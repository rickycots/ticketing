const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non configurato nel .env');
  process.exit(1);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token di autenticazione richiesto' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.ruolo !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  next();
}

function authenticateClientToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token di autenticazione richiesto' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.tipo !== 'cliente') {
      return res.status(403).json({ error: 'Token non valido per il portale cliente' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

module.exports = { authenticateToken, requireAdmin, authenticateClientToken, JWT_SECRET };
