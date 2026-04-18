const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createFileFilter, validateUploadedFiles } = require('../middleware/uploadSecurity');
const { sendNoreplyEmail } = require('../services/mailer');

// Multer config for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `client_${req.params.id}_logo${ext}`);
  },
});
const allowedLogoExts = ['.jpg', '.jpeg', '.png'];
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: createFileFilter(allowedLogoExts),
});

const router = express.Router();

// Helper: generate unique portale_slug from company name
function generateSlug(nomeAzienda, excludeId = null) {
  const base = (nomeAzienda.split(/\s+/)[0] || 'client').toLowerCase().replace(/[^a-z0-9]/g, '');
  let slug = base;
  let suffix = 2;
  const query = excludeId
    ? 'SELECT id FROM clienti WHERE portale_slug = ? AND id != ?'
    : 'SELECT id FROM clienti WHERE portale_slug = ?';
  while (true) {
    const existing = excludeId
      ? db.prepare(query).get(slug, excludeId)
      : db.prepare(query).get(slug);
    if (!existing) break;
    slug = base + suffix;
    suffix++;
  }
  return slug;
}

// GET /api/clients — list all clients (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as total FROM clienti').get().total;

  const data = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM ticket t WHERE t.cliente_id = c.id) as num_ticket,
      (SELECT COUNT(*) FROM progetti p WHERE p.cliente_id = c.id) as num_progetti
    FROM clienti c
    ORDER BY c.nome_azienda ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// GET /api/clients/:id — client detail (admin only)
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);

  if (!client) {
    return res.status(404).json({ error: 'Cliente non trovato' });
  }

  res.json(client);
});

// POST /api/clients — create client (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, sla_reazione, servizio_ticket, servizio_progetti, servizio_ai } = req.body;

  if (!nome_azienda || !email) {
    return res.status(400).json({ error: 'Campi obbligatori: nome_azienda, email' });
  }

  const portale_slug = generateSlug(nome_azienda);
  const sla = ['1g', '3g', 'nb'].includes(sla_reazione) ? sla_reazione : 'nb';

  const result = db.prepare(`
    INSERT INTO clienti (nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug, sla_reazione, servizio_ticket, servizio_progetti, servizio_ai)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nome_azienda, referente || null, email, telefono || null, indirizzo || null, citta || null, provincia || null, note || null, portale_slug, sla, servizio_ticket ? 1 : 0, servizio_progetti ? 1 : 0, servizio_ai ? 1 : 0);

  const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(client);
});

// PUT /api/clients/:id — update client (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug, sla_reazione, servizio_ticket, servizio_progetti, servizio_ai, servizio_progetti_stm } = req.body;

  const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Cliente non trovato' });
  }

  // Validate slug uniqueness if changed
  const newSlug = portale_slug !== undefined ? portale_slug : client.portale_slug;
  if (newSlug && newSlug !== client.portale_slug) {
    const dup = db.prepare('SELECT id FROM clienti WHERE portale_slug = ? AND id != ?').get(newSlug, req.params.id);
    if (dup) {
      return res.status(400).json({ error: 'Slug già in uso da un altro cliente' });
    }
  }

  const sla = sla_reazione !== undefined
    ? (['1g', '3g', 'nb'].includes(sla_reazione) ? sla_reazione : client.sla_reazione)
    : client.sla_reazione;

  db.prepare(`
    UPDATE clienti SET
      nome_azienda = COALESCE(?, nome_azienda),
      referente = ?,
      email = COALESCE(?, email),
      telefono = ?,
      indirizzo = ?,
      citta = ?,
      provincia = ?,
      note = ?,
      portale_slug = ?,
      sla_reazione = ?,
      servizio_ticket = COALESCE(?, servizio_ticket),
      servizio_progetti = COALESCE(?, servizio_progetti),
      servizio_ai = COALESCE(?, servizio_ai),
      servizio_progetti_stm = COALESCE(?, servizio_progetti_stm)
    WHERE id = ?
  `).run(
    nome_azienda || null,
    referente !== undefined ? referente : client.referente,
    email || null,
    telefono !== undefined ? telefono : client.telefono,
    indirizzo !== undefined ? indirizzo : client.indirizzo,
    citta !== undefined ? citta : client.citta,
    provincia !== undefined ? provincia : client.provincia,
    note !== undefined ? note : client.note,
    newSlug || client.portale_slug,
    sla,
    servizio_ticket !== undefined ? (servizio_ticket ? 1 : 0) : null,
    servizio_progetti !== undefined ? (servizio_progetti ? 1 : 0) : null,
    servizio_ai !== undefined ? (servizio_ai ? 1 : 0) : null,
    servizio_progetti_stm !== undefined ? (servizio_progetti_stm ? 1 : 0) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/clients/:id — delete client and all related data (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const id = req.params.id;
  const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  const projects = db.prepare('SELECT id FROM progetti WHERE cliente_id = ?').all(id);
  for (const p of projects) {
    const acts = db.prepare('SELECT id FROM attivita WHERE progetto_id = ?').all(p.id);
    for (const a of acts) {
      try { db.prepare('DELETE FROM note_attivita WHERE attivita_id = ?').run(a.id); } catch(e) {}
      try { db.prepare('DELETE FROM allegati_attivita WHERE attivita_id = ?').run(a.id); } catch(e) {}
      try { db.prepare('DELETE FROM attivita_programmate WHERE attivita_id = ?').run(a.id); } catch(e) {}
    }
    try { db.prepare('DELETE FROM attivita WHERE progetto_id = ?').run(p.id); } catch(e) {}
    try { db.prepare('DELETE FROM progetto_tecnici WHERE progetto_id = ?').run(p.id); } catch(e) {}
    try { db.prepare('DELETE FROM progetto_referenti WHERE progetto_id = ?').run(p.id); } catch(e) {}
    try { db.prepare('DELETE FROM allegati_progetto WHERE progetto_id = ?').run(p.id); } catch(e) {}
    try { db.prepare('DELETE FROM messaggi_progetto WHERE progetto_id = ?').run(p.id); } catch(e) {}
    try { db.prepare('DELETE FROM chat_lettura WHERE progetto_id = ?').run(p.id); } catch(e) {}
  }
  try { db.prepare('DELETE FROM progetti WHERE cliente_id = ?').run(id); } catch(e) {}
  try { db.prepare("UPDATE email SET cliente_id = NULL, progetto_id = NULL, attivita_id = NULL WHERE cliente_id = ?").run(id); } catch(e) {}
  const tickets = db.prepare('SELECT id FROM ticket WHERE cliente_id = ?').all(id);
  for (const tk of tickets) {
    try { db.prepare('DELETE FROM email WHERE ticket_id = ?').run(tk.id); } catch(e) {}
    try { db.prepare('DELETE FROM note_interne WHERE ticket_id = ?').run(tk.id); } catch(e) {}
    try { db.prepare('DELETE FROM chat_ticket_interna WHERE ticket_id = ?').run(tk.id); } catch(e) {}
  }
  try { db.prepare('DELETE FROM ticket WHERE cliente_id = ?').run(id); } catch(e) {}
  try { db.prepare('DELETE FROM utenti_cliente WHERE cliente_id = ?').run(id); } catch(e) {}
  try { db.prepare('DELETE FROM referenti_progetto WHERE cliente_id = ?').run(id); } catch(e) {}
  try { db.prepare('DELETE FROM comunicazioni_cliente WHERE cliente_id = ?').run(id); } catch(e) {}
  try { db.prepare('DELETE FROM comunicazioni_lette WHERE cliente_id = ?').run(id); } catch(e) {}
  try { db.prepare('DELETE FROM schede_cliente WHERE cliente_id = ?').run(id); } catch(e) {}
  db.prepare('DELETE FROM clienti WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/clients/:id/logo — upload logo (admin only)
router.post('/:id/logo', authenticateToken, requireAdmin, (req, res) => {
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Errore upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Validate magic bytes
    const { validateMagicBytes } = require('../middleware/uploadSecurity');
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!validateMagicBytes(req.file.path, ext)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'Il contenuto del file non corrisponde all\'estensione dichiarata' });
    }

    const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

    // Remove old logo if it exists and has different extension
    if (client.logo && client.logo !== req.file.filename) {
      const oldPath = path.join(__dirname, '..', '..', 'uploads', 'logos', client.logo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    db.prepare('UPDATE clienti SET logo = ? WHERE id = ?').run(req.file.filename, req.params.id);
    const updated = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
    res.json(updated);
  });
});

// DELETE /api/clients/:id/logo — remove logo (admin only)
router.delete('/:id/logo', authenticateToken, requireAdmin, (req, res) => {
  const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  if (client.logo) {
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'logos', client.logo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('UPDATE clienti SET logo = NULL WHERE id = ?').run(req.params.id);
  }

  const updated = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// --- Client Users (utenti_cliente) CRUD ---

// GET /api/clients/:id/users — list client users
router.get('/:id/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, cliente_id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE cliente_id = ? ORDER BY nome'
  ).all(req.params.id);
  res.json(users);
});

// POST /api/clients/:id/users — create client user
router.post('/:id/users', authenticateToken, requireAdmin, (req, res) => {
  const { nome, email, password, ruolo, schede_visibili, lingua, cambio_password, two_factor } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Campi obbligatori: nome, email, password' });
  }

  const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email già in uso' });

  const userRuolo = ruolo === 'admin' ? 'admin' : 'user';
  const visibili = userRuolo === 'admin' ? 'ticket,progetti,ai' : (schede_visibili || 'ticket,progetti,ai');
  const userLingua = ['it', 'en', 'fr'].includes(lingua) ? lingua : 'it';
  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili, lingua, cambio_password, two_factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, nome, email, password_hash, userRuolo, visibili, userLingua, cambio_password !== undefined ? cambio_password : 1, two_factor ? 1 : 0);

  const user = db.prepare(
    'SELECT id, cliente_id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?'
  ).get(result.lastInsertRowid);

  // Send welcome email
  const loginUrl = `${process.env.FRONTEND_BASE_URL || 'https://www.stmdomotica.cloud/ticketing'}/client/login`;
  sendNoreplyEmail(
    email,
    'Benvenuto — STM Domotica Ticketing',
    `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#0d9488;margin:0;">STM Domotica</h2>
        <p style="color:#6b7280;font-size:13px;">Portale Assistenza Tecnica</p>
      </div>
      <p>Gentile <strong>${nome}</strong>,</p>
      <p>BENVENUTO! Ti è stato creato un account per utilizzare il servizio di ticketing di STM Domotica.</p>
      <p>Segui il link per accedere:</p>
      <p style="text-align:center;margin:20px 0;">
        <a href="${loginUrl}" style="background:#0d9488;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Accedi al Portale</a>
      </p>
      <p>Di seguito la tua password provvisoria:</p>
      <p style="text-align:center;margin:20px 0;">
        <span style="background:#f0f4f8;border:1px solid #d0d7de;border-radius:8px;padding:12px 24px;font-size:20px;font-weight:bold;letter-spacing:2px;display:inline-block;">${password}</span>
      </p>
      <p style="color:#6b7280;font-size:12px;">Ti consigliamo di cambiare la password al primo accesso.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="color:#9ca3af;font-size:11px;text-align:center;">STM Domotica Corporation S.r.l. — Questo messaggio è stato inviato automaticamente.</p>
    </div>`
  ).catch(err => console.error('Welcome email error:', err));

  res.status(201).json(user);
});

// PUT /api/clients/:id/users/:userId — update client user
router.put('/:id/users/:userId', authenticateToken, requireAdmin, (req, res) => {
  const { nome, email, password, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor } = req.body;
  const user = db.prepare('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ? AND id != ?').get(email, req.params.userId);
    if (existing) return res.status(400).json({ error: 'Email già in uso' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  const newRuolo = ruolo !== undefined ? (ruolo === 'admin' ? 'admin' : 'user') : user.ruolo;
  const newVisibili = newRuolo === 'admin' ? 'ticket,progetti,ai' : (schede_visibili || user.schede_visibili);
  const newLingua = lingua ? (['it', 'en', 'fr'].includes(lingua) ? lingua : user.lingua) : user.lingua;

  db.prepare(`
    UPDATE utenti_cliente SET
      nome = COALESCE(?, nome),
      email = COALESCE(?, email),
      password_hash = ?,
      ruolo = ?,
      schede_visibili = ?,
      lingua = ?,
      attivo = COALESCE(?, attivo),
      cambio_password = COALESCE(?, cambio_password),
      two_factor = COALESCE(?, two_factor)
    WHERE id = ?
  `).run(nome || null, email || null, newHash, newRuolo, newVisibili, newLingua, attivo !== undefined ? attivo : null, cambio_password !== undefined ? cambio_password : null, two_factor !== undefined ? two_factor : null, req.params.userId);

  const updated = db.prepare(
    'SELECT id, cliente_id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?'
  ).get(req.params.userId);
  res.json(updated);
});

// DELETE /api/clients/:id/users/:userId — delete client user
router.delete('/:id/users/:userId', authenticateToken, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  try { db.prepare('DELETE FROM comunicazioni_lette WHERE utente_cliente_id = ?').run(req.params.userId); } catch (e) {}
  db.prepare('DELETE FROM utenti_cliente WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

module.exports = router;
