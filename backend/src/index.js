require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { globalLimiter, loginLimiter, aiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com data:; frame-ancestors 'none'");
  next();
});

// Global rate limit — 100 req/min per IP
app.use('/api/', globalLimiter);

// Static files for uploads (logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes — with specific rate limits on sensitive endpoints
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/client-auth', require('./routes/clientAuth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Activity routes are nested under projects
const activitiesRouter = require('./routes/activities');
app.use('/api/projects/:id/activities', activitiesRouter);

// All activities endpoint (admin: all, tecnico: only assigned projects)
const db = require('./db/database');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
app.get('/api/activities/all', authenticateToken, (req, res) => {
  let acts;
  if (req.user.ruolo === 'admin') {
    acts = db.prepare(`
      SELECT a.*, u.nome as assegnato_nome, u.ruolo as assegnato_ruolo, p.nome as progetto_nome, p.id as progetto_id, c.nome_azienda as cliente_nome
      FROM attivita a
      JOIN progetti p ON a.progetto_id = p.id
      LEFT JOIN clienti c ON p.cliente_id = c.id
      LEFT JOIN utenti u ON a.assegnato_a = u.id
      ORDER BY a.created_at DESC
    `).all();
  } else {
    acts = db.prepare(`
      SELECT a.*, u.nome as assegnato_nome, u.ruolo as assegnato_ruolo, p.nome as progetto_nome, p.id as progetto_id, c.nome_azienda as cliente_nome
      FROM attivita a
      JOIN progetti p ON a.progetto_id = p.id
      LEFT JOIN clienti c ON p.cliente_id = c.id
      LEFT JOIN utenti u ON a.assegnato_a = u.id
      INNER JOIN progetto_tecnici pt ON pt.progetto_id = p.id AND pt.utente_id = ?
      ORDER BY a.created_at DESC
    `).all(req.user.id);
  }
  res.json(acts);
});

// Knowledge Base routes (nested under clients)
app.use('/api/clients/:clienteId/schede', require('./routes/knowledgeBase'));

// Repository routes
app.use('/api/repository', require('./routes/repository'));

// Referenti esterni + Anagrafica (unified routes mounted at /api)
app.use('/api', require('./routes/referentiEsterni'));

// AI routes — stricter rate limit
app.use('/api/ai', aiLimiter, require('./routes/ai'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n=== Ticketing Backend API ===`);
  console.log(`Server avviato su http://localhost:${PORT}`);
  console.log(`API disponibili:`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/dashboard`);
  console.log(`  GET  /api/tickets`);
  console.log(`  GET  /api/projects`);
  console.log(`  GET  /api/clients`);
  console.log(`  GET  /api/emails`);
  console.log(`  GET  /api/users`);
  console.log(`  GET  /api/health`);
  console.log(`\nPronto!\n`);

  // Start IMAP email polling
  const { startPolling } = require('./services/imapPoller');
  startPolling();
});
