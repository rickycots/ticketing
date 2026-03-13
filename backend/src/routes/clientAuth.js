const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, requireAdmin, authenticateClientToken, JWT_SECRET } = require('../middleware/auth');
const { sendNoreplyEmail } = require('../services/mailer');

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

    // 2FA: generate code, send email, return pending
    if (user.two_factor) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      db.prepare('UPDATE utenti_cliente SET two_factor_code = ?, two_factor_expires = ?, two_factor_attempts = 0 WHERE id = ?')
        .run(code, expires, user.id);

      // Send email (async, don't block)
      sendNoreplyEmail(
        user.email,
        'Codice di verifica — STM Domotica',
        `<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;">
          <h2 style="color:#333;margin-bottom:10px;">Codice di Verifica</h2>
          <p style="color:#666;font-size:14px;">Inserisci questo codice per completare l'accesso:</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;">${code}</span>
          </div>
          <p style="color:#999;font-size:12px;">Il codice scade tra 10 minuti. Se non hai richiesto l'accesso, ignora questa email.</p>
        </div>`
      ).catch(err => console.error('2FA email error:', err));

      // Return a temporary token (short-lived, for 2FA verification only)
      const tempToken = jwt.sign(
        { id: user.id, tipo: '2fa_pending' },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({
        require_2fa: true,
        temp_token: tempToken,
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
          cambio_password: user.cambio_password || 0,
        },
      });
    }

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
        cambio_password: user.cambio_password || 0,
      },
    });
  }

  return res.status(401).json({ error: 'Credenziali non valide' });
});

// POST /api/client-auth/verify-2fa — verify 2FA code
router.post('/verify-2fa', (req, res) => {
  const { temp_token, code } = req.body;

  if (!temp_token || !code) {
    return res.status(400).json({ error: 'Token e codice sono obbligatori' });
  }

  // Verify temp token
  let decoded;
  try {
    decoded = jwt.verify(temp_token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Sessione scaduta. Effettua nuovamente il login.' });
  }

  if (decoded.tipo !== '2fa_pending') {
    return res.status(401).json({ error: 'Token non valido' });
  }

  const user = db.prepare(`
    SELECT uc.*, c.nome_azienda, c.logo
    FROM utenti_cliente uc
    JOIN clienti c ON uc.cliente_id = c.id
    WHERE uc.id = ?
  `).get(decoded.id);

  if (!user) return res.status(401).json({ error: 'Utente non trovato' });

  // Check attempts
  if (user.two_factor_attempts >= 3) {
    db.prepare('UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?')
      .run(user.id);
    return res.status(401).json({ error: 'Troppi tentativi errati. Effettua nuovamente il login.', locked: true });
  }

  // Check expiry
  if (!user.two_factor_code || !user.two_factor_expires || new Date(user.two_factor_expires) < new Date()) {
    return res.status(401).json({ error: 'Codice scaduto. Effettua nuovamente il login.', locked: true });
  }

  // Check code
  if (user.two_factor_code !== code.trim()) {
    const attempts = user.two_factor_attempts + 1;
    db.prepare('UPDATE utenti_cliente SET two_factor_attempts = ? WHERE id = ?').run(attempts, user.id);

    if (attempts >= 3) {
      db.prepare('UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?')
        .run(user.id);
      return res.status(401).json({ error: 'Troppi tentativi errati. Effettua nuovamente il login.', locked: true });
    }

    return res.status(400).json({
      error: 'Codice errato',
      remaining: 3 - attempts,
    });
  }

  // Code is correct — clear 2FA data, issue real token
  db.prepare('UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?')
    .run(user.id);

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

  res.json({ token });
});

// POST /api/client-auth/change-password — first login password change
router.post('/change-password', authenticateClientToken, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE utenti_cliente SET password_hash = ?, cambio_password = 0 WHERE id = ?').run(hash, req.user.id);

  // Update session data
  const updated = db.prepare('SELECT cambio_password FROM utenti_cliente WHERE id = ?').get(req.user.id);
  res.json({ success: true, cambio_password: updated.cambio_password });
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
  const cambio_pwd = req.body.cambio_password !== undefined ? req.body.cambio_password : 1;
  const two_fa = req.body.two_factor ? 1 : 0;
  const result = db.prepare(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili, lingua, cambio_password, two_factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.cliente_id, nome, email, password_hash, 'user', schede_visibili || 'ticket,progetti,ai', userLingua, cambio_pwd, two_fa);

  const user = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?'
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

  const cambio_pwd = req.body.cambio_password !== undefined ? req.body.cambio_password : null;
  const two_fa = req.body.two_factor !== undefined ? req.body.two_factor : null;
  db.prepare(`
    UPDATE utenti_cliente SET
      nome = COALESCE(?, nome),
      email = COALESCE(?, email),
      password_hash = ?,
      schede_visibili = COALESCE(?, schede_visibili),
      lingua = ?,
      attivo = COALESCE(?, attivo),
      cambio_password = COALESCE(?, cambio_password),
      two_factor = COALESCE(?, two_factor)
    WHERE id = ?
  `).run(nome || null, email || null, newHash, schede_visibili || null, newLingua, attivo !== undefined ? attivo : null, cambio_pwd, two_fa, req.params.userId);

  const updated = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?'
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
