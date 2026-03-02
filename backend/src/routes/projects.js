const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireAdmin, authenticateClientToken } = require('../middleware/auth');

const router = express.Router();

// Helper: get tecnici IDs for a project
function getProjectTecnici(progettoId) {
  return db.prepare('SELECT utente_id FROM progetto_tecnici WHERE progetto_id = ?').all(progettoId).map(r => r.utente_id);
}

// Helper: set tecnici for a project (replace all)
function setProjectTecnici(progettoId, tecnicoIds) {
  db.prepare('DELETE FROM progetto_tecnici WHERE progetto_id = ?').run(progettoId);
  const insert = db.prepare('INSERT INTO progetto_tecnici (progetto_id, utente_id) VALUES (?, ?)');
  for (const uid of tecnicoIds) {
    insert.run(progettoId, uid);
  }
}

// Helper: count unread chat messages for a user in a project
function chatNonLette(progettoId, utenteId) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM messaggi_progetto
    WHERE progetto_id = ?
      AND utente_id != ?
      AND created_at > COALESCE(
        (SELECT ultimo_letto_at FROM chat_lettura WHERE utente_id = ? AND progetto_id = ?),
        '1970-01-01'
      )
  `).get(progettoId, utenteId, utenteId, progettoId);
  return row ? row.cnt : 0;
}

// GET /api/projects — list projects (admin: all, tecnico: only visible)
router.get('/', authenticateToken, (req, res) => {
  const { cliente_id, stato } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;
  const isTecnico = req.user.ruolo === 'tecnico';

  let from = ' FROM progetti p LEFT JOIN clienti c ON p.cliente_id = c.id';
  const params = [];

  if (isTecnico) {
    from += ' INNER JOIN progetto_tecnici pt ON pt.progetto_id = p.id AND pt.utente_id = ?';
    params.push(req.user.id);
  }

  let where = ' WHERE 1=1';

  if (cliente_id) {
    where += ' AND p.cliente_id = ?';
    params.push(cliente_id);
  }
  if (stato) {
    where += ' AND p.stato = ?';
    params.push(stato);
  }

  const countQuery = 'SELECT COUNT(DISTINCT p.id) as total' + from + where;
  const total = db.prepare(countQuery).get(...params).total;

  const dataQuery = 'SELECT DISTINCT p.*, c.nome_azienda as cliente_nome' + from + where + ' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?';
  const projects = db.prepare(dataQuery).all(...params, limit, offset);

  const data = projects.map(p => {
    const activities = db.prepare(
      'SELECT avanzamento FROM attivita WHERE progetto_id = ?'
    ).all(p.id);

    const avanzamento = activities.length > 0
      ? Math.round(activities.reduce((sum, a) => sum + a.avanzamento, 0) / activities.length)
      : 0;

    return {
      ...p,
      avanzamento,
      num_attivita: activities.length,
      tecnici: getProjectTecnici(p.id),
      chat_non_lette: chatNonLette(p.id, req.user.id),
    };
  });

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// GET /api/projects/chat-unread — unread chat summary for sidebar notifications
router.get('/chat-unread', authenticateToken, (req, res) => {
  const isTecnico = req.user.ruolo === 'tecnico';

  let query = 'SELECT p.id, p.nome FROM progetti p';
  const params = [];

  if (isTecnico) {
    query += ' INNER JOIN progetto_tecnici pt ON pt.progetto_id = p.id AND pt.utente_id = ?';
    params.push(req.user.id);
  }

  const projs = db.prepare(query).all(...params);

  const result = projs
    .map(p => ({ ...p, non_lette: chatNonLette(p.id, req.user.id) }))
    .filter(p => p.non_lette > 0);

  res.json(result);
});

// GET /api/projects/client/:clienteId — projects for client portal (client auth)
router.get('/client/:clienteId', authenticateClientToken, (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }
  const projects = db.prepare(`
    SELECT p.id, p.nome, p.stato, p.blocco, p.data_scadenza, p.updated_at, p.email_bloccante_id
    FROM progetti p
    WHERE p.cliente_id = ? AND p.stato != 'annullato'
    ORDER BY p.updated_at DESC
  `).all(req.params.clienteId);

  const result = projects.map(p => {
    const activities = db.prepare(
      'SELECT avanzamento FROM attivita WHERE progetto_id = ?'
    ).all(p.id);

    const avanzamento = activities.length > 0
      ? Math.round(activities.reduce((sum, a) => sum + a.avanzamento, 0) / activities.length)
      : 0;

    let emailBloccante = null;
    if (p.blocco === 'lato_cliente' && p.email_bloccante_id) {
      emailBloccante = db.prepare(
        'SELECT oggetto, corpo, data_ricezione FROM email WHERE id = ?'
      ).get(p.email_bloccante_id);
    }

    return {
      ...p,
      avanzamento,
      email_bloccante_oggetto: emailBloccante ? emailBloccante.oggetto : null,
      email_bloccante_corpo: emailBloccante ? emailBloccante.corpo : null,
      email_bloccante_data: emailBloccante ? emailBloccante.data_ricezione : null,
    };
  });

  res.json(result);
});

// GET /api/projects/client/:clienteId/:projectId — project detail for client portal (read-only)
router.get('/client/:clienteId/:projectId', authenticateClientToken, (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }

  const project = db.prepare(`
    SELECT p.id, p.nome, p.stato, p.blocco, p.data_inizio, p.data_scadenza, p.updated_at, p.email_bloccante_id
    FROM progetti p
    WHERE p.id = ? AND p.cliente_id = ? AND p.stato != 'annullato'
  `).get(req.params.projectId, req.params.clienteId);

  if (!project) {
    return res.status(404).json({ error: 'Progetto non trovato' });
  }

  const attivita = db.prepare(`
    SELECT a.id, a.nome, a.stato, a.avanzamento, a.priorita, a.data_inizio, a.data_scadenza,
      a.ordine, a.dipende_da, a.data_completamento
    FROM attivita a
    WHERE a.progetto_id = ?
    ORDER BY a.ordine ASC,
      CASE a.priorita WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'bassa' THEN 3 END,
      a.created_at ASC
  `).all(project.id);

  const avanzamento = attivita.length > 0
    ? Math.round(attivita.reduce((sum, a) => sum + a.avanzamento, 0) / attivita.length)
    : 0;

  let emailBloccante = null;
  if (project.blocco === 'lato_cliente' && project.email_bloccante_id) {
    emailBloccante = db.prepare(
      'SELECT oggetto, corpo, data_ricezione FROM email WHERE id = ?'
    ).get(project.email_bloccante_id);
  }

  res.json({
    ...project,
    avanzamento,
    attivita,
    email_bloccante_oggetto: emailBloccante ? emailBloccante.oggetto : null,
    email_bloccante_corpo: emailBloccante ? emailBloccante.corpo : null,
    email_bloccante_data: emailBloccante ? emailBloccante.data_ricezione : null,
  });
});

// GET /api/projects/:id — project detail (admin: any, tecnico: only visible)
router.get('/:id', authenticateToken, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, c.nome_azienda as cliente_nome, c.email as cliente_email,
      c.telefono as cliente_telefono, c.referente as cliente_referente
    FROM progetti p
    LEFT JOIN clienti c ON p.cliente_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Progetto non trovato' });
  }

  // Tecnico can only see projects they're assigned to
  if (req.user.ruolo === 'tecnico') {
    const visible = db.prepare('SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?').get(req.params.id, req.user.id);
    if (!visible) return res.status(403).json({ error: 'Accesso non consentito' });
  }

  const attivitaRaw = db.prepare(`
    SELECT a.*, u.nome as assegnato_nome
    FROM attivita a
    LEFT JOIN utenti u ON a.assegnato_a = u.id
    WHERE a.progetto_id = ?
    ORDER BY a.ordine ASC,
      CASE a.priorita WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'bassa' THEN 3 END,
      a.created_at ASC
  `).all(project.id);

  // Include notes and blocking email info for each activity
  const attivita = attivitaRaw.map(a => {
    const note_attivita = db.prepare(`
      SELECT n.*, u.nome as utente_nome
      FROM note_attivita n
      LEFT JOIN utenti u ON n.utente_id = u.id
      WHERE n.attivita_id = ?
      ORDER BY n.created_at ASC
    `).all(a.id);
    const emailBloccante = db.prepare(
      'SELECT id, oggetto FROM email WHERE attivita_id = ? AND is_bloccante = 1'
    ).get(a.id);
    return { ...a, note_attivita, email_bloccante: emailBloccante || null };
  });

  const avanzamento = attivita.length > 0
    ? Math.round(attivita.reduce((sum, a) => sum + a.avanzamento, 0) / attivita.length)
    : 0;

  const emails = db.prepare(`
    SELECT e.*, a.nome as attivita_nome,
      CASE WHEN e.thread_id IS NOT NULL
        THEN (SELECT COUNT(*) FROM email e2 WHERE e2.thread_id = e.thread_id)
        ELSE 0
      END as thread_count
    FROM email e
    LEFT JOIN attivita a ON e.attivita_id = a.id
    WHERE e.progetto_id = ?
    ORDER BY e.data_ricezione DESC
  `).all(project.id);

  const note = db.prepare(`
    SELECT n.*, u.nome as utente_nome
    FROM note_interne n
    LEFT JOIN utenti u ON n.utente_id = u.id
    WHERE n.progetto_id = ?
    ORDER BY n.created_at ASC
  `).all(project.id);

  const chat = db.prepare(`
    SELECT m.*, u.nome as utente_nome, u.ruolo as utente_ruolo
    FROM messaggi_progetto m
    LEFT JOIN utenti u ON m.utente_id = u.id
    WHERE m.progetto_id = ?
    ORDER BY m.created_at ASC
  `).all(project.id);

  const tecnici = getProjectTecnici(project.id);

  // Mark chat as read for this user
  db.prepare(`
    INSERT INTO chat_lettura (utente_id, progetto_id, ultimo_letto_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(utente_id, progetto_id)
    DO UPDATE SET ultimo_letto_at = datetime('now')
  `).run(req.user.id, project.id);

  res.json({ ...project, avanzamento, attivita, emails, note, chat, tecnici });
});

// POST /api/projects/:id/chat — send chat message
router.post('/:id/chat', authenticateToken, (req, res) => {
  const { testo } = req.body;
  if (!testo || !testo.trim()) {
    return res.status(400).json({ error: 'Il testo del messaggio è obbligatorio' });
  }

  const project = db.prepare('SELECT id FROM progetti WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Progetto non trovato' });
  }

  // Check access: admin always, tecnico only if assigned
  if (req.user.ruolo === 'tecnico') {
    const visible = db.prepare('SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?').get(req.params.id, req.user.id);
    if (!visible) return res.status(403).json({ error: 'Accesso non consentito' });
  }

  const result = db.prepare(`
    INSERT INTO messaggi_progetto (progetto_id, utente_id, testo)
    VALUES (?, ?, ?)
  `).run(req.params.id, req.user.id, testo.trim());

  // Auto-mark as read for sender
  db.prepare(`
    INSERT INTO chat_lettura (utente_id, progetto_id, ultimo_letto_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(utente_id, progetto_id)
    DO UPDATE SET ultimo_letto_at = datetime('now')
  `).run(req.user.id, req.params.id);

  const msg = db.prepare(`
    SELECT m.*, u.nome as utente_nome, u.ruolo as utente_ruolo
    FROM messaggi_progetto m
    LEFT JOIN utenti u ON m.utente_id = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(msg);
});

// POST /api/projects — create project (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { cliente_id, nome, descrizione, data_inizio, data_scadenza, stato, tecnici } = req.body;

  if (!cliente_id || !nome) {
    return res.status(400).json({ error: 'Campi obbligatori: cliente_id, nome' });
  }

  const result = db.prepare(`
    INSERT INTO progetti (cliente_id, nome, descrizione, data_inizio, data_scadenza, stato)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cliente_id, nome, descrizione || null, data_inizio || null, data_scadenza || null, stato || 'attivo');

  if (tecnici && Array.isArray(tecnici) && tecnici.length > 0) {
    setProjectTecnici(result.lastInsertRowid, tecnici);
  }

  const project = db.prepare('SELECT * FROM progetti WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...project, tecnici: getProjectTecnici(project.id) });
});

// PUT /api/projects/:id — update project (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { nome, descrizione, stato, blocco, email_bloccante_id, data_scadenza, tecnici } = req.body;
  const project = db.prepare('SELECT * FROM progetti WHERE id = ?').get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Progetto non trovato' });
  }

  db.prepare(`
    UPDATE progetti SET
      nome = COALESCE(?, nome),
      descrizione = ?,
      stato = COALESCE(?, stato),
      blocco = COALESCE(?, blocco),
      email_bloccante_id = ?,
      data_scadenza = COALESCE(?, data_scadenza),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nome || null,
    descrizione !== undefined ? descrizione : project.descrizione,
    stato || null,
    blocco || null,
    email_bloccante_id !== undefined ? email_bloccante_id : project.email_bloccante_id,
    data_scadenza || null,
    req.params.id
  );

  if (tecnici !== undefined && Array.isArray(tecnici)) {
    setProjectTecnici(req.params.id, tecnici);
  }

  const updated = db.prepare(`
    SELECT p.*, c.nome_azienda as cliente_nome
    FROM progetti p
    LEFT JOIN clienti c ON p.cliente_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  res.json({ ...updated, tecnici: getProjectTecnici(req.params.id) });
});

module.exports = router;
