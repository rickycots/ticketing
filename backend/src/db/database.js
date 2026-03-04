const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'ticketing.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('Database initialized successfully');
}

initializeDatabase();

// Migrations for existing databases
function runMigrations() {
  const migrations = [
    "ALTER TABLE attivita ADD COLUMN data_completamento TEXT",
    "ALTER TABLE progetti ADD COLUMN descrizione TEXT",
    "ALTER TABLE clienti ADD COLUMN logo TEXT",
    "ALTER TABLE clienti ADD COLUMN indirizzo TEXT",
    "ALTER TABLE clienti ADD COLUMN citta TEXT",
    "ALTER TABLE clienti ADD COLUMN provincia TEXT",
    "ALTER TABLE email ADD COLUMN attivita_id INTEGER REFERENCES attivita(id)",
    "ALTER TABLE clienti ADD COLUMN portale_slug TEXT",
    "ALTER TABLE attivita ADD COLUMN data_inizio TEXT",
    "ALTER TABLE attivita ADD COLUMN ordine INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE attivita ADD COLUMN dipende_da INTEGER REFERENCES attivita(id)",
    "ALTER TABLE email ADD COLUMN rilevanza TEXT DEFAULT NULL",
    "ALTER TABLE ticket ADD COLUMN letta INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE email ADD COLUMN message_id TEXT",
    "ALTER TABLE email ADD COLUMN allegati TEXT DEFAULT '[]'",
    "ALTER TABLE ticket ADD COLUMN creatore_email TEXT",
    "ALTER TABLE utenti_cliente ADD COLUMN ruolo TEXT NOT NULL DEFAULT 'user'",
    "ALTER TABLE clienti ADD COLUMN sla_reazione TEXT DEFAULT 'nb'",
    "ALTER TABLE ticket ADD COLUMN data_evasione TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  }

  // Create notifiche table if not exists (for existing DBs before schema update)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifiche (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utente_id INTEGER NOT NULL REFERENCES utenti(id),
      tipo TEXT NOT NULL,
      titolo TEXT NOT NULL,
      messaggio TEXT,
      link TEXT,
      letta INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifiche_utente ON notifiche(utente_id)');

  // Create utenti_cliente table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS utenti_cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clienti(id),
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      schede_visibili TEXT NOT NULL DEFAULT 'ticket,progetti',
      attivo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_email_attivita ON email(attivita_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_email_message_id ON email(message_id) WHERE message_id IS NOT NULL');
  db.exec('CREATE INDEX IF NOT EXISTS idx_email_rilevanza ON email(rilevanza)');

  // Auto-populate portale_slug for existing clients without one
  const clientsWithoutSlug = db.prepare('SELECT id, nome_azienda FROM clienti WHERE portale_slug IS NULL').all();
  for (const c of clientsWithoutSlug) {
    let base = (c.nome_azienda.split(/\s+/)[0] || 'client').toLowerCase().replace(/[^a-z0-9]/g, '');
    let slug = base;
    let suffix = 2;
    while (db.prepare('SELECT id FROM clienti WHERE portale_slug = ?').get(slug)) {
      slug = base + suffix;
      suffix++;
    }
    db.prepare('UPDATE clienti SET portale_slug = ? WHERE id = ?').run(slug, c.id);
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_utenti_cliente_cliente ON utenti_cliente(cliente_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_utenti_cliente_email ON utenti_cliente(email)');
}
runMigrations();

module.exports = db;
