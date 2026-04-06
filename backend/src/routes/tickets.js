const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, authenticateClientToken } = require('../middleware/auth');
const { sendTicketingEmail, sendNoreplyEmail, wrapEmailTemplate } = require('../services/mailer');
const { createFileFilter, validateUploadedFiles } = require('../middleware/uploadSecurity');

const router = express.Router();

// Multer setup for ticket attachments
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'tickets');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.xlsx', '.zip'];
const ticketUpload = multer({
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

function createNotifica(utenteId, tipo, titolo, messaggio, link) {
  if (!utenteId) return;
  db.prepare('INSERT INTO notifiche (utente_id, tipo, titolo, messaggio, link) VALUES (?, ?, ?, ?, ?)')
    .run(utenteId, tipo, titolo, messaggio || '', link || '');
}

function generateTicketCode() {
  const year = new Date().getFullYear();
  const lastTicket = db.prepare(
    "SELECT codice FROM ticket WHERE codice LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`TK-${year}-%`);
  let nextNum = 1;
  if (lastTicket) nextNum = parseInt(lastTicket.codice.split('-')[2], 10) + 1;
  return `TK-${year}-${String(nextNum).padStart(4, '0')}`;
}

// Helper: fetch ticket with client info + emails (no internal notes)
function getTicketWithEmails(ticketId) {
  const ticket = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email
    FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id
    WHERE t.id = ?
  `).get(ticketId);
  if (!ticket) return null;
  ticket.emails = db.prepare(
    'SELECT * FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC'
  ).all(ticketId);
  return ticket;
}

// GET /api/tickets — list (admin, auth) — tecnico sees only assigned tickets
router.get('/', authenticateToken, (req, res) => {
  const { stato, priorita, cliente_id, assegnato_a, search, anno } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;

  let where = ' WHERE 1=1';
  const params = [];
  if (req.user.ruolo === 'tecnico') { where += ' AND t.assegnato_a = ?'; params.push(req.user.id); }
  if (anno) { where += " AND strftime('%Y', t.created_at) = ?"; params.push(String(anno)); }
  if (stato) {
    const stati = stato.split(',').filter(Boolean);
    if (stati.length === 1) { where += ' AND t.stato = ?'; params.push(stati[0]); }
    else if (stati.length > 1) { where += ` AND t.stato IN (${stati.map(() => '?').join(',')})`; params.push(...stati); }
  }
  if (priorita) { where += ' AND t.priorita = ?'; params.push(priorita); }
  if (cliente_id) { where += ' AND t.cliente_id = ?'; params.push(cliente_id); }
  if (assegnato_a) { where += ' AND t.assegnato_a = ?'; params.push(assegnato_a); }
  if (search) { where += ' AND (t.oggetto LIKE ? OR t.codice LIKE ? OR t.descrizione LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const countQuery = `SELECT COUNT(*) as total FROM ticket t` + where;
  const total = db.prepare(countQuery).get(...params).total;

  // Counts per stato (for the year/filters, ignoring stato filter)
  let statoCounts = {};
  const baseWhere = where.replace(/ AND t\.stato = \?/, '');
  const baseParams = stato ? params.filter((_, i) => i !== params.indexOf(stato)) : [...params];
  // Simpler: recompute without stato
  let whereNoStato = ' WHERE 1=1';
  const paramsNoStato = [];
  if (req.user.ruolo === 'tecnico') { whereNoStato += ' AND t.assegnato_a = ?'; paramsNoStato.push(req.user.id); }
  if (anno) { whereNoStato += " AND strftime('%Y', t.created_at) = ?"; paramsNoStato.push(String(anno)); }
  if (priorita) { whereNoStato += ' AND t.priorita = ?'; paramsNoStato.push(priorita); }
  if (cliente_id) { whereNoStato += ' AND t.cliente_id = ?'; paramsNoStato.push(cliente_id); }
  if (assegnato_a) { whereNoStato += ' AND t.assegnato_a = ?'; paramsNoStato.push(assegnato_a); }
  if (search) { whereNoStato += ' AND (t.oggetto LIKE ? OR t.codice LIKE ? OR t.descrizione LIKE ?)'; paramsNoStato.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const statoRows = db.prepare(`SELECT t.stato, COUNT(*) as cnt FROM ticket t${whereNoStato} GROUP BY t.stato`).all(...paramsNoStato);
  for (const r of statoRows) statoCounts[r.stato] = r.cnt;
  const totalAll = statoRows.reduce((s, r) => s + r.cnt, 0);

  const dataQuery = `
    SELECT t.*, c.nome_azienda as cliente_nome, c.sla_reazione, u.nome as assegnato_nome
    FROM ticket t
    LEFT JOIN clienti c ON t.cliente_id = c.id
    LEFT JOIN utenti u ON t.assegnato_a = u.id
  ` + where + ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';

  const data = db.prepare(dataQuery).all(...params, limit, offset);
  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit), statoCounts, totalAll });
});

// GET /api/tickets/client/:clienteId — list (client auth)
router.get('/client/:clienteId', authenticateClientToken, (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }
  const userEmail = req.user.email;
  const tickets = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome FROM ticket t
    LEFT JOIN clienti c ON t.cliente_id = c.id WHERE t.cliente_id = ? AND (t.privato = 0 OR t.creatore_email = ?)
    ORDER BY CASE t.stato WHEN 'in_attesa' THEN 0 WHEN 'aperto' THEN 1 WHEN 'in_lavorazione' THEN 2 WHEN 'risolto' THEN 3 ELSE 4 END, t.updated_at DESC
  `).all(req.params.clienteId, userEmail);
  // Add participant count + message count + unread per ticket
  for (const tk of tickets) {
    const cnt = db.prepare("SELECT COUNT(DISTINCT mittente) as cnt FROM email WHERE ticket_id = ? AND mittente NOT IN ('ticketing@stmdomotica.it','assistenzatecnica@stmdomotica.it','noreply@stmdomotica.it','admin@ticketing.local')").get(tk.id);
    tk.partecipanti_count = cnt ? cnt.cnt : 0;
    const msgCnt = db.prepare('SELECT COUNT(*) as cnt FROM email WHERE ticket_id = ?').get(tk.id);
    tk.messaggi_count = msgCnt ? msgCnt.cnt : 0;
    const unread = db.prepare("SELECT COUNT(*) as cnt FROM email WHERE ticket_id = ? AND letta = 0 AND direzione = 'inviata'").get(tk.id);
    tk.has_unread = unread ? unread.cnt > 0 : false;
  }
  res.json(tickets);
});

// GET /api/tickets/client/:clienteId/:ticketId — detail (client auth, no notes)
router.get('/client/:clienteId/:ticketId', authenticateClientToken, (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }
  const ticket = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email
    FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id
    WHERE t.id = ? AND t.cliente_id = ? AND (t.privato = 0 OR t.creatore_email = ?)
  `).get(req.params.ticketId, req.params.clienteId, req.user.email);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });
  // Mark admin replies as read when client opens ticket
  db.prepare("UPDATE email SET letta = 1 WHERE ticket_id = ? AND letta = 0 AND direzione = 'inviata'").run(ticket.id);
  ticket.emails = db.prepare('SELECT * FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC').all(ticket.id);
  res.json(ticket);
});

// PUT /api/tickets/client/:clienteId/:ticketId/close — client closes ticket
router.put('/client/:clienteId/:ticketId/close', authenticateClientToken, (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }
  const ticket = db.prepare('SELECT * FROM ticket WHERE id = ? AND cliente_id = ?').get(req.params.ticketId, req.params.clienteId);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });
  if (ticket.stato === 'chiuso') return res.status(400).json({ error: 'Ticket già chiuso' });

  db.prepare("UPDATE ticket SET stato = 'chiuso', updated_at = datetime('now') WHERE id = ?").run(ticket.id);
  res.json(getTicketWithEmails(ticket.id));
});

// POST /api/tickets/client/:clienteId/:ticketId/reply — client reply (client auth)
router.post('/client/:clienteId/:ticketId/reply', authenticateClientToken, async (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }
  const { corpo } = req.body;
  if (!corpo || !corpo.trim()) return res.status(400).json({ error: 'Il corpo del messaggio è obbligatorio' });

  const ticket = db.prepare(
    'SELECT t.*, c.email as cliente_email FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id WHERE t.id = ? AND t.cliente_id = ?'
  ).get(req.params.ticketId, req.params.clienteId);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

  const threadId = `thread-${ticket.codice}`;
  const oggetto = `Re: [TICKET #${ticket.codice}] ${ticket.oggetto}`;
  const ticketingAddr = process.env.MAIL_TICKETING_USER || 'ticketing@stmdomotica.it';
  const mittenteReale = req.user.email || ticket.cliente_email || 'unknown@client.com';
  db.prepare(`INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id) VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?)`)
    .run(mittenteReale, ticketingAddr, oggetto, corpo.trim(), req.params.clienteId, ticket.id, threadId);

  if (ticket.stato === 'in_attesa') {
    db.prepare("UPDATE ticket SET stato = 'in_lavorazione', updated_at = datetime('now') WHERE id = ?").run(ticket.id);
  } else if (ticket.stato === 'risolto' || ticket.stato === 'chiuso') {
    // Reopen: clear data_evasione (it's the resolution date, not a target)
    db.prepare("UPDATE ticket SET stato = 'aperto', data_evasione = NULL, updated_at = datetime('now') WHERE id = ?").run(ticket.id);
  }

  // Notification: client replied — notify assigned technician (or all admins if reopened)
  if (ticket.assegnato_a) {
    const isReopen = ticket.stato === 'risolto' || ticket.stato === 'chiuso';
    createNotifica(
      ticket.assegnato_a,
      isReopen ? 'ticket_riaperto' : 'ticket_risposta',
      isReopen ? `Ticket riaperto: ${ticket.codice}` : `Risposta cliente: ${ticket.codice}`,
      isReopen
        ? `Il cliente ha riaperto il ticket "${ticket.oggetto}"`
        : `Il cliente ha risposto al ticket "${ticket.oggetto}"`,
      `/admin/tickets/${ticket.id}`
    );
  }

  // Send email to all participants (other clients + admin/tecnici)
  try {
    const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local'];
    const allEmails = db.prepare('SELECT DISTINCT mittente, destinatario FROM email WHERE ticket_id = ?').all(ticket.id);
    const addrs = {};
    allEmails.forEach(row => {
      if (row.destinatario) row.destinatario.split(',').forEach(a => { addrs[a.trim().toLowerCase()] = true });
      if (row.mittente) addrs[row.mittente.toLowerCase()] = true;
    });
    // Add assigned technician + all admins
    if (ticket.assegnato_a) {
      const tecnico = db.prepare('SELECT email FROM utenti WHERE id = ?').get(ticket.assegnato_a);
      if (tecnico && tecnico.email) addrs[tecnico.email.toLowerCase()] = true;
    }
    const admins = db.prepare("SELECT email FROM utenti WHERE ruolo = 'admin' AND attivo = 1").all();
    admins.forEach(a => { if (a.email) addrs[a.email.toLowerCase()] = true });
    // Remove system addresses and the sender
    systemAddrs.forEach(s => delete addrs[s]);
    delete addrs[mittenteReale.toLowerCase()];

    const destinatari = Object.keys(addrs).join(', ');
    if (destinatari) {
      const htmlCorpo = corpo.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      const emailHtml = wrapEmailTemplate(`<p>Segui la risposta al tuo ticket su: <a href="https://www.stmdomotica.cloud/ticketing/client/tickets">portale</a></p>
<br><p><i>Un tuo collega ha aggiornato il ticket, ecco il messaggio:</i></p>
<div style="margin:12px 0;padding:12px;background:#f7f7f7;border-left:3px solid #e6a700;border-radius:4px">${htmlCorpo}</div>
<p style="font-size:12px;color:#888;margin-top:8px">Mittente: ${mittenteReale}</p>
<br><br><p>Puoi proseguire la discussione facendo reply a questa mail o dal portale.</p>`);
      await sendTicketingEmail(destinatari, `Re: [TICKET #${ticket.codice}] ${ticket.oggetto}`, emailHtml);
    }
  } catch (err) {
    console.error('[MAIL] Errore invio notifica partecipanti:', err.message);
  }

  console.log(`[EMAIL] Risposta cliente: ${oggetto}`);
  res.json(getTicketWithEmails(ticket.id));
});

// GET /api/tickets/client/:clienteId/:ticketId/chat — list internal chat
router.get('/client/:clienteId/:ticketId/chat', authenticateClientToken, (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) return res.status(403).json({ error: 'Accesso non consentito' });
  const msgs = db.prepare('SELECT * FROM chat_ticket_interna WHERE ticket_id = ? ORDER BY created_at ASC').all(req.params.ticketId);
  res.json(msgs);
});

// POST /api/tickets/client/:clienteId/:ticketId/chat — send internal chat message
router.post('/client/:clienteId/:ticketId/chat', authenticateClientToken, async (req, res) => {
  if (req.user.cliente_id !== parseInt(req.params.clienteId)) return res.status(403).json({ error: 'Accesso non consentito' });
  const { messaggio } = req.body;
  if (!messaggio || !messaggio.trim()) return res.status(400).json({ error: 'Messaggio obbligatorio' });

  const ticket = db.prepare('SELECT t.*, c.email as cliente_email FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id WHERE t.id = ? AND t.cliente_id = ?')
    .get(req.params.ticketId, req.params.clienteId);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

  db.prepare('INSERT INTO chat_ticket_interna (ticket_id, utente_id, utente_nome, utente_email, messaggio) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.ticketId, req.user.id, req.user.nome, req.user.email, messaggio.trim());

  // Notify other client participants (noreply, NOT saved in thread)
  try {
    const senderEmail = (req.user.email || '').toLowerCase();
    const chatUsers = db.prepare('SELECT DISTINCT utente_email FROM chat_ticket_interna WHERE ticket_id = ? AND LOWER(utente_email) != ?')
      .all(req.params.ticketId, senderEmail);
    const addrs = {};
    chatUsers.forEach(cu => { if (cu.utente_email) addrs[cu.utente_email.toLowerCase()] = true });
    if (ticket.creatore_email && ticket.creatore_email.toLowerCase() !== senderEmail) addrs[ticket.creatore_email.toLowerCase()] = true;
    const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local'];
    systemAddrs.forEach(s => delete addrs[s]);

    const destinatari = Object.keys(addrs).join(', ');
    if (destinatari) {
      const htmlMsg = messaggio.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      const emailHtml = wrapEmailTemplate(`<p><i>Un tuo collega ha aggiornato la chat del ticket <b>${ticket.codice}</b>:</i></p>
<div style="margin:12px 0;padding:12px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:4px">${htmlMsg}</div>
<p style="font-size:12px;color:#888;margin-top:8px">Mittente: ${senderEmail}</p>
<br><p><b>Per rispondere alla chat vai sul portale.</b></p>`);
      await sendNoreplyEmail(destinatari, `[TICKET #${ticket.codice}] Chat interna aggiornata`, emailHtml);
    }
  } catch (err) {
    console.error('[MAIL] Errore invio chat interna:', err.message);
  }

  const msgs = db.prepare('SELECT * FROM chat_ticket_interna WHERE ticket_id = ? ORDER BY created_at ASC').all(req.params.ticketId);
  res.json(msgs);
});

// GET /api/tickets/:id — detail (admin, auth)
router.get('/:id', authenticateToken, (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email,
      c.telefono as cliente_telefono, c.referente as cliente_referente,
      u.nome as assegnato_nome
    FROM ticket t
    LEFT JOIN clienti c ON t.cliente_id = c.id
    LEFT JOIN utenti u ON t.assegnato_a = u.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

  // IDOR protection: tecnico can only see tickets assigned to them
  if (req.user.ruolo === 'tecnico' && ticket.assegnato_a !== req.user.id) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }

  // Mark as read
  if (!ticket.letta) {
    db.prepare('UPDATE ticket SET letta = 1 WHERE id = ?').run(req.params.id);
    ticket.letta = 1;
  }

  ticket.emails = db.prepare('SELECT * FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC').all(ticket.id);
  ticket.note = db.prepare(`
    SELECT n.*, u.nome as utente_nome FROM note_interne n
    LEFT JOIN utenti u ON n.utente_id = u.id WHERE n.ticket_id = ? ORDER BY n.created_at ASC
  `).all(ticket.id);
  // Count KB cards for this client
  ticket.schede_count = db.prepare('SELECT COUNT(*) as c FROM schede_cliente WHERE cliente_id = ?').get(ticket.cliente_id).c;
  res.json(ticket);
});

// POST /api/tickets — create (client auth, with optional attachments)
router.post('/', authenticateClientToken, ticketUpload, validateUploadedFiles, async (req, res) => {
  const { oggetto, descrizione, categoria, priorita } = req.body;
  const cliente_id = req.user.cliente_id;
  if (!oggetto || !categoria) {
    return res.status(400).json({ error: 'Campi obbligatori: oggetto, categoria' });
  }

  const codice = generateTicketCode();
  const prio = priorita || 'media';
  const admin = db.prepare("SELECT id FROM utenti WHERE ruolo='admin' AND attivo=1 LIMIT 1").get();
  const assegnato_a = admin ? admin.id : null;
  const creatore_email = req.user.email || null;

  // Calculate data_evasione based on client SLA
  const clienteRow = db.prepare('SELECT sla_reazione FROM clienti WHERE id = ?').get(cliente_id);
  let data_evasione = null;
  if (clienteRow && clienteRow.sla_reazione && clienteRow.sla_reazione !== 'nb') {
    const now = new Date();
    const days = clienteRow.sla_reazione === '1g' ? 1 : 3;
    now.setDate(now.getDate() + days);
    data_evasione = now.toISOString().slice(0, 10);
  }

  const privato = req.body.privato ? 1 : 0;
  const result = db.prepare(`INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, assegnato_a, creatore_email, data_evasione, privato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(codice, cliente_id, oggetto, descrizione || '', categoria, prio, assegnato_a, creatore_email, data_evasione, privato);

  // Build allegati JSON from uploaded files
  const allegati = (req.files || []).map(f => ({
    nome: f.originalname,
    file: f.filename,
    dimensione: f.size,
  }));

  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(cliente_id);
  const catLabel = { assistenza: 'Assistenza', bug: 'Bug', richiesta_info: 'Richiesta Info', altro: 'Altro' };
  const emailOggetto = `[TICKET #${codice}] [${catLabel[categoria] || categoria}] ${oggetto} — Cliente: ${cliente ? cliente.nome_azienda : 'N/A'}`;
  const emailCorpo = descrizione || '';

  const ticketingAddr = process.env.MAIL_TICKETING_USER || 'ticketing@stmdomotica.it';

  // Send confirmation email to the user who created the ticket (creatore_email)
  let sentMessageId = null;
  const destinatarioConferma = creatore_email || (cliente && cliente.email);
  if (destinatarioConferma) {
    try {
      // Detect client language
      const utenteCliente = db.prepare('SELECT lingua FROM utenti_cliente WHERE email = ?').get(creatore_email);
      const lingua = (utenteCliente && utenteCliente.lingua) || 'it';

      const ticketBox = `<div style="background:#f0f4f8;border:1px solid #d0d7de;border-radius:8px;padding:16px;margin:16px 0">
<p style="font-size:12px;color:#666;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">${lingua === 'en' ? 'Your message' : lingua === 'fr' ? 'Votre message' : 'Il tuo messaggio'}</p>
<p style="font-size:13px;color:#333;margin:0;white-space:pre-wrap">${(descrizione || oggetto).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
</div>`;

      const itBlock = `<p>Gentile cliente,</p>
<p>abbiamo ricevuto il suo ticket <b>${codice}</b>.</p>
${lingua === 'it' ? ticketBox : ''}
<p>I nostri tecnici lo elaboreranno appena possibile nel rispetto dei tempi previsti dal suo contratto.</p>
<p>Riceverà risposta sul nostro portale e direttamente nella sua mail.</p>
<p>Distinti Saluti.</p>`;

      const enBlock = `<p>Dear customer,</p>
<p>we have received your ticket <b>${codice}</b>.</p>
${lingua === 'en' ? ticketBox : ''}
<p>Our technicians will process it as soon as possible in accordance with the terms of your contract.</p>
<p>You will receive a response on our portal and directly in your email.</p>
<p>Best regards.</p>`;

      const frBlock = `<p>Cher client,</p>
<p>nous avons bien reçu votre ticket <b>${codice}</b>.</p>
${lingua === 'fr' ? ticketBox : ''}
<p>Nos techniciens le traiteront dans les meilleurs délais, conformément aux conditions de votre contrat.</p>
<p>Vous recevrez une réponse sur notre portail et directement par e-mail.</p>
<p>Cordialement.</p>`;

      let primaryBlock, secondaryBlock;
      if (lingua === 'en') {
        primaryBlock = enBlock;
        secondaryBlock = `<div style="color:#888">${itBlock}</div>`;
      } else if (lingua === 'fr') {
        primaryBlock = frBlock;
        secondaryBlock = `<div style="color:#888">${itBlock}</div>`;
      } else {
        primaryBlock = itBlock;
        secondaryBlock = `<div style="color:#888">${enBlock}</div>`;
      }

      const confermaOggetto = `[TICKET #${codice}] ${lingua === 'en' ? 'Confirmation of receipt' : lingua === 'fr' ? 'Confirmation de réception' : 'Conferma ricezione'}`;
      const confermaHtml = wrapEmailTemplate(`${primaryBlock}
<hr style="margin:20px 0;border:none;border-top:1px solid #ccc">
${secondaryBlock}`);
      const r = await sendNoreplyEmail(destinatarioConferma, confermaOggetto, confermaHtml);
      sentMessageId = r.messageId;
    } catch (err) {
      console.error('[MAIL] Errore invio conferma ticket:', err.message);
    }
  }

  db.prepare(`INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id, message_id, allegati) VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(creatore_email || (cliente ? cliente.email : 'unknown@client.com'), ticketingAddr, emailOggetto, emailCorpo, cliente_id, result.lastInsertRowid, `thread-${codice}`, sentMessageId, JSON.stringify(allegati));
  console.log(`[EMAIL] Nuovo ticket: ${emailOggetto}`);

  res.status(201).json(db.prepare('SELECT * FROM ticket WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/tickets/:id — update (admin, auth)
router.put('/:id', authenticateToken, (req, res) => {
  const { stato, priorita, assegnato_a, progetto_id } = req.body;
  const ticket = db.prepare('SELECT * FROM ticket WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

  // Only client can close tickets — admin/tecnico cannot set "chiuso"
  if (stato === 'chiuso') {
    return res.status(403).json({ error: 'Solo il cliente può chiudere un ticket' });
  }

  // Auto "in_lavorazione" when assigning a technician (if ticket is still "aperto")
  let effectiveStato = stato || null;
  if (!stato && assegnato_a !== undefined && assegnato_a !== null && ticket.stato === 'aperto') {
    effectiveStato = 'in_lavorazione';
  }

  db.prepare(`UPDATE ticket SET stato = COALESCE(?, stato), priorita = COALESCE(?, priorita), assegnato_a = COALESCE(?, assegnato_a), progetto_id = COALESCE(?, progetto_id), updated_at = datetime('now') WHERE id = ?`)
    .run(effectiveStato, priorita || null, assegnato_a !== undefined ? assegnato_a : null, progetto_id !== undefined ? progetto_id : null, req.params.id);

  // Set data_evasione when resolved (if not already set)
  if (stato === 'risolto' && !ticket.data_evasione) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare('UPDATE ticket SET data_evasione = ? WHERE id = ?').run(today, req.params.id);
  }

  // Clear data_evasione when reopened
  if (stato === 'aperto' && (ticket.stato === 'risolto' || ticket.stato === 'chiuso')) {
    db.prepare('UPDATE ticket SET data_evasione = NULL WHERE id = ?').run(req.params.id);
  }

  // Notification: assignment changed
  if (assegnato_a !== undefined && assegnato_a !== null && assegnato_a !== ticket.assegnato_a) {
    createNotifica(
      assegnato_a,
      'ticket_assegnato',
      `Ticket assegnato: ${ticket.codice}`,
      `Ti e' stato assegnato il ticket "${ticket.oggetto}"`,
      `/admin/tickets/${ticket.id}`
    );
  }

  // Notification: status changed — notify assigned technician
  if (stato && stato !== ticket.stato && ticket.assegnato_a) {
    const targetUser = (assegnato_a !== undefined && assegnato_a !== null) ? assegnato_a : ticket.assegnato_a;
    // Don't double-notify if assignment + status changed to same user
    if (!(assegnato_a !== undefined && assegnato_a !== null && assegnato_a !== ticket.assegnato_a && targetUser === assegnato_a)) {
      createNotifica(
        targetUser,
        'ticket_stato',
        `Stato ticket aggiornato: ${ticket.codice}`,
        `Lo stato del ticket "${ticket.oggetto}" e' cambiato in "${stato}"`,
        `/admin/tickets/${ticket.id}`
      );
    }
  }

  res.json(db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome, u.nome as assegnato_nome
    FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id LEFT JOIN utenti u ON t.assegnato_a = u.id WHERE t.id = ?
  `).get(req.params.id));
});

// POST /api/tickets/:id/notes — create internal note (auth)
router.post('/:id/notes', authenticateToken, (req, res) => {
  const { testo, salva_in_kb } = req.body;
  if (!testo || !testo.trim()) return res.status(400).json({ error: 'Il testo della nota è obbligatorio' });

  const ticket = db.prepare('SELECT id, assegnato_a, cliente_id, codice, oggetto FROM ticket WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

  // IDOR protection: tecnico can only add notes to assigned tickets
  if (req.user.ruolo === 'tecnico' && ticket.assegnato_a !== req.user.id) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }

  const result = db.prepare(
    'INSERT INTO note_interne (ticket_id, utente_id, testo) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, testo.trim());

  // Auto "in_lavorazione" when adding a note to an "aperto" ticket
  const ticketFull = db.prepare('SELECT stato FROM ticket WHERE id = ?').get(req.params.id);
  if (ticketFull && ticketFull.stato === 'aperto') {
    db.prepare("UPDATE ticket SET stato = 'in_lavorazione', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  }

  // Save to KB if flag is set
  if (salva_in_kb && ticket.cliente_id) {
    const titolo = `Nota ${ticket.codice} — ${ticket.oggetto}`;
    db.prepare(
      'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)'
    ).run(ticket.cliente_id, titolo, testo.trim());
  }

  const note = db.prepare(`
    SELECT n.*, u.nome as utente_nome FROM note_interne n
    LEFT JOIN utenti u ON n.utente_id = u.id WHERE n.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(note);
});

module.exports = router;
