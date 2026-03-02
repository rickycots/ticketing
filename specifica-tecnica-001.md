# Specifica Tecnica — Sistema di Ticketing & Project Management

**Versione:** 1.0  
**Data:** 25 Febbraio 2026  
**Autore:** Claude AI  

---

## 1. Panoramica del Sistema

Il sistema si compone di due applicazioni web distinte che condividono lo stesso backend:

- **Portale Cliente** — interfaccia semplificata per i clienti
- **Pannello Gestione** — interfaccia completa per l'amministratore e i tecnici

Il collegamento tra le due parti avviene tramite email: il sistema intercetta, categorizza e permette di associare le email ai progetti.

---

## 2. Architettura Generale

```
┌─────────────────────┐     ┌──────────────────────┐
│   PORTALE CLIENTE    │     │   PANNELLO GESTIONE   │
│  (React Frontend)    │     │   (React Frontend)    │
│                      │     │                       │
│ • Form Ticket        │     │ • Inbox Ticketing     │
│ • Vista Progetti     │     │ • Gestione Progetti   │
│                      │     │ • Email Cliente       │
│                      │     │ • Gestione Attività   │
│                      │     │ • Dashboard           │
└──────────┬───────────┘     └───────────┬───────────┘
           │                             │
           └──────────┬──────────────────┘
                      │
              ┌───────▼────────┐
              │   BACKEND API   │
              │   (Node/Express │
              │    o simile)    │
              └───────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐   ┌────▼───┐   ┌────▼────┐
   │Database│   │ Email  │   │  File   │
   │(SQL/   │   │Service │   │ Storage │
   │NoSQL)  │   │(SMTP)  │   │         │
   └────────┘   └────────┘   └─────────┘
```

---

## 3. Portale Cliente

### 3.1 Form Apertura Ticket

Il cliente accede al portale (autenticato o tramite link univoco) e può aprire un nuovo ticket.

**Campi del form:**

| Campo | Tipo | Obbligatorio | Note |
|-------|------|:------------:|------|
| Oggetto | Testo | ✅ | Max 200 caratteri |
| Categoria | Select | ✅ | Es: Assistenza, Bug, Richiesta info, Altro |
| Priorità | Select | ❌ | Bassa / Media / Alta (default: Media) |
| Descrizione | Textarea | ✅ | Testo libero, supporto markdown opzionale |
| Allegati | File upload | ❌ | Max 5 file, max 10MB ciascuno |

**Comportamento:**
- Il submit genera un'email formattata inviata all'indirizzo dell'amministratore
- L'email contiene tutti i dati del ticket + metadati (ID ticket, cliente, timestamp)
- Il ticket viene salvato nel database con stato "Aperto"
- Il cliente riceve una conferma con il numero di ticket

**Email generata (esempio soggetto):**
```
[TICKET #TK-2026-0042] [Assistenza] Problema con configurazione rete — Cliente: Rossi Srl
```

### 3.2 Vista Progetti (lato Cliente)

Il cliente vede SOLO i propri progetti con 4 informazioni:

| Informazione | Visualizzazione | Dettaglio |
|-------------|-----------------|-----------|
| **Nome Progetto** | Testo | Es: "Migrazione Server Exchange" |
| **Stato Avanzamento** | Barra di progresso + % | Calcolato automaticamente dalle attività |
| **Ultimo Aggiornamento** | Pallino colorato + data | 🟢 < 3gg / 🟡 3-7gg / 🔴 > 7gg |
| **Blocco** | Badge con etichetta | "In attesa di riscontro" (fermo lato cliente) oppure "In lavorazione" (fermo lato admin) |

**Quando il progetto è fermo lato cliente:**
- Il badge mostra "⚠️ In attesa di tuo riscontro"
- Viene mostrato un riassunto/oggetto della richiesta pendente (collegata all'email bloccante)
- Il cliente sa esattamente cosa deve fare

**Quando il progetto è in lavorazione (lato admin):**
- Il badge mostra "🔧 In lavorazione"
- Nessun dettaglio aggiuntivo (il cliente non vede le attività interne)

---

## 4. Pannello Gestione (Amministratore/Tecnici)

### 4.1 Inbox — Ricezione e Categorizzazione Email

Tutte le email in arrivo vengono categorizzate automaticamente in due flussi:

#### Categoria: TICKET
- Provenienza: Form del portale cliente
- Riconoscimento: Header custom nell'email o tag nel soggetto `[TICKET #...]`
- Destinazione: Sezione "Ticketing"

#### Categoria: EMAIL CLIENTE
- Provenienza: Email standard del cliente (non dal portale)
- Riconoscimento: Indirizzo mittente presente nell'anagrafica clienti
- Destinazione: Sezione "Email Cliente"

**Azioni disponibili su ogni email (sia ticket che email cliente):**

| Azione | Descrizione |
|--------|-------------|
| **Assegna priorità** | Urgente / Alta / Media / Bassa |
| **Assegna a tecnico** | Me stesso o collaboratore |
| **Associa a progetto** | Collega l'email a un progetto esistente |
| **Marca come bloccante** | L'email diventa la "richiesta pendente" che blocca il progetto lato cliente |
| **Rispondi** | Risposta diretta al cliente |
| **Cambia stato** | Aperto → In lavorazione → In attesa → Risolto → Chiuso |
| **Aggiungi nota interna** | Nota visibile solo ai tecnici |

### 4.2 Gestione Ticketing

**Vista lista ticket con filtri:**

| Filtro | Opzioni |
|--------|---------|
| Stato | Aperto / In lavorazione / In attesa / Risolto / Chiuso |
| Priorità | Urgente / Alta / Media / Bassa |
| Cliente | Dropdown clienti |
| Assegnato a | Me / Collaboratore / Non assegnato |
| Data | Range date |

**Vista dettaglio ticket:**
- Tutti i dati del ticket originale
- Thread di risposte (storico conversazione)
- Note interne
- Progetto associato (se presente)
- Timeline delle azioni

### 4.3 Gestione Progetti

#### 4.3.1 Informazioni Progetto

| Campo | Tipo | Note |
|-------|------|------|
| Nome progetto | Testo | Visibile al cliente |
| Cliente | Select | Anagrafica clienti |
| Data inizio | Data | — |
| Data scadenza prevista | Data | — |
| Stato | Select | Attivo / In pausa / Completato / Annullato |
| Avanzamento | % (auto) | Calcolato dalle attività |
| Blocco attuale | Select | Lato admin / Lato cliente / Nessun blocco |
| Email bloccante | Riferimento | Email associata che causa il blocco lato cliente |
| Ultimo aggiornamento | Data (auto) | Aggiornato ad ogni modifica |

#### 4.3.2 Attività del Progetto

Ogni progetto contiene una lista di attività (task). L'avanzamento del progetto è calcolato dalla media ponderata delle attività.

**Campi attività:**

| Campo | Tipo | Note |
|-------|------|------|
| Nome attività | Testo | Es: "Configurazione firewall" |
| Descrizione | Textarea | Dettaglio del lavoro da fare |
| Assegnato a | Select | Amministratore / Nome collaboratore |
| Stato | Select | Da fare / In corso / Completata / Bloccata |
| Avanzamento | % | 0-100, manuale |
| Priorità | Select | Alta / Media / Bassa |
| Data scadenza | Data | — |
| Note | Textarea | Note interne |

**Calcolo avanzamento progetto:**
```
Avanzamento Progetto = Σ (Avanzamento attività_i) / Numero attività totali

Esempio:
- Attività 1: 100% (completata)
- Attività 2: 50% (in corso)
- Attività 3: 0% (da fare)
→ Avanzamento = (100 + 50 + 0) / 3 = 50%
```

**Logica "Blocco" del progetto:**
```
SE esiste un'email marcata come "bloccante" associata al progetto
  E l'email è stata inviata AL cliente
  E il cliente NON ha ancora risposto
→ Progetto FERMO LATO CLIENTE

ALTRIMENTI
→ Progetto FERMO LATO ADMIN (in lavorazione)
```

#### 4.3.3 Email Associate al Progetto

Nella vista progetto, sezione dedicata che mostra:
- Tutte le email associate (ticket + email standard)
- Ordinamento cronologico
- Evidenziazione dell'email bloccante (se presente)
- Indicazione dei giorni trascorsi dall'email bloccante

### 4.4 Dashboard Principale

**Riepilogo a colpo d'occhio:**

| Widget | Contenuto |
|--------|-----------|
| **Ticket aperti** | Contatore + lista urgenti |
| **Progetti attivi** | Totale + quanti bloccati lato cliente |
| **Email non processate** | Email ricevute non ancora assegnate |
| **Scadenze imminenti** | Attività in scadenza nei prossimi 7 giorni |
| **Carico per tecnico** | Distribuzione ticket/attività per persona |

---

## 5. Flusso Email — Dettaglio Tecnico

### 5.1 Ricezione Email

```
Email in arrivo
    │
    ├── Contiene header [TICKET]? ──────► Categoria: TICKET
    │                                      → Crea/aggiorna ticket nel DB
    │
    ├── Mittente in anagrafica clienti? ──► Categoria: EMAIL CLIENTE
    │                                      → Salva in inbox "Email Cliente"
    │
    └── Nessuna corrispondenza ──────────► Categoria: ALTRO
                                           → Inbox generico
```

### 5.2 Associazione Email → Progetto

```
Admin seleziona email
    │
    ├── "Associa a progetto" → Scelta progetto → Email collegata
    │
    └── "Marca come bloccante" → Email diventa il blocco visibile
                                  → Progetto passa a "Fermo lato cliente"
                                  → Cliente vede avviso nel portale
```

### 5.3 Risposta del Cliente all'Email Bloccante

```
Cliente risponde all'email bloccante
    │
    ├── Sistema riconosce il thread (In-Reply-To header)
    │
    ├── Rimuove automaticamente lo stato "bloccante"
    │
    ├── Progetto torna a "In lavorazione" (fermo lato admin)
    │
    └── Notifica all'admin: "Il cliente X ha risposto alla richiesta pendente"
```

---

## 6. Modello Dati

### 6.1 Entità Principali

```
CLIENTI
├── id
├── nome_azienda
├── referente
├── email
├── telefono
└── note

PROGETTI
├── id
├── cliente_id (FK → Clienti)
├── nome
├── data_inizio
├── data_scadenza
├── stato (attivo/pausa/completato/annullato)
├── blocco (nessuno/lato_admin/lato_cliente)
├── email_bloccante_id (FK → Email, nullable)
├── created_at
└── updated_at

ATTIVITA
├── id
├── progetto_id (FK → Progetti)
├── nome
├── descrizione
├── assegnato_a (FK → Utenti)
├── stato (da_fare/in_corso/completata/bloccata)
├── avanzamento (0-100)
├── priorita (alta/media/bassa)
├── data_scadenza
├── note
├── created_at
└── updated_at

TICKET
├── id
├── codice (es: TK-2026-0042)
├── cliente_id (FK → Clienti)
├── oggetto
├── categoria
├── priorita
├── stato (aperto/in_lavorazione/in_attesa/risolto/chiuso)
├── assegnato_a (FK → Utenti, nullable)
├── progetto_id (FK → Progetti, nullable)
├── created_at
└── updated_at

EMAIL
├── id
├── tipo (ticket/email_cliente/altro)
├── mittente
├── destinatario
├── oggetto
├── corpo
├── allegati (JSON array)
├── cliente_id (FK → Clienti, nullable)
├── ticket_id (FK → Ticket, nullable)
├── progetto_id (FK → Progetti, nullable)
├── is_bloccante (boolean)
├── thread_id (per raggruppare conversazioni)
├── data_ricezione
└── letta (boolean)

UTENTI (admin/tecnici)
├── id
├── nome
├── email
├── ruolo (admin/tecnico)
└── attivo (boolean)

NOTE_INTERNE
├── id
├── ticket_id (FK → Ticket, nullable)
├── progetto_id (FK → Progetti, nullable)
├── utente_id (FK → Utenti)
├── testo
└── created_at
```

---

## 7. Stack Tecnologico Proposto

| Componente | Tecnologia | Motivazione |
|-----------|------------|-------------|
| **Frontend** | React (Vite) | Moderno, componenti riutilizzabili, ottima DX |
| **UI Library** | Tailwind CSS + shadcn/ui | Design pulito, componenti pronti |
| **Backend** | Node.js + Express | Stesso linguaggio del frontend, ecosistema ricco |
| **Database** | PostgreSQL | Relazionale, robusto, ottimo per query complesse |
| **ORM** | Prisma | Type-safe, migrazioni semplici |
| **Email Ricezione** | IMAP listener (node-imap) | Polling periodico della casella email |
| **Email Invio** | Nodemailer + SMTP | Standard, affidabile |
| **Autenticazione** | JWT + bcrypt | Sessioni stateless |
| **File Storage** | Locale / S3 | Per allegati |

### 7.1 Alternativa Semplificata (MVP)

Per un primo MVP funzionante:
- **Frontend:** React con dati mockati (localStorage o JSON)
- **Email:** Simulata (log in console + form di invio)
- **Database:** JSON file o SQLite
- **Deploy:** Docker compose con tutto insieme

---

## 8. Fasi di Sviluppo Proposte

### Fase 1 — MVP Portale Cliente (settimana 1-2)
- [ ] Form apertura ticket (con invio email simulato)
- [ ] Vista progetti (con dati mock)
- [ ] Layout e navigazione base

### Fase 2 — MVP Pannello Gestione (settimana 3-4)
- [ ] Inbox ticket (lista + dettaglio)
- [ ] Gestione progetti + attività
- [ ] Dashboard base

### Fase 3 — Integrazione Email (settimana 5-6)
- [ ] Ricezione email via IMAP
- [ ] Categorizzazione automatica
- [ ] Associazione email → progetto
- [ ] Logica email bloccante

### Fase 4 — Rifinitura (settimana 7-8)
- [ ] Autenticazione e autorizzazioni
- [ ] Notifiche (email + in-app)
- [ ] Filtri avanzati e ricerca
- [ ] Responsive design

### Fase 5 — Evoluzione Futura
- [ ] AI per suggerimento risposte (RAG sui manuali)
- [ ] SLA e metriche tempi di risposta
- [ ] Reportistica per cliente
- [ ] App mobile

---

## 9. Note Aggiuntive

### Sicurezza
- Ogni cliente vede SOLO i propri progetti e ticket
- I tecnici vedono solo i ticket/progetti assegnati a loro (o tutti se admin)
- Le email bloccanti mostrano al cliente solo l'oggetto/riassunto, mai il corpo completo delle email interne

### Scalabilità
- Il sistema è pensato per un team piccolo (1 admin + 2-3 tecnici)
- Il modello dati supporta crescita futura senza refactoring

### UX
- Portale cliente: massima semplicità, nessuna complessità superflua
- Pannello gestione: potenza con usabilità, shortcuts da tastiera per operazioni frequenti

---

*Fine documento di specifica — Versione 1.0*
