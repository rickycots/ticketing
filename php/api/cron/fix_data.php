<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
if (($_GET['key'] ?? '') !== JWT_SECRET) { http_response_code(403); die('no'); }
header('Content-Type: text/plain');

// Fix circular dependency: activity 11 depends on 10, and 10 depends on 11
// Keep 10 -> 11 (10 depends on 11), remove 11 -> 10
Database::execute("UPDATE attivita SET dipende_da = NULL WHERE id = 11 AND dipende_da = 10");
echo "Fixed circular dependency between activity 10 and 11\n";

// Show all
$all = Database::fetchAll("SELECT id, nome, dipende_da FROM attivita WHERE progetto_id = 9 ORDER BY id");
foreach ($all as $r) {
    echo "ID:{$r['id']} nome:{$r['nome']} dipende_da:{$r['dipende_da']}\n";
}
echo "Done\n";
