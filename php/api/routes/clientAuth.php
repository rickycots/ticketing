<?php
/**
 * Client Auth routes — login, me, impersonate, comunicazioni, portal-users CRUD
 */

// Helper middleware: require client admin role
function requireClientAdmin($req) {
    if (($req->user['ruolo'] ?? '') !== 'admin' && empty($req->user['impersonated'])) {
        Response::error('Accesso riservato agli admin', 403);
        return false;
    }
    return true;
}

// POST /api/client-auth/login
$router->post('/client-auth/login', function($req) {
    $email = $req->body['email'] ?? '';
    $password = $req->body['password'] ?? '';

    if (!$email || !$password) {
        Response::error('Email e password sono obbligatori', 400);
    }

    $user = Database::fetchOne(
        'SELECT uc.*, c.nome_azienda, c.logo
         FROM utenti_cliente uc
         JOIN clienti c ON uc.cliente_id = c.id
         WHERE uc.email = ?',
        [$email]
    );

    if (!$user || !password_verify($password, $user['password_hash'])) {
        Response::error("Utente non abilitato o dati errati.\nVerifica le credenziali e riprova.", 401);
    }

    if (!$user['attivo']) {
        Response::error('Account disabilitato', 403);
    }

    $userRuolo = $user['ruolo'] ?: 'user';
    $visibili = $userRuolo === 'admin' ? 'ticket,progetti,ai' : $user['schede_visibili'];

    $token = Auth::generateToken([
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'cliente_id' => $user['cliente_id'],
        'ruolo' => $userRuolo,
        'schede_visibili' => $visibili,
        'tipo' => 'cliente',
    ]);

    $userData = [
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'cliente_id' => $user['cliente_id'],
        'nome_azienda' => $user['nome_azienda'],
        'logo' => $user['logo'],
        'ruolo' => $userRuolo,
        'schede_visibili' => $visibili,
        'lingua' => $user['lingua'] ?? 'it',
        'cambio_password' => (int)($user['cambio_password'] ?? 0),
    ];

    // 2FA: generate code, send email, return pending
    if (!empty($user['two_factor'])) {
        $code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $expires = date('Y-m-d H:i:s', time() + 600); // 10 min

        Database::execute(
            'UPDATE utenti_cliente SET two_factor_code = ?, two_factor_expires = ?, two_factor_attempts = 0 WHERE id = ?',
            [$code, $expires, $user['id']]
        );

        // Send email
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
            error_log('2FA email error: ' . $e->getMessage());
        }

        $tempToken = Auth::generateToken(['id' => $user['id'], 'tipo' => '2fa_pending'], 600);

        Response::json([
            'require_2fa' => true,
            'temp_token' => $tempToken,
            'user' => $userData,
        ]);
        return;
    }

    Response::json([
        'token' => $token,
        'user' => $userData,
    ]);
});

// POST /api/client-auth/verify-2fa — verify 2FA code
$router->post('/client-auth/verify-2fa', function($req) {
    $tempToken = $req->body['temp_token'] ?? '';
    $code = trim($req->body['code'] ?? '');

    if (!$tempToken || !$code) {
        Response::error('Token e codice sono obbligatori', 400);
    }

    $decoded = Auth::verifyToken($tempToken);
    if (!$decoded || ($decoded['tipo'] ?? '') !== '2fa_pending') {
        Response::error('Sessione scaduta. Effettua nuovamente il login.', 401);
    }

    $user = Database::fetchOne(
        'SELECT uc.*, c.nome_azienda, c.logo FROM utenti_cliente uc JOIN clienti c ON uc.cliente_id = c.id WHERE uc.id = ?',
        [$decoded['id']]
    );
    if (!$user) Response::error('Utente non trovato', 401);

    // Check attempts
    if ((int)$user['two_factor_attempts'] >= 3) {
        Database::execute(
            'UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?',
            [$user['id']]
        );
        Response::json(['error' => 'Troppi tentativi errati. Effettua nuovamente il login.', 'locked' => true], 401);
    }

    // Check expiry
    if (empty($user['two_factor_code']) || empty($user['two_factor_expires']) || strtotime($user['two_factor_expires']) < time()) {
        Response::json(['error' => 'Codice scaduto. Effettua nuovamente il login.', 'locked' => true], 401);
    }

    // Check code
    if ($user['two_factor_code'] !== $code) {
        $attempts = (int)$user['two_factor_attempts'] + 1;
        Database::execute('UPDATE utenti_cliente SET two_factor_attempts = ? WHERE id = ?', [$attempts, $user['id']]);

        if ($attempts >= 3) {
            Database::execute(
                'UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?',
                [$user['id']]
            );
            Response::json(['error' => 'Troppi tentativi errati. Effettua nuovamente il login.', 'locked' => true], 401);
        }

        Response::json(['error' => 'Codice errato', 'remaining' => 3 - $attempts], 400);
    }

    // Code correct — clear 2FA, issue real token
    Database::execute(
        'UPDATE utenti_cliente SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0 WHERE id = ?',
        [$user['id']]
    );

    $userRuolo = $user['ruolo'] ?: 'user';
    $visibili = $userRuolo === 'admin' ? 'ticket,progetti,ai' : $user['schede_visibili'];

    $token = Auth::generateToken([
        'id' => $user['id'],
        'nome' => $user['nome'],
        'email' => $user['email'],
        'cliente_id' => $user['cliente_id'],
        'ruolo' => $userRuolo,
        'schede_visibili' => $visibili,
        'tipo' => 'cliente',
    ]);

    Response::json(['token' => $token]);
});

// POST /api/client-auth/change-password — first login password change
$router->post('/client-auth/change-password', [Auth::class, 'authenticateClientToken'], function($req) {
    $newPassword = $req->body['newPassword'] ?? '';
    if (!$newPassword || strlen($newPassword) < 6) {
        Response::error('La password deve avere almeno 6 caratteri', 400);
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    Database::execute(
        'UPDATE utenti_cliente SET password_hash = ?, cambio_password = 0 WHERE id = ?',
        [$hash, $req->user['id']]
    );

    Response::json(['success' => true, 'cambio_password' => 0]);
});

// GET /api/client-auth/me
$router->get('/client-auth/me', [Auth::class, 'authenticateClientToken'], function($req) {
    // Handle impersonated admin
    if (!empty($req->user['impersonated'])) {
        $cliente = Database::fetchOne(
            'SELECT id, nome_azienda, logo FROM clienti WHERE id = ?',
            [$req->user['cliente_id']]
        );
        if (!$cliente) Response::error('Cliente non trovato', 401);

        Response::json([
            'id' => 0,
            'nome' => $req->user['nome'],
            'email' => $req->user['email'],
            'cliente_id' => $req->user['cliente_id'],
            'ruolo' => 'admin',
            'schede_visibili' => $req->user['schede_visibili'],
            'attivo' => 1,
            'nome_azienda' => $cliente['nome_azienda'],
            'logo' => $cliente['logo'],
        ]);
    }

    $user = Database::fetchOne(
        'SELECT uc.id, uc.nome, uc.email, uc.cliente_id, uc.ruolo, uc.schede_visibili, uc.lingua, uc.attivo,
                c.nome_azienda, c.logo
         FROM utenti_cliente uc
         JOIN clienti c ON uc.cliente_id = c.id
         WHERE uc.id = ?',
        [$req->user['id']]
    );

    if (!$user || !$user['attivo']) {
        Response::error('Account non valido', 401);
    }

    Response::json($user);
});

// POST /api/client-auth/impersonate/:clienteId
$router->post('/client-auth/impersonate/:clienteId',
    [Auth::class, 'authenticateToken'],
    [Auth::class, 'requireAdmin'],
    function($req) {
        $cliente = Database::fetchOne(
            'SELECT * FROM clienti WHERE id = ?',
            [$req->params['clienteId']]
        );
        if (!$cliente) Response::error('Cliente non trovato', 404);

        $token = Auth::generateToken([
            'id' => 0,
            'nome' => "Admin ({$req->user['nome']})",
            'email' => $req->user['email'],
            'cliente_id' => $cliente['id'],
            'schede_visibili' => 'ticket,progetti,ai',
            'tipo' => 'cliente',
            'impersonated' => true,
        ], 14400); // 4h

        Response::json([
            'token' => $token,
            'user' => [
                'id' => 0,
                'nome' => "Admin ({$req->user['nome']})",
                'email' => $req->user['email'],
                'cliente_id' => $cliente['id'],
                'nome_azienda' => $cliente['nome_azienda'],
                'logo' => $cliente['logo'],
                'schede_visibili' => 'ticket,progetti,ai',
            ],
        ]);
    }
);

// GET /api/client-auth/comunicazioni — returns unread comms + important (even if read), filtered by 15-day expiry
$router->get('/client-auth/comunicazioni', [Auth::class, 'authenticateClientToken'], function($req) {
    $userId = $req->user['id'];
    $clienteId = $req->user['cliente_id'];

    $comunicazioni = Database::fetchAll(
        "SELECT c.*,
            CASE WHEN cl.comunicazione_id IS NOT NULL THEN 1 ELSE 0 END as letta
         FROM comunicazioni_cliente c
         LEFT JOIN comunicazioni_lette cl ON cl.comunicazione_id = c.id AND cl.utente_cliente_id = ?
         WHERE c.cliente_id = ? AND c.data_ricezione >= DATE_SUB(NOW(), INTERVAL 15 DAY)
           AND (cl.comunicazione_id IS NULL OR c.importante = 1)
         ORDER BY c.data_ricezione DESC LIMIT 20",
        [$userId, $clienteId]
    );
    Response::json($comunicazioni);
});

// PUT /api/client-auth/comunicazioni/:id/read — mark single comm as read
$router->put('/client-auth/comunicazioni/:id/read', [Auth::class, 'authenticateClientToken'], function($req) {
    $userId = $req->user['id'];
    $commId = $req->params['id'];
    Database::execute(
        'INSERT IGNORE INTO comunicazioni_lette (utente_cliente_id, comunicazione_id) VALUES (?, ?)',
        [$userId, (int)$commId]
    );
    Response::success();
});

// PUT /api/client-auth/comunicazioni/read-all — mark all as read for current user
$router->put('/client-auth/comunicazioni/read-all', [Auth::class, 'authenticateClientToken'], function($req) {
    $userId = $req->user['id'];
    $clienteId = $req->user['cliente_id'];

    $unread = Database::fetchAll(
        "SELECT c.id FROM comunicazioni_cliente c
         LEFT JOIN comunicazioni_lette cl ON cl.comunicazione_id = c.id AND cl.utente_cliente_id = ?
         WHERE c.cliente_id = ? AND cl.comunicazione_id IS NULL
           AND c.data_ricezione >= DATE_SUB(NOW(), INTERVAL 15 DAY)",
        [$userId, $clienteId]
    );

    foreach ($unread as $c) {
        Database::execute(
            'INSERT IGNORE INTO comunicazioni_lette (utente_cliente_id, comunicazione_id) VALUES (?, ?)',
            [$userId, $c['id']]
        );
    }

    Response::success();
});

// GET /api/client-auth/portal-users
$router->get('/client-auth/portal-users',
    [Auth::class, 'authenticateClientToken'],
    'requireClientAdmin',
    function($req) {
        $users = Database::fetchAll(
            'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at
             FROM utenti_cliente WHERE cliente_id = ? ORDER BY nome',
            [$req->user['cliente_id']]
        );
        Response::json($users);
    }
);

// POST /api/client-auth/portal-users
$router->post('/client-auth/portal-users',
    [Auth::class, 'authenticateClientToken'],
    'requireClientAdmin',
    function($req) {
        $nome = $req->body['nome'] ?? '';
        $email = $req->body['email'] ?? '';
        $password = $req->body['password'] ?? '';
        $schede_visibili = $req->body['schede_visibili'] ?? 'ticket,progetti,ai';
        $lingua = $req->body['lingua'] ?? 'it';

        if (!$nome || !$email || !$password) {
            Response::error('Campi obbligatori: nome, email, password', 400);
        }

        $existing = Database::fetchOne('SELECT id FROM utenti_cliente WHERE email = ?', [$email]);
        if ($existing) Response::error('Email già in uso', 400);

        $userLingua = in_array($lingua, ['it', 'en', 'fr']) ? $lingua : 'it';
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $cambio_password = isset($req->body['cambio_password']) ? (int)$req->body['cambio_password'] : 1;
        $two_factor = isset($req->body['two_factor']) ? (int)$req->body['two_factor'] : 0;

        Database::execute(
            'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili, lingua, cambio_password, two_factor)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$req->user['cliente_id'], $nome, $email, $passwordHash, 'user', $schede_visibili, $userLingua, $cambio_password, $two_factor]
        );

        $user = Database::fetchOne(
            'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at
             FROM utenti_cliente WHERE id = ?',
            [Database::lastInsertId()]
        );
        Response::created($user);
    }
);

// PUT /api/client-auth/portal-users/:userId
$router->put('/client-auth/portal-users/:userId',
    [Auth::class, 'authenticateClientToken'],
    'requireClientAdmin',
    function($req) {
        $userId = $req->params['userId'];
        $user = Database::fetchOne(
            'SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?',
            [$userId, $req->user['cliente_id']]
        );
        if (!$user) Response::error('Utente non trovato', 404);
        if ($user['ruolo'] === 'admin') Response::error('Non puoi modificare un altro admin', 403);

        $nome = $req->body['nome'] ?? null;
        $email = $req->body['email'] ?? null;
        $password = $req->body['password'] ?? null;
        $schede_visibili = $req->body['schede_visibili'] ?? null;
        $lingua = $req->body['lingua'] ?? null;
        $attivo = $req->body['attivo'] ?? null;

        if ($email && $email !== $user['email']) {
            $existing = Database::fetchOne(
                'SELECT id FROM utenti_cliente WHERE email = ? AND id != ?',
                [$email, $userId]
            );
            if ($existing) Response::error('Email già in uso', 400);
        }

        $newHash = $password ? password_hash($password, PASSWORD_BCRYPT) : $user['password_hash'];
        $newLingua = $lingua && in_array($lingua, ['it', 'en', 'fr']) ? $lingua : $user['lingua'];
        $cambio_password = isset($req->body['cambio_password']) ? (int)$req->body['cambio_password'] : null;
        $two_factor = isset($req->body['two_factor']) ? (int)$req->body['two_factor'] : null;

        Database::execute(
            'UPDATE utenti_cliente SET
                nome = COALESCE(?, nome),
                email = COALESCE(?, email),
                password_hash = ?,
                schede_visibili = COALESCE(?, schede_visibili),
                lingua = ?,
                attivo = COALESCE(?, attivo),
                cambio_password = COALESCE(?, cambio_password),
                two_factor = COALESCE(?, two_factor)
             WHERE id = ?',
            [$nome, $email, $newHash, $schede_visibili, $newLingua, $attivo, $cambio_password, $two_factor, $userId]
        );

        $updated = Database::fetchOne(
            'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at
             FROM utenti_cliente WHERE id = ?',
            [$userId]
        );
        Response::json($updated);
    }
);

// DELETE /api/client-auth/portal-users/:userId
$router->delete('/client-auth/portal-users/:userId',
    [Auth::class, 'authenticateClientToken'],
    'requireClientAdmin',
    function($req) {
        $userId = $req->params['userId'];
        $user = Database::fetchOne(
            'SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?',
            [$userId, $req->user['cliente_id']]
        );
        if (!$user) Response::error('Utente non trovato', 404);
        if ($user['ruolo'] === 'admin') Response::error('Non puoi eliminare un admin', 403);

        Database::execute('DELETE FROM utenti_cliente WHERE id = ?', [$userId]);
        Response::success();
    }
);
