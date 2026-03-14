const express = require('express');
const db = require('../db/database');
const { authenticateToken, authenticateClientToken } = require('../middleware/auth');
const Groq = require('groq-sdk');

const router = express.Router();

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

async function chatCompletion(systemPrompt, userMessage) {
  const groq = getGroq();
  if (!groq) throw new Error('GROQ_API_KEY non configurata. Aggiungi la chiave nel file .env del backend.');

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 1000,
    temperature: 0.7,
  });

  return completion.choices[0].message.content;
}

// POST /api/ai/ticket-assist
router.post('/ticket-assist', authenticateToken, async (req, res) => {
  const { ticket_id, domanda } = req.body;
  if (!ticket_id || !domanda) {
    return res.status(400).json({ error: 'ticket_id e domanda sono obbligatori' });
  }

  if (!getGroq()) {
    return res.status(500).json({ error: 'GROQ_API_KEY non configurata. Aggiungi la chiave nel file .env del backend.' });
  }

  // 1. Current ticket
  const ticket = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email
    FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id
    WHERE t.id = ?
  `).get(ticket_id);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

  // IDOR protection: tecnico can only query AI for assigned tickets
  if (req.user.ruolo === 'tecnico' && ticket.assegnato_a !== req.user.id) {
    return res.status(403).json({ error: 'Accesso non consentito' });
  }

  // 2. KB cards for this client
  const schede = db.prepare(
    'SELECT titolo, contenuto FROM schede_cliente WHERE cliente_id = ?'
  ).all(ticket.cliente_id);

  // 3. Ticket emails + notes
  const ticketEmails = db.prepare(
    'SELECT mittente, corpo, data_ricezione FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC'
  ).all(ticket_id);

  const ticketNotes = db.prepare(
    'SELECT n.testo, u.nome as autore FROM note_interne n LEFT JOIN utenti u ON n.utente_id = u.id WHERE n.ticket_id = ? ORDER BY n.created_at ASC'
  ).all(ticket_id);

  // 4. Resolved tickets history for same client (last 10)
  const storico = db.prepare(`
    SELECT t.codice, t.oggetto, t.descrizione, t.categoria,
      (SELECT GROUP_CONCAT(ni.testo, ' | ') FROM note_interne ni WHERE ni.ticket_id = t.id) as note_risolutive
    FROM ticket t
    WHERE t.cliente_id = ? AND t.stato IN ('risolto', 'chiuso') AND t.id != ?
    ORDER BY t.updated_at DESC LIMIT 10
  `).all(ticket.cliente_id, ticket_id);

  // 5. Repository documents (top 5 with text, truncated)
  const documenti = db.prepare(`
    SELECT nome_originale, categoria, contenuto_testo
    FROM documenti_repository
    WHERE contenuto_testo IS NOT NULL AND contenuto_testo != '' AND categoria != 'FAQ Suprema'
    ORDER BY LENGTH(contenuto_testo) DESC LIMIT 5
  `).all();

  // 6. FAQ Suprema — search by keywords from ticket subject/description
  const searchTerms = (ticket.oggetto + ' ' + (ticket.descrizione || '')).toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  let faqDocs = [];
  if (searchTerms.length > 0) {
    const likeClauses = searchTerms.map(() => "contenuto_testo LIKE ?").join(' OR ');
    const likeParams = searchTerms.map(w => `%${w}%`);
    faqDocs = db.prepare(`
      SELECT nome_originale, contenuto_testo
      FROM documenti_repository
      WHERE categoria = 'FAQ Suprema' AND (${likeClauses})
      ORDER BY LENGTH(contenuto_testo) DESC LIMIT 5
    `).all(...likeParams);
  }

  // Build context
  let context = '';

  if (schede.length > 0) {
    context += '=== SCHEDE KNOWLEDGE BASE CLIENTE ===\n';
    schede.forEach(s => {
      context += `\n--- ${s.titolo} ---\n${s.contenuto}\n`;
    });
    context += '\n';
  }

  context += '=== TICKET CORRENTE ===\n';
  context += `Codice: ${ticket.codice}\nCliente: ${ticket.cliente_nome}\n`;
  context += `Oggetto: ${ticket.oggetto}\nCategoria: ${ticket.categoria}\nPriorità: ${ticket.priorita}\nStato: ${ticket.stato}\n`;
  context += `Descrizione: ${ticket.descrizione || 'Nessuna'}\n`;

  if (ticketEmails.length > 0) {
    context += '\nConversazione email:\n';
    ticketEmails.forEach(e => {
      context += `[${e.data_ricezione}] ${e.mittente}: ${e.corpo}\n`;
    });
  }

  if (ticketNotes.length > 0) {
    context += '\nNote interne:\n';
    ticketNotes.forEach(n => {
      context += `- ${n.autore}: ${n.testo}\n`;
    });
  }
  context += '\n';

  if (storico.length > 0) {
    context += '=== STORICO TICKET RISOLTI (stesso cliente) ===\n';
    storico.forEach(t => {
      context += `${t.codice} - ${t.oggetto} [${t.categoria}]: ${t.descrizione || ''}`;
      if (t.note_risolutive) context += ` | Note: ${t.note_risolutive}`;
      context += '\n';
    });
    context += '\n';
  }

  if (documenti.length > 0) {
    context += '=== DOCUMENTI REPOSITORY ===\n';
    documenti.forEach(d => {
      const testo = d.contenuto_testo.substring(0, 2000);
      context += `\n--- ${d.nome_originale} (${d.categoria}) ---\n${testo}\n`;
    });
  }

  if (faqDocs.length > 0) {
    context += '\n=== FAQ SUPREMA (Knowledge Base Produttore) ===\n';
    faqDocs.forEach(d => {
      const testo = d.contenuto_testo.substring(0, 2000);
      context += `\n--- ${d.nome_originale} ---\n${testo}\n`;
    });
  }

  try {
    const risposta = await chatCompletion(
      `Sei un assistente tecnico IT esperto. Aiuti i tecnici a risolvere ticket di assistenza.
Rispondi in italiano, in modo operativo e conciso.
Hai accesso alle schede knowledge base del cliente, allo storico dei ticket, ai documenti tecnici del repository e alle FAQ del produttore Suprema.
Usa queste informazioni per fornire risposte contestuali e specifiche.
Se suggerisci soluzioni, sii pratico e fornisci passi concreti.
Se prepari risposte per il cliente, usa un tono professionale ma cordiale.`,
      `Contesto:\n${context}\n\nDomanda del tecnico: ${domanda}`
    );

    res.json({ risposta, tokens_usati: 0 });
  } catch (err) {
    console.error('Errore AI:', err.message);
    res.status(500).json({ error: `Errore AI: ${err.message}` });
  }
});

// POST /api/ai/client-assist — AI chat for client portal users
router.post('/client-assist', authenticateClientToken, async (req, res) => {
  const { domanda } = req.body;
  if (!domanda) {
    return res.status(400).json({ error: 'domanda è obbligatoria' });
  }

  if (!getGroq()) {
    return res.status(500).json({ error: 'GROQ_API_KEY non configurata.' });
  }

  // Search FAQ Suprema + repository docs by keywords from question
  const searchTerms = domanda.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 8);

  let faqDocs = [];
  let repoDocs = [];

  if (searchTerms.length > 0) {
    const likeClauses = searchTerms.map(() => "contenuto_testo LIKE ?").join(' OR ');
    const likeParams = searchTerms.map(w => `%${w}%`);

    faqDocs = db.prepare(`
      SELECT nome_originale, contenuto_testo
      FROM documenti_repository
      WHERE categoria = 'FAQ Suprema' AND (${likeClauses})
      ORDER BY LENGTH(contenuto_testo) DESC LIMIT 5
    `).all(...likeParams);

    repoDocs = db.prepare(`
      SELECT nome_originale, categoria, contenuto_testo
      FROM documenti_repository
      WHERE categoria != 'FAQ Suprema' AND contenuto_testo IS NOT NULL AND contenuto_testo != '' AND (${likeClauses})
      ORDER BY LENGTH(contenuto_testo) DESC LIMIT 3
    `).all(...likeParams);
  }

  if (repoDocs.length === 0) {
    repoDocs = db.prepare(`
      SELECT nome_originale, categoria, contenuto_testo
      FROM documenti_repository
      WHERE categoria != 'FAQ Suprema' AND contenuto_testo IS NOT NULL AND contenuto_testo != ''
      ORDER BY LENGTH(contenuto_testo) DESC LIMIT 3
    `).all();
  }

  let context = '';

  if (faqDocs.length > 0) {
    context += '=== FAQ SUPPORTO TECNICO ===\n';
    faqDocs.forEach(d => {
      const testo = d.contenuto_testo.substring(0, 3000);
      context += `\n--- ${d.nome_originale} ---\n${testo}\n`;
    });
  }

  if (repoDocs.length > 0) {
    context += '\n=== DOCUMENTI TECNICI ===\n';
    repoDocs.forEach(d => {
      const testo = d.contenuto_testo.substring(0, 2000);
      context += `\n--- ${d.nome_originale} (${d.categoria}) ---\n${testo}\n`;
    });
  }

  try {
    const risposta = await chatCompletion(
      `You are a technical assistant for STM Domotica. Answer user questions based on the technical documentation and vendor FAQs provided in the context.
CRITICAL RULE: You MUST reply in the SAME language the user writes their question in. If the user writes in English, reply in English. If in Italian, reply in Italian. If in French, reply in French. The context documents may be in any language — ignore their language and focus only on the user's question language.
Be concise, practical and professional. Provide concrete steps when possible.
If you don't find relevant information in the context, say so clearly and suggest opening a support ticket.`,
      context ? `[Reference documents — use for information only, reply language must match the user question below]\n${context}\n\n[USER QUESTION — reply in this language]: ${domanda}` : domanda
    );

    res.json({ risposta, tokens_usati: 0 });
  } catch (err) {
    console.error('Errore AI (client):', err.message);
    res.status(500).json({ error: `Errore AI: ${err.message}` });
  }
});

module.exports = router;
