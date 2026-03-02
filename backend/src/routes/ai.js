const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/ai/ticket-assist
router.post('/ticket-assist', authenticateToken, async (req, res) => {
  const { ticket_id, domanda } = req.body;
  if (!ticket_id || !domanda) {
    return res.status(400).json({ error: 'ticket_id e domanda sono obbligatori' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY non configurata. Aggiungi la chiave nel file .env del backend.' });
  }

  // 1. Current ticket
  const ticket = db.prepare(`
    SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email
    FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id
    WHERE t.id = ?
  `).get(ticket_id);
  if (!ticket) return res.status(404).json({ error: 'Ticket non trovato' });

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
    WHERE contenuto_testo IS NOT NULL AND contenuto_testo != ''
    ORDER BY LENGTH(contenuto_testo) DESC LIMIT 5
  `).all();

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

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sei un assistente tecnico IT esperto. Aiuti i tecnici a risolvere ticket di assistenza.
Rispondi in italiano, in modo operativo e conciso.
Hai accesso alle schede knowledge base del cliente, allo storico dei ticket e ai documenti tecnici del repository.
Usa queste informazioni per fornire risposte contestuali e specifiche.
Se suggerisci soluzioni, sii pratico e fornisci passi concreti.
Se prepari risposte per il cliente, usa un tono professionale ma cordiale.`
        },
        {
          role: 'user',
          content: `Contesto:\n${context}\n\nDomanda del tecnico: ${domanda}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    res.json({
      risposta: completion.choices[0].message.content,
      tokens_usati: completion.usage?.total_tokens || 0,
    });
  } catch (err) {
    console.error('Errore OpenAI:', err.message);
    res.status(500).json({ error: `Errore AI: ${err.message}` });
  }
});

module.exports = router;
