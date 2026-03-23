const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — list active users (admin-only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, nome, email, ruolo, attivo, abilitato_ai, gestione_avanzata, created_at FROM utenti ORDER BY ruolo, nome'
  ).all();
  res.json(users);
});

// POST /api/users — create technician (admin-only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { nome, email, password, cambio_password, abilitato_ai, gestione_avanzata } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Campi obbligatori: nome, email, password' });
  }

  const existing = db.prepare('SELECT id FROM utenti WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'Email già in uso' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO utenti (nome, email, password_hash, ruolo, attivo, cambio_password, abilitato_ai, gestione_avanzata) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
  ).run(nome, email, password_hash, 'tecnico', cambio_password ? 1 : 0, abilitato_ai ? 1 : 0, gestione_avanzata ? 1 : 0);

  const user = db.prepare('SELECT id, nome, email, ruolo, attivo, cambio_password, abilitato_ai, gestione_avanzata, created_at FROM utenti WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id — update user (admin-only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { nome, email, password, attivo, abilitato_ai, gestione_avanzata } = req.body;
  const user = db.prepare('SELECT * FROM utenti WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM utenti WHERE email = ? AND id != ?').get(email, req.params.id);
    if (existing) return res.status(400).json({ error: 'Email già in uso' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare(
    'UPDATE utenti SET nome = COALESCE(?, nome), email = COALESCE(?, email), password_hash = ?, attivo = COALESCE(?, attivo), abilitato_ai = COALESCE(?, abilitato_ai), gestione_avanzata = COALESCE(?, gestione_avanzata) WHERE id = ?'
  ).run(nome || null, email || null, newHash, attivo !== undefined ? attivo : null, abilitato_ai !== undefined ? (abilitato_ai ? 1 : 0) : null, gestione_avanzata !== undefined ? (gestione_avanzata ? 1 : 0) : null, req.params.id);

  const updated = db.prepare('SELECT id, nome, email, ruolo, attivo, cambio_password, abilitato_ai, gestione_avanzata, created_at FROM utenti WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/users/:id — delete user (admin-only, cannot delete self or other admins)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM utenti WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  if (user.ruolo === 'admin') return res.status(403).json({ error: 'Non puoi eliminare un admin' });

  db.prepare('DELETE FROM utenti WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/users/audit-log — view audit log (admin-only)
router.get('/audit-log', authenticateToken, requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const logs = db.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
  res.json(logs);
});

module.exports = router;
