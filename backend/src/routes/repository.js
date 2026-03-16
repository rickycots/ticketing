const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createFileFilter, validateUploadedFiles } = require('../middleware/uploadSecurity');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'repository');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});

const allowedExts = ['.txt', '.pdf', '.doc', '.docx', '.md'];
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: createFileFilter(allowedExts),
});

// Extract text content from file
async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.txt' || ext === '.md') {
      return fs.readFileSync(filePath, 'utf-8');
    }
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }
  } catch (err) {
    console.error('Errore estrazione testo:', err.message);
  }
  return null;
}

// GET /api/repository — list documents
router.get('/', authenticateToken, (req, res) => {
  const { categoria } = req.query;
  let sql = "SELECT id, nome_originale, dimensione, tipo_mime, categoria, descrizione, caricato_da, created_at, CASE WHEN contenuto_testo IS NOT NULL AND contenuto_testo != '' THEN 1 ELSE 0 END as ai_parsed FROM documenti_repository";
  const params = [];
  if (categoria) {
    sql += ' WHERE categoria = ?';
    params.push(categoria);
  }
  sql += ' ORDER BY created_at DESC';
  const docs = db.prepare(sql).all(...params);
  res.json(docs);
});

// GET /api/repository/categorie — list distinct categories
router.get('/categorie', authenticateToken, (req, res) => {
  const cats = db.prepare('SELECT DISTINCT categoria FROM documenti_repository ORDER BY categoria').all();
  res.json(cats.map(c => c.categoria));
});

// POST /api/repository/upload — upload files (admin only)
router.post('/upload', authenticateToken, requireAdmin, (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Validate magic bytes
    const magicErr = (() => {
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!require('../middleware/uploadSecurity').validateMagicBytes(file.path, ext)) {
          try { fs.unlinkSync(file.path); } catch {}
          return `Il contenuto del file "${file.originalname}" non corrisponde all'estensione dichiarata`;
        }
      }
      return null;
    })();
    if (magicErr) return res.status(400).json({ error: magicErr });

    const categoria = req.body.categoria || 'generale';
    const descrizione = req.body.descrizione || null;
    const results = [];

    for (const file of req.files) {
      const contenutoTesto = await extractText(file.path, file.mimetype);
      const result = db.prepare(
        'INSERT INTO documenti_repository (nome_file, nome_originale, dimensione, tipo_mime, contenuto_testo, categoria, descrizione, caricato_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(file.filename, file.originalname, file.size, file.mimetype, contenutoTesto, categoria, descrizione, req.user.id);
      results.push(
        db.prepare('SELECT id, nome_originale, dimensione, tipo_mime, categoria, descrizione, caricato_da, created_at FROM documenti_repository WHERE id = ?').get(result.lastInsertRowid)
      );
    }

    res.status(201).json(results);
  });
});

// PUT /api/repository/:id — update category/description (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { categoria, descrizione } = req.body;
  const doc = db.prepare('SELECT * FROM documenti_repository WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento non trovato' });

  db.prepare(
    'UPDATE documenti_repository SET categoria = COALESCE(?, categoria), descrizione = COALESCE(?, descrizione) WHERE id = ?'
  ).run(categoria || null, descrizione !== undefined ? descrizione : null, req.params.id);

  res.json(db.prepare('SELECT id, nome_originale, dimensione, tipo_mime, categoria, descrizione, caricato_da, created_at FROM documenti_repository WHERE id = ?').get(req.params.id));
});

// DELETE /api/repository/:id — delete (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const doc = db.prepare('SELECT * FROM documenti_repository WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento non trovato' });

  // Delete file from disk
  const filePath = path.join(uploadDir, doc.nome_file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM documenti_repository WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/repository/:id/download — download file (admin + tecnico only, not client)
router.get('/:id/download', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documenti_repository WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento non trovato' });

  // Repository is visible to admin and tecnico only (no client access via this endpoint)
  // authenticateToken already ensures admin/tecnico — no further IDOR risk since repository is shared

  const filePath = path.join(uploadDir, doc.nome_file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File non trovato su disco' });
  }

  res.download(filePath, doc.nome_originale);
});

module.exports = router;
