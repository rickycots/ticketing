<?php
/**
 * Users routes — CRUD admin/tecnico users
 */

// GET /api/users
$router->get('/users', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $users = Database::fetchAll(
        'SELECT id, nome, email, ruolo, attivo, created_at FROM utenti ORDER BY ruolo, nome'
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
    Database::execute(
        'INSERT INTO utenti (nome, email, password_hash, ruolo, attivo) VALUES (?, ?, ?, ?, 1)',
        [$nome, $email, $passwordHash, 'tecnico']
    );

    $user = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo, created_at FROM utenti WHERE id = ?',
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
    $attivo = $req->body['attivo'] ?? null;

    if ($email && $email !== $user['email']) {
        $existing = Database::fetchOne('SELECT id FROM utenti WHERE email = ? AND id != ?', [$email, $id]);
        if ($existing) Response::error('Email già in uso', 400);
    }

    Database::execute(
        'UPDATE utenti SET nome = COALESCE(?, nome), email = COALESCE(?, email), attivo = COALESCE(?, attivo) WHERE id = ?',
        [$nome, $email, $attivo, $id]
    );

    $updated = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo, created_at FROM utenti WHERE id = ?',
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
