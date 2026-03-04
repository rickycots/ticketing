const { ImapFlow } = require('imapflow');
const db = require('../db/database');

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
 * Strip HTML tags to get plain text
 */
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();
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

  const clienteId = findClienteByEmail(msg.from);
  const ticketMatch = msg.subject.match(TICKET_CODE_RE);

  let ticketId = null;
  let threadId = null;

  if (ticketMatch) {
    const codice = ticketMatch[1];
    const ticket = db.prepare('SELECT id FROM ticket WHERE codice = ?').get(codice);
    if (ticket) {
      ticketId = ticket.id;
      threadId = `thread-${codice}`;
    }
  }

  db.prepare(`
    INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id, message_id, letta)
    VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    msg.from,
    msg.to,
    msg.subject,
    msg.body,
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
  if (messageExists(msg.messageId)) {
    console.log(`[IMAP] Skip duplicato: ${msg.messageId}`);
    return;
  }

  const clienteId = findClienteByEmail(msg.from);

  db.prepare(`
    INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, message_id, letta)
    VALUES ('email_cliente', ?, ?, ?, ?, ?, ?, 0)
  `).run(
    msg.from,
    msg.to,
    msg.subject,
    msg.body,
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
