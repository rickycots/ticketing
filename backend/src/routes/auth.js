const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Login attempt tracking (in-memory, per IP — resets on server restart)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 200 * 1000; // ~3 minutes

function checkLoginLockout(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.attempts >= MAX_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const record = loginAttempts.get(ip) || { attempts: 0, lastAttempt: 0 };
  record.attempts++;
  record.lastAttempt = Date.now();
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password richiesti' });
  }

  // Progressive lockout check
  if (checkLoginLockout(ip)) {
    return res.status(429).json({ error: 'Troppi tentativi di login. Riprova tra 15 minuti.' });
  }

  const user = db.prepare('SELECT * FROM utenti WHERE email = ? AND attivo = 1').get(email);

  if (!user) {
    recordFailedLogin(ip);
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    recordFailedLogin(ip);
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  // Success — clear lockout
  clearLoginAttempts(ip);

  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      ruolo: user.ruolo,
      cambio_password: user.cambio_password || 0,
      abilitato_ai: user.abilitato_ai ?? 0,
      gestione_avanzata: user.gestione_avanzata ?? 0
    }
  });
});

// PUT /api/auth/change-password — change password (authenticated)
router.put('/change-password', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autenticato' });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token non valido' }); }

  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE utenti SET password_hash = ?, cambio_password = 0 WHERE id = ?').run(hash, decoded.id);
  res.json({ success: true });
});

// GET /api/auth/me — verify token AND check user still active in DB
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, nome, email, ruolo, attivo FROM utenti WHERE id = ?').get(decoded.id);
    if (!user || !user.attivo) {
      return res.status(401).json({ error: 'Account disabilitato o non trovato' });
    }
    res.json({ user: { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo } });
  } catch {
    res.status(401).json({ error: 'Token non valido o scaduto' });
  }
});

module.exports = router;
