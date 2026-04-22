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

    // Utenti portale — 1 record per persona, nessun contesto aggiuntivo
    $utentiPortale = Database::fetchAll(
        "SELECT uc.id, uc.nome, COALESCE(uc.cognome, '') as cognome, uc.email,
                uc.cliente_id, c.nome_azienda as azienda,
                NULL as ruolo, NULL as telefono
         FROM utenti_cliente uc
         LEFT JOIN clienti c ON uc.cliente_id = c.id
         WHERE uc.attivo = 1"
    );
    foreach ($utentiPortale as &$u) { $u['status'] = 'utente_portale'; $u['contesti'] = []; }
    unset($u);

    // Referenti interni (1 record master) + lista contesti (progetti + attività)
    $refInterniRaw = Database::fetchAll(
        "SELECT rp.id, rp.nome, rp.cognome, rp.email, rp.telefono, rp.ruolo,
                c.nome_azienda as azienda
         FROM referenti_progetto rp
         LEFT JOIN clienti c ON rp.cliente_id = c.id"
    );
    $refInterni = [];
    foreach ($refInterniRaw as $r) {
        $progetti = Database::fetchAll(
            "SELECT p.nome FROM progetti p
             INNER JOIN progetto_referenti pr ON pr.progetto_id = p.id
             WHERE pr.referente_id = ?",
            [$r['id']]
        );
        $attivita = Database::fetchAll(
            "SELECT a.nome as attivita_nome, p.nome as progetto_nome
             FROM attivita a
             JOIN progetti p ON a.progetto_id = p.id
             INNER JOIN attivita_referenti ar ON ar.attivita_id = a.id
             WHERE ar.referente_id = ?",
            [$r['id']]
        );
        $contesti = [];
        foreach ($progetti as $p) { $contesti[] = ['progetto' => $p['nome'], 'attivita' => null]; }
        foreach ($attivita as $a) { $contesti[] = ['progetto' => $a['progetto_nome'], 'attivita' => $a['attivita_nome']]; }
        $r['status'] = 'ref_interno';
        $r['contesti'] = $contesti;
        $refInterni[] = $r;
    }

    // Referenti esterni — aggregati per email (case-insensitive)
    $refEsterniRaw = Database::fetchAll(
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
    $estMap = [];
    foreach ($refEsterniRaw as $r) {
        $key = strtolower($r['email'] ?? '');
        if (!$key) continue;
        if (!isset($estMap[$key])) {
            $estMap[$key] = [
                'ids' => [], 'nome' => $r['nome'], 'cognome' => $r['cognome'], 'email' => $r['email'],
                'telefono' => $r['telefono'], 'ruolo' => $r['ruolo'], 'azienda' => $r['azienda'],
                'status' => 'ref_esterno', 'contesti' => [],
            ];
        }
        $estMap[$key]['ids'][] = (int)$r['id'];
        $progettoNome = $r['progetto_nome'] ?: $r['attivita_progetto_nome'];
        if ($progettoNome) {
            $estMap[$key]['contesti'][] = [
                'progetto' => $progettoNome,
                'attivita' => $r['attivita_nome'] ?: null,
            ];
        }
    }
    $refEsterni = array_values($estMap);

    Response::json(array_merge($utentiPortale, $refInterni, $refEsterni));
});

// DELETE /anagrafica/ref-interno/:id — cascata junction + record master (admin only)
$router->delete('/anagrafica/ref-interno/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = (int)$req->params['id'];
    $pdo = Database::get();
    $pdo->beginTransaction();
    try {
        Database::execute('DELETE FROM progetto_referenti WHERE referente_id = ?', [$id]);
        Database::execute('DELETE FROM attivita_referenti WHERE referente_id = ?', [$id]);
        Database::execute('DELETE FROM referenti_progetto WHERE id = ?', [$id]);
        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        Response::error('Errore eliminazione: ' . $e->getMessage(), 500);
    }
    Response::json(['ok' => true]);
});

// PUT /anagrafica/ref-interno/:id — update campi anagrafica (admin only)
$router->put('/anagrafica/ref-interno/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = (int)$req->params['id'];
    $existing = Database::fetchOne('SELECT * FROM referenti_progetto WHERE id = ?', [$id]);
    if (!$existing) Response::error('Non trovato', 404);
    Database::execute(
        "UPDATE referenti_progetto
         SET nome = COALESCE(?, nome), cognome = COALESCE(?, cognome), email = COALESCE(?, email),
             telefono = COALESCE(?, telefono), ruolo = COALESCE(?, ruolo)
         WHERE id = ?",
        [
            $req->body['nome'] ?? null,
            $req->body['cognome'] ?? null,
            $req->body['email'] ?? null,
            array_key_exists('telefono', $req->body) ? ($req->body['telefono'] ?: null) : null,
            array_key_exists('ruolo', $req->body) ? ($req->body['ruolo'] ?: null) : null,
            $id,
        ]
    );
    $row = Database::fetchOne('SELECT * FROM referenti_progetto WHERE id = ?', [$id]);
    Response::json($row);
});

// DELETE /anagrafica/ref-esterno?email=... — bulk delete per email (admin only)
$router->delete('/anagrafica/ref-esterno', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    ensureReferentiEsterniTable();
    $email = strtolower(trim($req->query['email'] ?? ''));
    if (!$email) Response::error('email richiesta', 400);
    $stmt = Database::execute('DELETE FROM referenti_esterni WHERE LOWER(email) = ?', [$email]);
    Response::json(['ok' => true, 'deleted' => $stmt->rowCount()]);
});

// PUT /anagrafica/ref-esterno?email=... — bulk update (admin only)
$router->put('/anagrafica/ref-esterno', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    ensureReferentiEsterniTable();
    $oldEmail = strtolower(trim($req->query['email'] ?? ''));
    if (!$oldEmail) Response::error('email richiesta', 400);
    $stmt = Database::execute(
        "UPDATE referenti_esterni
         SET nome = COALESCE(?, nome), cognome = COALESCE(?, cognome), email = COALESCE(?, email),
             telefono = COALESCE(?, telefono), ruolo = COALESCE(?, ruolo), azienda = COALESCE(?, azienda)
         WHERE LOWER(email) = ?",
        [
            $req->body['nome'] ?? null,
            $req->body['cognome'] ?? null,
            $req->body['email'] ?? null,
            array_key_exists('telefono', $req->body) ? ($req->body['telefono'] ?: null) : null,
            array_key_exists('ruolo', $req->body) ? ($req->body['ruolo'] ?: null) : null,
            array_key_exists('azienda', $req->body) ? ($req->body['azienda'] ?: null) : null,
            $oldEmail,
        ]
    );
    Response::json(['ok' => true, 'updated' => $stmt->rowCount()]);
});
