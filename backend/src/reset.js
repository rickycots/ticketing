/**
 * RESET DATABASE — Cancella tutti i dati e ricrea solo l'utente admin.
 * Uso: npm run reset
 *
 * ATTENZIONE: Questo script CANCELLA TUTTO il database e lo ricrea da zero.
 * Usare solo per il reset finale di produzione.
 */

const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'ticketing.db');

// Delete existing DB
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  console.log('Database precedente eliminato.');
}

// Re-create DB with schema + migrations
const db = require('./db/database');

// Create only admin user
const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);
db.prepare(
  'INSERT INTO utenti (nome, email, password_hash, ruolo) VALUES (?, ?, ?, ?)'
).run('Amministratore', 'admin@ticketing.local', hashPassword('admin123'), 'admin');

console.log('\nReset completato!');
console.log('Database ricreato con solo utente admin:');
console.log('  Email:    admin@ticketing.local');
console.log('  Password: admin123');
console.log('\nTutti gli altri dati sono stati eliminati.');
