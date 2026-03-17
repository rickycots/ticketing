<?php
/**
 * Database migration runner
 *
 * SECURITY:
 * - Web access DISABLED by default. To enable temporarily:
 *   1. Create file _ENABLE_MIGRATE in the migrations/ directory
 *   2. Run migration with ?key=MIGRATE_KEY (NOT the JWT secret)
 *   3. Delete _ENABLE_MIGRATE when done
 * - CLI access: php migrate.php (no restrictions)
 * - ?reset=1 only available via CLI
 * - All web invocations are logged
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

$isCli = php_sapi_name() === 'cli';

// Dedicated migrate key (different from JWT_SECRET)
define('MIGRATE_KEY', hash('sha256', JWT_SECRET . '-migrate-stm-2026'));

if (!$isCli) {
    // Check enable flag file
    if (!file_exists(__DIR__ . '/_ENABLE_MIGRATE')) {
        http_response_code(403);
        die('Migrations disabled. Create _ENABLE_MIGRATE file to enable temporarily.');
    }

    // Validate dedicated key
    $key = $_GET['key'] ?? '';
    if (!hash_equals(MIGRATE_KEY, $key)) {
        http_response_code(403);
        // Log failed attempt
        $log = date('Y-m-d H:i:s') . " DENIED migrate from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . " key=" . substr($key, 0, 8) . "...\n";
        @file_put_contents(__DIR__ . '/migrate.log', $log, FILE_APPEND);
        die('Access denied. Invalid key.');
    }

    // Block reset via web — only CLI
    if (isset($_GET['reset'])) {
        http_response_code(403);
        die('Reset is only available via CLI for safety.');
    }

    // Log successful invocation
    $log = date('Y-m-d H:i:s') . " OK migrate from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";
    @file_put_contents(__DIR__ . '/migrate.log', $log, FILE_APPEND);
}

header('Content-Type: text/plain; charset=utf-8');

try {
    $db = Database::get();

    // Drop all tables if ?reset=1 is passed (CLI ONLY)
    if ($isCli && isset($argv) && in_array('--reset', $argv)) {
        echo "=== RESET: Dropping all tables ===\n";
        $db->exec('SET FOREIGN_KEY_CHECKS = 0');
        $tables = ['progetto_referenti', 'referenti_progetto',
            'comunicazioni_cliente', 'schede_cliente', 'documenti_repository', 'allegati_progetto',
            'notifiche', 'chat_lettura', 'messaggi_progetto', 'note_attivita', 'note_interne',
            'progetto_tecnici', 'email', 'ticket', 'attivita', 'progetti',
            'utenti_cliente', 'clienti', 'utenti', 'impostazioni', 'audit_log', 'rate_limits'];
        foreach ($tables as $t) {
            $db->exec("DROP TABLE IF EXISTS {$t}");
            echo "Dropped: {$t}\n";
        }
        $db->exec('SET FOREIGN_KEY_CHECKS = 1');
        echo "\n";
    }

    // Read and execute schema SQL
    $schemaFile = __DIR__ . '/001_schema.sql';
    if (!file_exists($schemaFile)) {
        die("Schema file not found: $schemaFile\n");
    }

    $sql = file_get_contents($schemaFile);

    // Split by semicolon and execute each statement
    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        function($s) {
            $clean = trim(preg_replace('/--.*$/m', '', $s));
            return $clean !== '';
        }
    );

    $count = 0;
    foreach ($statements as $stmt) {
        $clean = trim(preg_replace('/--.*$/m', '', $stmt));
        if (empty($clean)) continue;

        try {
            $db->exec($stmt);
            $count++;
            if (preg_match('/CREATE TABLE.*?(\w+)\s*\(/i', $stmt, $m)) {
                echo "OK: Created table {$m[1]}\n";
            } elseif (preg_match('/CREATE INDEX.*?(\w+)\s+ON/i', $stmt, $m)) {
                echo "OK: Created index {$m[1]}\n";
            } else {
                echo "OK: Executed statement\n";
            }
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'already exists') !== false) {
                echo "SKIP: Already exists\n";
            } else {
                echo "ERROR: " . $e->getMessage() . "\n";
            }
        }
    }

    // Incremental migrations (ALTER TABLE for existing databases)
    $alterations = [
        "ALTER TABLE utenti_cliente ADD COLUMN cambio_password TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE utenti_cliente ADD COLUMN two_factor TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE utenti_cliente ADD COLUMN two_factor_code VARCHAR(6) DEFAULT NULL",
        "ALTER TABLE utenti_cliente ADD COLUMN two_factor_expires DATETIME DEFAULT NULL",
        "ALTER TABLE utenti_cliente ADD COLUMN two_factor_attempts INT NOT NULL DEFAULT 0",
        "ALTER TABLE utenti ADD COLUMN cambio_password TINYINT(1) NOT NULL DEFAULT 0",
        "UPDATE documenti_repository SET categoria = 'Altro' WHERE categoria = 'generale'",
        "ALTER TABLE clienti ADD COLUMN servizio_ticket TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE clienti ADD COLUMN servizio_progetti TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE clienti ADD COLUMN servizio_ai TINYINT(1) NOT NULL DEFAULT 1",
    ];
    foreach ($alterations as $alt) {
        try {
            $db->exec($alt);
            echo "OK: $alt\n";
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate column') !== false) {
                echo "SKIP: Column already exists\n";
            } else {
                echo "ERROR: " . $e->getMessage() . "\n";
            }
        }
    }

    echo "\nMigration completed. $count statements executed.\n";
    echo "Database: " . DB_NAME . " on " . DB_HOST . "\n";

    // Remind to remove enable flag
    if (!$isCli) {
        echo "\n⚠ IMPORTANT: Delete _ENABLE_MIGRATE file now!\n";
    }

} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage() . "\n");
}
