const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — list notifications for current user (last 50, unread first)
router.get('/', authenticateToken, (req, res) => {
  const notifiche = db.prepare(`
    SELECT * FROM notifiche
    WHERE utente_id = ?
    ORDER BY letta ASC, created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(notifiche);
});

// GET /api/notifications/unread-count — count unread notifications
router.get('/unread-count', authenticateToken, (req, res) => {
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM notifiche WHERE utente_id = ? AND letta = 0'
  ).get(req.user.id);
  res.json({ count: row.count });
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifiche SET letta = 1 WHERE utente_id = ? AND letta = 0').run(req.user.id);
  res.json({ ok: true });
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', authenticateToken, (req, res) => {
  const notifica = db.prepare('SELECT * FROM notifiche WHERE id = ? AND utente_id = ?').get(req.params.id, req.user.id);
  if (!notifica) return res.status(404).json({ error: 'Notifica non trovata' });
  db.prepare('UPDATE notifiche SET letta = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
