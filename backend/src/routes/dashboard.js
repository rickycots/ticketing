const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard — dashboard statistics (filtered for tecnico)
router.get('/', authenticateToken, (req, res) => {
  const isTecnico = req.user.ruolo === 'tecnico';
  const userId = req.user.id;
  const ticketFilter = isTecnico ? ' AND assegnato_a = ?' : '';
  const ticketParams = isTecnico ? [userId] : [];

  // Open tickets count
  const ticketAperti = db.prepare(
    `SELECT COUNT(*) as count FROM ticket WHERE stato IN ('aperto', 'in_lavorazione', 'in_attesa')${ticketFilter}`
  ).get(...ticketParams);

  // Urgent tickets
  const ticketUrgenti = db.prepare(
    `SELECT * FROM ticket WHERE stato IN ('aperto', 'in_lavorazione') AND priorita IN ('urgente', 'alta')${ticketFilter} ORDER BY created_at DESC LIMIT 5`
  ).all(...ticketParams);

  // Active projects
  const progettiAttivi = db.prepare(
    "SELECT COUNT(*) as count FROM progetti WHERE stato = 'attivo'"
  ).get();

  // Projects blocked by client
  const progettiBloccoCliente = db.prepare(
    "SELECT COUNT(*) as count FROM progetti WHERE stato = 'attivo' AND blocco = 'lato_cliente'"
  ).get();

  // Unread emails (0 for tecnico, exclude ticket emails)
  const emailNonLette = isTecnico
    ? { count: 0 }
    : db.prepare("SELECT COUNT(*) as count FROM email WHERE letta = 0 AND tipo != 'ticket'").get();

  // Upcoming deadlines (next 7 days)
  const scadenzeFilter = isTecnico ? ' AND a.assegnato_a = ?' : '';
  const scadenzeParams = isTecnico ? [userId] : [];
  const scadenze = db.prepare(`
    SELECT a.*, p.nome as progetto_nome, u.nome as assegnato_nome
    FROM attivita a
    LEFT JOIN progetti p ON a.progetto_id = p.id
    LEFT JOIN utenti u ON a.assegnato_a = u.id
    WHERE a.data_scadenza IS NOT NULL
      AND a.stato != 'completata'
      AND a.data_scadenza <= date('now', '+7 days')
      AND a.data_scadenza >= date('now')
      ${scadenzeFilter}
    ORDER BY a.data_scadenza ASC
    LIMIT 10
  `).all(...scadenzeParams);

  // Workload per technician
  const caricoTecnici = db.prepare(`
    SELECT u.id, u.nome,
      (SELECT COUNT(*) FROM ticket t WHERE t.assegnato_a = u.id AND t.stato IN ('aperto', 'in_lavorazione')) as ticket_attivi,
      (SELECT COUNT(*) FROM attivita a WHERE a.assegnato_a = u.id AND a.stato IN ('da_fare', 'in_corso')) as attivita_attive
    FROM utenti u
    WHERE u.attivo = 1
    ORDER BY u.nome
  `).all();

  // Tickets by status
  const ticketPerStato = db.prepare(
    `SELECT stato, COUNT(*) as count FROM ticket WHERE 1=1${ticketFilter} GROUP BY stato`
  ).all(...ticketParams);

  // Recent tickets
  const ticketRecenti = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome
    FROM ticket t
    LEFT JOIN clienti c ON t.cliente_id = c.id
    WHERE 1=1${isTecnico ? ' AND t.assegnato_a = ?' : ''}
    ORDER BY t.created_at DESC
    LIMIT 5
  `).all(...ticketParams);

  // All scheduled activities
  let attivitaProgrammate = [];
  try { attivitaProgrammate = db.prepare('SELECT ap.*, a.nome as attivita_nome, p.nome as progetto_nome FROM attivita_programmate ap LEFT JOIN attivita a ON ap.attivita_id = a.id LEFT JOIN progetti p ON ap.progetto_id = p.id ORDER BY ap.data_pianificata ASC').all(); } catch(e) {}

  res.json({
    ticket_aperti: ticketAperti.count,
    ticket_urgenti: ticketUrgenti,
    progetti_attivi: progettiAttivi.count,
    progetti_blocco_cliente: progettiBloccoCliente.count,
    email_non_lette: emailNonLette.count,
    scadenze_imminenti: scadenze,
    carico_tecnici: caricoTecnici,
    ticket_per_stato: ticketPerStato,
    ticket_recenti: ticketRecenti,
    attivita_programmate: attivitaProgrammate,
  });
});

// GET /api/dashboard/sidebar-counts — count new tickets/emails since a timestamp
router.get('/sidebar-counts', authenticateToken, (req, res) => {
  const since = req.query.since || new Date(0).toISOString();
  const isTecnico = req.user.ruolo === 'tecnico';
  const userId = req.user.id;

  // Unread tickets
  let ticketCount;
  if (isTecnico) {
    ticketCount = db.prepare(
      "SELECT COUNT(*) as count FROM ticket WHERE letta = 0 AND assegnato_a = ?"
    ).get(userId).count;
  } else {
    ticketCount = db.prepare(
      "SELECT COUNT(*) as count FROM ticket WHERE letta = 0"
    ).get().count;
  }

  // Unread emails (non-ticket, admin only)
  let emailCount = 0;
  if (!isTecnico) {
    emailCount = db.prepare(
      "SELECT COUNT(*) as count FROM email WHERE letta = 0 AND tipo != 'ticket'"
    ).get().count;
  }

  res.json({ tickets_nuovi: ticketCount, email_nuove: emailCount });
});

// GET /api/dashboard/client/:clienteId — client-specific dashboard stats (admin only)
router.get('/client/:clienteId', authenticateToken, (req, res) => {
  if (req.user.ruolo !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  const clienteId = req.params.clienteId;

  // Client info
  const cliente = db.prepare('SELECT id, nome_azienda, email, telefono, referente, sla_reazione FROM clienti WHERE id = ?').get(clienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente non trovato' });

  // Ticket stats
  const ticketTotali = db.prepare('SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ?').get(clienteId).count;
  const ticketAperti = db.prepare("SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ? AND stato IN ('aperto','in_lavorazione','in_attesa')").get(clienteId).count;
  const ticketChiusi = db.prepare("SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ? AND stato IN ('risolto','chiuso')").get(clienteId).count;

  // Average ticket handling time (days between created_at and updated_at for closed/resolved tickets)
  const tempoMedioTicket = db.prepare(`
    SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
    FROM ticket WHERE cliente_id = ? AND stato IN ('risolto','chiuso')
  `).get(clienteId);

  // Email stats: emails linked to this client's tickets
  const emailTotali = db.prepare(`
    SELECT COUNT(*) as count FROM email e
    JOIN ticket t ON e.ticket_id = t.id
    WHERE t.cliente_id = ?
  `).get(clienteId).count;
  const emailAssegnate = db.prepare(`
    SELECT COUNT(*) as count FROM email e
    JOIN ticket t ON e.ticket_id = t.id
    WHERE t.cliente_id = ? AND e.ticket_id IS NOT NULL
  `).get(clienteId).count;
  const emailNonAssegnate = db.prepare(`
    SELECT COUNT(*) as count FROM email e
    LEFT JOIN ticket t ON e.ticket_id = t.id
    WHERE (t.cliente_id = ? OR e.tipo = 'email_cliente') AND e.ticket_id IS NULL
  `).get(clienteId).count;

  // Project stats
  const progettiTotali = db.prepare('SELECT COUNT(*) as count FROM progetti WHERE cliente_id = ?').get(clienteId).count;

  // Compute project statuses dynamically
  const allProjects = db.prepare('SELECT id FROM progetti WHERE cliente_id = ?').all(clienteId);
  let progettiAttivi = 0, progettiChiusi = 0, progettiBloccati = 0, progettiSenzaAttivita = 0;
  for (const p of allProjects) {
    const att = db.prepare('SELECT stato FROM attivita WHERE progetto_id = ?').all(p.id);
    if (att.length === 0) { progettiSenzaAttivita++; continue; }
    if (att.every(a => a.stato === 'completata')) { progettiChiusi++; continue; }
    if (att.some(a => a.stato === 'bloccata')) { progettiBloccati++; continue; }
    progettiAttivi++;
  }

  // Average activity duration (days between data_inizio and data_scadenza for completed activities in client projects)
  const tempoMedioAttivita = db.prepare(`
    SELECT AVG(julianday(a.data_scadenza) - julianday(a.data_inizio)) as avg_days
    FROM attivita a
    JOIN progetti p ON a.progetto_id = p.id
    WHERE p.cliente_id = ? AND a.stato = 'completata' AND a.data_inizio IS NOT NULL AND a.data_scadenza IS NOT NULL
  `).get(clienteId);

  // Recent tickets
  const ticketRecenti = db.prepare(`
    SELECT id, codice, oggetto, stato, priorita, created_at
    FROM ticket WHERE cliente_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).all(clienteId);

  res.json({
    cliente,
    ticket: { totali: ticketTotali, aperti: ticketAperti, chiusi: ticketChiusi },
    tempo_medio_ticket: tempoMedioTicket.avg_days ? Math.round(tempoMedioTicket.avg_days * 10) / 10 : null,
    email: { totali: emailTotali, assegnate: emailAssegnate, non_assegnate: emailNonAssegnate },
    progetti: { totali: progettiTotali, attivi: progettiAttivi, chiusi: progettiChiusi, bloccati: progettiBloccati, senza_attivita: progettiSenzaAttivita },
    tempo_medio_attivita: tempoMedioAttivita.avg_days ? Math.round(tempoMedioAttivita.avg_days * 10) / 10 : null,
    ticket_recenti: ticketRecenti,
  });
});

module.exports = router;
