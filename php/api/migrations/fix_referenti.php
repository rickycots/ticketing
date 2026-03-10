<?php
/**
 * Quick fix: create referenti tables if missing
 * Run via: /api/migrations/fix_referenti.php?key=YOUR_JWT_SECRET
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

if (php_sapi_name() !== 'cli') {
    $key = $_GET['key'] ?? '';
    if ($key !== JWT_SECRET) {
        http_response_code(403);
        die('Access denied');
    }
}

header('Content-Type: text/plain; charset=utf-8');

$db = Database::get();

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
