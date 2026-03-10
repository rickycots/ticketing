-- Schema Ticketing & Project Management MVP — MySQL version
-- Compatible with MySQL 5.6+ (no JSON type, VARCHAR UNIQUE max 191 for utf8mb4)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS utenti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ruolo ENUM('admin', 'tecnico') NOT NULL,
  attivo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clienti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_azienda VARCHAR(255) NOT NULL,
  referente VARCHAR(255),
  email VARCHAR(191) NOT NULL,
  telefono VARCHAR(50),
  indirizzo VARCHAR(255),
  citta VARCHAR(100),
  provincia VARCHAR(5),
  note TEXT,
  logo VARCHAR(255),
  portale_slug VARCHAR(100) UNIQUE,
  sla_reazione ENUM('1g', '3g', 'nb') NOT NULL DEFAULT 'nb',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('ticket', 'email_cliente', 'altro') NOT NULL DEFAULT 'altro',
  mittente VARCHAR(255) NOT NULL,
  destinatario VARCHAR(255) NOT NULL,
  oggetto VARCHAR(500) NOT NULL,
  corpo TEXT,
  allegati TEXT DEFAULT NULL,
  cliente_id INT,
  ticket_id INT,
  progetto_id INT,
  attivita_id INT,
  is_bloccante TINYINT(1) NOT NULL DEFAULT 0,
  rilevanza ENUM('rilevante', 'di_contesto', 'bloccante') DEFAULT NULL,
  thread_id VARCHAR(255),
  message_id VARCHAR(191) UNIQUE,
  data_ricezione DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  letta TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS progetti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descrizione TEXT,
  data_inizio DATE,
  data_scadenza DATE,
  stato ENUM('attivo', 'in_pausa', 'completato', 'annullato') NOT NULL DEFAULT 'attivo',
  blocco ENUM('nessuno', 'lato_admin', 'lato_cliente') NOT NULL DEFAULT 'nessuno',
  email_bloccante_id INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id),
  FOREIGN KEY (email_bloccante_id) REFERENCES email(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codice VARCHAR(20) NOT NULL UNIQUE,
  cliente_id INT NOT NULL,
  oggetto VARCHAR(500) NOT NULL,
  descrizione TEXT,
  categoria ENUM('assistenza', 'bug', 'richiesta_info', 'altro') NOT NULL,
  priorita ENUM('urgente', 'alta', 'media', 'bassa') NOT NULL DEFAULT 'media',
  stato ENUM('aperto', 'in_lavorazione', 'in_attesa', 'risolto', 'chiuso') NOT NULL DEFAULT 'aperto',
  assegnato_a INT,
  progetto_id INT,
  letta TINYINT(1) NOT NULL DEFAULT 0,
  creatore_email VARCHAR(255),
  data_evasione DATE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id),
  FOREIGN KEY (assegnato_a) REFERENCES utenti(id),
  FOREIGN KEY (progetto_id) REFERENCES progetti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attivita (
  id INT AUTO_INCREMENT PRIMARY KEY,
  progetto_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descrizione TEXT,
  assegnato_a INT,
  stato ENUM('da_fare', 'in_corso', 'completata', 'bloccata') NOT NULL DEFAULT 'da_fare',
  avanzamento TINYINT UNSIGNED NOT NULL DEFAULT 0,
  priorita ENUM('alta', 'media', 'bassa') NOT NULL DEFAULT 'media',
  data_scadenza DATE,
  data_completamento DATE,
  data_inizio DATE,
  ordine INT DEFAULT NULL,
  dipende_da INT,
  note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (assegnato_a) REFERENCES utenti(id),
  FOREIGN KEY (dipende_da) REFERENCES attivita(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS note_interne (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT,
  progetto_id INT,
  utente_id INT NOT NULL,
  testo TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES ticket(id),
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS progetto_tecnici (
  progetto_id INT NOT NULL,
  utente_id INT NOT NULL,
  PRIMARY KEY (progetto_id, utente_id),
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS note_attivita (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attivita_id INT NOT NULL,
  utente_id INT NOT NULL,
  testo TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attivita_id) REFERENCES attivita(id) ON DELETE CASCADE,
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messaggi_progetto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  progetto_id INT NOT NULL,
  utente_id INT NOT NULL,
  testo TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_lettura (
  utente_id INT NOT NULL,
  progetto_id INT NOT NULL,
  ultimo_letto_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (utente_id, progetto_id),
  FOREIGN KEY (utente_id) REFERENCES utenti(id),
  FOREIGN KEY (progetto_id) REFERENCES progetti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifiche (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utente_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  titolo VARCHAR(255) NOT NULL,
  messaggio TEXT,
  link VARCHAR(500),
  letta TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utenti_cliente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ruolo ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  schede_visibili VARCHAR(100) NOT NULL DEFAULT 'ticket,progetti,ai',
  lingua ENUM('it', 'en', 'fr') NOT NULL DEFAULT 'it',
  attivo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicazioni_cliente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  oggetto VARCHAR(500) NOT NULL,
  corpo TEXT,
  mittente VARCHAR(255),
  message_id VARCHAR(191) UNIQUE,
  importante TINYINT(1) NOT NULL DEFAULT 0,
  data_ricezione DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schede_cliente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  titolo VARCHAR(255) NOT NULL,
  contenuto TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documenti_repository (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_file VARCHAR(255) NOT NULL,
  nome_originale VARCHAR(255) NOT NULL,
  dimensione INT NOT NULL DEFAULT 0,
  tipo_mime VARCHAR(100),
  contenuto_testo TEXT,
  categoria VARCHAR(100) NOT NULL DEFAULT 'generale',
  descrizione TEXT,
  caricato_da INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caricato_da) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS allegati_progetto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  progetto_id INT NOT NULL,
  nome_file VARCHAR(255) NOT NULL,
  nome_originale VARCHAR(255) NOT NULL,
  dimensione INT NOT NULL DEFAULT 0,
  tipo_mime VARCHAR(100),
  caricato_da INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (caricato_da) REFERENCES utenti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS impostazioni (
  chiave VARCHAR(100) PRIMARY KEY,
  valore TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Referenti progetto (anagrafica referenti del cliente)
CREATE TABLE IF NOT EXISTS referenti_progetto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  cognome VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(191) NOT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  ruolo VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Associazione progetto-referente (ponte)
CREATE TABLE IF NOT EXISTS progetto_referenti (
  progetto_id INT NOT NULL,
  referente_id INT NOT NULL,
  PRIMARY KEY (progetto_id, referente_id),
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (referente_id) REFERENCES referenti_progetto(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lettura comunicazioni per utente
CREATE TABLE IF NOT EXISTS comunicazioni_lette (
  utente_cliente_id INT NOT NULL,
  comunicazione_id INT NOT NULL,
  letto_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (utente_cliente_id, comunicazione_id),
  FOREIGN KEY (utente_cliente_id) REFERENCES utenti_cliente(id),
  FOREIGN KEY (comunicazione_id) REFERENCES comunicazioni_cliente(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes
CREATE INDEX idx_ticket_stato ON ticket(stato);
CREATE INDEX idx_ticket_cliente ON ticket(cliente_id);
CREATE INDEX idx_ticket_codice ON ticket(codice);
CREATE INDEX idx_progetti_cliente ON progetti(cliente_id);
CREATE INDEX idx_attivita_progetto ON attivita(progetto_id);
CREATE INDEX idx_email_tipo ON email(tipo);
CREATE INDEX idx_email_cliente ON email(cliente_id);
CREATE INDEX idx_email_ticket ON email(ticket_id);
CREATE INDEX idx_email_progetto ON email(progetto_id);
CREATE INDEX idx_email_attivita ON email(attivita_id);
CREATE INDEX idx_email_rilevanza ON email(rilevanza);
CREATE INDEX idx_note_ticket ON note_interne(ticket_id);
CREATE INDEX idx_note_progetto ON note_interne(progetto_id);
CREATE INDEX idx_note_attivita ON note_attivita(attivita_id);
CREATE INDEX idx_messaggi_progetto ON messaggi_progetto(progetto_id);
CREATE INDEX idx_notifiche_utente ON notifiche(utente_id);
CREATE INDEX idx_utenti_cliente_cliente ON utenti_cliente(cliente_id);
CREATE INDEX idx_schede_cliente ON schede_cliente(cliente_id);
CREATE INDEX idx_documenti_repository_categoria ON documenti_repository(categoria);
CREATE INDEX idx_allegati_progetto ON allegati_progetto(progetto_id);
CREATE INDEX idx_comunicazioni_cliente ON comunicazioni_cliente(cliente_id);
CREATE INDEX idx_referenti_progetto_cliente ON referenti_progetto(cliente_id);

SET FOREIGN_KEY_CHECKS = 1;
