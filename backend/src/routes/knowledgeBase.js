const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/clients/:clienteId/schede — list KB cards for a client (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const schede = db.prepare(
    'SELECT * FROM schede_cliente WHERE cliente_id = ? ORDER BY updated_at DESC'
  ).all(req.params.clienteId);
  res.json(schede);
});

// POST /api/clients/:clienteId/schede — create (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { titolo, contenuto } = req.body;
  if (!titolo || !contenuto) {
    return res.status(400).json({ error: 'Titolo e contenuto sono obbligatori' });
  }
  const result = db.prepare(
    'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)'
  ).run(req.params.clienteId, titolo, contenuto);
  res.status(201).json(
    db.prepare('SELECT * FROM schede_cliente WHERE id = ?').get(result.lastInsertRowid)
  );
});

// PUT /api/clients/:clienteId/schede/:id — update (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { titolo, contenuto } = req.body;
  const scheda = db.prepare(
    'SELECT * FROM schede_cliente WHERE id = ? AND cliente_id = ?'
  ).get(req.params.id, req.params.clienteId);
  if (!scheda) return res.status(404).json({ error: 'Scheda non trovata' });

  db.prepare(
    "UPDATE schede_cliente SET titolo = COALESCE(?, titolo), contenuto = COALESCE(?, contenuto), updated_at = datetime('now') WHERE id = ?"
  ).run(titolo || null, contenuto || null, req.params.id);

  res.json(db.prepare('SELECT * FROM schede_cliente WHERE id = ?').get(req.params.id));
});

// DELETE /api/clients/:clienteId/schede/:id — delete (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const scheda = db.prepare(
    'SELECT * FROM schede_cliente WHERE id = ? AND cliente_id = ?'
  ).get(req.params.id, req.params.clienteId);
  if (!scheda) return res.status(404).json({ error: 'Scheda non trovata' });

  db.prepare('DELETE FROM schede_cliente WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
