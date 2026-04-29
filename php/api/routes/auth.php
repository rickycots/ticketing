<?php
/**
 * Auth routes — POST /api/auth/login, GET /api/auth/me
 */

// POST /api/auth/login
$router->post('/auth/login', function($req) {
    // Rate limit: 5 attempts per 15 minutes per IP
    RateLimiter::enforce('admin_login', 5, 200, 'Troppi tentativi di login. Riprova tra qualche minuto.');

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

    $userData = [
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'ruolo' => $user['ruolo'],
        'cambio_password' => (int)($user['cambio_password'] ?? 0),
        'abilitato_ai' => (int)($user['abilitato_ai'] ?? 0),
        'gestione_avanzata' => (int)($user['gestione_avanzata'] ?? 0),
    ];

    // 2FA: generate code, send email, return pending
    if (!empty($user['two_factor'])) {
        $code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $expires = date('Y-m-d H:i:s', time() + 600);

        Database::execute(
            'UPDATE utenti SET two_factor_code = ?, two_factor_expires = ?, two_factor_attempts = 0 WHERE id = ?',
            [$code, $expires, $user['id']]
        );

        try {
            Mailer::sendNoreply(
                $user['email'],
                'Codice di verifica — STM Domotica',
                '<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;">
                    <h2 style="color:#333;margin-bottom:10px;">Codice di Verifica</h2>
                    <p style="color:#666;font-size:14px;">Inserisci questo codice per completare l\'accesso:</p>
                    <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
                        <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;">' . $code . '</span>
                    </div>
                    <p style="color:#999;font-size:12px;">Il codice scade tra 10 minuti. Se non hai richiesto l\'accesso, ignora questa email.</p>
                </div>'
            );
        } catch (Exception $e) {
            error_log('2FA admin email error: ' . $e->getMessage());
        }

        $tempToken = Auth::generateToken(['id' => $user['id'], 'tipo' => '2fa_pending_admin'], 600);

        Response::json([
            'require_2fa' => true,
            'temp_token' => $tempToken,
            'user' => $userData,
        ]);
        return;
    }

    $token = Auth::generateToken([
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'ruolo' => $user['ruolo'],
    ]);

    Response::json([
        'token' => $token,
        'user' => $userData,
    ]);
});

// POST /api/auth/verify-2fa
$router->post('/auth/verify-2fa', function($req) {
    $tempToken = $req->body['temp_token'] ?? '';
    $code = trim($req->body['code'] ?? '');

    if (!$tempToken || !$code) {
        Response::error('Token e codice sono obbligatori', 400);
    }

    $decoded = Auth::verifyToken($tempToken);
    if (!$decoded || ($decoded['tipo'] ?? '') !== '2fa_pending_admin') {
        Response::error('Sessione scaduta. Effettua nuovamente il login.', 401);
    }

    $user = Database::fetchOne('SELECT * FROM utenti WHERE id = ?', [$decoded['id']]);
    if (!$user) Response::error('Utente non trovato', 401);

    if ((int)$user['two_factor_attempts'] >= 3) {
        Database::execute(
            'UPDATE utenti SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?',
            [$user['id']]
        );
        Response::json(['error' => 'Troppi tentativi errati. Effettua nuovamente il login.', 'locked' => true], 401);
        return;
    }

    if (empty($user['two_factor_code']) || empty($user['two_factor_expires']) || strtotime($user['two_factor_expires']) < time()) {
        Response::json(['error' => 'Codice scaduto. Effettua nuovamente il login.', 'locked' => true], 401);
        return;
    }

    if ($user['two_factor_code'] !== $code) {
        $attempts = (int)$user['two_factor_attempts'] + 1;
        Database::execute('UPDATE utenti SET two_factor_attempts = ? WHERE id = ?', [$attempts, $user['id']]);

        if ($attempts >= 3) {
            Database::execute(
                'UPDATE utenti SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?',
                [$user['id']]
            );
            Response::json(['error' => 'Troppi tentativi errati. Effettua nuovamente il login.', 'locked' => true], 401);
            return;
        }

        Response::json(['error' => 'Codice errato', 'remaining' => 3 - $attempts], 400);
        return;
    }

    Database::execute(
        'UPDATE utenti SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?',
        [$user['id']]
    );

    $token = Auth::generateToken([
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'ruolo' => $user['ruolo'],
    ]);

    Response::json(['token' => $token]);
});

// PUT /api/auth/change-password
$router->put('/auth/change-password', [Auth::class, 'authenticateToken'], function($req) {
    $password = $req->body['password'] ?? '';
    $oldPassword = $req->body['oldPassword'] ?? null;
    if (!$password || strlen($password) < 6) {
        Response::error('La password deve avere almeno 6 caratteri', 400);
    }

    if ($oldPassword !== null) {
        $user = Database::fetchOne('SELECT password_hash FROM utenti WHERE id = ?', [$req->user['id']]);
        if (!$user || !password_verify($oldPassword, $user['password_hash'])) {
            Response::error('Password attuale errata', 401);
        }
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    Database::execute('UPDATE utenti SET password_hash = ?, cambio_password = 0 WHERE id = ?', [$hash, $req->user['id']]);
    Response::json(['success' => true]);
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
