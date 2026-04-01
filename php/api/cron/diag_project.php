<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
if (($_GET['key'] ?? '') !== JWT_SECRET) { http_response_code(403); die('no'); }
header('Content-Type: text/plain');

$projectId = (int)($_GET['id'] ?? 3);
echo "Deleting project $projectId...\n";

try {
  $project = Database::fetchOne('SELECT id, nome FROM progetti WHERE id = ?', [$projectId]);
  if (!$project) { echo "Project not found\n"; exit; }
  echo "Found: {$project['nome']}\n";

  echo "1. Delete allegati_progetto... ";
  Database::execute('DELETE FROM allegati_progetto WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "2. Delete attivita_programmate... ";
  Database::execute('DELETE FROM attivita_programmate WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "3. Delete email (attivita)... ";
  Database::execute('DELETE FROM email WHERE attivita_id IN (SELECT id FROM attivita WHERE progetto_id = ?)', [$projectId]);
  echo "OK\n";

  echo "4. Delete note_attivita... ";
  Database::execute('DELETE FROM note_attivita WHERE attivita_id IN (SELECT id FROM attivita WHERE progetto_id = ?)', [$projectId]);
  echo "OK\n";

  echo "4b. Reset dipende_da... ";
  Database::execute('UPDATE attivita SET dipende_da = NULL WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "5. Delete attivita... ";
  Database::execute('DELETE FROM attivita WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "6. Delete progetto_tecnici... ";
  Database::execute('DELETE FROM progetto_tecnici WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "7. Delete progetto_referenti... ";
  Database::execute('DELETE FROM progetto_referenti WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "8. Delete messaggi_progetto... ";
  Database::execute('DELETE FROM messaggi_progetto WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "9. Delete chat_lettura... ";
  Database::execute('DELETE FROM chat_lettura WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "10. Delete email (progetto)... ";
  Database::execute('DELETE FROM email WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "11. Delete note_interne... ";
  Database::execute('DELETE FROM note_interne WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "12. Update ticket (set progetto_id NULL)... ";
  Database::execute('UPDATE ticket SET progetto_id = NULL WHERE progetto_id = ?', [$projectId]);
  echo "OK\n";

  echo "13. Delete progetti... ";
  Database::execute('DELETE FROM progetti WHERE id = ?', [$projectId]);
  echo "OK\n";

  echo "\nDONE - Project $projectId deleted successfully!\n";
} catch (\Exception $e) {
  echo "ERROR: " . $e->getMessage() . "\n";
}
