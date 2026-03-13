# Ticketing & Project Management — STM Domotica

Sistema di Ticketing e Project Management con due portali: **Admin Panel** (gestione interna) e **Client Portal** (accesso clienti).

**Versione corrente:** V1.5-0313

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
      Upload.php              # Upload file handler
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
      001_schema.sql          # Schema SQL completo
      fix_referenti.php       # Migrazioni incrementali
      migrate.php             # Runner migrazioni via browser
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
3. Aprire `/api/migrations/migrate.php?key=JWT_SECRET` per creare le tabelle
4. (Opzionale) Aprire `/api/seed/seed.php?key=JWT_SECRET` per dati demo

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

## Database Schema (19+ tabelle)

**Core**: `utenti`, `clienti`, `progetti`, `attivita`, `ticket`, `email`
**Relazioni**: `progetto_tecnici`, `note_interne`, `note_attivita`
**Chat**: `messaggi_progetto`, `chat_lettura`
**Portale client**: `utenti_cliente`, `comunicazioni_cliente`, `comunicazioni_lette`
**Progetti**: `allegati_progetto`, `referenti_progetto`, `progetto_referenti`
**Features**: `notifiche`, `schede_cliente`, `documenti_repository`
**Config**: `impostazioni`

## Autenticazione e Sicurezza

- **Admin/Tecnico**: JWT in `sessionStorage` (key: `token`), 8h expiry
- **Client**: JWT in `sessionStorage` (key: `clientToken`), 8h expiry
- **Inactivity timeout**: 30 minuti
- `sessionStorage` (non localStorage): sessione chiusa con il browser
- Solo HTTP 401 trigger logout automatico (non 403)
- Impersonation: admin > client via `POST /api/client-auth/impersonate/:clienteId`

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
- Note interne, email associate
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
- **Admin**: contesto KB + ticket + email + note + storico + repository
- **Client**: contesto FAQ + repository docs
- Modello: Groq Llama 3.3 70B (free tier)
- Risponde nella lingua della domanda

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

## Versioning

La versione e nel file `frontend/src/version.js` e viene mostrata nel footer della Dashboard admin.
Formato: `V{major}.{minor}-MMGG` (es. V1.5-0313)

## Repository

GitHub: https://github.com/rickycots/ticketing.git
Branch principale: `main`
