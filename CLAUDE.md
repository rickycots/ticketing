# Ticketing & Project Management — Guida Progetto

## Panoramica
Sistema MVP di Ticketing e Project Management per STM Domotica Corporation Srl.
Due portali: **Admin Panel** (gestione interna) e **Client Portal** (accesso clienti).

## Tech Stack
- **Frontend**: React 19 (Vite) + Tailwind CSS v4 + lucide-react icons
- **Backend**: Node.js + Express + better-sqlite3 + bcryptjs + jsonwebtoken + multer + nodemailer + imapflow + groq-sdk
- **DB**: SQLite (file `backend/data/ticketing.db`)
- **AI**: Groq (Llama 3.3 70B, free tier) — richiede `GROQ_API_KEY`
- **Email**: SMTP/IMAP via Aruba (ticketing@ + assistenzatecnica@stmdomotica.it)

## Struttura Progetto

```
backend/
  .env                    # Variabili d'ambiente (NON committare)
  src/
    index.js              # Entry point Express (port 3001)
    seed.js               # Script seed demo data
    db/
      database.js         # Inizializzazione DB + migrazioni
      schema.sql          # Schema SQL completo
    middleware/
      auth.js             # JWT auth (admin + client), JWT_SECRET obbligatorio
    routes/
      auth.js             # POST /login, GET /me (admin)
      clientAuth.js       # Login/me client, impersonate, comunicazioni, portal-users CRUD
      tickets.js          # CRUD ticket + endpoint client
      projects.js         # CRUD progetti + allegati + chat + endpoint client
      activities.js       # CRUD attivita (nested under projects)
      emails.js           # CRUD email
      clients.js          # CRUD clienti + logo upload
      users.js            # CRUD utenti admin/tecnico
      notifications.js    # Notifiche admin
      dashboard.js        # Dashboard stats + sidebar counts
      knowledgeBase.js    # Schede cliente (KB cards)
      repository.js       # Repository documenti con upload file
      ai.js               # AI ticket-assist (admin) + client-assist (client)
    services/
      mailer.js           # SMTP nodemailer (ticketing@, assistenzatecnica@, noreply@)
      imapPoller.js       # IMAP polling ogni 2min, dedup, [TICKET #TK-], [COMM slug]
      faqScraper.js       # Scraping FAQ fornitori per knowledge base AI
  uploads/
    logos/                # Loghi clienti
    repository/           # Documenti repository
    progetti/             # Allegati progetto

frontend/
  src/
    App.jsx               # Router principale (admin + client routes)
    api/client.js         # Tutte le chiamate API + session management + inactivity timeout
    i18n/clientTranslations.js  # Traduzioni IT/EN/FR per portale client
    layouts/
      AdminLayout.jsx     # Sidebar nav, notifiche, chat badges
      ClientLayout.jsx    # Header nav, comunicazioni banner, Teams FAB
    components/
      GanttChart.jsx      # Componente Gantt
      Pagination.jsx      # Paginazione riutilizzabile
    pages/
      Login.jsx           # Login admin
      ClientLogin.jsx     # Login client
      admin/
        Dashboard.jsx     # Dashboard admin con stats
        TicketList.jsx    # Lista ticket con filtri
        TicketDetail.jsx  # Dettaglio ticket + AI sidebar + KB sidebar
        ProjectList.jsx   # Lista progetti
        ProjectDetail.jsx # Dettaglio progetto (tab attivita/email, chat, allegati)
        ProjectGantt.jsx  # Vista Gantt progetto + allegati
        ActivityDetail.jsx # Dettaglio singola attivita
        TimelineList.jsx  # Timeline tutti i progetti
        EmailInbox.jsx    # Inbox email (admin only)
        ClientList.jsx    # Lista clienti (admin only)
        ClientDetail.jsx  # Dettaglio cliente + KB + utenti portale
        UserList.jsx      # Gestione utenti admin/tecnico
        Repository.jsx    # Repository documenti
      client/
        TicketList.jsx    # Lista ticket client (3 colonne: sidebar + aperti + chiusi)
        TicketDetail.jsx  # Dettaglio ticket client
        TicketForm.jsx    # Apertura nuovo ticket
        ProjectsView.jsx  # Lista progetti client con allegati per progetto
        ClientProjectDetail.jsx # Dettaglio progetto client
        AiChat.jsx        # Chat AI client (3 colonne: sidebar + chat)
        UserManagement.jsx # Gestione utenti portale (client admin)
```

## Avvio Sviluppo

```bash
# Backend (port 3001)
cd backend
npm install
npm run dev          # oppure: npm start

# Frontend (port 5173, proxy verso backend)
cd frontend
npm install
npm run dev

# Seed dati demo (cancella e ricrea DB)
cd backend
npm run seed
```

**Nota Windows**: Node.js potrebbe non essere in PATH. Usare:
```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

## Variabili d'Ambiente (`backend/.env`)

```env
JWT_SECRET=<obbligatorio>
GROQ_API_KEY=<per AI assistant>

# Email Aruba
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
MAIL_POLL_INTERVAL=120000
```

`JWT_SECRET` e obbligatorio — il server non parte senza.
Le credenziali email sono opzionali: senza, IMAP polling e disattivato e SMTP fa console.log.

## Credenziali Demo

| Ruolo | Email | Password |
|-------|-------|----------|
| Admin | admin@ticketing.local | admin123 |
| Tecnico | tecnico@ticketing.local | tecnico123 |
| Client (Rossi Srl) | giuseppe.rossi@rossisrl.it | cliente123 |
| Client (Tech Solutions) | marco.tech@techsolutions.it | cliente123 |

## Database Schema (17 tabelle)

**Core**: `utenti`, `clienti`, `progetti`, `attivita`, `ticket`, `email`
**Relazioni**: `progetto_tecnici`, `note_interne`, `note_attivita`
**Chat**: `messaggi_progetto`, `chat_lettura`
**Portale client**: `utenti_cliente`, `comunicazioni_cliente`
**Features**: `notifiche`, `schede_cliente`, `documenti_repository`, `allegati_progetto`
**Config**: `impostazioni`

Le migrazioni sono in `database.js` (`runMigrations()`) e girano automaticamente all'avvio.
Lo schema base e in `schema.sql`; le tabelle aggiunte dopo sono create via `CREATE TABLE IF NOT EXISTS` nelle migrazioni.

## Autenticazione e Sicurezza

- **Admin/Tecnico**: JWT in `sessionStorage` (key: `token`), 8h expiry, verifica su DB al mount
- **Client**: JWT in `sessionStorage` (key: `clientToken`), 8h expiry, verifica al mount
- **Inactivity timeout**: 30 minuti, tracciato via event listeners (click/keydown/scroll/mousemove)
- `sessionStorage` (non localStorage): sessione chiusa alla chiusura del browser
- Solo HTTP 401 trigger logout automatico (non 403)
- Impersonation: admin puo impersonare un client via `POST /api/client-auth/impersonate/:clienteId`

## Ruoli e Permessi

**Admin**: accesso completo a tutto
**Tecnico**: Dashboard + Ticket assegnati + Progetti assegnati (via `progetto_tecnici`) + Repository (sola lettura)
- NON vede: Email, Clienti, Utenti, upload/edit/delete Repository
**Client (admin portale)**: Ticket + Progetti + AI + Gestione utenti portale
**Client (user)**: Ticket + Progetti + AI (sezioni filtrate da `schede_visibili`)

## Funzionalita Principali

### Ticket
- Codice auto: `TK-YYYY-NNNN`
- Stati: aperto → in_lavorazione → in_attesa → risolto → chiuso
- Priorita: urgente, alta, media, bassa
- Categorie: assistenza, bug, richiesta_info, altro
- SLA per cliente: 1g, 3g, nb (nessun blocco)
- Note interne, email associate, allegati
- Client puo aprire, rispondere, chiudere, riaprire

### Progetti
- Stati: attivo, in_pausa, completato, annullato
- Blocco: nessuno, lato_admin, lato_cliente (con email bloccante)
- Attivita con avanzamento %, dipendenze, note multiple
- Chat admin↔tecnico per progetto con tracking non lette
- Allegati progetto (upload admin, download tutti)
- Vista Gantt
- Email associate con rilevanza (rilevante, di_contesto, bloccante)

### Email IMAP
- **ticketing@**: match `[TICKET #TK-YYYY-NNNN]` nel subject → associa al ticket
- **assistenzatecnica@**: match `[COMM slug]` → inserisce in `comunicazioni_cliente`; altrimenti importa come `email_cliente`
- Dedup via `message_id` (colonna unique)
- Polling ogni 2min configurabile

### AI Assistant
- **Admin**: `POST /api/ai/ticket-assist` — contesto: KB + ticket + email + note + storico + repository
- **Client**: `POST /api/ai/client-assist` — contesto: FAQ + repository docs
- Modello: Groq Llama 3.3 70B Versatile (free tier)
- Risponde nella lingua della domanda (istruzione esplicita nel prompt)

### Comunicazioni Client (`[COMM slug]`)
- Admin invia email a assistenzatecnica@ con `[COMM rossi-srl] Oggetto`
- IMAP poller intercetta il tag, trova cliente via `portale_slug`, salva in `comunicazioni_cliente`
- Banner comunicazioni visibile nel portale client (ClientLayout + TicketList)

### Repository Documenti
- Upload file (admin), download (tutti), testo estratto per AI
- Formati: txt, md, pdf, doc, docx
- Categorie personalizzabili

### i18n Portale Client
- 3 lingue: IT, EN, FR
- Lingua impostata per utente (`utenti_cliente.lingua`)
- File: `frontend/src/i18n/clientTranslations.js`
- Funzioni: `t(key)`, `getDateLocale()`, `getClientLang()`

## API Routes Principali

| Prefisso | File | Descrizione |
|----------|------|-------------|
| `/api/auth` | auth.js | Login/me admin |
| `/api/client-auth` | clientAuth.js | Login/me client, impersonate, comunicazioni, portal-users |
| `/api/tickets` | tickets.js | CRUD ticket + client endpoints |
| `/api/projects` | projects.js | CRUD progetti + allegati + chat + client endpoints |
| `/api/projects/:id/activities` | activities.js | CRUD attivita |
| `/api/clients` | clients.js | CRUD clienti + logo |
| `/api/clients/:id/schede` | knowledgeBase.js | KB cards per cliente |
| `/api/emails` | emails.js | CRUD email |
| `/api/users` | users.js | CRUD utenti admin/tecnico |
| `/api/notifications` | notifications.js | Notifiche |
| `/api/dashboard` | dashboard.js | Stats + sidebar counts |
| `/api/repository` | repository.js | Repository documenti |
| `/api/ai` | ai.js | AI assistant (admin + client) |

## Convenzioni Codice

- Frontend: componenti funzionali React, hooks, Tailwind utility classes
- Backend: Express router pattern, better-sqlite3 sync queries
- Icone: lucide-react (import singoli)
- API client: `frontend/src/api/client.js` contiene TUTTE le chiamate API (admin + client)
- Niente shadcn/ui: Tailwind puro
- File encoding: CRLF su Windows (attenzione con Grep/replace_all)

## Comandi Git Utili

```bash
git status
git add <files>
git commit -m "messaggio"
git push
```

Il repository e su GitHub: `https://github.com/rickycots/ticketing.git`
Branch principale: `main`
