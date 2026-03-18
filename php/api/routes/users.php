<?php
/**
 * Users routes — CRUD admin/tecnico users
 */

// GET /api/users
$router->get('/users', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $users = Database::fetchAll(
        'SELECT id, nome, email, ruolo, attivo, abilitato_ai, created_at FROM utenti ORDER BY ruolo, nome'
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
    Database::execute(
        'INSERT INTO utenti (nome, email, password_hash, ruolo, attivo, cambio_password, abilitato_ai) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [$nome, $email, $passwordHash, 'tecnico', $cambioPwd, $abilitatoAi]
    );

    $user = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo, cambio_password, abilitato_ai, created_at FROM utenti WHERE id = ?',
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

    if ($email && $email !== $user['email']) {
        $existing = Database::fetchOne('SELECT id FROM utenti WHERE email = ? AND id != ?', [$email, $id]);
        if ($existing) Response::error('Email già in uso', 400);
    }

    $newHash = $password ? password_hash($password, PASSWORD_BCRYPT) : $user['password_hash'];

    Database::execute(
        'UPDATE utenti SET nome = COALESCE(?, nome), email = COALESCE(?, email), password_hash = ?, attivo = COALESCE(?, attivo), abilitato_ai = COALESCE(?, abilitato_ai) WHERE id = ?',
        [$nome, $email, $newHash, $attivo, $abilitatoAi, $id]
    );

    $updated = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo, cambio_password, abilitato_ai, created_at FROM utenti WHERE id = ?',
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
