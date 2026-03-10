<?php
/**
 * Database migration runner
 * Execute via browser: /api/migrations/migrate.php?key=YOUR_JWT_SECRET
 * Or via CLI: php migrate.php
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

// Security: require key parameter (use JWT_SECRET) unless CLI
if (php_sapi_name() !== 'cli') {
    $key = $_GET['key'] ?? '';
    if ($key !== JWT_SECRET) {
        http_response_code(403);
        die('Access denied. Pass ?key=YOUR_JWT_SECRET');
    }
}

header('Content-Type: text/plain; charset=utf-8');

try {
    $db = Database::get();

    // Drop all tables if ?reset=1 is passed
    if (isset($_GET['reset']) && $_GET['reset'] === '1') {
        echo "=== RESET: Dropping all tables ===\n";
        $db->exec('SET FOREIGN_KEY_CHECKS = 0');
        $tables = ['progetto_referenti', 'referenti_progetto',
            'comunicazioni_cliente', 'schede_cliente', 'documenti_repository', 'allegati_progetto',
            'notifiche', 'chat_lettura', 'messaggi_progetto', 'note_attivita', 'note_interne',
            'progetto_tecnici', 'email', 'ticket', 'attivita', 'progetti',
            'utenti_cliente', 'clienti', 'utenti', 'impostazioni'];
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
            // Remove comment-only lines and check if there's actual SQL
            $clean = trim(preg_replace('/--.*$/m', '', $s));
            return $clean !== '';
        }
    );

    $count = 0;
    foreach ($statements as $stmt) {
        // Skip comments-only statements
        $clean = trim(preg_replace('/--.*$/m', '', $stmt));
        if (empty($clean)) continue;

        try {
            $db->exec($stmt);
            $count++;
            // Extract table name for feedback
            if (preg_match('/CREATE TABLE.*?(\w+)\s*\(/i', $stmt, $m)) {
                echo "OK: Created table {$m[1]}\n";
            } elseif (preg_match('/CREATE INDEX.*?(\w+)\s+ON/i', $stmt, $m)) {
                echo "OK: Created index {$m[1]}\n";
            } else {
                echo "OK: Executed statement\n";
            }
        } catch (PDOException $e) {
            // Ignore "already exists" errors
            if (strpos($e->getMessage(), 'already exists') !== false) {
                echo "SKIP: Already exists\n";
            } else {
                echo "ERROR: " . $e->getMessage() . "\n";
            }
        }
    }

    echo "\nMigration completed. $count statements executed.\n";
    echo "Database: " . DB_NAME . " on " . DB_HOST . "\n";

} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage() . "\n");
}
