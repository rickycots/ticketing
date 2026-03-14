<?php
/**
 * Database Seeder — demo data for MySQL
 *
 * SECURITY:
 * - Web access DISABLED by default. To enable temporarily:
 *   1. Create file _ENABLE_SEED in the seed/ directory
 *   2. Run with ?key=SEED_KEY (NOT the JWT secret)
 *   3. Delete _ENABLE_SEED when done
 * - CLI: php seed.php (no restrictions)
 * - WARNING: TRUNCATES all tables!
 * - All web invocations are logged
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

$isCli = php_sapi_name() === 'cli';

// Dedicated seed key (different from JWT_SECRET)
define('SEED_KEY', hash('sha256', JWT_SECRET . '-seed-stm-2026'));

if (!$isCli) {
    // Check enable flag file
    if (!file_exists(__DIR__ . '/_ENABLE_SEED')) {
        http_response_code(403);
        die('Seed disabled. Create _ENABLE_SEED file to enable temporarily.');
    }

    // Validate dedicated key
    $key = $_GET['key'] ?? '';
    if (!hash_equals(SEED_KEY, $key)) {
        http_response_code(403);
        $log = date('Y-m-d H:i:s') . " DENIED seed from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";
        @file_put_contents(__DIR__ . '/seed.log', $log, FILE_APPEND);
        die(json_encode(['error' => 'Access denied. Invalid key.']));
    }

    // Log successful invocation
    $log = date('Y-m-d H:i:s') . " OK seed from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";
    @file_put_contents(__DIR__ . '/seed.log', $log, FILE_APPEND);

    header('Content-Type: text/plain; charset=utf-8');
}

function out(string $msg): void {
    echo $msg . "\n";
    if (php_sapi_name() !== 'cli') ob_flush();
}

out("=== Seeding database ===\n");

$pdo = Database::get();

// Disable FK checks for truncation
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

$tables = [
    'progetto_referenti', 'referenti_progetto',
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
    'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 'Giuseppe Rossi', 'giuseppe@rossi-srl.it', $hash('cliente123'), 'admin', 'ticket,progetti,ai']
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
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [2, 'Configurazione regole firewall', 'Definizione policy di sicurezza', 1, 'completata', 100, 'alta', '2026-02-15', '2026-02-01', 1, null]
);
Database::execute(
    "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, data_inizio, ordine, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [2, 'Test penetrazione', 'Verifica sicurezza perimetrale', 2, 'in_corso', 30, 'alta', '2026-03-01', '2026-02-16', null, 5]
);
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
    ['TK-2026-0001', 1, 'Problema accesso email aziendale', 'Diversi utenti non riescono ad accedere alla webmail da questa mattina.', 'assistenza', 'alta', 'in_lavorazione', 1]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0002', 1, 'Richiesta nuovo indirizzo email', 'Necessario creare indirizzo email per nuovo dipendente.', 'richiesta_info', 'bassa', 'aperto', null]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0003', 2, 'Errore 500 sul gestionale', 'Il gestionale restituisce errore 500 quando si prova a generare il report mensile.', 'bug', 'urgente', 'aperto', null]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0004', 2, 'Lentezza connessione VPN', "La VPN aziendale è molto lenta da circa una settimana.", 'assistenza', 'media', 'in_lavorazione', 2]
);
Database::execute(
    "INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, stato, assegnato_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ['TK-2026-0005', 1, 'Richiesta documentazione rete', 'Servono gli schemi di rete aggiornati per audit di sicurezza.', 'richiesta_info', 'media', 'aperto', null]
);

out("5 ticket creati");

// --- EMAIL ---
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['ticket', 'g.rossi@rossi-srl.it', 'admin@ticketing.local', '[TICKET #TK-2026-0001] Problema accesso email', 'Diversi utenti non riescono ad accedere alla webmail.', 1, 1, null, 0, 'thread-TK-2026-0001', 1]
);
Database::execute(
    "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, is_bloccante, thread_id, letta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ['email_cliente', 'g.rossi@rossi-srl.it', 'admin@ticketing.local', 'Aggiornamento configurazione firewall', 'Volevo sapere a che punto siamo con la configurazione del firewall.', 1, null, 2, 1, 'thread-firewall-001', 0]
);

Database::execute("UPDATE progetti SET email_bloccante_id = 2, blocco = 'lato_cliente' WHERE id = 2");

out("2 email simulate create");

// --- NOTE INTERNE ---
Database::execute(
    "INSERT INTO note_interne (ticket_id, progetto_id, utente_id, testo) VALUES (?, ?, ?, ?)",
    [1, null, 1, 'Verificato: problema legato al certificato SSL scaduto sul server IMAP.']
);

out("1 nota interna creata");

out("\n=== Seed completato con successo! ===");
out("\nCredenziali demo:");
out("  Admin:   admin@ticketing.local / admin123");
out("  Tecnico: tecnico@ticketing.local / tecnico123");
out("\nPortale Cliente:");
out("  giuseppe@rossi-srl.it / cliente123 (Rossi Srl)");
out("  maria@rossi-srl.it / cliente123 (Rossi Srl)");
out("  anna@techsolutions.it / cliente123 (Tech Solutions)");

if (!$isCli) {
    out("\n⚠ IMPORTANT: Delete _ENABLE_SEED file now!");
}
