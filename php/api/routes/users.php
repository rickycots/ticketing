<?php
/**
 * Users routes — CRUD admin/tecnico users
 */

// GET /api/users
$router->get('/users', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $users = Database::fetchAll(
        'SELECT id, nome, email, ruolo, attivo, abilitato_ai, gestione_avanzata, created_at FROM utenti ORDER BY ruolo, nome'
    );
    Response::json($users);
});

// POST /api/users
$router->post('/users', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $nome = $req->body['nome'] ?? '';
    $email = $req->body['email'] ?? '';
    $password = $req->body['password'] ?? '';

    if (!$nome || !$email || !$password) {
        Response::error('Campi obbligatori: nome, email, password', 400);
    }

    $existing = Database::fetchOne('SELECT id FROM utenti WHERE email = ?', [$email]);
    if ($existing) Response::error('Email già in uso', 400);

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $cambioPwd = isset($req->body['cambio_password']) ? (int)$req->body['cambio_password'] : 0;
    $abilitatoAi = !empty($req->body['abilitato_ai']) ? 1 : 0;
    $gestioneAvanzata = !empty($req->body['gestione_avanzata']) ? 1 : 0;
    Database::execute(
        'INSERT INTO utenti (nome, email, password_hash, ruolo, attivo, cambio_password, abilitato_ai, gestione_avanzata) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
        [$nome, $email, $passwordHash, 'tecnico', $cambioPwd, $abilitatoAi, $gestioneAvanzata]
    );

    $user = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo, cambio_password, abilitato_ai, gestione_avanzata, created_at FROM utenti WHERE id = ?',
        [Database::lastInsertId()]
    );
    Response::created($user);
});

// PUT /api/users/:id
$router->put('/users/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $user = Database::fetchOne('SELECT * FROM utenti WHERE id = ?', [$id]);
    if (!$user) Response::error('Utente non trovato', 404);

    $nome = $req->body['nome'] ?? null;
    $email = $req->body['email'] ?? null;
    $password = $req->body['password'] ?? null;
    $attivo = $req->body['attivo'] ?? null;
    $abilitatoAi = isset($req->body['abilitato_ai']) ? (int)$req->body['abilitato_ai'] : null;
    $gestioneAvanzata = isset($req->body['gestione_avanzata']) ? (int)$req->body['gestione_avanzata'] : null;

    if ($email && $email !== $user['email']) {
        $existing = Database::fetchOne('SELECT id FROM utenti WHERE email = ? AND id != ?', [$email, $id]);
        if ($existing) Response::error('Email già in uso', 400);
    }

    $newHash = $password ? password_hash($password, PASSWORD_BCRYPT) : $user['password_hash'];

    Database::execute(
        'UPDATE utenti SET nome = COALESCE(?, nome), email = COALESCE(?, email), password_hash = ?, attivo = COALESCE(?, attivo), abilitato_ai = COALESCE(?, abilitato_ai), gestione_avanzata = COALESCE(?, gestione_avanzata) WHERE id = ?',
        [$nome, $email, $newHash, $attivo, $abilitatoAi, $gestioneAvanzata, $id]
    );

    $updated = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo, cambio_password, abilitato_ai, gestione_avanzata, created_at FROM utenti WHERE id = ?',
        [$id]
    );
    Response::json($updated);
});

// DELETE /api/users/:id
$router->delete('/users/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $user = Database::fetchOne('SELECT * FROM utenti WHERE id = ?', [$id]);
    if (!$user) Response::error('Utente non trovato', 404);
    if ($user['ruolo'] === 'admin') Response::error('Non puoi eliminare un admin', 403);

    // Unassign all references before deleting
    Database::execute('UPDATE ticket SET assegnato_a = NULL WHERE assegnato_a = ?', [$id]);
    Database::execute('UPDATE attivita SET assegnato_a = NULL WHERE assegnato_a = ?', [$id]);
    Database::execute('DELETE FROM progetto_tecnici WHERE utente_id = ?', [$id]);
    Database::execute('UPDATE note_interne SET utente_id = NULL WHERE utente_id = ?', [$id]);
    Database::execute('UPDATE note_attivita SET utente_id = NULL WHERE utente_id = ?', [$id]);
    Database::execute('UPDATE allegati_progetto SET caricato_da = NULL WHERE caricato_da = ?', [$id]);
    Database::execute('UPDATE allegati_attivita SET caricato_da = NULL WHERE caricato_da = ?', [$id]);
    Database::execute('DELETE FROM notifiche WHERE utente_id = ?', [$id]);
    Database::execute('UPDATE email SET inviata_da = NULL WHERE inviata_da = ?', [$id]);
    try { Database::execute('DELETE FROM chat_lettura WHERE utente_id = ?', [$id]); } catch (\Exception $e) {}
    try { Database::execute('UPDATE messaggi_progetto SET utente_id = NULL WHERE utente_id = ?', [$id]); } catch (\Exception $e) {}
    try { Database::execute('UPDATE attivita_programmate SET creato_da = NULL WHERE creato_da = ?', [$id]); } catch (\Exception $e) {}

    Database::execute('DELETE FROM utenti WHERE id = ?', [$id]);
    Response::success();
});

// GET /api/users/audit-log — view audit log (admin-only)
$router->get('/users/audit-log', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $limit = min((int)($req->query['limit'] ?? 50), 200);
    $logs = Database::fetchAll(
        'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?',
        [$limit]
    );
    Response::json($logs);
});
