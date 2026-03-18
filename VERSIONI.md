# Storico Versioni

## V3.7.00-0318 — 18 Marzo 2026
- Gestione tecnici nel dettaglio progetto (Gantt): toggle per assegnare/rimuovere tecnici
- Multi-tecnico per attività: dropdown con checkbox, campo `tecnici_ids`
- Accesso attività per tecnico: solo attività assegnate, pagina "Utente non abilitato" se non autorizzato
- Nomi tecnici visibili per tutti (anche tecnici non admin) tramite `tecnici_nomi` dal backend
- Knowledge Base checkbox nascosta per tecnici senza AI
- Default `abilitato_ai = 0` per nuovi tecnici, reset tutti i tecnici esistenti a 0
- Fix lista utenti: campo `abilitato_ai` incluso nella query GET

## V3.6.00-0318 — 18 Marzo 2026
- Abilitazione AI per tecnico: flag `abilitato_ai` su tabella utenti
- Checkbox "Abilita AI Assistant" nel form creazione e modifica tecnico (estesa + compatta)
- Menu AI admin nascosto per tecnici non abilitati
- Fix modifica utente in vista compatta: form inline sotto la riga con Salva/Annulla

## V3.5.00-0317 — 17 Marzo 2026
- Servizi per cliente: 3 flag (Ticket, Progetti, AI) configurabili in creazione e dettaglio cliente
- Portale client: menu e accesso pagine filtrati per servizi attivi del cliente
- Protezione URL diretto: redirect automatico se servizio disattivato
- Creazione utente portale (admin + client): checkbox disabilitate per servizi non attivi
- Pagina Utenti admin: toggle vista Estesa/Compatta (tabella)
- Pagina Clienti admin: toggle vista Estesa/Compatta (tabella con SLA, ticket, progetti)
- Migrazione DB: colonne servizio_ticket, servizio_progetti, servizio_ai su tabella clienti

## V3.4.03-0317 — 17 Marzo 2026
- AI: rimossi tutti i limiti di ricerca documenti (LIMIT e troncamento 2000 char)
- AI: carica tutti i documenti repository + tutte le FAQ Suprema ad ogni domanda (128K token Groq)
- Repository: fix allineamento colonne tabella (header/body)
- Repository: fix categoria editing (select parte da "Altro" per categorie non standard)
- Migrazione: rinominata categoria "generale" → "Altro"

## V3.4.02-0316 — 16 Marzo 2026
- Repository: colonna AI con spunta verde se testo estratto
- Repository: descrizione spostata sotto la riga con triangolino espandibile, modificabile con matita
- Repository: 3 categorie fisse (Accessi, TVCC, Altro) con select e filtri dedicati
- Repository: paginazione a 10 file per pagina

## V3.4.01-0316 — 16 Marzo 2026
- Pagina Utenti admin: bottone matita per modifica nome, email e password di ogni tecnico
- Form Nuovo Tecnico: checkbox "Richiedi cambio password al primo accesso"
- Login admin: schermata cambio password obbligatorio al primo accesso (come portale client)
- Endpoint `PUT /api/auth/change-password` per admin (Node.js + PHP)
- Migrazione DB: colonna `cambio_password` aggiunta a tabella `utenti`
- Dettaglio Progetto (Gantt): gestione referenti — aggiungi da elenco esistente, crea nuovo, rimuovi

## V3.4.00-0315 — 15 Marzo 2026
- AI referenze: sezione "📎 Fonti:" in fondo ad ogni risposta AI con elenco documenti utilizzati
- Fix overflow chat AI: testo lungo non esce più dalla finestra (admin, client, ticket)
- Libreria `smalot/pdfparser` installata su Aruba per estrazione testo PDF

## V3.3.02-0315 — 15 Marzo 2026
- PHP: estrazione testo PDF nel repository via `smalot/pdfparser` (prima solo .txt/.md)
- AI keyword search: mantiene trattini nei termini di ricerca, soglia abbassata a 3 caratteri (prima 4)
- Fix applicato su tutti gli endpoint AI (Node.js + PHP)
- Nota informativa nel box upload repository sui formati supportati dall'AI

## V3.3.01-0315 — 15 Marzo 2026
- Messaggio login errato: "Accesso Negato — Verifica i dati" (admin + client)
- Menu client admin: stessa dimensione dei menu user, allineato a destra
- Rimosso bottone "Accedi Ticketing/Progetti" dalla pagina dettaglio cliente admin
- Dashboard cliente: link "Progetti" apre Timeline filtrata per cliente
- Dashboard cliente: SLA assegnata nel box tempo medio gestione ticket
- Timeline: supporto parametro URL `?cliente=` per filtro preimpostato

## V3.3.00-0314 — 14 Marzo 2026
- CSP Google Fonts: aggiunto `fonts.googleapis.com` e `fonts.gstatic.com` ai Content-Security-Policy su tutti e 3 i livelli (.htaccess, Node.js, PHP)
- Fix Timeline: progetti "Senza Attività" ora visibili nel filtro "Aperti"
- Menu portale client su due righe: riga 1 per tutti (Ticket, Progetti, AI), riga 2 solo admin (Dashboard, Utenti)
- Rinominato "I Miei Ticket" → "Ticket" e "I Miei Progetti" → "Progetti" nel portale client (IT/EN/FR)

## V3.2.00-0314 — 14 Marzo 2026
- Dashboard cliente lato portale: nuova pagina `/client/dashboard` con torte ticket/email/progetti, tempi medi, ticket recenti
- Endpoint `GET /api/client-auth/dashboard` (Node.js + PHP), solo admin cliente
- Link Dashboard nel menu portale client (solo admin cliente)
- Filtro "Solo miei" nella lista ticket client: filtra per `creatore_email` dell'utente loggato
- Email di benvenuto automatica alla creazione utente cliente (admin + client, Node.js + PHP)
- Rimosso bottone "Dashboard Sistemi" dalla pagina login clienti
- Traduzioni i18n IT/EN/FR per dashboard e filtro

## V3.1.04-0314 — 14 Marzo 2026
- Fix posizione banner sicurezza AI: ora dentro la colonna chat (stessa larghezza) sia lato admin che client

## V3.1.03-0314 — 14 Marzo 2026
- Titolo "Dettaglio Progetto" nella pagina progetto singolo (ProjectGantt)
- Titolo "Dettaglio Attività" nella pagina attività singola (ActivityDetail) con sottotitolo progetto + nome attività
- Banner sicurezza AI spostato sotto la chat nella pagina admin AI
- Banner sicurezza AI aggiunto nella pagina client AI con traduzioni i18n (IT/EN/FR)

## V3.1.02-0314 — 14 Marzo 2026
- Icona Dashboard Cliente in alto a destra di ogni card nella lista clienti

## V3.1.01-0314 — 14 Marzo 2026
- Fix route PHP dashboard cliente: parametro `:clienteId` al posto di regex `(\d+)` incompatibile con il router

## V3.1.00-0314 — 14 Marzo 2026
- Nuovo schema versione a 3 segmenti: `V{X}.{Y}.{ZZ}-MMGG` (major.minor.patch-data)
- CLAUDE.md riscritto: checklist commit obbligatoria a 8 passi con checkbox
- Domanda "Versione maggiore o minore?" obbligatoria prima di ogni commit
- Messaggio finale commit con menzione esplicita README e VERSIONI
- Regole anti-dimenticanza per README.md e VERSIONI.md

## V3.0-0314 — 14 Marzo 2026
- Dashboard Cliente: nuova pagina `/admin/clients/:id/dashboard` con statistiche dedicate per cliente
- Grafici a torta: ticket (aperti/chiusi), email (assegnate/non assegnate), progetti (attivi/chiusi/bloccati/senza attivita)
- Valori: tempo medio gestione ticket, tempo medio durata attivita di progetto
- Banner cliente con nome azienda, email, telefono, referente (stile Gantt)
- Rinominato "Dashboard Sistemi" in "Dashboard Cliente" nella pagina dettaglio cliente
- AI Assistente admin/tecnico: nuova pagina `/admin/ai` con chat AI general-purpose
- Pannello informativo su fonti dati AI: Repository documenti, FAQ Suprema, Knowledge Base clienti (incluse note salvate con flag KB)
- Link "AI Assistente" nel sidebar admin, visibile ad admin e tecnici
- Nuovo endpoint `POST /api/ai/admin-assist` (Node.js + PHP) con accesso cross-client a tutte le KB
- Nuovo endpoint `GET /api/dashboard/client/:clienteId` (Node.js + PHP) per statistiche cliente

## V2.9-0314 — 14 Marzo 2026
- RAG prompt injection defense: funzione `sanitizeContext()` filtra 20+ pattern di injection dal contesto prima dell'invio al modello AI
- Pattern filtrati: manipolazione istruzioni, cambio ruolo, data exfiltration, meta-prompt
- Difesa su due livelli: sanitizzazione pre-invio (livello 2) + system prompt hardening (livello 1, V2.7)
- Applicata su tutti e 4 gli endpoint AI (Node.js + PHP)

## V2.8-0314 — 14 Marzo 2026
- README: documentazione completa audit IDOR endpoint client vs admin
- Tabella copertura validazione su tutti i 10 endpoint client con dettaglio check per ciascuno
- Sezione anti-prompt-injection AI documentata nel README
- Sezione isolamento tecnico (ownership check) documentata

## V2.7-0314 — 14 Marzo 2026
- Anti-prompt-injection nei system prompt AI: documenti di contesto trattati come dati puri, mai come istruzioni
- Protezione su tutti e 4 gli endpoint AI (ticket-assist + client-assist, Node.js + PHP)
- Blocco esplicito di pattern injection: "ignora istruzioni precedenti", "rivela lo schema", "cambia ruolo"
- AI non rivela mai configurazione interna, schema DB, credenziali o architettura

## V2.6-0314 — 14 Marzo 2026
- Security headers globali nel .htaccess root: CSP, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- Headers applicati su 3 livelli: .htaccess root (HTML), PHP router (API), Node.js middleware (dev)
- Aggiunto Permissions-Policy: disabilita camera, microfono, geolocalizzazione, pagamenti
- README: sezione .htaccess completa con tabella copertura headers, dettaglio protezioni per livello

## V2.5-0314 — 14 Marzo 2026
- Flag "Salva in Knowledge Base" nelle note interne ticket e note attività
- Nota salvata anche in schede_cliente per il cliente associato, disponibile per AI (admin + client)
- Security headers globali (Node.js + PHP): CSP, X-Frame-Options DENY, X-XSS-Protection, Referrer-Policy, X-Content-Type-Options
- README: corrette istruzioni seed (flag file + SEED_KEY dedicata)

## V2.4-0314 — 14 Marzo 2026
- Client AI chat: aggiunto caricamento schede Knowledge Base filtrate per cliente (tenant isolation)
- Ogni cliente vede solo le proprie schede KB nella chat AI, non quelle di altri clienti
- Modifica applicata su entrambi i backend (Node.js + PHP)

## V2.3-0314 — 14 Marzo 2026
- CLAUDE.md: procedura commit aggiornata — push e deploy frontend sono ora obbligatori ad ogni commit
- Aggiunto passo esplicito `git push && git push --tags` e nota IMPORTANTE sulla completezza della procedura

## V2.2-0314 — 14 Marzo 2026
- README.md aggiornato alla V2.1: versione, struttura progetto, schema DB 21+ tabelle, sezione sicurezza completa, istruzioni migrazione con flag file + MIGRATE_KEY
- CLAUDE.md aggiornato: nota migrazioni PHP con flag file e chiave dedicata
- Nuovi file documentati: RateLimiter.php, rateLimiter.js, uploadSecurity.js
- Sezione sicurezza README riscritta: autenticazione, impersonation, rate limiting, upload security, IDOR/BOLA, IMAP hardening

## V2.1-0314 — 14 Marzo 2026
- Security hardening completo su tutti gli endpoint
- Fix XSS: rimosso dangerouslySetInnerHTML da ClientLayout, split chatDisclaimer in 3 chiavi i18n (IT/EN/FR)
- Fix HTTP header injection nei download file (repository + progetti)
- Impersonation blindata: audit log DB, claim admin_id nel JWT, TTL ridotto a 1h, banner amber con uscita rapida
- Upload security: magic bytes validation, blocco doppie estensioni, whitelist globale, .htaccess anti-esecuzione in uploads/
- IMAP hardening: rate limit 30 email/ciclo + 10/ora per mittente, body troncato a 50KB, stripHtml rinforzata
- Anti-spoofing: [TICKET] verifica mittente vs cliente del ticket, [COMM] accettato solo da admin
- IDOR/BOLA fix: tecnico limitato a ticket/progetti assegnati, KB cards solo admin, referenti solo admin
- Rate limiting login: express-rate-limit globale (100/min), lockout progressivo 5 tentativi/15min (Node.js + PHP)
- Rate limiting AI: 20 req/min, impersonation: 5/ora
- PHP RateLimiter DB-based per Aruba (no Redis)
- Tabelle DB: audit_log + rate_limits
- Endpoint GET /api/users/audit-log per consultare log operazioni sensibili
- Migrazione/seed: chiavi dedicate sha256, flag file _ENABLE_, reset solo CLI, logging

## V2.0-0314 — 14 Marzo 2026
- Stato progetto calcolato automaticamente: Chiuso (tutte attività completate), Attivo, Bloccato (attività bloccata), Senza attività
- Eliminazione progetto con conferma (cestino in ProjectDetail e ProjectGantt)
- Colonna 2F nella tabella utenti portale (admin e client) con SI/NO
- Checkbox "Cambio password al primo avvio" disabilitato dopo primo cambio, riabilitato solo se admin cambia password
- Timeline: filtri Aperti/Chiusi/Senza Attività/Tutti, legenda pallini colorati
- Colori timeline aggiornati: blu=attivo, verde=chiuso, rosso=bloccato, grigio=senza attività
- Fix cache CDN Aruba: index.html rinominato in _app.html, servito via index.php con header no-cache

## V1.8-0313 — 13 Marzo 2026
- Cambio password al primo avvio: modale con nuova password + conferma + toggle visibilità
- Autenticazione a 2 fattori via email: codice 6 cifre via noreply, 3 tentativi max, scadenza 10 min
- Opzioni sicurezza (cambio psw + 2FA) nel form utenti admin e client
- Versione app nel sidebar admin
- Nota sotto email referente commerciale in creazione/modifica cliente
- Nuove colonne DB: cambio_password, two_factor, two_factor_code, two_factor_expires, two_factor_attempts
- Traduzioni i18n IT/EN/FR per 2FA e cambio password

## V1.7-0313 — 13 Marzo 2026
- Aggiunto script `npm run reset` per reset DB finale (solo utente admin)
- Aggiornate regole Git in CLAUDE.md con procedura versioning dettagliata

## V1.6-0313 — 13 Marzo 2026
- Disabilitato caching browser per index.html e risposte API (meta tag + .htaccess)

## V1.5-0313 — 13 Marzo 2026
- Dettaglio progetto client: aggiunta descrizione breve, allegati, referenti
- Vista compatta client: righe espandibili con toggle descrizione/allegati/referenti
- Admin ProjectDetail e ProjectGantt: aggiunto toggle referenti e label STM Manutenzione Ordinaria
- Layout client allargato a max-w-6xl
- README.md riscritto, CLAUDE.md snellito, rimosso PROJECT_CONTEXT.md obsoleto

## V1.4-0310 — 10 Marzo 2026
- Pagina admin comunicazioni (`/admin/comunicazioni`) con CRUD completo
- Banner comunicazioni ridisegnato con tracking lettura per utente
- Contatore letture lato admin (letti/totale utenti)
- Flag "importante" per comunicazioni persistenti

## V1.3-0310 — 10 Marzo 2026
- Referenti progetto (tabelle `referenti_progetto` + `progetto_referenti`)
- Fix login e validazione token
- CronRunner PHP per job automatici
- Fix migrazioni PHP per MySQL 5.6

## V1.1-0310 — 10 Marzo 2026
- Config criptato (`config.env`) per credenziali server
- Polling automatico email IMAP
- Notifiche admin per nuovi ticket
- Footer con versione app nella Dashboard

## V1.0-1003 — 10 Marzo 2026
- Fix deployment Aruba: compatibilita MySQL 5.6, CGI auth header, base path
- Primo deploy funzionante in produzione

## V0.9 — 9 Marzo 2026
- Porting completo backend PHP/MySQL per hosting Aruba
- Router custom PHP, PDO MySQL, PHPMailer
- Toggle visibilita AI per cliente
- Miglioramenti email noreply
- Background personalizzato pagina login

## V0.8 — 7 Marzo 2026
- Sistema allegati progetto (upload, download, delete)
- CLAUDE.md per continuita sessioni Claude Code

## V0.7 — 7 Marzo 2026
- Hardening sicurezza login (verifica token su DB al mount)
- Chat AI client con Groq Llama 3.3 70B
- Banner comunicazioni cliente nel portale
- Campo descrizione progetto

## V0.6 — 7 Marzo 2026
- i18n portale client (IT/EN/FR)
- Chat AI client con integrazione Groq
- FAQ scraper per knowledge base AI
- Tag email `[COMM slug]` per comunicazioni cliente via IMAP

## V0.5 — 4 Marzo 2026
- SLA per cliente (1g, 3g, nb)
- Email noreply dedicata
- Fix IMAP polling
- Gestione utenti portale client (admin portale)

## V0.1 — 2 Marzo 2026
- Commit iniziale: MVP completo
- Admin panel + Client portal
- Ticket, Progetti, Attivita, Email, Clienti, Utenti
- Dashboard con statistiche
- Chat progetto admin/tecnico
