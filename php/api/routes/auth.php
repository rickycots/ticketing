<?php
/**
 * Auth routes — POST /api/auth/login, GET /api/auth/me
 */

// POST /api/auth/login
$router->post('/auth/login', function($req) {
    // Rate limit: 5 attempts per 15 minutes per IP
    RateLimiter::enforce('admin_login', 5, 900, 'Troppi tentativi di login. Riprova tra 15 minuti.');

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
        RateLimiter::record('admin_login');
        Response::error("Utente non abilitato o dati errati.\nVerifica le credenziali e riprova.", 401);
    }

    // Success — clear lockout
    RateLimiter::clear('admin_login');

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
