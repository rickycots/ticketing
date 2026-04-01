const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createFileFilter, validateUploadedFiles } = require('../middleware/uploadSecurity');

const router = express.Router({ mergeParams: true });

// Multer for activity attachments
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'activities');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.xlsx', '.zip', '.dwg', '.dxf'];
const uploadAllegati = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: createFileFilter(allowedExts),
});

// Middleware: check project visibility for tecnico
function checkProjectAccess(req, res, next) {
  if (req.user.ruolo === 'admin') return next();
  const visible = db.prepare('SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?').get(req.params.id, req.user.id);
  if (!visible) return res.status(403).json({ error: 'Accesso non consentito' });
  next();
}

// GET /api/projects/:id/activities — list activities
router.get('/', authenticateToken, checkProjectAccess, (req, res) => {
  const activities = db.prepare(`
    SELECT a.*, u.nome as assegnato_nome
    FROM attivita a
    LEFT JOIN utenti u ON a.assegnato_a = u.id
    WHERE a.progetto_id = ?
    ORDER BY a.ordine ASC,
      CASE a.priorita WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'bassa' THEN 3 END,
      a.created_at ASC
  `).all(req.params.id);

  res.json(activities);
});

// GET /api/projects/:id/activities/:activityId — single activity detail
router.get('/:activityId', authenticateToken, checkProjectAccess, (req, res) => {
  const activity = db.prepare(`
    SELECT a.*, u.nome as assegnato_nome
    FROM attivita a
    LEFT JOIN utenti u ON a.assegnato_a = u.id
    WHERE a.id = ? AND a.progetto_id = ?
  `).get(req.params.activityId, req.params.id);

  if (!activity) {
    return res.status(404).json({ error: 'Attività non trovata' });
  }

  // Tecnico can only view activities assigned to them
  if (req.user.ruolo === 'tecnico') {
    const assignedIds = (activity.tecnici_ids || '').split(',').filter(Boolean).map(Number);
    if (activity.assegnato_a !== req.user.id && !assignedIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Non sei abilitato su questa attività' });
    }
  }

  // Project info
  const project = db.prepare(`
    SELECT p.id, p.nome, p.stato, c.nome_azienda as cliente_nome, c.id as cliente_id,
           c.email as cliente_email, c.telefono as cliente_telefono, c.referente as cliente_referente
    FROM progetti p
    LEFT JOIN clienti c ON p.cliente_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  // Notes
  const note_attivita = db.prepare(`
    SELECT n.*, u.nome as utente_nome
    FROM note_attivita n
    LEFT JOIN utenti u ON n.utente_id = u.id
    WHERE n.attivita_id = ?
    ORDER BY n.created_at ASC
  `).all(req.params.activityId);

  // Dependency info
  let dipendenza = null;
  if (activity.dipende_da) {
    dipendenza = db.prepare('SELECT id, nome, stato FROM attivita WHERE id = ?').get(activity.dipende_da);
  }

  // Dependents (activities that depend on this one)
  const dipendenti = db.prepare('SELECT id, nome, stato FROM attivita WHERE dipende_da = ?').all(req.params.activityId);

  // Blocking email
  const email_bloccante = db.prepare(
    'SELECT id, oggetto FROM email WHERE attivita_id = ? AND is_bloccante = 1'
  ).get(req.params.activityId);

  // Associated emails
  const emails = db.prepare(`
    SELECT * FROM email WHERE attivita_id = ? ORDER BY data_ricezione ASC
  `).all(req.params.activityId);

  // Resolve tecnici names
  let tecnici_nomi = [];
  if (activity.tecnici_ids) {
    const ids = activity.tecnici_ids.split(',').filter(Boolean).map(Number);
    tecnici_nomi = ids.map(tid => {
      const u = db.prepare('SELECT id, nome FROM utenti WHERE id = ?').get(tid);
      return u ? { id: u.id, nome: u.nome } : null;
    }).filter(Boolean);
  }

  // Allegati
  const allegati = db.prepare(
    'SELECT id, nome_originale, dimensione, tipo_mime, created_at FROM allegati_attivita WHERE attivita_id = ? ORDER BY created_at DESC'
  ).all(req.params.activityId);

  res.json({
    ...activity,
    progetto: project,
    note_attivita,
    dipendenza,
    dipendenti,
    email_bloccante: email_bloccante || null,
    emails,
    tecnici_nomi,
    allegati
  });
});

// POST /api/projects/:id/activities — create activity (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const progettoId = req.params.id;
  const { nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, note, data_inizio, ordine, dipende_da, tecnici_ids } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Campo obbligatorio: nome' });
  }

  const project = db.prepare('SELECT id FROM progetti WHERE id = ?').get(progettoId);
  if (!project) {
    return res.status(404).json({ error: 'Progetto non trovato' });
  }

  // Validate dipende_da is in same project
  if (dipende_da) {
    const dep = db.prepare('SELECT id FROM attivita WHERE id = ? AND progetto_id = ?').get(dipende_da, progettoId);
    if (!dep) {
      return res.status(400).json({ error: 'Attività dipendenza non trovata nello stesso progetto' });
    }
  }

  // Ordine: only for primary activities (no dipende_da)
  let finalOrdine = null;
  if (!dipende_da) {
    finalOrdine = ordine;
    if (finalOrdine === undefined || finalOrdine === null || finalOrdine === '') {
      // Auto: next after max ordine of primary activities in this project
      const maxOrd = db.prepare('SELECT MAX(ordine) as m FROM attivita WHERE progetto_id = ? AND (dipende_da IS NULL OR dipende_da = 0)').get(progettoId);
      finalOrdine = (maxOrd && maxOrd.m != null) ? maxOrd.m + 1 : 1;
    } else {
      // Explicit ordine: shift existing primary activities >= this ordine
      finalOrdine = parseInt(finalOrdine);
      db.prepare('UPDATE attivita SET ordine = ordine + 1 WHERE progetto_id = ? AND (dipende_da IS NULL OR dipende_da = 0) AND ordine >= ?').run(progettoId, finalOrdine);
    }
  }

  const result = db.prepare(`
    INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, note, data_inizio, ordine, dipende_da, tecnici_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    progettoId,
    nome,
    descrizione || null,
    assegnato_a || null,
    stato || 'da_fare',
    avanzamento || 0,
    priorita || 'media',
    data_scadenza || null,
    note || null,
    data_inizio || null,
    finalOrdine,
    dipende_da || null,
    tecnici_ids ? (Array.isArray(tecnici_ids) ? tecnici_ids.join(',') : tecnici_ids) : null
  );

  db.prepare("UPDATE progetti SET updated_at = datetime('now') WHERE id = ?").run(progettoId);

  const activity = db.prepare(`
    SELECT a.*, u.nome as assegnato_nome
    FROM attivita a
    LEFT JOIN utenti u ON a.assegnato_a = u.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(activity);
});

// PUT /api/projects/:id/activities/:activityId — update activity
// Admin: can update everything. Tecnico: can update stato and note on assigned activities.
router.put('/:activityId', authenticateToken, checkProjectAccess, (req, res) => {
  const { nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, note, data_inizio, ordine, dipende_da, tecnici_ids } = req.body;

  const activity = db.prepare('SELECT * FROM attivita WHERE id = ? AND progetto_id = ?')
    .get(req.params.activityId, req.params.id);

  if (!activity) {
    return res.status(404).json({ error: 'Attività non trovata' });
  }

  // If activity is blocked by a blocking email, prevent status changes
  if (stato && stato !== activity.stato) {
    const blockingEmail = db.prepare(
      'SELECT id FROM email WHERE attivita_id = ? AND is_bloccante = 1'
    ).get(req.params.activityId);
    if (blockingEmail) {
      return res.status(400).json({ error: "L'attività è bloccata da un'email bloccante. Rimuovi prima il blocco dall'email." });
    }
  }

  // Tecnico can only update stato and note on activities assigned to them
  if (req.user.ruolo === 'tecnico') {
    const assignedIds = (activity.tecnici_ids || '').split(',').filter(Boolean).map(Number);
    const isAssigned = activity.assegnato_a === req.user.id || assignedIds.includes(req.user.id);
    if (!isAssigned) {
      return res.status(403).json({ error: 'Puoi modificare solo le attività assegnate a te' });
    }
    // Only allow stato and note updates
    const allowedStato = stato || activity.stato;
    const allowedNote = note !== undefined ? note : activity.note;

    // Auto-manage data_completamento
    let dataCompletamento = activity.data_completamento;
    if (allowedStato === 'completata' && activity.stato !== 'completata') {
      dataCompletamento = new Date().toISOString().slice(0, 19).replace('T', ' ');
    } else if (allowedStato !== 'completata' && activity.stato === 'completata') {
      dataCompletamento = null;
    }

    db.prepare(`
      UPDATE attivita SET
        stato = ?,
        note = ?,
        data_completamento = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(allowedStato, allowedNote, dataCompletamento, req.params.activityId);
  } else {
    // Admin: full update
    // Auto-manage data_completamento
    const newStato = stato || activity.stato;
    let dataCompletamento = activity.data_completamento;
    if (newStato === 'completata' && activity.stato !== 'completata') {
      dataCompletamento = new Date().toISOString().slice(0, 19).replace('T', ' ');
    } else if (newStato !== 'completata' && activity.stato === 'completata') {
      dataCompletamento = null;
    }

    // Validate dipende_da is in same project
    if (dipende_da !== undefined && dipende_da !== null && dipende_da !== '' && dipende_da !== 0) {
      const dep = db.prepare('SELECT id FROM attivita WHERE id = ? AND progetto_id = ?').get(dipende_da, req.params.id);
      if (!dep) {
        return res.status(400).json({ error: 'Attività dipendenza non trovata nello stesso progetto' });
      }
    }

    // Determine final dipende_da
    const finalDipendeDa = dipende_da !== undefined ? (dipende_da || null) : activity.dipende_da;

    // Determine final ordine based on dependency status
    let finalOrdine;
    if (finalDipendeDa) {
      // Dependent activity: no ordine
      finalOrdine = null;
    } else if (ordine !== undefined && ordine !== null && ordine !== '') {
      // Primary with explicit ordine: shift others
      finalOrdine = parseInt(ordine);
      if (finalOrdine !== activity.ordine) {
        db.prepare('UPDATE attivita SET ordine = ordine + 1 WHERE progetto_id = ? AND id != ? AND (dipende_da IS NULL OR dipende_da = 0) AND ordine >= ?')
          .run(req.params.id, req.params.activityId, finalOrdine);
      }
    } else {
      // Primary, keep current ordine (or auto-assign if was dependent before)
      if (activity.dipende_da && !finalDipendeDa) {
        // Was dependent, becoming primary: auto-assign next ordine
        const maxOrd = db.prepare('SELECT MAX(ordine) as m FROM attivita WHERE progetto_id = ? AND (dipende_da IS NULL OR dipende_da = 0)').get(req.params.id);
        finalOrdine = (maxOrd && maxOrd.m != null) ? maxOrd.m + 1 : 1;
      } else {
        finalOrdine = activity.ordine;
      }
    }

    db.prepare(`
      UPDATE attivita SET
        nome = COALESCE(?, nome),
        descrizione = COALESCE(?, descrizione),
        assegnato_a = ?,
        stato = COALESCE(?, stato),
        avanzamento = COALESCE(?, avanzamento),
        priorita = COALESCE(?, priorita),
        data_scadenza = COALESCE(?, data_scadenza),
        data_completamento = ?,
        note = COALESCE(?, note),
        data_inizio = COALESCE(?, data_inizio),
        ordine = ?,
        dipende_da = ?,
        tecnici_ids = COALESCE(?, tecnici_ids),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      nome || null,
      descrizione || null,
      assegnato_a !== undefined ? assegnato_a : activity.assegnato_a,
      stato || null,
      avanzamento !== undefined ? avanzamento : null,
      priorita || null,
      data_scadenza || null,
      dataCompletamento,
      note || null,
      data_inizio || null,
      finalOrdine,
      finalDipendeDa,
      tecnici_ids !== undefined ? (Array.isArray(tecnici_ids) ? tecnici_ids.join(',') : tecnici_ids) : null,
      req.params.activityId
    );
  }

  db.prepare("UPDATE progetti SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  const updated = db.prepare(`
    SELECT a.*, u.nome as assegnato_nome
    FROM attivita a
    LEFT JOIN utenti u ON a.assegnato_a = u.id
    WHERE a.id = ?
  `).get(req.params.activityId);

  res.json(updated);
});

// POST /api/projects/:id/activities/:activityId/notes — add note to activity
router.post('/:activityId/notes', authenticateToken, checkProjectAccess, (req, res) => {
  const { testo, salva_in_kb } = req.body;
  if (!testo || !testo.trim()) {
    return res.status(400).json({ error: 'Il testo della nota è obbligatorio' });
  }

  const activity = db.prepare('SELECT a.*, p.cliente_id, p.nome as progetto_nome FROM attivita a JOIN progetti p ON a.progetto_id = p.id WHERE a.id = ? AND a.progetto_id = ?')
    .get(req.params.activityId, req.params.id);
  if (!activity) {
    return res.status(404).json({ error: 'Attività non trovata' });
  }

  // Tecnico can only add notes on activities assigned to them
  if (req.user.ruolo === 'tecnico') {
    const assignedIds = (activity.tecnici_ids || '').split(',').filter(Boolean).map(Number);
    if (activity.assegnato_a !== req.user.id && !assignedIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Non sei abilitato su questa attività' });
    }
  }

  const result = db.prepare(`
    INSERT INTO note_attivita (attivita_id, utente_id, testo)
    VALUES (?, ?, ?)
  `).run(req.params.activityId, req.user.id, testo.trim());

  // Save to KB if flag is set
  if (salva_in_kb && activity.cliente_id) {
    const titolo = `Nota attività "${activity.titolo}" — ${activity.progetto_nome}`;
    db.prepare(
      'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)'
    ).run(activity.cliente_id, titolo, testo.trim());
  }

  const nota = db.prepare(`
    SELECT n.*, u.nome as utente_nome
    FROM note_attivita n
    LEFT JOIN utenti u ON n.utente_id = u.id
    WHERE n.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(nota);
});

// DELETE /api/projects/:id/activities/:activityId (admin only)
router.delete('/:activityId', authenticateToken, requireAdmin, (req, res) => {
  const activity = db.prepare('SELECT * FROM attivita WHERE id = ? AND progetto_id = ?')
    .get(req.params.activityId, req.params.id);

  if (!activity) {
    return res.status(404).json({ error: 'Attività non trovata' });
  }

  db.prepare('DELETE FROM attivita WHERE id = ?').run(req.params.activityId);
  db.prepare("UPDATE progetti SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  res.json({ message: 'Attività eliminata' });
});

// === Scheduled Activities (Attivita Programmate) ===

// GET /api/projects/:id/activities/:activityId/scheduled
router.get('/:activityId/scheduled', authenticateToken, checkProjectAccess, (req, res) => {
  const items = db.prepare(`
    SELECT ap.*, u.nome as creato_da_nome
    FROM attivita_programmate ap
    LEFT JOIN utenti u ON ap.creato_da = u.id
    WHERE ap.attivita_id = ? AND ap.progetto_id = ?
    ORDER BY ap.data_pianificata ASC
  `).all(req.params.activityId, req.params.id);
  res.json(items);
});

// POST /api/projects/:id/activities/:activityId/scheduled
router.post('/:activityId/scheduled', authenticateToken, checkProjectAccess, (req, res) => {
  if (req.user.ruolo !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  const { nota, referenti_ids } = req.body;
  let data_pianificata = req.body.data_pianificata;
  if (!nota || !data_pianificata) return res.status(400).json({ error: 'Nota e data sono obbligatori' });
  // Fix 2-digit year from some browsers (0026 -> 2026)
  if (data_pianificata.match(/^00\d{2}-/)) data_pianificata = '2' + data_pianificata.substring(1);

  const result = db.prepare(
    'INSERT INTO attivita_programmate (attivita_id, progetto_id, nota, data_pianificata, referenti_ids, creato_da) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.activityId, req.params.id, nota, data_pianificata, referenti_ids || null, req.user.id);

  const item = db.prepare('SELECT ap.*, u.nome as creato_da_nome FROM attivita_programmate ap LEFT JOIN utenti u ON ap.creato_da = u.id WHERE ap.id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// DELETE /api/projects/:id/activities/:activityId/scheduled/:scheduledId
router.delete('/:activityId/scheduled/:scheduledId', authenticateToken, checkProjectAccess, (req, res) => {
  if (req.user.ruolo !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  db.prepare('DELETE FROM attivita_programmate WHERE id = ? AND attivita_id = ?').run(req.params.scheduledId, req.params.activityId);
  res.json({ success: true });
});

// POST /api/projects/:id/activities/:activityId/allegati — upload attachments
router.post('/:activityId/allegati', authenticateToken, checkProjectAccess, uploadAllegati.array('files', 10), validateUploadedFiles, (req, res) => {
  const activity = db.prepare('SELECT id FROM attivita WHERE id = ? AND progetto_id = ?').get(req.params.activityId, req.params.id);
  if (!activity) return res.status(404).json({ error: 'Attività non trovata' });

  const insert = db.prepare(
    'INSERT INTO allegati_attivita (attivita_id, nome_file, nome_originale, dimensione, tipo_mime, caricato_da) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const results = [];
  for (const f of (req.files || [])) {
    const info = insert.run(req.params.activityId, f.filename, f.originalname, f.size, f.mimetype, req.user.id);
    results.push({ id: info.lastInsertRowid, nome_originale: f.originalname, dimensione: f.size, tipo_mime: f.mimetype });
  }
  res.status(201).json(results);
});

// GET /api/projects/:id/activities/:activityId/allegati/:allegatoId — download
router.get('/:activityId/allegati/:allegatoId', authenticateToken, checkProjectAccess, (req, res) => {
  const allegato = db.prepare('SELECT * FROM allegati_attivita WHERE id = ? AND attivita_id = ?').get(req.params.allegatoId, req.params.activityId);
  if (!allegato) return res.status(404).json({ error: 'Allegato non trovato' });
  const filePath = path.join(uploadDir, allegato.nome_file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File non trovato' });
  res.download(filePath, allegato.nome_originale);
});

// DELETE /api/projects/:id/activities/:activityId/allegati/:allegatoId
router.delete('/:activityId/allegati/:allegatoId', authenticateToken, checkProjectAccess, (req, res) => {
  const allegato = db.prepare('SELECT * FROM allegati_attivita WHERE id = ? AND attivita_id = ?').get(req.params.allegatoId, req.params.activityId);
  if (!allegato) return res.status(404).json({ error: 'Allegato non trovato' });
  const filePath = path.join(uploadDir, allegato.nome_file);
  try { fs.unlinkSync(filePath); } catch (e) {}
  db.prepare('DELETE FROM allegati_attivita WHERE id = ?').run(req.params.allegatoId);
  res.json({ success: true });
});

module.exports = router;
