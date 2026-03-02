const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Delete existing DB to reset autoincrement counters
const dbPath = path.join(__dirname, '..', 'data', 'ticketing.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  // Also remove WAL/SHM files
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
}

// Re-require to create fresh DB
const db = require('./db/database');

console.log('Seeding database...');

// --- UTENTI ---
const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

const insertUtente = db.prepare(
  'INSERT INTO utenti (nome, email, password_hash, ruolo) VALUES (?, ?, ?, ?)'
);

insertUtente.run('Marco Rossi', 'admin@ticketing.local', hashPassword('admin123'), 'admin');
insertUtente.run('Laura Bianchi', 'tecnico@ticketing.local', hashPassword('tecnico123'), 'tecnico');

console.log('  Utenti creati: admin@ticketing.local / admin123, tecnico@ticketing.local / tecnico123');

// --- CLIENTI ---
const insertCliente = db.prepare(
  'INSERT INTO clienti (nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

insertCliente.run('Rossi Srl', 'Giuseppe Rossi', 'g.rossi@rossi-srl.it', '02-1234567', 'Via Roma 42', 'Milano', 'MI', 'Cliente storico, contratto premium', 'rossi');
insertCliente.run('Tech Solutions SpA', 'Anna Verdi', 'a.verdi@techsolutions.it', '06-9876543', 'Viale Europa 15', 'Roma', 'RM', 'Nuovo cliente, progetto migrazione in corso', 'tech');

console.log('  2 clienti creati');

// --- UTENTI CLIENTE ---
const insertUtenteCliente = db.prepare(
  'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, schede_visibili) VALUES (?, ?, ?, ?, ?)'
);

insertUtenteCliente.run(1, 'Giuseppe Rossi', 'giuseppe@rossi-srl.it', hashPassword('cliente123'), 'ticket,progetti');
insertUtenteCliente.run(1, 'Maria Rossi', 'maria@rossi-srl.it', hashPassword('cliente123'), 'ticket');
insertUtenteCliente.run(2, 'Anna Verdi', 'anna@techsolutions.it', hashPassword('cliente123'), 'ticket,progetti');

console.log('  3 utenti cliente creati');

// --- PROGETTI ---
const insertProgetto = db.prepare(
  "INSERT INTO progetti (cliente_id, nome, data_inizio, data_scadenza, stato, blocco) VALUES (?, ?, ?, ?, ?, ?)"
);

insertProgetto.run(1, 'Migrazione Server Exchange', '2026-01-15', '2026-04-30', 'attivo', 'nessuno');
insertProgetto.run(1, 'Aggiornamento Firewall', '2026-02-01', '2026-03-15', 'attivo', 'lato_cliente');
insertProgetto.run(2, 'Setup Infrastruttura Cloud', '2026-02-10', '2026-06-30', 'attivo', 'nessuno');

console.log('  3 progetti creati');

// --- ATTIVITA ---
const insertAttivita = db.prepare(
  "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

// Progetto 1: Migrazione Exchange — primaria 1, dipendenti 2→3→4
insertAttivita.run(1, 'Analisi infrastruttura attuale', 'Inventario server e servizi attivi', 1, 'completata', 100, 'alta', '2026-02-01', '2026-01-15', 1, null);
insertAttivita.run(1, 'Configurazione nuovo server', 'Setup Exchange Online', 1, 'in_corso', 60, 'alta', '2026-03-01', '2026-02-05', null, 1);
insertAttivita.run(1, 'Migrazione caselle email', 'Migrazione di tutte le caselle aziendali', 2, 'da_fare', 0, 'media', '2026-03-30', '2026-03-05', null, 2);
insertAttivita.run(1, 'Test e validazione', 'Verifica funzionamento post-migrazione', 2, 'da_fare', 0, 'media', '2026-04-15', '2026-04-01', null, 3);

// Progetto 2: Firewall — primaria 5, dipendente 6
insertAttivita.run(2, 'Configurazione regole firewall', 'Definizione policy di sicurezza', 1, 'completata', 100, 'alta', '2026-02-15', '2026-02-01', 1, null);
insertAttivita.run(2, 'Test penetrazione', 'Verifica sicurezza perimetrale', 2, 'in_corso', 30, 'alta', '2026-03-01', '2026-02-16', null, 5);

// Progetto 3: Cloud — primaria 7, dipendenti 8→9
insertAttivita.run(3, 'Design architettura cloud', 'Progettazione infrastruttura AWS/Azure', 1, 'in_corso', 50, 'alta', '2026-03-15', '2026-02-10', 1, null);
insertAttivita.run(3, 'Setup rete virtuale', 'VPC, subnet, security groups', 2, 'da_fare', 0, 'media', '2026-04-01', '2026-03-16', null, 7);
insertAttivita.run(3, 'Migrazione applicativi', 'Containerizzazione e deploy', 1, 'da_fare', 0, 'bassa', '2026-05-30', '2026-04-05', null, 8);

console.log('  9 attività create');

// --- TICKET ---
const insertTicket = db.prepare(
  "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

insertTicket.run('TK-2026-0001', 1, 'Problema accesso email aziendale', 'Diversi utenti non riescono ad accedere alla webmail da questa mattina. Errore "autenticazione fallita".', 'assistenza', 'alta', 'in_lavorazione', 1);
insertTicket.run('TK-2026-0002', 1, 'Richiesta nuovo indirizzo email', 'Necessario creare indirizzo email per nuovo dipendente: mario.neri@rossi-srl.it', 'richiesta_info', 'bassa', 'aperto', null);
insertTicket.run('TK-2026-0003', 2, 'Errore 500 sul gestionale', 'Il gestionale restituisce errore 500 quando si prova a generare il report mensile. Screenshot allegato.', 'bug', 'urgente', 'aperto', null);
insertTicket.run('TK-2026-0004', 2, 'Lentezza connessione VPN', 'La VPN aziendale è molto lenta da circa una settimana. Velocità ridotta del 70%.', 'assistenza', 'media', 'in_lavorazione', 2);
insertTicket.run('TK-2026-0005', 1, 'Richiesta documentazione rete', 'Servono gli schemi di rete aggiornati per audit di sicurezza previsto il mese prossimo.', 'richiesta_info', 'media', 'aperto', null);

console.log('  5 ticket creati');

// --- EMAIL ---
const insertEmail = db.prepare(
  "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

// Emails from tickets
insertEmail.run('ticket', 'g.rossi@rossi-srl.it', 'admin@ticketing.local',
  '[TICKET #TK-2026-0001] [Assistenza] Problema accesso email aziendale — Cliente: Rossi Srl',
  'Diversi utenti non riescono ad accedere alla webmail da questa mattina.',
  1, 1, null, 0, 'thread-TK-2026-0001', 1);

insertEmail.run('ticket', 'g.rossi@rossi-srl.it', 'admin@ticketing.local',
  '[TICKET #TK-2026-0002] [Richiesta Info] Richiesta nuovo indirizzo email — Cliente: Rossi Srl',
  'Necessario creare indirizzo email per nuovo dipendente.',
  1, 2, null, 0, 'thread-TK-2026-0002', 0);

insertEmail.run('ticket', 'a.verdi@techsolutions.it', 'admin@ticketing.local',
  '[TICKET #TK-2026-0003] [Bug] Errore 500 sul gestionale — Cliente: Tech Solutions SpA',
  'Il gestionale restituisce errore 500 quando si prova a generare il report mensile.',
  2, 3, null, 0, 'thread-TK-2026-0003', 0);

// Client email (not from portal)
insertEmail.run('email_cliente', 'g.rossi@rossi-srl.it', 'admin@ticketing.local',
  'Aggiornamento configurazione firewall',
  'Buongiorno, volevo sapere a che punto siamo con la configurazione del firewall. Abbiamo bisogno di approvare le regole proposte?',
  1, null, 2, 1, 'thread-firewall-001', 0);

// Response to client (blocking email for project 2)
insertEmail.run('email_cliente', 'admin@ticketing.local', 'g.rossi@rossi-srl.it',
  'RE: Aggiornamento configurazione firewall — RICHIESTA APPROVAZIONE',
  'Gentile cliente, abbiamo completato la configurazione delle regole. Necessaria vostra approvazione per procedere. In allegato il documento con le policy proposte.',
  1, null, 2, 1, 'thread-firewall-001', 1);

// Update project 2 with blocking email
db.prepare("UPDATE progetti SET email_bloccante_id = 5, blocco = 'lato_cliente' WHERE id = 2").run();

insertEmail.run('email_cliente', 'a.verdi@techsolutions.it', 'admin@ticketing.local',
  'Domanda su tempistiche cloud',
  'Salve, vorremmo avere un aggiornamento sulle tempistiche del progetto cloud. È possibile avere una call questa settimana?',
  2, null, 3, 0, null, 0);

console.log('  6 email simulate create');

// --- NOTE INTERNE ---
const insertNota = db.prepare(
  "INSERT INTO note_interne (ticket_id, progetto_id, utente_id, testo) VALUES (?, ?, ?, ?)"
);

insertNota.run(1, null, 1, 'Verificato: problema legato al certificato SSL scaduto sul server IMAP. Rinnovo in corso.');
insertNota.run(3, null, 1, 'Probabilmente legato all\'ultimo aggiornamento del gestionale. Contattare il fornitore.');
insertNota.run(null, 1, 1, 'Il cliente ha confermato la finestra di migrazione per il weekend del 15-16 marzo.');

console.log('  3 note interne create');

// --- SCHEDE CLIENTE (Knowledge Base) ---
const insertScheda = db.prepare(
  'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)'
);

insertScheda.run(1, 'Infrastruttura rete', `Server principale: Windows Server 2019 (IP: 192.168.1.10)
Domain Controller: Active Directory con 45 utenti
Mail Server: Exchange 2016 (migrazione a Exchange Online in corso)
Firewall: Fortinet FortiGate 60F
Switch: 2x Cisco Catalyst 2960 (48 porte ciascuno)
NAS: Synology DS920+ (RAID 5, 8TB utili)
Backup: Veeam Backup su NAS + replica offsite
VPN: FortiClient SSL-VPN (20 licenze attive)
ISP: Fastweb Business 100/100 Mbps + backup LTE Vodafone`);

insertScheda.run(1, 'Credenziali e accessi', `Domain Admin: admin.rossi (credenziali in cassaforte IT)
Exchange Admin Panel: https://mail.rossi-srl.it/ecp
Fortinet: https://192.168.1.1 (admin / vedi password manager)
Synology NAS: https://192.168.1.50:5001
Veeam Console: installata su server principale
Accesso remoto: AnyDesk su tutti i PC (password di accesso non presidiato configurata)
Referente IT interno: Mario Bianchi (int. 201, m.bianchi@rossi-srl.it)`);

insertScheda.run(2, 'Ambiente cloud e servizi', `Cloud Provider: AWS (account ID: 123456789012)
Region: eu-south-1 (Milano)
Servizi attivi: EC2 (3 istanze), RDS MySQL, S3, CloudFront
Gestionale: applicazione Java su EC2 t3.large
Database: RDS MySQL 8.0 (db.r5.large)
CDN: CloudFront per assets statici
Monitoring: CloudWatch + Grafana su EC2 t3.small
CI/CD: GitHub Actions → deploy su EC2 via SSM
Dominio: techsolutions.it (Registrar: Aruba, DNS: Route53)
VPN site-to-site: AWS VPN → sede Roma (Fortinet on-prem)`);

console.log('  3 schede cliente (Knowledge Base) create');

console.log('\nSeed completato con successo!');
console.log('\nCredenziali demo:');
console.log('  Admin:   admin@ticketing.local / admin123');
console.log('  Tecnico: tecnico@ticketing.local / tecnico123');
console.log('\nPortale Cliente:');
console.log('  giuseppe@rossi-srl.it / cliente123 (Rossi Srl — ticket+progetti)');
console.log('  maria@rossi-srl.it / cliente123 (Rossi Srl — solo ticket)');
console.log('  anna@techsolutions.it / cliente123 (Tech Solutions — ticket+progetti)');
