const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Permission check: admin or tecnico assigned to project
function canEditProject(userId, userRole, progettoId) {
  if (userRole === 'admin') return true;
  const row = db.prepare('SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?').get(progettoId, userId);
  return !!row;
}

// GET /api/projects/:projectId/referenti-esterni — list by project (include activity-level of that project)
router.get('/projects/:projectId/referenti-esterni', authenticateToken, (req, res) => {
  const pid = Number(req.params.projectId);
  if (!canEditProject(req.user.id, req.user.ruolo, pid)) return res.status(403).json({ error: 'Non autorizzato' });
  const rows = db.prepare(`
    SELECT r.*, a.nome as attivita_nome
    FROM referenti_esterni r
    LEFT JOIN attivita a ON r.attivita_id = a.id
    WHERE r.progetto_id = ? OR r.attivita_id IN (SELECT id FROM attivita WHERE progetto_id = ?)
    ORDER BY r.created_at DESC
  `).all(pid, pid);
  res.json(rows);
});

// POST /api/projects/:projectId/referenti-esterni — create at project level
router.post('/projects/:projectId/referenti-esterni', authenticateToken, (req, res) => {
  const pid = Number(req.params.projectId);
  if (!canEditProject(req.user.id, req.user.ruolo, pid)) return res.status(403).json({ error: 'Non autorizzato' });
  const { nome, cognome = '', email, telefono = null, ruolo = null, azienda = null } = req.body || {};
  if (!nome || !email) return res.status(400).json({ error: 'nome e email obbligatori' });
  const info = db.prepare(`
    INSERT INTO referenti_esterni (progetto_id, attivita_id, nome, cognome, email, telefono, ruolo, azienda)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
  `).run(pid, nome, cognome, email, telefono, ruolo, azienda);
  const row = db.prepare('SELECT * FROM referenti_esterni WHERE id = ?').get(info.lastInsertRowid);
  res.json(row);
});

// POST /api/projects/:projectId/activities/:activityId/referenti-esterni — create at activity level
router.post('/projects/:projectId/activities/:activityId/referenti-esterni', authenticateToken, (req, res) => {
  const pid = Number(req.params.projectId);
  const aid = Number(req.params.activityId);
  if (!canEditProject(req.user.id, req.user.ruolo, pid)) return res.status(403).json({ error: 'Non autorizzato' });
  const act = db.prepare('SELECT id FROM attivita WHERE id = ? AND progetto_id = ?').get(aid, pid);
  if (!act) return res.status(404).json({ error: 'Attività non trovata' });
  const { nome, cognome = '', email, telefono = null, ruolo = null, azienda = null } = req.body || {};
  if (!nome || !email) return res.status(400).json({ error: 'nome e email obbligatori' });
  const info = db.prepare(`
    INSERT INTO referenti_esterni (progetto_id, attivita_id, nome, cognome, email, telefono, ruolo, azienda)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(aid, nome, cognome, email, telefono, ruolo, azienda);
  const row = db.prepare('SELECT * FROM referenti_esterni WHERE id = ?').get(info.lastInsertRowid);
  res.json(row);
});

// PUT /api/referenti-esterni/:id — update
router.put('/referenti-esterni/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM referenti_esterni WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Non trovato' });
  // Permission: based on the project it belongs to (direct or via activity)
  let pid = existing.progetto_id;
  if (!pid && existing.attivita_id) {
    const act = db.prepare('SELECT progetto_id FROM attivita WHERE id = ?').get(existing.attivita_id);
    pid = act ? act.progetto_id : null;
  }
  if (!pid || !canEditProject(req.user.id, req.user.ruolo, pid)) return res.status(403).json({ error: 'Non autorizzato' });
  const { nome, cognome, email, telefono, ruolo, azienda } = req.body || {};
  db.prepare(`
    UPDATE referenti_esterni
    SET nome = COALESCE(?, nome), cognome = COALESCE(?, cognome), email = COALESCE(?, email),
        telefono = COALESCE(?, telefono), ruolo = COALESCE(?, ruolo), azienda = COALESCE(?, azienda)
    WHERE id = ?
  `).run(nome ?? null, cognome ?? null, email ?? null, telefono ?? null, ruolo ?? null, azienda ?? null, id);
  const row = db.prepare('SELECT * FROM referenti_esterni WHERE id = ?').get(id);
  res.json(row);
});

// DELETE /api/referenti-esterni/:id
router.delete('/referenti-esterni/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM referenti_esterni WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Non trovato' });
  let pid = existing.progetto_id;
  if (!pid && existing.attivita_id) {
    const act = db.prepare('SELECT progetto_id FROM attivita WHERE id = ?').get(existing.attivita_id);
    pid = act ? act.progetto_id : null;
  }
  if (!pid || !canEditProject(req.user.id, req.user.ruolo, pid)) return res.status(403).json({ error: 'Non autorizzato' });
  db.prepare('DELETE FROM referenti_esterni WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/anagrafica — unified roster (admin + tecnico)
// Returns utenti portale + referenti interni + referenti esterni
router.get('/anagrafica', authenticateToken, (req, res) => {
  // utenti_cliente (portale)
  const utentiPortale = db.prepare(`
    SELECT uc.id, uc.nome, uc.cognome, uc.email, c.nome_azienda as azienda, NULL as ruolo, NULL as telefono
    FROM utenti_cliente uc
    LEFT JOIN clienti c ON uc.cliente_id = c.id
    WHERE uc.attivo = 1
  `).all().map(u => ({ ...u, status: 'utente_portale' }));

  // referenti interni (referenti_progetto)
  const refInterni = db.prepare(`
    SELECT rp.id, rp.nome, rp.cognome, rp.email, rp.telefono, rp.ruolo, c.nome_azienda as azienda
    FROM referenti_progetto rp
    LEFT JOIN clienti c ON rp.cliente_id = c.id
  `).all().map(r => ({ ...r, status: 'ref_interno' }));

  // referenti esterni
  const refEsterni = db.prepare(`
    SELECT re.id, re.nome, re.cognome, re.email, re.telefono, re.ruolo, re.azienda,
           re.progetto_id, re.attivita_id,
           p.nome as progetto_nome,
           ap.nome as attivita_progetto_nome,
           a.nome as attivita_nome
    FROM referenti_esterni re
    LEFT JOIN progetti p ON re.progetto_id = p.id
    LEFT JOIN attivita a ON re.attivita_id = a.id
    LEFT JOIN progetti ap ON a.progetto_id = ap.id
  `).all().map(r => ({
    ...r,
    status: 'ref_esterno',
    progetto_nome: r.progetto_nome || r.attivita_progetto_nome,
  }));

  res.json([...utentiPortale, ...refInterni, ...refEsterni]);
});

module.exports = router;
