<?php
/**
 * Quick fix: create referenti tables if missing
 * Run via: /api/migrations/fix_referenti.php?key=MIGRATE_KEY
 * Requires _ENABLE_MIGRATE flag file (same as migrate.php)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

define('MIGRATE_KEY', hash('sha256', JWT_SECRET . '-migrate-stm-2026'));

if (php_sapi_name() !== 'cli') {
    if (!file_exists(__DIR__ . '/_ENABLE_MIGRATE')) {
        http_response_code(403);
        die('Migrations disabled. Create _ENABLE_MIGRATE file to enable temporarily.');
    }
    $key = $_GET['key'] ?? '';
    if (!hash_equals(MIGRATE_KEY, $key)) {
        http_response_code(403);
        die('Access denied');
    }
}

header('Content-Type: text/plain; charset=utf-8');

$db = Database::get();

// Also create comunicazioni_lette if missing
try {
    $db->exec("CREATE TABLE IF NOT EXISTS comunicazioni_lette (
        utente_cliente_id INT NOT NULL,
        comunicazione_id INT NOT NULL,
        letto_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (utente_cliente_id, comunicazione_id),
        FOREIGN KEY (utente_cliente_id) REFERENCES utenti_cliente(id),
        FOREIGN KEY (comunicazione_id) REFERENCES comunicazioni_cliente(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "OK: comunicazioni_lette table\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'already exists') === false) echo "ERROR: " . $e->getMessage() . "\n";
}

// Add 'importante' column to comunicazioni_cliente if missing
try {
    $db->exec("ALTER TABLE comunicazioni_cliente ADD COLUMN importante TINYINT(1) NOT NULL DEFAULT 0");
    echo "OK: added 'importante' column to comunicazioni_cliente\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') === false && strpos($e->getMessage(), 'duplicate column') === false) {
        echo "SKIP: importante column — " . $e->getMessage() . "\n";
    } else {
        echo "OK: importante column already exists\n";
    }
}

// Add 'manutenzione_ordinaria' column to progetti if missing
try {
    $db->exec("ALTER TABLE progetti ADD COLUMN manutenzione_ordinaria TINYINT(1) NOT NULL DEFAULT 0");
    echo "OK: added 'manutenzione_ordinaria' column to progetti\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') === false && strpos($e->getMessage(), 'duplicate column') === false) {
        echo "SKIP: manutenzione_ordinaria — " . $e->getMessage() . "\n";
    } else {
        echo "OK: manutenzione_ordinaria column already exists\n";
    }
}

$sqls = [
    "CREATE TABLE IF NOT EXISTS referenti_progetto (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cognome VARCHAR(255) NOT NULL DEFAULT '',
        email VARCHAR(191) NOT NULL,
        telefono VARCHAR(50) DEFAULT NULL,
        ruolo VARCHAR(100) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clienti(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE IF NOT EXISTS progetto_referenti (
        progetto_id INT NOT NULL,
        referente_id INT NOT NULL,
        PRIMARY KEY (progetto_id, referente_id),
        FOREIGN KEY (progetto_id) REFERENCES progetti(id),
        FOREIGN KEY (referente_id) REFERENCES referenti_progetto(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE INDEX idx_referenti_progetto_cliente ON referenti_progetto(cliente_id)",

    "CREATE TABLE IF NOT EXISTS attivita_referenti (
        attivita_id INT NOT NULL,
        referente_id INT NOT NULL,
        PRIMARY KEY (attivita_id, referente_id),
        FOREIGN KEY (attivita_id) REFERENCES attivita(id),
        FOREIGN KEY (referente_id) REFERENCES referenti_progetto(id),
        INDEX idx_attivita_referenti_act (attivita_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
];

foreach ($sqls as $sql) {
    try {
        $db->exec($sql);
        echo "OK: " . substr($sql, 0, 80) . "...\n";
    } catch (PDOException $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
    }
}

echo "\nDone.\n";
