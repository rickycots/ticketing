<?php
/**
 * Referenti Esterni routes — contatti esterni all'azienda cliente, legati a progetto o attività.
 * Include anche l'endpoint /anagrafica (utenti portale + referenti interni + referenti esterni).
 */

// Lazy migration for referenti_esterni table
function ensureReferentiEsterniTable() {
    static $checked = false;
    if ($checked) return;
    try {
        Database::execute("CREATE TABLE IF NOT EXISTS referenti_esterni (
            id INT AUTO_INCREMENT PRIMARY KEY,
            progetto_id INT DEFAULT NULL,
            attivita_id INT DEFAULT NULL,
            nome VARCHAR(255) NOT NULL,
            cognome VARCHAR(255) DEFAULT '',
            email VARCHAR(191) NOT NULL,
            telefono VARCHAR(50) DEFAULT NULL,
            ruolo VARCHAR(100) DEFAULT NULL,
            azienda VARCHAR(255) DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ref_est_progetto (progetto_id),
            INDEX idx_ref_est_attivita (attivita_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (\Throwable $e) {}
    $checked = true;
}

// Permission helper: admin or tecnico assigned to the project
function canEditProjectReferentiEsterni($req, $progettoId) {
    if (($req->user['ruolo'] ?? '') === 'admin') return true;
    $row = Database::fetchOne(
        'SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?',
        [$progettoId, $req->user['id']]
    );
    return !!$row;
}

// GET /projects/:id/referenti-esterni — lista ref esterni del progetto (include quelli a livello attività)
$router->get('/projects/:id/referenti-esterni', [Auth::class, 'authenticateToken'], function($req) {
    ensureReferentiEsterniTable();
    $pid = (int)$req->params['id'];
    if (!canEditProjectReferentiEsterni($req, $pid)) Response::error('Non autorizzato', 403);
    $rows = Database::fetchAll(
        "SELECT r.*, a.nome as attivita_nome
         FROM referenti_esterni r
         LEFT JOIN attivita a ON r.attivita_id = a.id
         WHERE r.progetto_id = ? OR r.attivita_id IN (SELECT id FROM attivita WHERE progetto_id = ?)
         ORDER BY r.created_at DESC",
        [$pid, $pid]
    );
    Response::json($rows);
});

// POST /projects/:id/referenti-esterni — crea a livello progetto
$router->post('/projects/:id/referenti-esterni', [Auth::class, 'authenticateToken'], function($req) {
    ensureReferentiEsterniTable();
    $pid = (int)$req->params['id'];
    if (!canEditProjectReferentiEsterni($req, $pid)) Response::error('Non autorizzato', 403);
    $nome = trim($req->body['nome'] ?? '');
    $email = trim($req->body['email'] ?? '');
    if (!$nome || !$email) Response::error('nome e email obbligatori', 400);
    Database::execute(
        "INSERT INTO referenti_esterni (progetto_id, attivita_id, nome, cognome, email, telefono, ruolo, azienda)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)",
        [
            $pid, $nome,
            $req->body['cognome'] ?? '',
            $email,
            $req->body['telefono'] ?? null,
            $req->body['ruolo'] ?? null,
            $req->body['azienda'] ?? null,
        ]
    );
    $id = Database::lastInsertId();
    $row = Database::fetchOne('SELECT * FROM referenti_esterni WHERE id = ?', [$id]);
    Response::json($row);
});

// POST /projects/:id/activities/:aid/referenti-esterni — crea a livello attività
$router->post('/projects/:id/activities/:aid/referenti-esterni', [Auth::class, 'authenticateToken'], function($req) {
    ensureReferentiEsterniTable();
    $pid = (int)$req->params['id'];
    $aid = (int)$req->params['aid'];
    if (!canEditProjectReferentiEsterni($req, $pid)) Response::error('Non autorizzato', 403);
    $act = Database::fetchOne('SELECT id FROM attivita WHERE id = ? AND progetto_id = ?', [$aid, $pid]);
    if (!$act) Response::error('Attività non trovata', 404);
    $nome = trim($req->body['nome'] ?? '');
    $email = trim($req->body['email'] ?? '');
    if (!$nome || !$email) Response::error('nome e email obbligatori', 400);
    Database::execute(
        "INSERT INTO referenti_esterni (progetto_id, attivita_id, nome, cognome, email, telefono, ruolo, azienda)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)",
        [
            $aid, $nome,
            $req->body['cognome'] ?? '',
            $email,
            $req->body['telefono'] ?? null,
            $req->body['ruolo'] ?? null,
            $req->body['azienda'] ?? null,
        ]
    );
    $id = Database::lastInsertId();
    $row = Database::fetchOne('SELECT * FROM referenti_esterni WHERE id = ?', [$id]);
    Response::json($row);
});

// PUT /referenti-esterni/:id
$router->put('/referenti-esterni/:id', [Auth::class, 'authenticateToken'], function($req) {
    ensureReferentiEsterniTable();
    $id = (int)$req->params['id'];
    $existing = Database::fetchOne('SELECT * FROM referenti_esterni WHERE id = ?', [$id]);
    if (!$existing) Response::error('Non trovato', 404);
    $pid = $existing['progetto_id'];
    if (!$pid && $existing['attivita_id']) {
        $act = Database::fetchOne('SELECT progetto_id FROM attivita WHERE id = ?', [$existing['attivita_id']]);
        $pid = $act ? (int)$act['progetto_id'] : null;
    }
    if (!$pid || !canEditProjectReferentiEsterni($req, $pid)) Response::error('Non autorizzato', 403);
    Database::execute(
        "UPDATE referenti_esterni
         SET nome = COALESCE(?, nome), cognome = COALESCE(?, cognome), email = COALESCE(?, email),
             telefono = COALESCE(?, telefono), ruolo = COALESCE(?, ruolo), azienda = COALESCE(?, azienda)
         WHERE id = ?",
        [
            $req->body['nome'] ?? null,
            $req->body['cognome'] ?? null,
            $req->body['email'] ?? null,
            array_key_exists('telefono', $req->body) ? ($req->body['telefono'] ?: null) : null,
            array_key_exists('ruolo', $req->body) ? ($req->body['ruolo'] ?: null) : null,
            array_key_exists('azienda', $req->body) ? ($req->body['azienda'] ?: null) : null,
            $id,
        ]
    );
    $row = Database::fetchOne('SELECT * FROM referenti_esterni WHERE id = ?', [$id]);
    Response::json($row);
});

// DELETE /referenti-esterni/:id
$router->delete('/referenti-esterni/:id', [Auth::class, 'authenticateToken'], function($req) {
    ensureReferentiEsterniTable();
    $id = (int)$req->params['id'];
    $existing = Database::fetchOne('SELECT * FROM referenti_esterni WHERE id = ?', [$id]);
    if (!$existing) Response::error('Non trovato', 404);
    $pid = $existing['progetto_id'];
    if (!$pid && $existing['attivita_id']) {
        $act = Database::fetchOne('SELECT progetto_id FROM attivita WHERE id = ?', [$existing['attivita_id']]);
        $pid = $act ? (int)$act['progetto_id'] : null;
    }
    if (!$pid || !canEditProjectReferentiEsterni($req, $pid)) Response::error('Non autorizzato', 403);
    Database::execute('DELETE FROM referenti_esterni WHERE id = ?', [$id]);
    Response::json(['ok' => true]);
});

// GET /anagrafica — elenco unificato utenti portale + ref. interni + ref. esterni (admin + tecnico)
$router->get('/anagrafica', [Auth::class, 'authenticateToken'], function($req) {
    ensureReferentiEsterniTable();

    // Utenti portale
    $utentiPortale = Database::fetchAll(
        "SELECT uc.id, uc.nome, COALESCE(uc.cognome, '') as cognome, uc.email,
                c.nome_azienda as azienda, NULL as ruolo, NULL as telefono
         FROM utenti_cliente uc
         LEFT JOIN clienti c ON uc.cliente_id = c.id
         WHERE uc.attivo = 1"
    );
    foreach ($utentiPortale as &$u) { $u['status'] = 'utente_portale'; }
    unset($u);

    // Referenti interni
    $refInterni = Database::fetchAll(
        "SELECT rp.id, rp.nome, rp.cognome, rp.email, rp.telefono, rp.ruolo,
                c.nome_azienda as azienda
         FROM referenti_progetto rp
         LEFT JOIN clienti c ON rp.cliente_id = c.id"
    );
    foreach ($refInterni as &$r) { $r['status'] = 'ref_interno'; }
    unset($r);

    // Referenti esterni
    $refEsterni = Database::fetchAll(
        "SELECT re.id, re.nome, re.cognome, re.email, re.telefono, re.ruolo, re.azienda,
                re.progetto_id, re.attivita_id,
                p.nome as progetto_nome,
                ap.nome as attivita_progetto_nome,
                a.nome as attivita_nome
         FROM referenti_esterni re
         LEFT JOIN progetti p ON re.progetto_id = p.id
         LEFT JOIN attivita a ON re.attivita_id = a.id
         LEFT JOIN progetti ap ON a.progetto_id = ap.id"
    );
    foreach ($refEsterni as &$r) {
        $r['status'] = 'ref_esterno';
        if (empty($r['progetto_nome']) && !empty($r['attivita_progetto_nome'])) {
            $r['progetto_nome'] = $r['attivita_progetto_nome'];
        }
        unset($r['attivita_progetto_nome']);
    }
    unset($r);

    Response::json(array_merge($utentiPortale, $refInterni, $refEsterni));
});
