# Ticketing & Project Management — Architettura

## Panoramica
Sistema MVP per gestione ticket e progetti con due interfacce:
- **Pannello Admin/Tecnico** (`/admin`) — autenticato con JWT
- **Portale Cliente** (`/client`) — accesso senza autenticazione (selezione cliente da dropdown)

---

## Tech Stack

| Layer      | Tecnologia                                   |
|------------|----------------------------------------------|
| Frontend   | React 19 + Vite 7 + Tailwind CSS v4          |
| Backend    | Node.js + Express 4                          |
| Database   | SQLite via better-sqlite3 (WAL mode)         |
| Auth       | JWT (jsonwebtoken) + bcryptjs                |
| Icone      | lucide-react                                 |
| Routing FE | react-router-dom v7                          |

---

## Struttura Directory

```
Ticketing/
├── backend/
│   ├── data/
│   │   └── ticketing.db              # File SQLite (generato)
│   ├── src/
│   │   ├── index.js                  # Entry point Express, porta 3001
│   │   ├── seed.js                   # Script seed dati demo
│   │   ├── db/
│   │   │   ├── database.js           # Connessione SQLite + init schema
│   │   │   └── schema.sql            # DDL tabelle + indici
│   │   ├── middleware/
│   │   │   └── auth.js               # authenticateToken, requireAdmin, JWT_SECRET
│   │   └── routes/
│   │       ├── auth.js               # POST /login, GET /me
│   │       ├── tickets.js            # CRUD ticket (admin + portale cliente)
│   │       ├── projects.js           # CRUD progetti
│   │       ├── activities.js         # CRUD attivita (nested sotto progetti)
│   │       ├── clients.js            # CRUD clienti
│   │       ├── emails.js             # CRUD email
│   │       ├── users.js              # CRUD utenti (admin-only)
│   │       └── dashboard.js          # Statistiche aggregate
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                  # Entry point React
│   │   ├── App.jsx                   # Router con tutte le route
│   │   ├── index.css                 # Tailwind imports
│   │   ├── api/
│   │   │   └── client.js             # Wrapper fetch per tutte le API
│   │   ├── layouts/
│   │   │   ├── AdminLayout.jsx       # Sidebar + nav condizionale per ruolo
│   │   │   └── ClientLayout.jsx      # Layout portale cliente
│   │   └── pages/
│   │       ├── Login.jsx             # Form login admin/tecnico
│   │       ├── admin/
│   │       │   ├── Dashboard.jsx     # Dashboard con statistiche
│   │       │   ├── TicketList.jsx    # Lista ticket con filtri
│   │       │   ├── TicketDetail.jsx  # Dettaglio ticket + thread email + azioni
│   │       │   ├── ProjectList.jsx   # Lista progetti
│   │       │   ├── ProjectDetail.jsx # Dettaglio progetto (tab Attivita/Email + chat + gestione)
│   │       │   ├── EmailInbox.jsx    # Inbox email
│   │       │   ├── ClientList.jsx    # Lista clienti
│   │       │   └── UserList.jsx      # Gestione utenti/tecnici (admin-only)
│   │       └── client/
│   │           ├── TicketList.jsx    # Lista ticket del cliente
│   │           ├── TicketDetail.jsx  # Dettaglio ticket (senza note interne)
│   │           ├── TicketForm.jsx    # Apertura nuovo ticket
│   │           └── ProjectsView.jsx  # Vista progetti del cliente
│   ├── vite.config.js               # Proxy /api → localhost:3001
│   └── package.json
│
└── PROJECT_CONTEXT.md                # Questo file
```

---

## Database — 11 Tabelle

### `utenti`
| Campo         | Tipo    | Note                              |
|---------------|---------|-----------------------------------|
| id            | INTEGER | PK autoincrement                  |
| nome          | TEXT    | NOT NULL                          |
| email         | TEXT    | NOT NULL UNIQUE                   |
| password_hash | TEXT    | bcrypt hash                       |
| ruolo         | TEXT    | 'admin' o 'tecnico'              |
| attivo        | INTEGER | 1 = attivo, 0 = disattivato      |
| created_at    | TEXT    | datetime                          |

### `clienti`
| Campo        | Tipo    | Note            |
|--------------|---------|-----------------|
| id           | INTEGER | PK              |
| nome_azienda | TEXT    | NOT NULL        |
| referente    | TEXT    |                 |
| email        | TEXT    | NOT NULL        |
| telefono     | TEXT    |                 |
| note         | TEXT    |                 |
| created_at   | TEXT    |                 |

### `progetti`
| Campo              | Tipo    | Note                                           |
|--------------------|---------|-------------------------------------------------|
| id                 | INTEGER | PK                                              |
| cliente_id         | INTEGER | FK → clienti                                    |
| nome               | TEXT    | NOT NULL                                        |
| descrizione        | TEXT    | Descrizione opzionale del progetto              |
| data_inizio        | TEXT    |                                                 |
| data_scadenza      | TEXT    |                                                 |
| stato              | TEXT    | attivo / in_pausa / completato / annullato      |
| blocco             | TEXT    | nessuno / lato_admin / lato_cliente              |
| email_bloccante_id | INTEGER | FK → email                                      |
| created_at         | TEXT    |                                                 |
| updated_at         | TEXT    |                                                 |

### `attivita`
| Campo         | Tipo    | Note                                    |
|---------------|---------|-----------------------------------------|
| id            | INTEGER | PK                                      |
| progetto_id   | INTEGER | FK → progetti                           |
| nome          | TEXT    | NOT NULL                                |
| descrizione   | TEXT    |                                         |
| assegnato_a   | INTEGER | FK → utenti                             |
| stato             | TEXT    | da_fare / in_corso / completata / bloccata |
| avanzamento       | INTEGER | 0-100                                   |
| priorita          | TEXT    | alta / media / bassa                    |
| data_scadenza     | TEXT    |                                         |
| data_completamento| TEXT    | Auto-impostata quando stato = completata|
| note              | TEXT    |                                         |

### `ticket`
| Campo       | Tipo    | Note                                               |
|-------------|---------|----------------------------------------------------|
| id          | INTEGER | PK                                                 |
| codice      | TEXT    | UNIQUE, formato TK-YYYY-NNNN                      |
| cliente_id  | INTEGER | FK → clienti                                       |
| oggetto     | TEXT    | NOT NULL                                           |
| descrizione | TEXT    |                                                    |
| categoria   | TEXT    | assistenza / bug / richiesta_info / altro           |
| priorita    | TEXT    | urgente / alta / media / bassa                     |
| stato       | TEXT    | aperto / in_lavorazione / in_attesa / risolto / chiuso |
| assegnato_a | INTEGER | FK → utenti (auto-assegnato all'admin alla creazione) |
| progetto_id | INTEGER | FK → progetti                                      |

### `email`
| Campo          | Tipo    | Note                              |
|----------------|---------|-----------------------------------|
| id             | INTEGER | PK                                |
| tipo           | TEXT    | ticket / email_cliente / altro    |
| mittente       | TEXT    | NOT NULL                          |
| destinatario   | TEXT    | NOT NULL                          |
| oggetto        | TEXT    | NOT NULL                          |
| corpo          | TEXT    |                                   |
| allegati       | TEXT    | JSON array (default '[]')         |
| cliente_id     | INTEGER | FK → clienti                      |
| ticket_id      | INTEGER | FK → ticket                       |
| progetto_id    | INTEGER | FK → progetti                     |
| is_bloccante   | INTEGER |                                   |
| thread_id      | TEXT    | Raggruppa email dello stesso thread |
| data_ricezione | TEXT    |                                   |
| letta          | INTEGER | 0/1                               |

### `note_interne`
| Campo      | Tipo    | Note                    |
|------------|---------|-------------------------|
| id         | INTEGER | PK                      |
| ticket_id  | INTEGER | FK → ticket             |
| progetto_id| INTEGER | FK → progetti           |
| utente_id  | INTEGER | FK → utenti, NOT NULL   |
| testo      | TEXT    | NOT NULL                |
| created_at | TEXT    |                         |

### `progetto_tecnici`
| Campo       | Tipo    | Note                              |
|-------------|---------|-----------------------------------|
| progetto_id | INTEGER | FK → progetti, PK composita       |
| utente_id   | INTEGER | FK → utenti, PK composita         |

### `note_attivita`
| Campo       | Tipo    | Note                              |
|-------------|---------|-----------------------------------|
| id          | INTEGER | PK                                |
| attivita_id | INTEGER | FK → attivita (ON DELETE CASCADE) |
| utente_id   | INTEGER | FK → utenti, NOT NULL             |
| testo       | TEXT    | NOT NULL                          |
| created_at  | TEXT    |                                   |

### `messaggi_progetto`
| Campo       | Tipo    | Note                              |
|-------------|---------|-----------------------------------|
| id          | INTEGER | PK                                |
| progetto_id | INTEGER | FK → progetti, NOT NULL           |
| utente_id   | INTEGER | FK → utenti, NOT NULL             |
| testo       | TEXT    | NOT NULL                          |
| created_at  | TEXT    |                                   |

### `chat_lettura`
| Campo           | Tipo    | Note                              |
|-----------------|---------|-----------------------------------|
| utente_id       | INTEGER | FK → utenti, PK composita         |
| progetto_id     | INTEGER | FK → progetti, PK composita       |
| ultimo_letto_at | TEXT    | Timestamp ultima lettura chat      |

---

## API Endpoints

### Auth
| Metodo | Endpoint         | Auth | Descrizione          |
|--------|------------------|------|----------------------|
| POST   | /api/auth/login  | No   | Login → JWT token    |
| GET    | /api/auth/me     | JWT  | Utente corrente      |

### Dashboard
| Metodo | Endpoint       | Auth | Descrizione                            |
|--------|----------------|------|----------------------------------------|
| GET    | /api/dashboard | JWT  | Statistiche (filtrate per ruolo tecnico) |

### Ticket
| Metodo | Endpoint                                 | Auth | Descrizione                    |
|--------|------------------------------------------|------|--------------------------------|
| GET    | /api/tickets                             | JWT  | Lista (tecnico: solo assegnati)|
| GET    | /api/tickets/:id                         | JWT  | Dettaglio + email + note       |
| POST   | /api/tickets                             | No   | Crea ticket (auto-assign admin)|
| PUT    | /api/tickets/:id                         | JWT  | Aggiorna stato/priorita/assign |
| GET    | /api/tickets/client/:clienteId           | No   | Lista ticket cliente           |
| GET    | /api/tickets/client/:clienteId/:ticketId | No   | Dettaglio ticket cliente       |
| POST   | /api/tickets/client/:clienteId/:ticketId/reply | No | Risposta cliente         |

### Progetti
| Metodo | Endpoint                              | Auth | Descrizione                         |
|--------|---------------------------------------|------|-------------------------------------|
| GET    | /api/projects                         | JWT  | Lista progetti (tecnico: assegnati) |
| GET    | /api/projects/chat-unread             | JWT  | Conteggio chat non lette per sidebar|
| GET    | /api/projects/:id                     | JWT  | Dettaglio + attivita + chat + email |
| POST   | /api/projects                         | JWT  | Crea progetto (admin)               |
| PUT    | /api/projects/:id                     | JWT  | Aggiorna progetto (admin)           |
| POST   | /api/projects/:id/chat                | JWT  | Invia messaggio chat progetto       |
| GET    | /api/projects/client/:clienteId       | No   | Progetti del cliente                |

### Attivita (nested sotto progetti)
| Metodo | Endpoint                                             | Auth | Descrizione              |
|--------|------------------------------------------------------|------|--------------------------|
| GET    | /api/projects/:id/activities                         | JWT  | Lista attivita           |
| POST   | /api/projects/:id/activities                         | JWT  | Crea attivita (admin)    |
| PUT    | /api/projects/:id/activities/:activityId             | JWT  | Aggiorna attivita        |
| DELETE | /api/projects/:id/activities/:activityId             | JWT  | Elimina attivita (admin) |
| POST   | /api/projects/:id/activities/:activityId/notes       | JWT  | Aggiungi nota attivita   |

### Clienti
| Metodo | Endpoint          | Auth | Descrizione     |
|--------|-------------------|------|-----------------|
| GET    | /api/clients      | JWT  | Lista clienti   |
| GET    | /api/clients/:id  | JWT  | Dettaglio       |
| POST   | /api/clients      | JWT  | Crea cliente    |
| PUT    | /api/clients/:id  | JWT  | Aggiorna        |

### Email
| Metodo | Endpoint         | Auth | Descrizione          |
|--------|------------------|------|----------------------|
| GET    | /api/emails      | JWT  | Lista email          |
| GET    | /api/emails/:id  | JWT  | Dettaglio            |
| POST   | /api/emails      | JWT  | Crea email (simulata)|
| PUT    | /api/emails/:id  | JWT  | Aggiorna (letta)     |

### Utenti
| Metodo | Endpoint         | Auth       | Descrizione           |
|--------|------------------|------------|-----------------------|
| GET    | /api/users       | JWT+Admin  | Lista utenti          |
| POST   | /api/users       | JWT+Admin  | Crea tecnico          |
| PUT    | /api/users/:id   | JWT+Admin  | Aggiorna utente       |

---

## Ruoli e Permessi

### Admin
- Vede tutte le pagine: Dashboard, Ticket, Progetti, Email, Clienti, Utenti
- Crea account tecnici
- Assegna ticket ai tecnici
- Gestisce tutto il sistema

### Tecnico
- Vede: Dashboard (filtrata), Ticket (solo assegnati), Progetti (solo assegnati via progetto_tecnici)
- Non vede: Email, Clienti, Utenti
- Dashboard mostra solo i suoi ticket e le sue scadenze, email_non_lette = 0
- Puo' cambiare stato e aggiungere note sulle attivita' a lui assegnate
- Puo' usare la chat di progetto per comunicare con l'admin

---

## Flusso Ticket

1. **Cliente** apre ticket dal portale → stato `aperto`, auto-assegnato all'admin
2. **Admin** vede il ticket, puo' assegnarlo a un tecnico
3. **Admin/Tecnico** risponde al cliente → stato passa a `in_attesa` (opzionale)
4. **Cliente** risponde → stato torna a `in_lavorazione`
5. **Admin/Tecnico** risolve → stato `risolto` → `chiuso`

---

## Convenzioni Codice

- **Codice ticket**: `TK-YYYY-NNNN` (es. TK-2026-0001)
- **Email**: simulate (console.log + salvate in DB)
- **JWT payload**: `{ id, nome, email, ruolo }`, scadenza 24h
- **CSS**: Tailwind utility classes, nessun shadcn/ui
- **Componenti**: functional components con hooks
- **API client**: wrapper fetch centralizzato in `api/client.js`
- **Vite proxy**: `/api` → `http://localhost:3001`

---

## Comandi

```bash
# Backend
cd backend
npm install
npm run seed     # Popola DB con dati demo (resetta tutto)
npm run dev      # Avvia con --watch su porta 3001

# Frontend
cd frontend
npm install
npm run dev      # Avvia Vite su porta 5173
```

---

## Credenziali Demo

| Ruolo   | Email                      | Password   |
|---------|----------------------------|------------|
| Admin   | admin@ticketing.local      | admin123   |
| Tecnico | tecnico@ticketing.local    | tecnico123 |

**Clienti demo**: ID 1 = Rossi Srl, ID 2 = Tech Solutions SpA
