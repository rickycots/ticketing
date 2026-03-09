<?php
/**
 * Auth routes — POST /api/auth/login, GET /api/auth/me
 */

// POST /api/auth/login
$router->post('/auth/login', function($req) {
    $email = $req->body['email'] ?? '';
    $password = $req->body['password'] ?? '';

    if (!$email || !$password) {
        Response::error('Email e password richiesti', 400);
    }

    $user = Database::fetchOne(
        'SELECT * FROM utenti WHERE email = ? AND attivo = 1',
        [$email]
    );

    if (!$user || !password_verify($password, $user['password_hash'])) {
        Response::error('Credenziali non valide', 401);
    }

    $token = Auth::generateToken([
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'ruolo' => $user['ruolo'],
    ]);

    Response::json([
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'nome' => $user['nome'],
            'email' => $user['email'],
            'ruolo' => $user['ruolo'],
        ],
    ]);
});

// GET /api/auth/me
$router->get('/auth/me', [Auth::class, 'authenticateToken'], function($req) {
    $user = Database::fetchOne(
        'SELECT id, nome, email, ruolo, attivo FROM utenti WHERE id = ?',
        [$req->user['id']]
    );

    if (!$user || !$user['attivo']) {
        Response::error('Account disabilitato o non trovato', 401);
    }

    Response::json([
        'user' => [
            'id' => $user['id'],
            'nome' => $user['nome'],
            'email' => $user['email'],
            'ruolo' => $user['ruolo'],
        ],
    ]);
});
