<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
if (($_GET['key'] ?? '') !== JWT_SECRET) { http_response_code(403); die('no'); }
header('Content-Type: application/json');
$count = Database::fetchOne("SELECT COUNT(*) as c FROM documenti_repository WHERE categoria = 'FAQ Suprema'");
$sample = Database::fetchAll("SELECT id, nome_originale, LENGTH(contenuto_testo) as len, descrizione FROM documenti_repository WHERE categoria = 'FAQ Suprema' ORDER BY id DESC LIMIT 5");
$lastSync = Database::fetchOne("SELECT valore FROM impostazioni WHERE chiave = 'faq_suprema_last_sync'");
echo json_encode(['count' => $count['c'], 'last_sync' => $lastSync['valore'] ?? null, 'sample' => $sample]);
