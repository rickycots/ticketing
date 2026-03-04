require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static files for uploads (logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
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

// Knowledge Base routes (nested under clients)
app.use('/api/clients/:clienteId/schede', require('./routes/knowledgeBase'));

// Repository routes
app.use('/api/repository', require('./routes/repository'));

// AI routes
app.use('/api/ai', require('./routes/ai'));

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
