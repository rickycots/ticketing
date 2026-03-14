# Ticketing & Project Management — STM Domotica

Sistema di Ticketing e Project Management con due portali: **Admin Panel** (gestione interna) e **Client Portal** (accesso clienti).

**Versione corrente:** V2.1-0314

**Produzione:** https://www.stmdomotica.cloud/ticketing/

## Tech Stack

### Produzione (Aruba Shared Hosting)
- **Frontend**: React 19 (Vite) + Tailwind CSS v4 + lucide-react
- **Backend**: PHP 8+ con router custom, PDO MySQL
- **DB**: MySQL 5.6+ (Aruba shared hosting)
- **Email**: SMTP via Aruba (ticketing@, assistenzatecnica@, noreply@stmdomotica.it)
- **AI**: Groq Llama 3.3 70B Versatile (free tier)

### Sviluppo Locale
- **Backend**: Node.js + Express + better-sqlite3
- **DB**: SQLite (file `backend/data/ticketing.db`)

## Struttura Progetto

```
php/                          # Backend PHP (produzione Aruba)
  api/
    index.php                 # Entry point + router
    config.php                # Configurazione (legge config.env)
    config.env                # Credenziali DB/JWT/Email (NON committare)
    core/
      Auth.php                # JWT auth (admin + client)
      Database.php            # PDO MySQL wrapper
      Mailer.php              # SMTP PHPMailer
      Response.php            # JSON response helper
      Router.php              # Router custom
      Upload.php              # Upload file handler (whitelist, magic bytes, double-ext block)
      RateLimiter.php         # Rate limiter DB-based (no Redis)
      CronRunner.php          # Cron job runner
    routes/
      auth.php                # Login/me admin
      clientAuth.php          # Login/me client, impersonate, comunicazioni, portal-users
      tickets.php             # CRUD ticket + endpoint client
      projects.php            # CRUD progetti + allegati + chat + referenti + client endpoints
      activities.php          # CRUD attivita
      emails.php              # CRUD email
      clients.php             # CRUD clienti + logo upload
      users.php               # CRUD utenti admin/tecnico
      notifications.php       # Notifiche admin
      dashboard.php           # Dashboard stats + sidebar counts
      knowledgeBase.php       # Schede cliente (KB cards)
      repository.php          # Repository documenti
      comunicazioni.php       # CRUD comunicazioni admin
      ai.php                  # AI ticket-assist (admin) + client-assist (client)
    migrations/
      001_schema.sql          # Schema SQL completo (include audit_log, rate_limits)
      fix_referenti.php       # Migrazioni incrementali
      migrate.php             # Runner migrazioni (flag file + chiave dedicata)
    cron/
      poll_emails.php         # IMAP polling
      scrape_faq.php          # FAQ scraping
    seed/
      seed.php                # Dati demo

backend/                      # Backend Node.js (sviluppo locale)
  .env                        # Variabili d'ambiente
  src/
    index.js                  # Entry point Express (port 3001)
    seed.js                   # Script seed demo data
    db/database.js            # SQLite + migrazioni
    db/schema.sql             # Schema SQL
    middleware/auth.js         # JWT auth
    middleware/rateLimiter.js  # Rate limiters (global, login, AI, upload, impersonate)
    middleware/uploadSecurity.js # Upload validation (whitelist, magic bytes, double-ext)
    routes/                   # Stesse route del PHP
    services/
      mailer.js               # SMTP nodemailer
      imapPoller.js           # IMAP polling
      faqScraper.js           # FAQ scraping

frontend/                     # React SPA (condiviso)
  src/
    App.jsx                   # Router principale (admin + client routes)
    version.js                # Versione app (visualizzata in Dashboard)
    api/client.js             # Tutte le chiamate API + session management
    i18n/clientTranslations.js # Traduzioni IT/EN/FR portale client
    layouts/
      AdminLayout.jsx         # Sidebar nav, notifiche, chat badges
      ClientLayout.jsx        # Header nav, comunicazioni banner, Teams FAB
    components/
      GanttChart.jsx          # Componente Gantt
      Pagination.jsx          # Paginazione riutilizzabile
    pages/
      Login.jsx               # Login admin
      ClientLogin.jsx         # Login client
      admin/
        Dashboard.jsx         # Dashboard con stats + versione
        TicketList.jsx        # Lista ticket con filtri
        TicketDetail.jsx      # Dettaglio ticket + AI sidebar + KB sidebar
        ProjectList.jsx       # Lista progetti (creazione con referenti obbligatori)
        ProjectDetail.jsx     # Dettaglio progetto (tab, chat, allegati, referenti)
        ProjectGantt.jsx      # Vista Gantt + allegati + referenti
        ActivityDetail.jsx    # Dettaglio singola attivita
        TimelineList.jsx      # Timeline tutti i progetti (creazione rapida)
        EmailInbox.jsx        # Inbox email
        ClientList.jsx        # Lista clienti
        ClientDetail.jsx      # Dettaglio cliente + KB + utenti portale
        UserList.jsx          # Gestione utenti admin/tecnico
        Repository.jsx        # Repository documenti
        ComunicazioniList.jsx # Gestione comunicazioni client
      client/
        TicketList.jsx        # Lista ticket (sidebar + aperti + chiusi)
        TicketDetail.jsx      # Dettaglio ticket
        TicketForm.jsx        # Apertura nuovo ticket
        ProjectsView.jsx      # Lista progetti (vista estesa/compatta)
        ClientProjectDetail.jsx # Dettaglio progetto client
        AiChat.jsx            # Chat AI (sidebar + chat)
        UserManagement.jsx    # Gestione utenti portale

deploy/
  deploy.js                   # Script FTP deploy (--frontend / --php)
```

## Protezione .htaccess

Tre file `.htaccess` proteggono l'applicazione in produzione su tre livelli:

### Root (`/ticketing/.htaccess`) — Frontend + Routing
- **File bloccati**: `.md`, `.env`, `.enc`, `.json`, `.log`, `.sql`, `.sh`, `.gitignore`, `composer.json`, `config.enc`
- **Security headers globali** (applicati a tutte le risposte HTML/JS/CSS):
  - `X-Frame-Options: DENY` — anti-clickjacking, impedisce embedding in iframe
  - `X-Content-Type-Options: nosniff` — impedisce MIME sniffing del browser
  - `X-XSS-Protection: 1; mode=block` — protezione XSS per browser legacy
  - `Referrer-Policy: strict-origin` — limita invio referrer a terze parti
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'` — restringe caricamento risorse alla stessa origin, blocca script/font/connect esterni, impedisce framing
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` — disabilita API browser sensibili
- **Cache disabled** per HTML/PHP: `no-cache, no-store, must-revalidate`
- Routing SPA React con cache busting per CDN Aruba

### API (`/ticketing/api/.htaccess`) — Backend PHP
- **File bloccati**: `.env`, `.enc`, `.sql`, `.log`, `.json`, `config.php`, `config.env`, `composer.json`, `composer.lock`, `_ENABLE_*` (flag files migrazione/seed)
- Passa header `Authorization` a PHP (necessario per CGI/FastCGI su Aruba)
- Routing API verso `index.php` front controller
- **Security headers API** aggiuntivi impostati nel PHP router (`index.php`): stessi header CSP/X-Frame/X-XSS delle risposte HTML

### Uploads (`/ticketing/api/uploads/.htaccess`) — File caricati dagli utenti
- **Blocca esecuzione** di tutti gli script: `.php`, `.php3-7`, `.phtml`, `.phar`, `.pl`, `.py`, `.cgi`, `.asp`, `.aspx`, `.jsp`, `.sh`, `.shtml`
- `RemoveHandler` / `RemoveType` per tutti i tipi script — impedisce interpretazione anche se rinominati
- `Options -Indexes -ExecCGI` — no directory listing, no CGI
- `X-Content-Type-Options: nosniff` — impedisce al browser di interpretare un file come script
- `Content-Security-Policy: default-src 'none'` — nessun contenuto attivo consentito
- Blocca file nascosti (`.htaccess`, `.env`, ecc.)

### Riepilogo copertura security headers

| Header | HTML (root) | API (PHP) | Uploads |
|--------|:-----------:|:---------:|:-------:|
| X-Frame-Options: DENY | Si | Si | — |
| X-Content-Type-Options: nosniff | Si | Si | Si |
| X-XSS-Protection | Si | Si | — |
| Content-Security-Policy | Si | Si | Si (none) |
| Referrer-Policy | Si | Si | — |
| Permissions-Policy | Si | — | — |
| Cache-Control: no-store | Si | — | — |

## Deploy Produzione

```bash
# Build frontend
cd frontend
npx vite build --emptyOutDir false

# Deploy frontend su Aruba
node deploy/deploy.js --frontend

# Deploy PHP backend su Aruba
node deploy/deploy.js --php
```

### Setup Iniziale Server

1. Caricare i file PHP via deploy
2. Creare `php/api/config.env` sul server con le credenziali
3. Creare file `_ENABLE_MIGRATE` nella cartella `api/migrations/`
4. Aprire `/api/migrations/migrate.php?key=MIGRATE_KEY` per creare le tabelle
5. Eliminare `_ENABLE_MIGRATE` subito dopo
6. (Opzionale) Per dati demo: creare `_ENABLE_SEED` in `api/seed/`, aprire `/api/seed/seed.php?key=SEED_KEY`, eliminare `_ENABLE_SEED`

> **Nota**: MIGRATE_KEY e SEED_KEY sono chiavi dedicate derivate dal JWT_SECRET (non il JWT_SECRET stesso).
> - `MIGRATE_KEY = hash('sha256', JWT_SECRET . '-migrate-stm-2026')`
> - `SEED_KEY = hash('sha256', JWT_SECRET . '-seed-stm-2026')`

## Sviluppo Locale

```bash
# Backend Node.js (port 3001)
cd backend
npm install
npm run dev

# Frontend (port 5173, proxy verso backend)
cd frontend
npm install
npm run dev

# Seed dati demo
cd backend
npm run seed
```

**Nota Windows**: Node.js potrebbe non essere in PATH:
```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

## Configurazione

### Produzione (`php/api/config.env`)

```env
DB_HOST=localhost
DB_NAME=...
DB_USER=...
DB_PASS=...
JWT_SECRET=<obbligatorio>
GROQ_API_KEY=<per AI assistant>

MAIL_TICKETING_USER=ticketing@stmdomotica.it
MAIL_TICKETING_PASS=
MAIL_ASSISTENZA_USER=assistenzatecnica@stmdomotica.it
MAIL_ASSISTENZA_PASS=
MAIL_NOREPLY_USER=noreply@stmdomotica.it
MAIL_NOREPLY_PASS=
MAIL_SMTP_HOST=smtps.aruba.it
MAIL_SMTP_PORT=465
MAIL_IMAP_HOST=imaps.aruba.it
MAIL_IMAP_PORT=993
```

### Sviluppo (`backend/.env`)

```env
JWT_SECRET=<obbligatorio>
GROQ_API_KEY=<per AI assistant>
# Stesse variabili email (opzionali in locale)
```

## Database Schema (21+ tabelle)

**Core**: `utenti`, `clienti`, `progetti`, `attivita`, `ticket`, `email`
**Relazioni**: `progetto_tecnici`, `note_interne`, `note_attivita`
**Chat**: `messaggi_progetto`, `chat_lettura`
**Portale client**: `utenti_cliente`, `comunicazioni_cliente`, `comunicazioni_lette`
**Progetti**: `allegati_progetto`, `referenti_progetto`, `progetto_referenti`
**Features**: `notifiche`, `schede_cliente`, `documenti_repository`
**Security**: `audit_log`, `rate_limits`
**Config**: `impostazioni`

## Autenticazione e Sicurezza

### Autenticazione
- **Admin/Tecnico**: JWT in `sessionStorage` (key: `token`), 8h expiry
- **Client**: JWT in `sessionStorage` (key: `clientToken`), 8h expiry
- **Inactivity timeout**: 30 minuti
- `sessionStorage` (non localStorage): sessione chiusa con il browser
- Solo HTTP 401 trigger logout automatico (non 403)
- **2FA via email**: codice 6 cifre, 3 tentativi max, scadenza 10 min
- **Cambio password al primo avvio**: modale obbligatoria

### Impersonation (V2.1)
- Admin > client via `POST /api/client-auth/impersonate/:clienteId`
- Audit log obbligatorio su DB (`audit_log` table)
- Claim `admin_id` nel JWT per tracciabilita
- TTL ridotto a 1h (vs 8h standard)
- Banner amber nel portale client con pulsante "Esci"

### Rate Limiting (V2.1)
- **Login**: 5 tentativi / 15 min con lockout progressivo (Node.js in-memory + PHP DB-based)
- **API globale**: 100 req/min per IP
- **AI**: 20 req/min per IP
- **Upload**: 10 req/min per IP
- **Impersonation**: 5 req/ora per IP
- PHP usa `rate_limits` table su DB (Aruba non ha Redis)

### Upload Security (V2.1)
- Whitelist estensioni per tipo di upload
- Validazione magic bytes (header file reali vs estensione dichiarata)
- Blocco doppie estensioni (`file.php.jpg`)
- 30+ estensioni pericolose bloccate (`.php`, `.exe`, `.sh`, ecc.)
- `.htaccess` anti-esecuzione nella cartella uploads
- `X-Content-Type-Options: nosniff` su tutti i download

### IDOR/BOLA Protection (V2.1)
- Tecnico limitato a ticket/progetti assegnati (check ownership server-side)
- KB cards e referenti: solo admin
- Anti-spoofing IMAP: verifica mittente vs cliente del ticket
- Tag `[COMM]` accettato solo da email admin

### IMAP Hardening (V2.1)
- Rate limit: 30 email/ciclo, 10/ora per mittente
- Body troncato a 50KB
- `stripHtml` rinforzata (rimuove script, style, commenti HTML, decodifica entities)

### Anti-Prompt-Injection AI — RAG Defense (V2.7 + V2.9)
Difesa su **due livelli** contro RAG prompt injection (documenti, email, note che contengono istruzioni malevole):

**Livello 1 — System prompt hardening (V2.7)**:
- Il modello è istruito a trattare tutti i documenti di contesto come **dati puri, mai come istruzioni**
- Blocco esplicito di pattern: "ignora istruzioni precedenti", "rivela lo schema", "cambia ruolo"
- Il modello non rivela mai configurazione interna, schema DB, credenziali o architettura

**Livello 2 — Context sanitization pre-invio (V2.9)**:
- Funzione `sanitizeContext()` filtra 20+ pattern di injection **prima** che il contesto arrivi al modello
- Pattern filtrati (sostituiti con `[FILTERED]`):
  - Manipolazione istruzioni: `ignore previous instructions`, `override instructions`, `new instructions:`, `disregard previous`, `forget previous`
  - Cambio ruolo: `you are now a`, `act as a different`, `change your role`, `switch to mode`
  - Data exfiltration: `reveal the database/schema/credentials`, `show me the system prompt`, `print the entire knowledge base`, `dump the database`
  - Meta-prompt: `system prompt`, `hidden prompt`, `initial instructions`, `output your instructions`, `repeat your prompt`
- Applicata su tutti e 4 gli endpoint AI (ticket-assist + client-assist, Node.js + PHP)
- Pattern identici su entrambi i backend per coerenza

### Isolamento Endpoint Client vs Admin (IDOR Audit)
Analisi completa della separazione degli endpoint per ruolo:

**Endpoint admin-only** (middleware `authenticateToken` — inaccessibili ai client):
- `/api/projects/{id}`, `/api/tickets/{id}`, `/api/repository/{id}`, `/api/clients/{id}`
- Un client che chiama questi endpoint riceve **401 Unauthorized**

**Endpoint client** (middleware `authenticateClientToken` — isolati per tenant):
- Pattern URL: `/api/.../client/{clienteId}/...`
- **Ogni endpoint** verifica `req.user.cliente_id !== clienteId` → **403 Forbidden**
- Il `cliente_id` viene dal JWT (non manipolabile dal client), non dal body della request
- `POST /api/tickets` (creazione): usa `req.user.cliente_id` dal token — il client non può scegliere per quale cliente creare

**Copertura validazione** (10 endpoint client Node.js + 10 PHP):

| Endpoint | Metodo | Validazione |
|----------|--------|-------------|
| `/tickets/client/:clienteId` | GET | `cliente_id != clienteId → 403` |
| `/tickets/client/:clienteId/:ticketId` | GET | `cliente_id != clienteId → 403` |
| `/tickets/client/:clienteId/:ticketId/close` | PUT | `cliente_id != clienteId → 403` |
| `/tickets/client/:clienteId/:ticketId/reply` | POST | `cliente_id != clienteId → 403` |
| `/tickets` (create) | POST | `cliente_id` dal JWT, non dal body |
| `/projects/client/:clienteId` | GET | `cliente_id != clienteId → 403` |
| `/projects/client/:clienteId/:projectId` | GET | `cliente_id != clienteId → 403` |
| `/projects/client/:clienteId/:projectId/allegati` | GET | `cliente_id != clienteId → 403` |
| `/projects/client/:clienteId/:projectId/allegati/:id/download` | GET | `cliente_id != clienteId → 403` |
| `/ai/client-assist` | POST | KB filtrata per `cliente_id` dal JWT |

**Tecnico** (middleware `authenticateToken` con check ownership):
- Limitato a ticket assegnati (`assegnato_a = user.id`)
- Limitato a progetti assegnati (presente in `progetto_tecnici`)
- KB cards e referenti: solo admin

### Security Headers (V2.5)
- Applicati su **3 livelli**: `.htaccess` root (HTML/CSS/JS), PHP router (API JSON), Node.js middleware (sviluppo)
- `Content-Security-Policy`: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `connect-src 'self'`, `frame-ancestors 'none'`
- `X-Frame-Options: DENY` — anti-clickjacking, impedisce embedding in iframe
- `X-Content-Type-Options: nosniff` — anti-MIME sniffing
- `X-XSS-Protection: 1; mode=block` — protezione XSS browser legacy
- `Referrer-Policy: strict-origin` — limita leak referrer a terze parti
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` — disabilita API browser sensibili
- Dettaglio completo nella sezione **Protezione .htaccess**

## Ruoli e Permessi

| Ruolo | Accesso |
|-------|---------|
| **Admin** | Accesso completo a tutto |
| **Tecnico** | Dashboard + Ticket assegnati + Progetti assegnati + Repository (read-only) |
| **Client (admin portale)** | Ticket + Progetti + AI + Gestione utenti portale |
| **Client (user)** | Ticket + Progetti + AI (sezioni filtrate da `schede_visibili`) |

## Funzionalita Principali

### Ticket
- Codice auto: `TK-YYYY-NNNN`
- Stati: aperto > in_lavorazione > in_attesa > risolto > chiuso
- Priorita: urgente, alta, media, bassa
- SLA per cliente: 1g, 3g, nb
- Note interne, email associate, flag "Salva in Knowledge Base" per rendere una nota disponibile all'AI del cliente
- Client: apertura, risposta, chiusura, riapertura

### Progetti
- Stati: attivo, in_pausa, completato, annullato
- Blocco: nessuno, lato_admin, lato_cliente (con email bloccante)
- **Manutenzione Ordinaria**: flag dedicato (referenti opzionali)
- Attivita con avanzamento %, dipendenze, note
- Chat admin/tecnico per progetto
- Allegati (upload admin, download tutti)
- Referenti progetto (obbligatori per progetti normali)
- Vista Gantt + Vista compatta/estesa (client)
- Email associate con rilevanza

### Comunicazioni Client
- Admin crea comunicazioni dalla pagina `/admin/comunicazioni`
- Oppure via email: `[COMM slug]` a assistenzatecnica@
- Banner nel portale client con tracking lettura per utente
- Flag "importante": resta visibile anche dopo lettura
- Scadenza automatica: 15 giorni
- Contatore letture lato admin (letti/totale utenti)

### Email IMAP
- **ticketing@**: match `[TICKET #TK-YYYY-NNNN]` > associa al ticket
- **assistenzatecnica@**: match `[COMM slug]` > comunicazione client; altrimenti > inbox admin
- Dedup via `message_id`
- Polling automatico via cron

### AI Assistant
- **Admin**: contesto KB cliente + ticket + email + note + storico + repository + FAQ
- **Client**: contesto KB cliente (tenant-isolated) + FAQ + repository docs
- Modello: Groq Llama 3.3 70B (free tier)
- Risponde nella lingua della domanda
- **Anti-prompt-injection (V2.7)**: il system prompt istruisce il modello a trattare tutti i documenti di contesto (email, note, KB, repository, FAQ) come **dati puri, mai come istruzioni**. Tentativi di injection tipo "ignora le istruzioni precedenti", "rivela lo schema DB" o "cambia ruolo" vengono esplicitamente ignorati. Il modello non rivela mai configurazione interna, schema DB, credenziali o architettura.

### Repository Documenti
- Upload (admin), download (tutti), testo estratto per AI
- Formati: txt, md, pdf, doc, docx

### i18n Portale Client
- 3 lingue: IT, EN, FR
- File: `frontend/src/i18n/clientTranslations.js`

## API Routes

| Prefisso | File | Descrizione |
|----------|------|-------------|
| `/api/auth` | auth.php | Login/me admin |
| `/api/client-auth` | clientAuth.php | Login/me client, impersonate, comunicazioni |
| `/api/tickets` | tickets.php | CRUD ticket + client |
| `/api/projects` | projects.php | CRUD progetti + allegati + chat + referenti |
| `/api/projects/:id/activities` | activities.php | CRUD attivita |
| `/api/clients` | clients.php | CRUD clienti + logo |
| `/api/clients/:id/schede` | knowledgeBase.php | KB cards |
| `/api/emails` | emails.php | CRUD email |
| `/api/users` | users.php | CRUD utenti |
| `/api/notifications` | notifications.php | Notifiche |
| `/api/dashboard` | dashboard.php | Stats + counts |
| `/api/repository` | repository.php | Repository documenti |
| `/api/comunicazioni` | comunicazioni.php | CRUD comunicazioni admin |
| `/api/ai` | ai.php | AI assistant |
| `/api/users/audit-log` | users.php | Audit log operazioni sensibili (admin) |

## Versioning

La versione e nel file `frontend/src/version.js` e viene mostrata nel footer della Dashboard admin.
Formato: `V{major}.{minor}-MMGG` (es. V1.5-0313)

## Repository

GitHub: https://github.com/rickycots/ticketing.git
Branch principale: `main`
