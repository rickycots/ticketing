# Sistema Ticketing & Project Management — MVP

## Quick Start

Esegui power shell come admminsitratore 
Esegui il comando : Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

### 1. Backend
```bash
cd backend
npm install
npm run seed    # Popola il database con dati demo
npm start       # Avvia su http://localhost:3001


cd backend
  node src/seed.js
  node src/index.js

```
Esegui un altro power shell come admminsitratore 
Esegui il comando : Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned


### 2. Frontend
```bash
cd frontend
npm install
npm run dev     # Avvia su http://localhost:5173

cd frontend
  npx vite --port 5173```

### 3. Accesso

**Pannello Gestione (Admin):** http://localhost:5173/login
- Admin: `admin@ticketing.local` / `admin123`
- Tecnico: `tecnico@ticketing.local` / `tecnico123`

**Portale Cliente:** http://localhost:5173/client

## Stack Tecnologico
- **Frontend:** React 19 (Vite) + Tailwind CSS v4
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT
- **Email:** Simulata (console log + DB)

## Struttura API

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/dashboard` | Statistiche dashboard |
| GET/POST | `/api/tickets` | Lista / Crea ticket |
| GET/PUT | `/api/tickets/:id` | Dettaglio / Aggiorna ticket |
| GET/POST | `/api/projects` | Lista / Crea progetti |
| GET/PUT | `/api/projects/:id` | Dettaglio / Aggiorna progetto |
| GET | `/api/projects/client/:clienteId` | Progetti per portale cliente |
| GET/POST | `/api/projects/:id/activities` | Attività progetto |
| PUT/DELETE | `/api/projects/:id/activities/:aid` | Aggiorna / Elimina attività |
| GET/POST | `/api/clients` | Lista / Crea clienti |
| GET/POST | `/api/emails` | Lista / Crea email |
| GET/PUT | `/api/emails/:id` | Dettaglio / Aggiorna email |

## Dati Demo
- 2 clienti (Rossi Srl, Tech Solutions SpA)
- 3 progetti con 9 attività
- 5 ticket
- 6 email simulate
- 3 note interne
