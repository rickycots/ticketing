const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendAssistenzaEmail, sendTicketingEmail, wrapEmailTemplate, logoAttachment } = require('../services/mailer');
const { createFileFilter, validateUploadedFiles } = require('../middleware/uploadSecurity');

const router = express.Router();

// Multer setup for email attachments
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'tickets');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.xlsx', '.zip'];
const emailUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: createFileFilter(allowedExts),
}).array('allegati', 5);

// POST /api/emails/poll — trigger IMAP polling (admin only)
router.post('/poll', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { pollEmails } = require('../services/imapPoller');
    if (typeof pollEmails === 'function') await pollEmails();
  } catch (e) { console.error('[POLL] Error:', e.message); }
  res.json({ polled: true });
});

// GET /api/emails — list emails with filters (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const { tipo, letta, cliente_id, progetto_id, attivita_id, rilevanza, quick_filter, direzione } = req.query;
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
  if (direzione) {
    baseWhere += ' AND e.direzione = ?';
    baseParams.push(direzione);
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
    SELECT e.*, c.nome_azienda as cliente_nome, u.nome as inviata_da_nome
    FROM email e
    LEFT JOIN clienti c ON e.cliente_id = c.id
    LEFT JOIN utenti u ON e.inviata_da = u.id
  ` + where + ' ORDER BY e.data_ricezione DESC LIMIT ? OFFSET ?';

  const data = db.prepare(dataQuery).all(...params, limit, offset);
  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit), counts });
});

// GET /api/emails/:id — email detail (admin only)
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  const email = db.prepare(`
    SELECT e.*, c.nome_azienda as cliente_nome, a.nome as attivita_nome, u.nome as inviata_da_nome
    FROM email e
    LEFT JOIN clienti c ON e.cliente_id = c.id
    LEFT JOIN attivita a ON e.attivita_id = a.id
    LEFT JOIN utenti u ON e.inviata_da = u.id
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

// POST /api/emails — create email (admin + tecnico on assigned tickets)
router.post('/', authenticateToken, emailUpload, validateUploadedFiles, async (req, res) => {
  // Tecnico: can send on assigned tickets or on assigned projects
  if (req.user.ruolo === 'tecnico') {
    const ticketId = req.body.ticket_id ? parseInt(req.body.ticket_id) : null;
    const progettoId = req.body.progetto_id ? parseInt(req.body.progetto_id) : null;
    if (ticketId) {
      const ticket = db.prepare('SELECT assegnato_a FROM ticket WHERE id = ?').get(ticketId);
      if (!ticket || ticket.assegnato_a !== req.user.id) {
        return res.status(403).json({ error: 'Non sei assegnato a questo ticket' });
      }
    } else if (progettoId) {
      const pt = db.prepare('SELECT id FROM progetto_tecnici WHERE progetto_id = ? AND tecnico_id = ?').get(progettoId, req.user.id);
      if (!pt) return res.status(403).json({ error: 'Non sei assegnato a questo progetto' });
    } else {
      return res.status(403).json({ error: 'Tecnico deve specificare un ticket o progetto' });
    }
  }
  const { tipo, destinatario, oggetto, corpo, is_bloccante, thread_id } = req.body;
  // FormData sends everything as strings — parse numeric IDs
  const cliente_id = req.body.cliente_id ? parseInt(req.body.cliente_id) : null;
  const ticket_id = req.body.ticket_id ? parseInt(req.body.ticket_id) : null;
  const progetto_id = req.body.progetto_id ? parseInt(req.body.progetto_id) : null;
  const attivita_id = req.body.attivita_id ? parseInt(req.body.attivita_id) : null;

  const isTicketEmail = tipo === 'ticket' || !!ticket_id;
  const mittente = isTicketEmail
    ? (process.env.MAIL_TICKETING_USER || 'ticketing@stmdomotica.it')
    : (process.env.MAIL_ASSISTENZA_USER || 'assistenzatecnica@stmdomotica.it');

  if (!destinatario || !oggetto) {
    return res.status(400).json({ error: 'Campi obbligatori: destinatario, oggetto' });
  }

  // Build allegati JSON from uploaded files
  const allegati = (req.files || []).map(f => ({
    nome: f.originalname,
    file: f.filename,
    dimensione: f.size,
  }));

  // Find parent message_id for threading (In-Reply-To)
  let inReplyTo = null;
  if (thread_id) {
    const parent = db.prepare('SELECT message_id FROM email WHERE thread_id = ? AND message_id IS NOT NULL ORDER BY data_ricezione DESC LIMIT 1').get(thread_id);
    if (parent) inReplyTo = parent.message_id;
  }

  // Collect all recipients for ticket replies (everyone who interacted)
  let allDestinatari = destinatario;
  if (isTicketEmail && ticket_id) {
    const systemAddrs = [
      (process.env.MAIL_TICKETING_USER || 'ticketing@stmdomotica.it').toLowerCase(),
      (process.env.MAIL_ASSISTENZA_USER || 'assistenzatecnica@stmdomotica.it').toLowerCase(),
      (process.env.MAIL_NOREPLY_USER || 'noreply@stmdomotica.it').toLowerCase(),
    ];
    const ticket = db.prepare('SELECT creatore_email FROM ticket WHERE id = ?').get(ticket_id);
    const threadEmails = db.prepare('SELECT DISTINCT mittente FROM email WHERE ticket_id = ?').all(ticket_id);
    const addrs = new Set();
    if (ticket && ticket.creatore_email) addrs.add(ticket.creatore_email.toLowerCase());
    for (const row of threadEmails) {
      if (row.mittente) addrs.add(row.mittente.toLowerCase());
    }
    // Remove system addresses
    for (const sys of systemAddrs) addrs.delete(sys);
    if (addrs.size > 0) {
      allDestinatari = [...addrs].join(', ');
    }
  }

  // Send real email via SMTP (ticketing@ for ticket emails, assistenza@ for others)
  let sentMessageId = null;
  try {
    const htmlCorpo = (corpo || '').replace(/\n/g, '<br>');
    const portalUrl = process.env.BASE_URL || 'http://localhost:5173';

    // Build the email subject and body based on ticket reply or generic email
    let emailSubject = oggetto;
    let emailHtml;
    if (isTicketEmail && ticket_id) {
      const ticketInfo = db.prepare('SELECT codice FROM ticket WHERE id = ?').get(ticket_id);
      const codice = ticketInfo ? ticketInfo.codice : '';
      emailSubject = `[TICKET #${codice}] STM Domotica Reply`;
      emailHtml = wrapEmailTemplate(`<p>Segui la risposta al tuo ticket su: <a href="${portalUrl}/client/tickets">${portalUrl}/client/tickets</a></p>
<br>
<p><i>Ecco la risposta di STM Domotica:</i></p>
<div style="margin:12px 0;padding:12px;background:#f7f7f7;border-left:3px solid #0066cc;border-radius:4px">${htmlCorpo}</div>
<br><br>
<p>Puoi proseguire la discussione facendo reply a questa mail o dal portale.</p>`);
    } else {
      emailHtml = wrapEmailTemplate(`<div>${htmlCorpo}</div>`);
    }

    const sendFn = isTicketEmail ? sendTicketingEmail : sendAssistenzaEmail;
    const result = await sendFn(allDestinatari, emailSubject, emailHtml, inReplyTo);
    sentMessageId = result.messageId;
  } catch (err) {
    console.error('[MAIL] Errore invio:', err.message);
    // Continue — save to DB anyway
  }

  const result = db.prepare(`
    INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, attivita_id, is_bloccante, thread_id, message_id, allegati, direzione, inviata_da)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inviata', ?)
  `).run(
    tipo || 'altro',
    mittente,
    allDestinatari || destinatario,
    oggetto,
    corpo || '',
    cliente_id,
    ticket_id,
    progetto_id,
    attivita_id,
    is_bloccante ? 1 : 0,
    thread_id || null,
    sentMessageId,
    JSON.stringify(allegati),
    req.user.id
  );

  // Auto "in_lavorazione" when replying to a ticket that is "aperto"
  if (ticket_id) {
    const tk = db.prepare('SELECT stato FROM ticket WHERE id = ?').get(ticket_id);
    if (tk && tk.stato === 'aperto') {
      db.prepare("UPDATE ticket SET stato = 'in_lavorazione', updated_at = datetime('now') WHERE id = ?").run(ticket_id);
    }
  }

  // If marked as blocking and associated with a project, update the project
  if (is_bloccante && progetto_id) {
    db.prepare(`
      UPDATE progetti SET
        blocco = 'lato_cliente',
        email_bloccante_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(result.lastInsertRowid, progetto_id);
  }

  // If marked as blocking and associated with an activity, set activity to bloccata
  if (is_bloccante && attivita_id) {
    db.prepare("UPDATE attivita SET stato = 'bloccata' WHERE id = ?").run(attivita_id);
  }

  console.log(`[EMAIL] Da: ${mittente} A: ${destinatario} — ${oggetto}`);

  const email = db.prepare('SELECT * FROM email WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(email);
});

// PUT /api/emails/:id — update email (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { progetto_id, attivita_id, is_bloccante, letta, tipo, rilevanza, cliente_id, oggetto, corpo } = req.body;

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

  const newClienteId = cliente_id !== undefined ? cliente_id : email.cliente_id;

  db.prepare(`
    UPDATE email SET
      cliente_id = ?,
      progetto_id = ?,
      attivita_id = ?,
      is_bloccante = COALESCE(?, is_bloccante),
      letta = COALESCE(?, letta),
      tipo = COALESCE(?, tipo),
      rilevanza = ?,
      oggetto = COALESCE(?, oggetto),
      corpo = COALESCE(?, corpo)
    WHERE id = ?
  `).run(
    newClienteId,
    newProgettoId,
    newAttivitaId,
    is_bloccante !== undefined ? (is_bloccante ? 1 : 0) : null,
    letta !== undefined ? (letta ? 1 : 0) : null,
    tipo || null,
    newRilevanza,
    oggetto !== undefined ? oggetto : null,
    corpo !== undefined ? corpo : null,
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

// DELETE /api/emails/:id — delete email (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const email = db.prepare('SELECT id FROM email WHERE id = ?').get(req.params.id);
  if (!email) return res.status(404).json({ error: 'Email non trovata' });
  db.prepare('DELETE FROM email WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
