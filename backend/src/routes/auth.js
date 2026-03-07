const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');


const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password richiesti' });
  }

  const user = db.prepare('SELECT * FROM utenti WHERE email = ? AND attivo = 1').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

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
      ruolo: user.ruolo
    }
  });
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
