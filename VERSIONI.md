# Storico Versioni

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
