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

    Response::json([
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'nome' => $user['nome'],
            'email' => $user['email'],
            'cliente_id' => $user['cliente_id'],
            'nome_azienda' => $user['nome_azienda'],
            'logo' => $user['logo'],
            'ruolo' => $userRuolo,
            'schede_visibili' => $visibili,
            'lingua' => $user['lingua'] ?? 'it',
        ],
    ]);
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

        Database::execute(
            'INSERT INTO utenti_cliente (cliente_id, nome, email, password_hash, ruolo, schede_visibili, lingua)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$req->user['cliente_id'], $nome, $email, $passwordHash, 'user', $schede_visibili, $userLingua]
        );

        $user = Database::fetchOne(
            'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at
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

        Database::execute(
            'UPDATE utenti_cliente SET
                nome = COALESCE(?, nome),
                email = COALESCE(?, email),
                password_hash = ?,
                schede_visibili = COALESCE(?, schede_visibili),
                lingua = ?,
                attivo = COALESCE(?, attivo)
             WHERE id = ?',
            [$nome, $email, $newHash, $schede_visibili, $newLingua, $attivo, $userId]
        );

        $updated = Database::fetchOne(
            'SELECT id, nome, email, ruolo, schede_visibili, lingua, attivo, created_at
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
