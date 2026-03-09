const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, requireAdmin, authenticateClientToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/client-auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  const user = db.prepare(`
    SELECT uc.*, c.nome_azienda, c.logo
    FROM utenti_cliente uc
    JOIN clienti c ON uc.cliente_id = c.id
    WHERE uc.email = ?
  `).get(email);

  if (user && bcrypt.compareSync(password, user.password_hash)) {
    if (!user.attivo) {
      return res.status(403).json({ error: 'Account disabilitato' });
    }

    const userRuolo = user.ruolo || 'user';
    const visibili = userRuolo === 'admin' ? 'ticket,progetti,ai' : user.schede_visibili;

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cliente_id: user.cliente_id,
        ruolo: userRuolo,
        schede_visibili: visibili,
        tipo: 'cliente',
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cliente_id: user.cliente_id,
        nome_azienda: user.nome_azienda,
        logo: user.logo,
        ruolo: userRuolo,
        schede_visibili: visibili,
        lingua: user.lingua || 'it',
      },
    });
  }

  return res.status(401).json({ error: 'Credenziali non valide' });
});

// GET /api/client-auth/me
router.get('/me', authenticateClientToken, (req, res) => {
  // Handle impersonated admin users (id: 0)
  if (req.user.impersonated) {
    const cliente = db.prepare('SELECT id, nome_azienda, logo FROM clienti WHERE id = ?').get(req.user.cliente_id);
    if (!cliente) return res.status(401).json({ error: 'Cliente non trovato' });
    return res.json({
      id: 0,
      nome: req.user.nome,
      email: req.user.email,
      cliente_id: req.user.cliente_id,
      ruolo: 'admin',
      schede_visibili: req.user.schede_visibili,
      attivo: 1,
      nome_azienda: cliente.nome_azienda,
      logo: cliente.logo,
    });
  }

  const user = db.prepare(`
    SELECT uc.id, uc.nome, uc.email, uc.cliente_id, uc.ruolo, uc.schede_visibili, uc.lingua, uc.attivo,
           c.nome_azienda, c.logo
    FROM utenti_cliente uc
    JOIN clienti c ON uc.cliente_id = c.id
    WHERE uc.id = ?
  `).get(req.user.id);

  if (!user || !user.attivo) {
    return res.status(401).json({ error: 'Account non valido' });
  }

  res.json(user);
});

// POST /api/client-auth/impersonate/:clienteId — admin impersonates a client (full access)
router.post('/impersonate/:clienteId', authenticateToken, requireAdmin, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.clienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente non trovato' });

  const token = jwt.sign(
    {
      id: 0,
      nome: `Admin (${req.user.nome})`,
      email: req.user.email,
      cliente_id: cliente.id,
      schede_visibili: 'ticket,progetti,ai',
      tipo: 'cliente',
      impersonated: true,
    },
    JWT_SECRET,
    { expiresIn: '4h' }
  );

  res.json({
    token,
    user: {
      id: 0,
      nome: `Admin (${req.user.nome})`,
      email: req.user.email,
      cliente_id: cliente.id,
      nome_azienda: cliente.nome_azienda,
      logo: cliente.logo,
      schede_visibili: 'ticket,progetti,ai',
    },
  });
});

// GET /api/client-auth/comunicazioni — client communications
router.get('/comunicazioni', authenticateClientToken, (req, res) => {
  const comunicazioni = db.prepare(
    'SELECT * FROM comunicazioni_cliente WHERE cliente_id = ? ORDER BY data_ricezione DESC LIMIT 20'
  ).all(req.user.cliente_id);
  res.json(comunicazioni);
});

// --- Client Admin: manage portal users ---

function requireClientAdmin(req, res, next) {
  if (req.user.ruolo !== 'admin' && !req.user.impersonated) {
    return res.status(403).json({ error: 'Accesso riservato agli admin' });
  }
  next();
}

// GET /api/client-auth/portal-users — list users of same company
router.get('/portal-users', authenticateClientToken, requireClientAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at FROM utenti_cliente WHERE cliente_id = ? ORDER BY nome'
  ).all(req.user.cliente_id);
  res.json(users);
});

// POST /api/client-auth/portal-users — create user (only 'user' role)
router.post('/portal-users', authenticateClientToken, requireClientAdmin, (req, res) => {
  const { nome, email, password, schede_visibili, lingua } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Campi obbligatori: nome, email, password' });
  }

  const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email già in uso' });

  const userLingua = ['it', 'en', 'fr'].includes(lingua) ? lingua : 'it';
  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili, lingua) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.cliente_id, nome, email, password_hash, 'user', schede_visibili || 'ticket,progetti,ai', userLingua);

  const user = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at FROM utenti_cliente WHERE id = ?'
  ).get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/client-auth/portal-users/:userId — update user (admin can edit users of same company)
router.put('/portal-users/:userId', authenticateClientToken, requireClientAdmin, (req, res) => {
  const { nome, email, password, schede_visibili, lingua, attivo } = req.body;
  const user = db.prepare('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.user.cliente_id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  if (user.ruolo === 'admin') return res.status(403).json({ error: 'Non puoi modificare un altro admin' });

  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ? AND id != ?').get(email, req.params.userId);
    if (existing) return res.status(400).json({ error: 'Email già in uso' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  const newLingua = lingua ? (['it', 'en', 'fr'].includes(lingua) ? lingua : user.lingua) : user.lingua;

  db.prepare(`
    UPDATE utenti_cliente SET
      nome = COALESCE(?, nome),
      email = COALESCE(?, email),
      password_hash = ?,
      schede_visibili = COALESCE(?, schede_visibili),
      lingua = ?,
      attivo = COALESCE(?, attivo)
    WHERE id = ?
  `).run(nome || null, email || null, newHash, schede_visibili || null, newLingua, attivo !== undefined ? attivo : null, req.params.userId);

  const updated = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at FROM utenti_cliente WHERE id = ?'
  ).get(req.params.userId);
  res.json(updated);
});

// DELETE /api/client-auth/portal-users/:userId — delete user
router.delete('/portal-users/:userId', authenticateClientToken, requireClientAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.user.cliente_id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  if (user.ruolo === 'admin') return res.status(403).json({ error: 'Non puoi eliminare un admin' });

  db.prepare('DELETE FROM utenti_cliente WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

module.exports = router;
