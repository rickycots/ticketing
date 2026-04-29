const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { sendNoreplyEmail } = require('../services/mailer');

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

  const userData = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    ruolo: user.ruolo,
    cambio_password: user.cambio_password || 0,
    abilitato_ai: user.abilitato_ai ?? 0,
    gestione_avanzata: user.gestione_avanzata ?? 0,
  };

  // 2FA: generate code, send email, return pending
  if (user.two_factor) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare('UPDATE utenti SET two_factor_code = ?, two_factor_expires = ?, two_factor_attempts = 0 WHERE id = ?')
      .run(code, expires, user.id);

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

    const tempToken = jwt.sign(
      { id: user.id, tipo: '2fa_pending_admin' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({ require_2fa: true, temp_token: tempToken, user: userData });
  }

  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user: userData });
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', (req, res) => {
  const { temp_token, code } = req.body;
  if (!temp_token || !code) return res.status(400).json({ error: 'Token e codice sono obbligatori' });

  let decoded;
  try { decoded = jwt.verify(temp_token, JWT_SECRET); }
  catch (e) { return res.status(401).json({ error: 'Sessione scaduta. Effettua nuovamente il login.' }); }

  if (decoded.tipo !== '2fa_pending_admin') return res.status(401).json({ error: 'Token non valido' });

  const user = db.prepare('SELECT * FROM utenti WHERE id = ?').get(decoded.id);
  if (!user) return res.status(401).json({ error: 'Utente non trovato' });

  if (user.two_factor_attempts >= 3) {
    db.prepare('UPDATE utenti SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?').run(user.id);
    return res.status(401).json({ error: 'Troppi tentativi errati. Effettua nuovamente il login.', locked: true });
  }

  if (!user.two_factor_code || !user.two_factor_expires || new Date(user.two_factor_expires) < new Date()) {
    return res.status(401).json({ error: 'Codice scaduto. Effettua nuovamente il login.', locked: true });
  }

  if (user.two_factor_code !== code.trim()) {
    const attempts = user.two_factor_attempts + 1;
    db.prepare('UPDATE utenti SET two_factor_attempts = ? WHERE id = ?').run(attempts, user.id);
    if (attempts >= 3) {
      db.prepare('UPDATE utenti SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?').run(user.id);
      return res.status(401).json({ error: 'Troppi tentativi errati. Effettua nuovamente il login.', locked: true });
    }
    return res.status(400).json({ error: 'Codice errato', remaining: 3 - attempts });
  }

  db.prepare('UPDATE utenti SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?').run(user.id);

  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token });
});

// PUT /api/auth/change-password — change password (authenticated)
router.put('/change-password', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autenticato' });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token non valido' }); }

  const { password, oldPassword } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });

  if (oldPassword !== undefined) {
    const user = db.prepare('SELECT password_hash FROM utenti WHERE id = ?').get(decoded.id);
    if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Password attuale errata' });
    }
  }

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
