const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo file JPG e PNG sono consentiti'));
  },
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
  const { nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note } = req.body;

  if (!nome_azienda || !email) {
    return res.status(400).json({ error: 'Campi obbligatori: nome_azienda, email' });
  }

  const portale_slug = generateSlug(nome_azienda);

  const result = db.prepare(`
    INSERT INTO clienti (nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nome_azienda, referente || null, email, telefono || null, indirizzo || null, citta || null, provincia || null, note || null, portale_slug);

  const client = db.prepare('SELECT * FROM clienti WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(client);
});

// PUT /api/clients/:id — update client (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug } = req.body;

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
      portale_slug = ?
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
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.id);
  res.json(updated);
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
    'SELECT id, cliente_id, nome, email, schede_visibili, attivo, created_at FROM utenti_cliente WHERE cliente_id = ? ORDER BY nome'
  ).all(req.params.id);
  res.json(users);
});

// POST /api/clients/:id/users — create client user
router.post('/:id/users', authenticateToken, requireAdmin, (req, res) => {
  const { nome, email, password, schede_visibili } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Campi obbligatori: nome, email, password' });
  }

  const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email già in uso' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, schede_visibili) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, nome, email, password_hash, schede_visibili || 'ticket,progetti');

  const user = db.prepare(
    'SELECT id, cliente_id, nome, email, schede_visibili, attivo, created_at FROM utenti_cliente WHERE id = ?'
  ).get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/clients/:id/users/:userId — update client user
router.put('/:id/users/:userId', authenticateToken, requireAdmin, (req, res) => {
  const { nome, email, password, schede_visibili, attivo } = req.body;
  const user = db.prepare('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ? AND id != ?').get(email, req.params.userId);
    if (existing) return res.status(400).json({ error: 'Email già in uso' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare(`
    UPDATE utenti_cliente SET
      nome = COALESCE(?, nome),
      email = COALESCE(?, email),
      password_hash = ?,
      schede_visibili = COALESCE(?, schede_visibili),
      attivo = COALESCE(?, attivo)
    WHERE id = ?
  `).run(nome || null, email || null, newHash, schede_visibili || null, attivo !== undefined ? attivo : null, req.params.userId);

  const updated = db.prepare(
    'SELECT id, cliente_id, nome, email, schede_visibili, attivo, created_at FROM utenti_cliente WHERE id = ?'
  ).get(req.params.userId);
  res.json(updated);
});

// DELETE /api/clients/:id/users/:userId — delete client user
router.delete('/:id/users/:userId', authenticateToken, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  db.prepare('DELETE FROM utenti_cliente WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

module.exports = router;
