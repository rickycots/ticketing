<?php
/**
 * Database Seeder — demo data for MySQL
 * Usage: php seed.php (or call via browser with ?key=JWT_SECRET)
 * WARNING: This TRUNCATES all tables and reinserts demo data!
 */

// Load config
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

// Security: require JWT_SECRET as key parameter (web) or CLI
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if ($key !== JWT_SECRET) {
        http_response_code(403);
        die(json_encode(['error' => 'Accesso negato. Parametro ?key= richiesto.']));
    }
    header('Content-Type: text/plain; charset=utf-8');
}

function out(string $msg): void {
    echo $msg . "\n";
    if (php_sapi_name() !== 'cli') ob_flush();
}

out("=== Seeding database ===\n");

$pdo = Database::getConnection();

// Disable FK checks for truncation
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

$tables = [
    'comunicazioni_cliente', 'schede_cliente', 'documenti_repository', 'allegati_progetto',
    'notifiche', 'chat_lettura', 'messaggi_progetto', 'note_attivita', 'note_interne',
    'progetto_tecnici', 'email', 'ticket', 'attivita', 'progetti',
    'utenti_cliente', 'clienti', 'utenti', 'impostazioni'
];

foreach ($tables as $t) {
    $pdo->exec("TRUNCATE TABLE {$t}");
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

out("Tabelle svuotate.");

// --- UTENTI ---
$hash = fn(string $pwd) => password_hash($pwd, PASSWORD_DEFAULT);

Database::execute(
    'INSERT INTO utenti (nome, email, password_hash, ruolo) VALUES (?, ?, ?, ?)',
    ['Marco Rossi', 'admin@ticketing.local', $hash('admin123'), 'admin']
);
Database::execute(
    'INSERT INTO utenti (nome, email, password_hash, ruolo) VALUES (?, ?, ?, ?)',
    ['Laura Bianchi', 'tecnico@ticketing.local', $hash('tecnico123'), 'tecnico']
);

out("Utenti creati: admin@ticketing.local / admin123, tecnico@ticketing.local / tecnico123");

// --- CLIENTI ---
Database::execute(
    'INSERT INTO clienti (nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Rossi Srl', 'Giuseppe Rossi', 'g.rossi@rossi-srl.it', '02-1234567', 'Via Roma 42', 'Milano', 'MI', 'Cliente storico, contratto premium', 'rossi']
);
Database::execute(
    'INSERT INTO clienti (nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Tech Solutions SpA', 'Anna Verdi', 'a.verdi@techsolutions.it', '06-9876543', 'Viale Europa 15', 'Roma', 'RM', 'Nuovo cliente, progetto migrazione in corso', 'tech']
);

out("2 clienti creati");

// --- UTENTI CLIENTE ---
Database::execute(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, schede_visibili) VALUES (?, ?, ?, ?, ?)',
    [1, 'Giuseppe Rossi', 'giuseppe@rossi-srl.it', $hash('cliente123'), 'ticket,progetti,ai']
);
Database::execute(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, schede_visibili) VALUES (?, ?, ?, ?, ?)',
    [1, 'Maria Rossi', 'maria@rossi-srl.it', $hash('cliente123'), 'ticket']
);
Database::execute(
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, schede_visibili) VALUES (?, ?, ?, ?, ?)',
    [2, 'Anna Verdi', 'anna@techsolutions.it', $hash('cliente123'), 'ticket,progetti,ai']
);

out("3 utenti cliente creati");

// --- PROGETTI ---
Database::execute(
    "INSERT INTO progetti (cliente_id, nome, data_inizio, data_scadenza, stato, blocco) VALUES (?, ?, ?, ?, ?, ?)",
    [1, 'Migrazione Server Exchange', '2026-01-15', '2026-04-30', 'attivo', 'nessuno']
);
Database::execute(
    "INSERT INTO progetti (cliente_id, nome, data_inizio, data_scadenza, stato, blocco) VALUES (?, ?, ?, ?, ?, ?)",
    [1, 'Aggiornamento Firewall', '2026-02-01', '2026-03-15', 'attivo', 'lato_cliente']
);
Database::execute(
    "INSERT INTO progetti (cliente_id, nome, data_inizio, data_scadenza, stato, blocco) VALUES (?, ?, ?, ?, ?, ?)",
    [2, 'Setup Infrastruttura Cloud', '2026-02-10', '2026-06-30', 'attivo', 'nessuno']
);

out("3 progetti creati");

// --- ATTIVITA ---
// Progetto 1: Migrazione Exchange
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [1, 'Analisi infrastruttura attuale', 'Inventario server e servizi attivi', 1, 'completata', 100, 'alta', '2026-02-01', '2026-01-15', 1, null]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [1, 'Configurazione nuovo server', 'Setup Exchange Online', 1, 'in_corso', 60, 'alta', '2026-03-01', '2026-02-05', null, 1]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [1, 'Migrazione caselle email', 'Migrazione di tutte le caselle aziendali', 2, 'da_fare', 0, 'media', '2026-03-30', '2026-03-05', null, 2]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [1, 'Test e validazione', 'Verifica funzionamento post-migrazione', 2, 'da_fare', 0, 'media', '2026-04-15', '2026-04-01', null, 3]
);

// Progetto 2: Firewall
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [2, 'Configurazione regole firewall', 'Definizione policy di sicurezza', 1, 'completata', 100, 'alta', '2026-02-15', '2026-02-01', 1, null]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [2, 'Test penetrazione', 'Verifica sicurezza perimetrale', 2, 'in_corso', 30, 'alta', '2026-03-01', '2026-02-16', null, 5]
);

// Progetto 3: Cloud
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [3, 'Design architettura cloud', 'Progettazione infrastruttura AWS/Azure', 1, 'in_corso', 50, 'alta', '2026-03-15', '2026-02-10', 1, null]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [3, 'Setup rete virtuale', 'VPC, subnet, security groups', 2, 'da_fare', 0, 'media', '2026-04-01', '2026-03-16', null, 7]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [3, 'Migrazione applicativi', 'Containerizzazione e deploy', 1, 'da_fare', 0, 'bassa', '2026-05-30', '2026-04-05', null, 8]
);

out("9 attività create");

// --- TICKET ---
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0001', 1, 'Problema accesso email aziendale', 'Diversi utenti non riescono ad accedere alla webmail da questa mattina. Errore "autenticazione fallita".', 'assistenza', 'alta', 'in_lavorazione', 1]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0002', 1, 'Richiesta nuovo indirizzo email', 'Necessario creare indirizzo email per nuovo dipendente: mario.neri@rossi-srl.it', 'richiesta_info', 'bassa', 'aperto', null]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0003', 2, 'Errore 500 sul gestionale', 'Il gestionale restituisce errore 500 quando si prova a generare il report mensile. Screenshot allegato.', 'bug', 'urgente', 'aperto', null]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0004', 2, 'Lentezza connessione VPN', "La VPN aziendale è molto lenta da circa una settimana. Velocità ridotta del 70%.", 'assistenza', 'media', 'in_lavorazione', 2]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0005', 1, 'Richiesta documentazione rete', 'Servono gli schemi di rete aggiornati per audit di sicurezza previsto il mese prossimo.', 'richiesta_info', 'media', 'aperto', null]
);

out("5 ticket creati");

// --- EMAIL ---
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ticket', 'g.rossi@rossi-srl.it', 'admin@ticketing.local',
     '[TICKET #TK-2026-0001] [Assistenza] Problema accesso email aziendale — Cliente: Rossi Srl',
     'Diversi utenti non riescono ad accedere alla webmail da questa mattina.',
     1, 1, null, 0, 'thread-TK-2026-0001', 1]
);
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ticket', 'g.rossi@rossi-srl.it', 'admin@ticketing.local',
     '[TICKET #TK-2026-0002] [Richiesta Info] Richiesta nuovo indirizzo email — Cliente: Rossi Srl',
     'Necessario creare indirizzo email per nuovo dipendente.',
     1, 2, null, 0, 'thread-TK-2026-0002', 0]
);
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ticket', 'a.verdi@techsolutions.it', 'admin@ticketing.local',
     '[TICKET #TK-2026-0003] [Bug] Errore 500 sul gestionale — Cliente: Tech Solutions SpA',
     'Il gestionale restituisce errore 500 quando si prova a generare il report mensile.',
     2, 3, null, 0, 'thread-TK-2026-0003', 0]
);
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['email_cliente', 'g.rossi@rossi-srl.it', 'admin@ticketing.local',
     'Aggiornamento configurazione firewall',
     'Buongiorno, volevo sapere a che punto siamo con la configurazione del firewall. Abbiamo bisogno di approvare le regole proposte?',
     1, null, 2, 1, 'thread-firewall-001', 0]
);
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['email_cliente', 'admin@ticketing.local', 'g.rossi@rossi-srl.it',
     'RE: Aggiornamento configurazione firewall — RICHIESTA APPROVAZIONE',
     'Gentile cliente, abbiamo completato la configurazione delle regole. Necessaria vostra approvazione per procedere. In allegato il documento con le policy proposte.',
     1, null, 2, 1, 'thread-firewall-001', 1]
);

// Update project 2 with blocking email (email id = 5)
Database::execute("UPDATE progetti SET email_bloccante_id = 5, blocco = 'lato_cliente' WHERE id = 2");

Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['email_cliente', 'a.verdi@techsolutions.it', 'admin@ticketing.local',
     'Domanda su tempistiche cloud',
     'Salve, vorremmo avere un aggiornamento sulle tempistiche del progetto cloud. È possibile avere una call questa settimana?',
     2, null, 3, 0, null, 0]
);

out("6 email simulate create");

// --- NOTE INTERNE ---
Database::execute(
    "INSERT INTO note_interne (ticket_id, progetto_id, utente_id, testo) VALUES (?, ?, ?, ?)",
    [1, null, 1, 'Verificato: problema legato al certificato SSL scaduto sul server IMAP. Rinnovo in corso.']
);
Database::execute(
    "INSERT INTO note_interne (ticket_id, progetto_id, utente_id, testo) VALUES (?, ?, ?, ?)",
    [3, null, 1, "Probabilmente legato all'ultimo aggiornamento del gestionale. Contattare il fornitore."]
);
Database::execute(
    "INSERT INTO note_interne (ticket_id, progetto_id, utente_id, testo) VALUES (?, ?, ?, ?)",
    [null, 1, 1, 'Il cliente ha confermato la finestra di migrazione per il weekend del 15-16 marzo.']
);

out("3 note interne create");

// --- SCHEDE CLIENTE (Knowledge Base) ---
Database::execute(
    'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)',
    [1, 'Infrastruttura rete', "Server principale: Windows Server 2019 (IP: 192.168.1.10)\nDomain Controller: Active Directory con 45 utenti\nMail Server: Exchange 2016 (migrazione a Exchange Online in corso)\nFirewall: Fortinet FortiGate 60F\nSwitch: 2x Cisco Catalyst 2960 (48 porte ciascuno)\nNAS: Synology DS920+ (RAID 5, 8TB utili)\nBackup: Veeam Backup su NAS + replica offsite\nVPN: FortiClient SSL-VPN (20 licenze attive)\nISP: Fastweb Business 100/100 Mbps + backup LTE Vodafone"]
);
Database::execute(
    'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)',
    [1, 'Credenziali e accessi', "Domain Admin: admin.rossi (credenziali in cassaforte IT)\nExchange Admin Panel: https://mail.rossi-srl.it/ecp\nFortinet: https://192.168.1.1 (admin / vedi password manager)\nSynology NAS: https://192.168.1.50:5001\nVeeam Console: installata su server principale\nAccesso remoto: AnyDesk su tutti i PC (password di accesso non presidiato configurata)\nReferente IT interno: Mario Bianchi (int. 201, m.bianchi@rossi-srl.it)"]
);
Database::execute(
    'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)',
    [2, 'Ambiente cloud e servizi', "Cloud Provider: AWS (account ID: 123456789012)\nRegion: eu-south-1 (Milano)\nServizi attivi: EC2 (3 istanze), RDS MySQL, S3, CloudFront\nGestionale: applicazione Java su EC2 t3.large\nDatabase: RDS MySQL 8.0 (db.r5.large)\nCDN: CloudFront per assets statici\nMonitoring: CloudWatch + Grafana su EC2 t3.small\nCI/CD: GitHub Actions → deploy su EC2 via SSM\nDominio: techsolutions.it (Registrar: Aruba, DNS: Route53)\nVPN site-to-site: AWS VPN → sede Roma (Fortinet on-prem)"]
);

out("3 schede cliente (Knowledge Base) create");

out("\n=== Seed completato con successo! ===");
out("\nCredenziali demo:");
out("  Admin:   admin@ticketing.local / admin123");
out("  Tecnico: tecnico@ticketing.local / tecnico123");
out("\nPortale Cliente:");
out("  giuseppe@rossi-srl.it / cliente123 (Rossi Srl — ticket+progetti+ai)");
out("  maria@rossi-srl.it / cliente123 (Rossi Srl — solo ticket)");
out("  anna@techsolutions.it / cliente123 (Tech Solutions — ticket+progetti+ai)");
