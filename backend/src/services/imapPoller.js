const { ImapFlow } = require('imapflow');
const db = require('../db/database');
const { checkAndSync: checkFaqSync } = require('./faqScraper');

const IMAP_HOST = process.env.MAIL_IMAP_HOST;
const IMAP_PORT = parseInt(process.env.MAIL_IMAP_PORT) || 993;
const TICKETING_USER = process.env.MAIL_TICKETING_USER;
const TICKETING_PASS = process.env.MAIL_TICKETING_PASS;
const ASSISTENZA_USER = process.env.MAIL_ASSISTENZA_USER;
const ASSISTENZA_PASS = process.env.MAIL_ASSISTENZA_PASS;
const POLL_INTERVAL = parseInt(process.env.MAIL_POLL_INTERVAL) || 120000;

const imapEnabled = !!(IMAP_HOST && TICKETING_USER && TICKETING_PASS);

// Ticket code pattern: [TICKET #TK-YYYY-NNNN]
const TICKET_CODE_RE = /\[TICKET\s*#(TK-\d{4}-\d{4})\]/i;

// Communication tag pattern: [COMM slug]
const COMM_TAG_RE = /\[COMM\s+([a-z0-9-]+)\]/i;

// Security: max body length stored in DB (prevent DoS via huge emails)
const MAX_BODY_LENGTH = 50000; // ~50KB of text

// Security: rate limit — max emails imported per poll cycle per mailbox
const MAX_EMAILS_PER_POLL = 30;

// Security: rate limit — max emails from same sender in last hour
const MAX_PER_SENDER_HOUR = 10;

/**
 * Match sender email to a client in the DB
 */
function findClienteByEmail(senderEmail) {
  if (!senderEmail) return null;
  // Try exact match on clienti.email
  const cliente = db.prepare('SELECT id FROM clienti WHERE email = ?').get(senderEmail);
  if (cliente) return cliente.id;
  // Try match on utenti_cliente.email
  const utenteCliente = db.prepare('SELECT cliente_id FROM utenti_cliente WHERE email = ?').get(senderEmail);
  if (utenteCliente) return utenteCliente.cliente_id;
  // Try match on referenti_progetto.email
  const referente = db.prepare('SELECT cliente_id FROM referenti_progetto WHERE email = ?').get(senderEmail);
  if (referente) return referente.cliente_id;
  return null;
}

/**
 * Check if message_id already exists in DB (dedup)
 */
function messageExists(messageId) {
  if (!messageId) return false;
  const row = db.prepare('SELECT id FROM email WHERE message_id = ?').get(messageId);
  return !!row;
}

/**
 * Check if message_id already exists in comunicazioni_cliente (dedup)
 */
function comunicazioneExists(messageId) {
  if (!messageId) return false;
  const row = db.prepare('SELECT id FROM comunicazioni_cliente WHERE message_id = ?').get(messageId);
  return !!row;
}

/**
 * Find the best text part number from bodyStructure (text/plain preferred, text/html fallback)
 */
function findTextPartNum(structure, path) {
  if (!structure) return null;
  if (structure.childNodes && structure.childNodes.length > 0) {
    let htmlPart = null;
    for (let i = 0; i < structure.childNodes.length; i++) {
      const childPath = path ? `${path}.${i + 1}` : `${i + 1}`;
      const result = findTextPartNum(structure.childNodes[i], childPath);
      if (result && result.type === 'text/plain') return result;
      if (result && result.type === 'text/html' && !htmlPart) htmlPart = result;
    }
    return htmlPart;
  }
  const type = (structure.type || '').toLowerCase();
  if (type === 'text/plain' || type === 'text/html') {
    return { part: path || '1', type };
  }
  return null;
}

/**
 * Strip HTML to plain text (defensive — output is never rendered as HTML,
 * but we sanitize thoroughly in case the display layer ever changes)
 */
function stripHtml(html) {
  return html
    // Remove script/style blocks entirely (content included)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Preserve line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    // Collapse excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Truncate body to max length to prevent DB bloat from huge emails
 */
function truncateBody(text) {
  if (text.length <= MAX_BODY_LENGTH) return text;
  return text.substring(0, MAX_BODY_LENGTH) + '\n\n[... troncato — email troppo lunga]';
}

/**
 * Rate limit: check how many emails from this sender were imported in the last hour
 */
function isSenderRateLimited(senderEmail) {
  if (!senderEmail) return false;
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM email WHERE mittente = ? AND created_at > datetime('now', '-1 hour')"
  ).get(senderEmail);
  return row.cnt >= MAX_PER_SENDER_HOUR;
}

/**
 * Extract plain email address from "Name <email>" format
 */
function extractEmail(addr) {
  if (!addr) return '';
  if (typeof addr === 'object' && addr.address) return addr.address;
  const match = String(addr).match(/<([^>]+)>/);
  return match ? match[1] : String(addr).trim();
}

/**
 * Poll a single IMAP mailbox for UNSEEN messages
 */
async function pollMailbox(user, pass, handler) {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search for unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: false,
        bodyStructure: true,
        headers: ['message-id', 'in-reply-to', 'references'],
      });

      const toProcess = [];
      for await (const msg of messages) {
        toProcess.push(msg);
        if (toProcess.length >= MAX_EMAILS_PER_POLL) {
          console.warn(`[IMAP] Rate limit: elaborazione limitata a ${MAX_EMAILS_PER_POLL} email per ciclo`);
          break;
        }
      }

      for (const msg of toProcess) {
        // Fetch body text — find the right MIME part from bodyStructure
        let bodyText = '';
        const textPart = findTextPartNum(msg.bodyStructure, '');
        const partNum = textPart ? textPart.part : '1';
        try {
          const downloaded = await client.download(msg.seq, partNum, { uid: false });
          if (downloaded && downloaded.content) {
            const chunks = [];
            for await (const chunk of downloaded.content) {
              chunks.push(chunk);
            }
            let raw = Buffer.concat(chunks).toString('utf-8');
            if (textPart && textPart.type === 'text/html') {
              raw = stripHtml(raw);
            }
            bodyText = raw;
          }
        } catch (e) {
          // fallback: try part '1.1' for multipart emails
          try {
            const downloaded = await client.download(msg.seq, '1.1', { uid: false });
            if (downloaded && downloaded.content) {
              const chunks = [];
              for await (const chunk of downloaded.content) {
                chunks.push(chunk);
              }
              bodyText = Buffer.concat(chunks).toString('utf-8');
            }
          } catch (e2) { /* no body */ }
        }

        const envelope = msg.envelope;
        const messageId = envelope.messageId || null;
        const fromAddr = envelope.from && envelope.from[0] ? extractEmail(envelope.from[0]) : '';
        const toAddr = envelope.to && envelope.to[0] ? extractEmail(envelope.to[0]) : user;
        const subject = envelope.subject || '(nessun oggetto)';
        const date = envelope.date || new Date();
        const inReplyTo = envelope.inReplyTo || null;

        handler({
          messageId,
          from: fromAddr,
          to: toAddr,
          subject,
          date,
          body: bodyText,
          inReplyTo,
          seq: msg.seq,
        });

        // Mark as seen
        await client.messageFlagsAdd(msg.seq, ['\\Seen'], { uid: false });
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`[IMAP] Errore polling ${user}:`, err.message);
    try { await client.logout(); } catch (e) { /* ignore */ }
  }
}

/**
 * Handle messages from ticketing@ inbox
 * - If subject contains [TICKET #TK-YYYY-NNNN], associate with that ticket
 * - Otherwise import as generic email
 */
function handleTicketingMessage(msg) {
  if (messageExists(msg.messageId)) {
    console.log(`[IMAP] Skip duplicato: ${msg.messageId}`);
    return;
  }

  // Rate limit: skip if sender is flooding
  if (isSenderRateLimited(msg.from)) {
    console.warn(`[IMAP ticketing@] Rate limit superato per ${msg.from} — email ignorata`);
    return;
  }

  const clienteId = findClienteByEmail(msg.from);
  const ticketMatch = msg.subject.match(TICKET_CODE_RE);

  let ticketId = null;
  let threadId = null;

  if (ticketMatch) {
    const codice = ticketMatch[1];
    const ticket = db.prepare('SELECT id, cliente_id FROM ticket WHERE codice = ?').get(codice);
    if (ticket) {
      // Security: verify sender belongs to the ticket's client (anti-spoofing)
      // If sender is unknown (clienteId null) or matches ticket's client, allow association
      // If sender belongs to a DIFFERENT client, import as generic email (don't associate)
      if (clienteId && ticket.cliente_id && clienteId !== ticket.cliente_id) {
        console.warn(`[IMAP ticketing@] Mittente ${msg.from} (cliente ${clienteId}) non corrisponde al ticket ${codice} (cliente ${ticket.cliente_id}) — importata senza associazione`);
        // Don't associate with ticket — possible spoofing attempt
      } else {
        ticketId = ticket.id;
        threadId = `thread-${codice}`;
      }
    }
  }

  const body = truncateBody(msg.body);

  db.prepare(`
    INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id, message_id, letta)
    VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    msg.from,
    msg.to,
    msg.subject,
    body,
    clienteId,
    ticketId,
    threadId,
    msg.messageId
  );

  console.log(`[IMAP ticketing@] Importata: ${msg.subject} (da: ${msg.from})`);

  // If ticket found and was in_attesa, revert to in_lavorazione
  if (ticketId) {
    db.prepare("UPDATE ticket SET stato = 'in_lavorazione', updated_at = datetime('now') WHERE id = ? AND stato = 'in_attesa'").run(ticketId);
  }
}

/**
 * Handle messages from assistenzatecnica@ inbox
 * Import as email_cliente, unassigned, for admin to manage
 */
function handleAssistenzaMessage(msg) {
  // Check for [COMM slug] tag — client communication via email
  // Security: [COMM] emails come from admin (assistenzatecnica@ outgoing), not from external senders.
  // We verify the sender is a known admin user to prevent spoofed communications.
  const commMatch = msg.subject.match(COMM_TAG_RE);
  if (commMatch) {
    const slug = commMatch[1].toLowerCase();

    // Verify sender is an admin (anti-spoofing: external users can't inject [COMM] messages)
    const senderIsAdmin = db.prepare("SELECT id FROM utenti WHERE email = ? AND ruolo = 'admin'").get(msg.from);
    if (!senderIsAdmin) {
      console.warn(`[IMAP assistenza@] [COMM] tag da mittente non-admin: ${msg.from} — trattata come email normale`);
      // Fall through to regular email import below
    } else {
      const cliente = db.prepare('SELECT id FROM clienti WHERE portale_slug = ?').get(slug);

      if (cliente) {
        if (comunicazioneExists(msg.messageId)) {
          console.log(`[IMAP] Skip comunicazione duplicata: ${msg.messageId}`);
          return;
        }

        const oggettoClean = msg.subject.replace(COMM_TAG_RE, '').trim();
        const body = truncateBody(msg.body);

        db.prepare(`
          INSERT INTO comunicazioni_cliente (cliente_id, oggetto, corpo, mittente, message_id, data_ricezione)
          VALUES (?, ?, ?, ?, ?, datetime(?))
        `).run(
          cliente.id,
          oggettoClean,
          body,
          msg.from,
          msg.messageId,
          new Date(msg.date).toISOString()
        );

        console.log(`[IMAP assistenza@] Comunicazione cliente (${slug}): ${oggettoClean}`);
        return;
      } else {
        console.warn(`[IMAP assistenza@] [COMM] slug non trovato: "${slug}" — trattata come email normale`);
      }
    }
  }

  if (messageExists(msg.messageId)) {
    console.log(`[IMAP] Skip duplicato: ${msg.messageId}`);
    return;
  }

  // Rate limit: skip if sender is flooding
  if (isSenderRateLimited(msg.from)) {
    console.warn(`[IMAP assistenza@] Rate limit superato per ${msg.from} — email ignorata`);
    return;
  }

  const clienteId = findClienteByEmail(msg.from);
  const body = truncateBody(msg.body);

  db.prepare(`
    INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, message_id, letta)
    VALUES ('email_cliente', ?, ?, ?, ?, ?, ?, 0)
  `).run(
    msg.from,
    msg.to,
    msg.subject,
    body,
    clienteId,
    msg.messageId
  );

  console.log(`[IMAP assistenza@] Importata: ${msg.subject} (da: ${msg.from})`);
}

/**
 * Run one polling cycle for both mailboxes
 */
async function pollAll() {
  console.log('[IMAP] Polling in corso...');

  if (TICKETING_USER && TICKETING_PASS) {
    await pollMailbox(TICKETING_USER, TICKETING_PASS, handleTicketingMessage);
  }

  if (ASSISTENZA_USER && ASSISTENZA_PASS) {
    await pollMailbox(ASSISTENZA_USER, ASSISTENZA_PASS, handleAssistenzaMessage);
  }

  console.log('[IMAP] Polling completato');

  // Check FAQ sync (runs max once every 24h)
  checkFaqSync().catch(err => console.error('[FAQ Scraper] Errore:', err.message));
}

let pollTimer = null;

function startPolling() {
  if (!imapEnabled) {
    console.log('[IMAP] Credenziali mancanti — polling disattivato');
    return;
  }

  console.log(`[IMAP] Polling attivo ogni ${POLL_INTERVAL / 1000}s`);

  // First poll after 10 seconds (let server finish starting)
  setTimeout(() => {
    pollAll().catch(err => console.error('[IMAP] Errore:', err.message));
    // Then poll at interval
    pollTimer = setInterval(() => {
      pollAll().catch(err => console.error('[IMAP] Errore:', err.message));
    }, POLL_INTERVAL);
  }, 10000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = { startPolling, stopPolling, pollAll };
