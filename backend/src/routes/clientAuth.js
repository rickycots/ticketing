const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, requireAdmin, authenticateClientToken, JWT_SECRET } = require('../middleware/auth');
const { sendNoreplyEmail } = require('../services/mailer');
const { loginLimiter, impersonateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Login attempt tracking (in-memory, per IP)
const clientLoginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 200 * 1000; // ~3 minutes

function checkClientLockout(ip) {
  const record = clientLoginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOGIN_LOCKOUT_MS) {
    clientLoginAttempts.delete(ip);
    return false;
  }
  return record.attempts >= MAX_LOGIN_ATTEMPTS;
}

function recordClientFailedLogin(ip) {
  const record = clientLoginAttempts.get(ip) || { attempts: 0, lastAttempt: 0 };
  record.attempts++;
  record.lastAttempt = Date.now();
  clientLoginAttempts.set(ip, record);
}

// POST /api/client-auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  // Progressive lockout
  if (checkClientLockout(ip)) {
    return res.status(429).json({ error: 'Troppi tentativi di login. Riprova tra 15 minuti.' });
  }

  const user = db.prepare(`
    SELECT uc.*, c.nome_azienda, c.logo, c.servizio_ticket, c.servizio_progetti, c.servizio_ai
    FROM utenti_cliente uc
    JOIN clienti c ON uc.cliente_id = c.id
    WHERE uc.email = ?
  `).get(email);

  if (user && bcrypt.compareSync(password, user.password_hash)) {
    if (!user.attivo) {
      return res.status(403).json({ error: 'Account disabilitato' });
    }

    // Clear lockout on successful login
    clientLoginAttempts.delete(ip);

    const userRuolo = user.ruolo || 'user';
    const visibili = userRuolo === 'admin' ? 'ticket,progetti,ai' : user.schede_visibili;

    // 2FA: generate code, send email, return pending
    if (user.two_factor) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      db.prepare('UPDATE utenti_cliente SET two_factor_code = ?, two_factor_expires = ?, two_factor_attempts = 0 WHERE id = ?')
        .run(code, expires, user.id);

      // Send email (async, don't block)
      sendNoreplyEmail(
        user.email,
        'Codice di verifica — STM Domotica',
        `<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;">
          <h2 style="color:#333;margin-bottom:10px;">Codice di Verifica</h2>
          <p style="color:#666;font-size:14px;">Inserisci questo codice per completare l'accesso:</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;">${code}</span>
          </div>
          <p style="color:#999;font-size:12px;">Il codice scade tra 10 minuti. Se non hai richiesto l'accesso, ignora questa email.</p>
        </div>`
      ).catch(err => console.error('2FA email error:', err));

      // Return a temporary token (short-lived, for 2FA verification only)
      const tempToken = jwt.sign(
        { id: user.id, tipo: '2fa_pending' },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({
        require_2fa: true,
        temp_token: tempToken,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          cliente_id: user.cliente_id,
          nome_azienda: user.nome_azienda,
          logo: user.logo,
          ruolo: userRuolo,
          schede_visibili: visibili,
          lingua: user.lingua || 'it',
          cambio_password: user.cambio_password || 0,
          servizio_ticket: user.servizio_ticket ?? 1,
          servizio_progetti: user.servizio_progetti ?? 1,
          servizio_ai: user.servizio_ai ?? 1,
        },
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cliente_id: user.cliente_id,
        ruolo: userRuolo,
        schede_visibili: visibili,
        tipo: 'cliente',
      },
      JWT_SECRET,
      { expiresIn: '8h' }
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
        ruolo: userRuolo,
        schede_visibili: visibili,
        lingua: user.lingua || 'it',
        cambio_password: user.cambio_password || 0,
        servizio_ticket: user.servizio_ticket ?? 1,
        servizio_progetti: user.servizio_progetti ?? 1,
        servizio_ai: user.servizio_ai ?? 1,
      },
    });
  }

  recordClientFailedLogin(ip);
  return res.status(401).json({ error: 'Credenziali non valide' });
});

// POST /api/client-auth/verify-2fa — verify 2FA code
router.post('/verify-2fa', (req, res) => {
  const { temp_token, code } = req.body;

  if (!temp_token || !code) {
    return res.status(400).json({ error: 'Token e codice sono obbligatori' });
  }

  // Verify temp token
  let decoded;
  try {
    decoded = jwt.verify(temp_token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Sessione scaduta. Effettua nuovamente il login.' });
  }

  if (decoded.tipo !== '2fa_pending') {
    return res.status(401).json({ error: 'Token non valido' });
  }

  const user = db.prepare(`
    SELECT uc.*, c.nome_azienda, c.logo, c.servizio_ticket, c.servizio_progetti, c.servizio_ai
    FROM utenti_cliente uc
    JOIN clienti c ON uc.cliente_id = c.id
    WHERE uc.id = ?
  `).get(decoded.id);

  if (!user) return res.status(401).json({ error: 'Utente non trovato' });

  // Check attempts
  if (user.two_factor_attempts >= 3) {
    db.prepare('UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?')
      .run(user.id);
    return res.status(401).json({ error: 'Troppi tentativi errati. Effettua nuovamente il login.', locked: true });
  }

  // Check expiry
  if (!user.two_factor_code || !user.two_factor_expires || new Date(user.two_factor_expires) < new Date()) {
    return res.status(401).json({ error: 'Codice scaduto. Effettua nuovamente il login.', locked: true });
  }

  // Check code
  if (user.two_factor_code !== code.trim()) {
    const attempts = user.two_factor_attempts + 1;
    db.prepare('UPDATE utenti_cliente SET two_factor_attempts = ? WHERE id = ?').run(attempts, user.id);

    if (attempts >= 3) {
      db.prepare('UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?')
        .run(user.id);
      return res.status(401).json({ error: 'Troppi tentativi errati. Effettua nuovamente il login.', locked: true });
    }

    return res.status(400).json({
      error: 'Codice errato',
      remaining: 3 - attempts,
    });
  }

  // Code is correct — clear 2FA data, issue real token
  db.prepare('UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?')
    .run(user.id);

  const userRuolo = user.ruolo || 'user';
  const visibili = userRuolo === 'admin' ? 'ticket,progetti,ai' : user.schede_visibili;

  const token = jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cliente_id: user.cliente_id,
      ruolo: userRuolo,
      schede_visibili: visibili,
      tipo: 'cliente',
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token });
});

// POST /api/client-auth/change-password — first login password change
router.post('/change-password', authenticateClientToken, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE utenti_cliente SET password_hash = ?, cambio_password = 0 WHERE id = ?').run(hash, req.user.id);

  // Update session data
  const updated = db.prepare('SELECT cambio_password FROM utenti_cliente WHERE id = ?').get(req.user.id);
  res.json({ success: true, cambio_password: updated.cambio_password });
});

// GET /api/client-auth/dashboard — client-side dashboard stats (client admin only)
router.get('/dashboard', authenticateClientToken, (req, res) => {
  if (req.user.ruolo !== 'admin') return res.status(403).json({ error: 'Solo admin cliente' });
  const clienteId = req.user.cliente_id;

  const cliente = db.prepare('SELECT id, nome_azienda, email, telefono, referente FROM clienti WHERE id = ?').get(clienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente non trovato' });

  // Ticket stats
  const ticketTotali = db.prepare('SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ?').get(clienteId).count;
  const ticketAperti = db.prepare("SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ? AND stato IN ('aperto','in_lavorazione','in_attesa')").get(clienteId).count;
  const ticketChiusi = db.prepare("SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ? AND stato IN ('risolto','chiuso')").get(clienteId).count;

  const tempoMedioTicket = db.prepare(`
    SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
    FROM ticket WHERE cliente_id = ? AND stato IN ('risolto','chiuso')
  `).get(clienteId);

  // Email stats
  const emailTotali = db.prepare('SELECT COUNT(*) as count FROM email e JOIN ticket t ON e.ticket_id = t.id WHERE t.cliente_id = ?').get(clienteId).count;
  const emailAssegnate = db.prepare('SELECT COUNT(*) as count FROM email e JOIN ticket t ON e.ticket_id = t.id WHERE t.cliente_id = ? AND e.ticket_id IS NOT NULL').get(clienteId).count;
  const emailNonAssegnate = db.prepare("SELECT COUNT(*) as count FROM email e LEFT JOIN ticket t ON e.ticket_id = t.id WHERE (t.cliente_id = ? OR e.tipo = 'email_cliente') AND e.ticket_id IS NULL").get(clienteId).count;

  // Project stats (computed dynamically)
  const allProjects = db.prepare('SELECT id FROM progetti WHERE cliente_id = ?').all(clienteId);
  let progettiAttivi = 0, progettiChiusi = 0, progettiBloccati = 0, progettiSenzaAttivita = 0;
  for (const p of allProjects) {
    const att = db.prepare('SELECT stato FROM attivita WHERE progetto_id = ?').all(p.id);
    if (att.length === 0) { progettiSenzaAttivita++; continue; }
    if (att.every(a => a.stato === 'completata')) { progettiChiusi++; continue; }
    if (att.some(a => a.stato === 'bloccata')) { progettiBloccati++; continue; }
    progettiAttivi++;
  }

  const tempoMedioAttivita = db.prepare(`
    SELECT AVG(julianday(a.data_scadenza) - julianday(a.data_inizio)) as avg_days
    FROM attivita a JOIN progetti p ON a.progetto_id = p.id
    WHERE p.cliente_id = ? AND a.stato = 'completata' AND a.data_inizio IS NOT NULL AND a.data_scadenza IS NOT NULL
  `).get(clienteId);

  const ticketRecenti = db.prepare('SELECT id, codice, oggetto, stato, priorita, created_at FROM ticket WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 5').all(clienteId);

  res.json({
    cliente,
    ticket: { totali: ticketTotali, aperti: ticketAperti, chiusi: ticketChiusi },
    tempo_medio_ticket: tempoMedioTicket.avg_days ? Math.round(tempoMedioTicket.avg_days * 10) / 10 : null,
    email: { totali: emailTotali, assegnate: emailAssegnate, non_assegnate: emailNonAssegnate },
    progetti: { totali: allProjects.length, attivi: progettiAttivi, chiusi: progettiChiusi, bloccati: progettiBloccati, senza_attivita: progettiSenzaAttivita },
    tempo_medio_attivita: tempoMedioAttivita.avg_days ? Math.round(tempoMedioAttivita.avg_days * 10) / 10 : null,
    ticket_recenti: ticketRecenti,
  });
});

// GET /api/client-auth/alerts — blocked activities/projects for this client
router.get('/alerts', authenticateClientToken, (req, res) => {
  const clienteId = req.user.cliente_id;
  const blockedActivities = db.prepare(
    "SELECT a.id, a.nome as attivita_nome, p.nome as progetto_nome, p.id as progetto_id FROM attivita a JOIN progetti p ON a.progetto_id = p.id WHERE p.cliente_id = ? AND a.stato = 'bloccata'"
  ).all(clienteId);
  const blockedProjects = db.prepare(
    "SELECT p.id, p.nome FROM progetti p WHERE p.cliente_id = ? AND p.blocco = 'lato_cliente'"
  ).all(clienteId);
  const ticketInAttesa = db.prepare(
    "SELECT id, codice, oggetto FROM ticket WHERE cliente_id = ? AND stato = 'in_attesa'"
  ).all(clienteId);
  res.json({ attivita_bloccate: blockedActivities, progetti_bloccati: blockedProjects, ticket_in_attesa: ticketInAttesa });
});

// GET /api/client-auth/me
router.get('/me', authenticateClientToken, (req, res) => {
  // Handle impersonated admin users (id: 0)
  if (req.user.impersonated) {
    const cliente = db.prepare('SELECT id, nome_azienda, logo, servizio_ticket, servizio_progetti, servizio_ai FROM clienti WHERE id = ?').get(req.user.cliente_id);
    if (!cliente) return res.status(401).json({ error: 'Cliente non trovato' });
    return res.json({
      id: 0,
      nome: req.user.nome,
      email: req.user.email,
      cliente_id: req.user.cliente_id,
      ruolo: 'admin',
      schede_visibili: req.user.schede_visibili,
      attivo: 1,
      nome_azienda: cliente.nome_azienda,
      logo: cliente.logo,
      servizio_ticket: cliente.servizio_ticket ?? 1,
      servizio_progetti: cliente.servizio_progetti ?? 1,
      servizio_ai: cliente.servizio_ai ?? 1,
    });
  }

  const user = db.prepare(`
    SELECT uc.id, uc.nome, uc.email, uc.cliente_id, uc.ruolo, uc.schede_visibili, uc.lingua, uc.attivo,
           c.nome_azienda, c.logo, c.servizio_ticket, c.servizio_progetti, c.servizio_ai
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
router.post('/impersonate/:clienteId', impersonateLimiter, authenticateToken, requireAdmin, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clienti WHERE id = ?').get(req.params.clienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente non trovato' });

  // Audit log
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  db.prepare(
    'INSERT INTO audit_log (azione, admin_id, admin_nome, admin_email, target_id, target_tipo, dettagli, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('impersonate', req.user.id, req.user.nome, req.user.email, cliente.id, 'cliente', `Impersonation cliente: ${cliente.nome_azienda}`, ip);

  const token = jwt.sign(
    {
      id: 0,
      admin_id: req.user.id,
      nome: `Admin (${req.user.nome})`,
      email: req.user.email,
      cliente_id: cliente.id,
      schede_visibili: 'ticket,progetti,ai',
      tipo: 'cliente',
      impersonated: true,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
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
      schede_visibili: 'ticket,progetti,ai',
      impersonated: true,
      servizio_ticket: cliente.servizio_ticket ?? 1,
      servizio_progetti: cliente.servizio_progetti ?? 1,
      servizio_ai: cliente.servizio_ai ?? 1,
    },
  });
});

// GET /api/client-auth/comunicazioni — client communications
router.get('/comunicazioni', authenticateClientToken, (req, res) => {
  const comunicazioni = db.prepare(
    'SELECT * FROM comunicazioni_cliente WHERE cliente_id = ? ORDER BY data_ricezione DESC LIMIT 20'
  ).all(req.user.cliente_id);
  res.json(comunicazioni);
});

// --- Client Admin: manage portal users ---

function requireClientAdmin(req, res, next) {
  if (req.user.ruolo !== 'admin' && !req.user.impersonated) {
    return res.status(403).json({ error: 'Accesso riservato agli admin' });
  }
  next();
}

// GET /api/client-auth/portal-users — list users of same company
router.get('/portal-users', authenticateClientToken, requireClientAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at FROM utenti_cliente WHERE cliente_id = ? ORDER BY nome'
  ).all(req.user.cliente_id);
  res.json(users);
});

// POST /api/client-auth/portal-users — create user (only 'user' role)
router.post('/portal-users', authenticateClientToken, requireClientAdmin, (req, res) => {
  const { nome, email, password, schede_visibili, lingua } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Campi obbligatori: nome, email, password' });
  }

  const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email già in uso' });

  const userLingua = ['it', 'en', 'fr'].includes(lingua) ? lingua : 'it';
  const password_hash = bcrypt.hashSync(password, 10);
  const cambio_pwd = req.body.cambio_password !== undefined ? req.body.cambio_password : 1;
  const two_fa = req.body.two_factor ? 1 : 0;
  const result = db.prepare(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili, lingua, cambio_password, two_factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.cliente_id, nome, email, password_hash, 'user', schede_visibili || 'ticket,progetti,ai', userLingua, cambio_pwd, two_fa);

  const user = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?'
  ).get(result.lastInsertRowid);

  // Send welcome email
  const loginUrl = `${process.env.FRONTEND_BASE_URL || 'https://www.stmdomotica.cloud/ticketing'}/client/login`;
  sendNoreplyEmail(
    email,
    'Benvenuto — STM Domotica Ticketing',
    `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#0d9488;margin:0;">STM Domotica</h2>
        <p style="color:#6b7280;font-size:13px;">Portale Assistenza Tecnica</p>
      </div>
      <p>Gentile <strong>${nome}</strong>,</p>
      <p>BENVENUTO! Ti è stato creato un account per utilizzare il servizio di ticketing di STM Domotica.</p>
      <p>Segui il link per accedere:</p>
      <p style="text-align:center;margin:20px 0;">
        <a href="${loginUrl}" style="background:#0d9488;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Accedi al Portale</a>
      </p>
      <p>Di seguito la tua password provvisoria:</p>
      <p style="text-align:center;margin:20px 0;">
        <span style="background:#f0f4f8;border:1px solid #d0d7de;border-radius:8px;padding:12px 24px;font-size:20px;font-weight:bold;letter-spacing:2px;display:inline-block;">${password}</span>
      </p>
      <p style="color:#6b7280;font-size:12px;">Ti consigliamo di cambiare la password al primo accesso.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="color:#9ca3af;font-size:11px;text-align:center;">STM Domotica Corporation S.r.l. — Questo messaggio è stato inviato automaticamente.</p>
    </div>`
  ).catch(err => console.error('Welcome email error:', err));

  res.status(201).json(user);
});

// PUT /api/client-auth/portal-users/:userId — update user (admin can edit users of same company)
router.put('/portal-users/:userId', authenticateClientToken, requireClientAdmin, (req, res) => {
  const { nome, email, password, schede_visibili, lingua, attivo } = req.body;
  const user = db.prepare('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.user.cliente_id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM utenti_cliente WHERE email = ? AND id != ?').get(email, req.params.userId);
    if (existing) return res.status(400).json({ error: 'Email già in uso' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  const newLingua = lingua ? (['it', 'en', 'fr'].includes(lingua) ? lingua : user.lingua) : user.lingua;

  const cambio_pwd = req.body.cambio_password !== undefined ? req.body.cambio_password : null;
  const two_fa = req.body.two_factor !== undefined ? req.body.two_factor : null;
  db.prepare(`
    UPDATE utenti_cliente SET
      nome = COALESCE(?, nome),
      email = COALESCE(?, email),
      password_hash = ?,
      schede_visibili = COALESCE(?, schede_visibili),
      lingua = ?,
      attivo = COALESCE(?, attivo),
      cambio_password = COALESCE(?, cambio_password),
      two_factor = COALESCE(?, two_factor)
    WHERE id = ?
  `).run(nome || null, email || null, newHash, schede_visibili || null, newLingua, attivo !== undefined ? attivo : null, cambio_pwd, two_fa, req.params.userId);

  const updated = db.prepare(
    'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?'
  ).get(req.params.userId);
  res.json(updated);
});

// DELETE /api/client-auth/portal-users/:userId — delete user
router.delete('/portal-users/:userId', authenticateClientToken, requireClientAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?').get(req.params.userId, req.user.cliente_id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  if (Number(req.params.userId) === req.user.id) return res.status(403).json({ error: 'Non puoi eliminare te stesso' });
  if (user.ruolo === 'admin') {
    const adminCount = db.prepare('SELECT COUNT(*) as cnt FROM utenti_cliente WHERE cliente_id = ? AND ruolo = ?').get(req.user.cliente_id, 'admin');
    if (adminCount.cnt <= 1) return res.status(403).json({ error: 'Deve rimanere almeno un admin' });
  }

  db.prepare('DELETE FROM utenti_cliente WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

module.exports = router;
