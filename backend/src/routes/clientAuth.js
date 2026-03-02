const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, requireAdmin, authenticateClientToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// GET /api/client-auth/info/:slug — public, no auth
router.get('/info/:slug', (req, res) => {
  const client = db.prepare(
    'SELECT id, nome_azienda, logo FROM clienti WHERE portale_slug = ?'
  ).get(req.params.slug);

  if (!client) {
    return res.status(404).json({ error: 'Portale non trovato' });
  }

  res.json(client);
});

// POST /api/client-auth/login
router.post('/login', (req, res) => {
  const { email, password, slug } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  // 1. Try client user (utenti_cliente)
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

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cliente_id: user.cliente_id,
        schede_visibili: user.schede_visibili,
        tipo: 'cliente',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
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
        schede_visibili: user.schede_visibili,
      },
    });
  }

  // 2. Try admin user (utenti) — needs slug to identify the client
  if (slug) {
    const adminUser = db.prepare('SELECT * FROM utenti WHERE email = ?').get(email);
    if (adminUser && bcrypt.compareSync(password, adminUser.password_hash) && adminUser.ruolo === 'admin') {
      const cliente = db.prepare('SELECT * FROM clienti WHERE portale_slug = ?').get(slug);
      if (!cliente) {
        return res.status(404).json({ error: 'Portale non trovato' });
      }

      const token = jwt.sign(
        {
          id: 0,
          nome: `Admin (${adminUser.nome})`,
          email: adminUser.email,
          cliente_id: cliente.id,
          schede_visibili: 'ticket,progetti',
          tipo: 'cliente',
          impersonated: true,
        },
        JWT_SECRET,
        { expiresIn: '4h' }
      );

      return res.json({
        token,
        user: {
          id: 0,
          nome: `Admin (${adminUser.nome})`,
          email: adminUser.email,
          cliente_id: cliente.id,
          nome_azienda: cliente.nome_azienda,
          logo: cliente.logo,
          schede_visibili: 'ticket,progetti',
        },
      });
    }
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
      schede_visibili: req.user.schede_visibili,
      attivo: 1,
      nome_azienda: cliente.nome_azienda,
      logo: cliente.logo,
    });
  }

  const user = db.prepare(`
    SELECT uc.id, uc.nome, uc.email, uc.cliente_id, uc.schede_visibili, uc.attivo,
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
      schede_visibili: 'ticket,progetti',
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
      schede_visibili: 'ticket,progetti',
    },
    slug: cliente.portale_slug,
  });
});

module.exports = router;
