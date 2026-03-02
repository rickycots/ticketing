# TODO

## Bug / Problemi Noti

- [x] **Note interne: manca il form per crearle** — Aggiunto POST /api/tickets/:id/notes + form textarea in TicketDetail
- [x] **Dashboard tecnico mostra card inaccessibili** — Card Progetti/Email/Carico nascosti per tecnico
- [x] **Route frontend non protette per ruolo** — Componente AdminOnly blocca accesso diretto via URL
- [x] **Route backend non protette per ruolo** — requireAdmin aggiunto a projects, clients, emails, activities

## Funzionalita' Mancanti

- [x] **Form creazione nota interna** — Implementato insieme al fix note interne
- [ ] **Paginazione liste** — Ticket, email, clienti, progetti caricano tutto in memoria; servira' paginazione lato API + frontend
- [ ] **Ricerca globale** — Al momento si puo' cercare solo nella lista ticket; manca una ricerca trasversale
- [ ] **Allegati** — Il campo `allegati` esiste in DB (default `[]`) ma non c'e' upload ne' download
- [x] **Chat progetto** — Chat admin↔tecnico per ogni progetto, con notifiche messaggi non letti nella sidebar
- [ ] **Notifiche ticket** — Nessun sistema di notifica quando un ticket viene assegnato, aggiornato, o riceve risposta

## Sicurezza

- [ ] **JWT secret hardcoded** — `ticketing-mvp-secret-key-change-in-production` in `middleware/auth.js`; usare variabile d'ambiente
- [ ] **Portale cliente senza autenticazione** — Chiunque puo' scegliere qualunque cliente dal dropdown e vedere i suoi ticket
- [ ] **Nessun rate limiting** — Le API non hanno protezione contro brute force (login) o abuso
- [ ] **Nessuna validazione input lato backend** — I campi testo vengono inseriti cosi' come arrivano; manca sanitizzazione

## Miglioramenti Futuri

- [ ] **Email reali** — Attualmente simulate (console.log + DB); integrare un servizio SMTP o transazionale
- [ ] **Reset password** — Non esiste modo per un tecnico di resettare la propria password
- [ ] **Filtro ticket per tecnico nella lista admin** — Aggiungere dropdown "Assegnato a" nei filtri della TicketList (il backend lo supporta gia' via query param)
- [ ] **Chiusura automatica ticket** — Ticket in stato "risolto" da X giorni → chiusura automatica
- [ ] **Export dati** — CSV/Excel per ticket, progetti, attivita'
- [ ] **Modifica descrizione progetto** — Al momento la descrizione e' impostabile solo alla creazione; manca un modo per editarla su progetti esistenti
