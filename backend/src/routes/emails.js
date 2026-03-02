const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/emails — list emails with filters (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const { tipo, letta, cliente_id, progetto_id, attivita_id, rilevanza, quick_filter } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;

  // Base filters (dropdown filters)
  let baseWhere = " WHERE e.tipo != 'ticket'";
  const baseParams = [];

  if (tipo) {
    baseWhere += ' AND e.tipo = ?';
    baseParams.push(tipo);
  }
  if (letta !== undefined && !quick_filter) {
    baseWhere += ' AND e.letta = ?';
    baseParams.push(parseInt(letta));
  }
  if (cliente_id) {
    baseWhere += ' AND e.cliente_id = ?';
    baseParams.push(cliente_id);
  }
  if (progetto_id) {
    baseWhere += ' AND e.progetto_id = ?';
    baseParams.push(progetto_id);
  }
  if (attivita_id) {
    baseWhere += ' AND e.attivita_id = ?';
    baseParams.push(attivita_id);
  }
  if (rilevanza && !quick_filter) {
    baseWhere += ' AND e.rilevanza = ?';
    baseParams.push(rilevanza);
  }

  // Compute quick-filter counts (scoped to base filters)
  const counts = {
    tutte: db.prepare('SELECT COUNT(*) as c FROM email e' + baseWhere).get(...baseParams).c,
    da_leggere: db.prepare('SELECT COUNT(*) as c FROM email e' + baseWhere + ' AND e.letta = 0').get(...baseParams).c,
    non_assegnate: db.prepare('SELECT COUNT(*) as c FROM email e' + baseWhere + ' AND e.progetto_id IS NULL AND e.attivita_id IS NULL').get(...baseParams).c,
    bloccanti: db.prepare('SELECT COUNT(*) as c FROM email e' + baseWhere + ' AND e.is_bloccante = 1').get(...baseParams).c,
    rilevanti: db.prepare("SELECT COUNT(*) as c FROM email e" + baseWhere + " AND e.rilevanza = 'rilevante'").get(...baseParams).c,
  };

  // Apply quick filter
  let where = baseWhere;
  const params = [...baseParams];
  if (quick_filter === 'da_leggere') {
    where += ' AND e.letta = 0';
  } else if (quick_filter === 'non_assegnate') {
    where += ' AND e.progetto_id IS NULL AND e.attivita_id IS NULL';
  } else if (quick_filter === 'bloccanti') {
    where += ' AND e.is_bloccante = 1';
  } else if (quick_filter === 'rilevanti') {
    where += " AND e.rilevanza = 'rilevante'";
  }

  const countQuery = 'SELECT COUNT(*) as total FROM email e' + where;
  const total = db.prepare(countQuery).get(...params).total;

  const dataQuery = `
    SELECT e.*, c.nome_azienda as cliente_nome
    FROM email e
    LEFT JOIN clienti c ON e.cliente_id = c.id
  ` + where + ' ORDER BY e.data_ricezione DESC LIMIT ? OFFSET ?';

  const data = db.prepare(dataQuery).all(...params, limit, offset);
  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit), counts });
});

// GET /api/emails/:id — email detail (admin only)
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  const email = db.prepare(`
    SELECT e.*, c.nome_azienda as cliente_nome, a.nome as attivita_nome
    FROM email e
    LEFT JOIN clienti c ON e.cliente_id = c.id
    LEFT JOIN attivita a ON e.attivita_id = a.id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!email) {
    return res.status(404).json({ error: 'Email non trovata' });
  }

  // Mark as read
  if (!email.letta) {
    db.prepare('UPDATE email SET letta = 1 WHERE id = ?').run(req.params.id);
    email.letta = 1;
  }

  // Get thread emails if thread_id exists
  let thread = [];
  if (email.thread_id) {
    thread = db.prepare(
      'SELECT * FROM email WHERE thread_id = ? ORDER BY data_ricezione ASC'
    ).all(email.thread_id);
  }

  res.json({ ...email, thread });
});

// POST /api/emails — create simulated email (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, attivita_id, is_bloccante, thread_id } = req.body;

  if (!mittente || !destinatario || !oggetto) {
    return res.status(400).json({ error: 'Campi obbligatori: mittente, destinatario, oggetto' });
  }

  const result = db.prepare(`
    INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, attivita_id, is_bloccante, thread_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tipo || 'altro',
    mittente,
    destinatario,
    oggetto,
    corpo || '',
    cliente_id || null,
    ticket_id || null,
    progetto_id || null,
    attivita_id || null,
    is_bloccante ? 1 : 0,
    thread_id || null
  );

  // If marked as blocking and associated with a project, update the project
  if (is_bloccante && progetto_id) {
    db.prepare(`
      UPDATE progetti SET
        blocco = 'lato_cliente',
        email_bloccante_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(result.lastInsertRowid, progetto_id);
    console.log(`[EMAIL SIMULATA] Email bloccante associata al progetto #${progetto_id}`);
  }

  // If marked as blocking and associated with an activity, set activity to bloccata
  if (is_bloccante && attivita_id) {
    db.prepare("UPDATE attivita SET stato = 'bloccata' WHERE id = ?").run(attivita_id);
    console.log(`[EMAIL SIMULATA] Email bloccante → attività #${attivita_id} bloccata`);
  }

  console.log(`[EMAIL SIMULATA] Da: ${mittente} A: ${destinatario} — ${oggetto}`);

  const email = db.prepare('SELECT * FROM email WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(email);
});

// PUT /api/emails/:id — update email (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { progetto_id, attivita_id, is_bloccante, letta, tipo, rilevanza } = req.body;

  const email = db.prepare('SELECT * FROM email WHERE id = ?').get(req.params.id);
  if (!email) {
    return res.status(404).json({ error: 'Email non trovata' });
  }

  // If project changes, reset attivita_id (activity belongs to old project)
  const newProgettoId = progetto_id !== undefined ? progetto_id : email.progetto_id;
  let newAttivitaId;
  if (attivita_id !== undefined) {
    newAttivitaId = attivita_id;
  } else if (progetto_id !== undefined && progetto_id !== email.progetto_id) {
    newAttivitaId = null; // project changed, clear activity
  } else {
    newAttivitaId = email.attivita_id;
  }

  // Build rilevanza value: if explicitly passed (including null), use it; otherwise keep current
  const newRilevanza = rilevanza !== undefined ? (rilevanza || null) : email.rilevanza;

  db.prepare(`
    UPDATE email SET
      progetto_id = ?,
      attivita_id = ?,
      is_bloccante = COALESCE(?, is_bloccante),
      letta = COALESCE(?, letta),
      tipo = COALESCE(?, tipo),
      rilevanza = ?
    WHERE id = ?
  `).run(
    newProgettoId,
    newAttivitaId,
    is_bloccante !== undefined ? (is_bloccante ? 1 : 0) : null,
    letta !== undefined ? (letta ? 1 : 0) : null,
    tipo || null,
    newRilevanza,
    req.params.id
  );

  // Handle blocking logic — project
  if (is_bloccante && newProgettoId) {
    db.prepare(`
      UPDATE progetti SET
        blocco = 'lato_cliente',
        email_bloccante_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id, newProgettoId);
  } else if (is_bloccante === false && email.is_bloccante) {
    // Unblock project if this was the blocking email
    db.prepare(`
      UPDATE progetti SET
        blocco = 'nessuno',
        email_bloccante_id = NULL,
        updated_at = datetime('now')
      WHERE email_bloccante_id = ?
    `).run(req.params.id);
  }

  // Handle blocking logic — activity
  const finalBloccante = is_bloccante !== undefined ? is_bloccante : !!email.is_bloccante;
  if (finalBloccante && newAttivitaId) {
    db.prepare("UPDATE attivita SET stato = 'bloccata' WHERE id = ?").run(newAttivitaId);
  } else if (is_bloccante === false && email.is_bloccante && email.attivita_id) {
    // Unblock old activity — revert to in_corso
    db.prepare("UPDATE attivita SET stato = 'in_corso' WHERE id = ? AND stato = 'bloccata'").run(email.attivita_id);
  }

  const updated = db.prepare(`
    SELECT e.*, c.nome_azienda as cliente_nome
    FROM email e
    LEFT JOIN clienti c ON e.cliente_id = c.id
    WHERE e.id = ?
  `).get(req.params.id);

  res.json(updated);
});

module.exports = router;
