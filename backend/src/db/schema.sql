-- Schema Ticketing & Project Management MVP

CREATE TABLE IF NOT EXISTS utenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  ruolo TEXT NOT NULL CHECK(ruolo IN ('admin', 'tecnico')),
  attivo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clienti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_azienda TEXT NOT NULL,
  referente TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  indirizzo TEXT,
  citta TEXT,
  provincia TEXT,
  note TEXT,
  logo TEXT,
  portale_slug TEXT UNIQUE,
  sla_reazione TEXT NOT NULL DEFAULT 'nb' CHECK(sla_reazione IN ('1g', '3g', 'nb')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progetti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clienti(id),
  nome TEXT NOT NULL,
  descrizione TEXT,
  data_inizio TEXT,
  data_scadenza TEXT,
  stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo', 'in_pausa', 'completato', 'annullato')),
  blocco TEXT NOT NULL DEFAULT 'nessuno' CHECK(blocco IN ('nessuno', 'lato_admin', 'lato_cliente')),
  email_bloccante_id INTEGER REFERENCES email(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attivita (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  progetto_id INTEGER NOT NULL REFERENCES progetti(id),
  nome TEXT NOT NULL,
  descrizione TEXT,
  assegnato_a INTEGER REFERENCES utenti(id),
  stato TEXT NOT NULL DEFAULT 'da_fare' CHECK(stato IN ('da_fare', 'in_corso', 'completata', 'bloccata')),
  avanzamento INTEGER NOT NULL DEFAULT 0 CHECK(avanzamento >= 0 AND avanzamento <= 100),
  priorita TEXT NOT NULL DEFAULT 'media' CHECK(priorita IN ('alta', 'media', 'bassa')),
  data_scadenza TEXT,
  data_completamento TEXT,
  data_inizio TEXT,
  ordine INTEGER DEFAULT NULL,
  dipende_da INTEGER REFERENCES attivita(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codice TEXT NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES clienti(id),
  oggetto TEXT NOT NULL,
  descrizione TEXT,
  categoria TEXT NOT NULL CHECK(categoria IN ('assistenza', 'bug', 'richiesta_info', 'altro')),
  priorita TEXT NOT NULL DEFAULT 'media' CHECK(priorita IN ('urgente', 'alta', 'media', 'bassa')),
  stato TEXT NOT NULL DEFAULT 'aperto' CHECK(stato IN ('aperto', 'in_lavorazione', 'in_attesa', 'risolto', 'chiuso')),
  assegnato_a INTEGER REFERENCES utenti(id),
  progetto_id INTEGER REFERENCES progetti(id),
  letta INTEGER NOT NULL DEFAULT 0,
  data_evasione TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL DEFAULT 'altro' CHECK(tipo IN ('ticket', 'email_cliente', 'altro')),
  mittente TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  oggetto TEXT NOT NULL,
  corpo TEXT,
  allegati TEXT DEFAULT '[]',
  cliente_id INTEGER REFERENCES clienti(id),
  ticket_id INTEGER REFERENCES ticket(id),
  progetto_id INTEGER REFERENCES progetti(id),
  attivita_id INTEGER REFERENCES attivita(id),
  is_bloccante INTEGER NOT NULL DEFAULT 0,
  rilevanza TEXT DEFAULT NULL CHECK(rilevanza IN ('rilevante', 'di_contesto')),
  thread_id TEXT,
  data_ricezione TEXT NOT NULL DEFAULT (datetime('now')),
  letta INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS note_interne (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER REFERENCES ticket(id),
  progetto_id INTEGER REFERENCES progetti(id),
  utente_id INTEGER NOT NULL REFERENCES utenti(id),
  testo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progetto_tecnici (
  progetto_id INTEGER NOT NULL REFERENCES progetti(id),
  utente_id INTEGER NOT NULL REFERENCES utenti(id),
  PRIMARY KEY (progetto_id, utente_id)
);

CREATE TABLE IF NOT EXISTS note_attivita (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attivita_id INTEGER NOT NULL REFERENCES attivita(id) ON DELETE CASCADE,
  utente_id INTEGER NOT NULL REFERENCES utenti(id),
  testo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messaggi_progetto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  progetto_id INTEGER NOT NULL REFERENCES progetti(id),
  utente_id INTEGER NOT NULL REFERENCES utenti(id),
  testo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_lettura (
  utente_id INTEGER NOT NULL REFERENCES utenti(id),
  progetto_id INTEGER NOT NULL REFERENCES progetti(id),
  ultimo_letto_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (utente_id, progetto_id)
);

CREATE TABLE IF NOT EXISTS notifiche (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utente_id INTEGER NOT NULL REFERENCES utenti(id),
  tipo TEXT NOT NULL,
  titolo TEXT NOT NULL,
  messaggio TEXT,
  link TEXT,
  letta INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS utenti_cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clienti(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  ruolo TEXT NOT NULL DEFAULT 'user' CHECK(ruolo IN ('admin', 'user')),
  schede_visibili TEXT NOT NULL DEFAULT 'ticket,progetti',
  attivo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schede_cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clienti(id),
  titolo TEXT NOT NULL,
  contenuto TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documenti_repository (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_file TEXT NOT NULL,
  nome_originale TEXT NOT NULL,
  dimensione INTEGER NOT NULL DEFAULT 0,
  tipo_mime TEXT,
  contenuto_testo TEXT,
  categoria TEXT NOT NULL DEFAULT 'generale',
  descrizione TEXT,
  caricato_da INTEGER REFERENCES utenti(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_stato ON ticket(stato);
CREATE INDEX IF NOT EXISTS idx_ticket_cliente ON ticket(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ticket_codice ON ticket(codice);
CREATE INDEX IF NOT EXISTS idx_progetti_cliente ON progetti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_attivita_progetto ON attivita(progetto_id);
CREATE INDEX IF NOT EXISTS idx_email_tipo ON email(tipo);
CREATE INDEX IF NOT EXISTS idx_email_cliente ON email(cliente_id);
CREATE INDEX IF NOT EXISTS idx_email_ticket ON email(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_progetto ON email(progetto_id);
CREATE INDEX IF NOT EXISTS idx_email_attivita ON email(attivita_id);
CREATE INDEX IF NOT EXISTS idx_email_rilevanza ON email(rilevanza);
CREATE INDEX IF NOT EXISTS idx_note_ticket ON note_interne(ticket_id);
CREATE INDEX IF NOT EXISTS idx_note_progetto ON note_interne(progetto_id);
CREATE INDEX IF NOT EXISTS idx_note_attivita ON note_attivita(attivita_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_progetto ON messaggi_progetto(progetto_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_utente ON notifiche(utente_id);
CREATE INDEX IF NOT EXISTS idx_utenti_cliente_cliente ON utenti_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_utenti_cliente_email ON utenti_cliente(email);
CREATE INDEX IF NOT EXISTS idx_schede_cliente ON schede_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documenti_repository_categoria ON documenti_repository(categoria);
