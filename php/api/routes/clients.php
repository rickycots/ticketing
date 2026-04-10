<?php
/**
 * Clients routes — CRUD clients + logo + portal users
 */

function generateSlug($nomeAzienda, $excludeId = null) {
    $base = strtolower(preg_replace('/[^a-z0-9]/', '', explode(' ', strtolower($nomeAzienda))[0] ?: 'client'));
    $slug = $base;
    $suffix = 2;
    while (true) {
        $params = $excludeId ? [$slug, $excludeId] : [$slug];
        $query = $excludeId
            ? 'SELECT id FROM clienti WHERE portale_slug = ? AND id != ?'
            : 'SELECT id FROM clienti WHERE portale_slug = ?';
        if (!Database::fetchOne($query, $params)) break;
        $slug = $base . $suffix;
        $suffix++;
    }
    return $slug;
}

// GET /api/clients
$router->get('/clients', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $page = (int)($req->query['page'] ?? 1) ?: 1;
    $limit = (int)($req->query['limit'] ?? 25) ?: 25;
    $offset = ($page - 1) * $limit;

    $total = (int)Database::fetchOne('SELECT COUNT(*) as total FROM clienti')['total'];
    $data = Database::fetchAll(
        "SELECT c.*,
            (SELECT COUNT(*) FROM ticket t WHERE t.cliente_id = c.id) as num_ticket,
            (SELECT COUNT(*) FROM progetti p WHERE p.cliente_id = c.id) as num_progetti
         FROM clienti c ORDER BY c.nome_azienda ASC LIMIT ? OFFSET ?",
        [$limit, $offset]
    );

    Response::json(['data' => $data, 'total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)]);
});

// GET /api/clients/:id
$router->get('/clients/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $client = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$req->params['id']]);
    if (!$client) Response::error('Cliente non trovato', 404);
    Response::json($client);
});

// POST /api/clients
$router->post('/clients', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $nomeAzienda = $req->body['nome_azienda'] ?? '';
    $email = $req->body['email'] ?? '';
    if (!$nomeAzienda || !$email) Response::error('Campi obbligatori: nome_azienda, email', 400);

    $slug = generateSlug($nomeAzienda);
    $sla = in_array($req->body['sla_reazione'] ?? '', ['1g', '3g', 'nb']) ? $req->body['sla_reazione'] : 'nb';

    $srvTicket = !empty($req->body['servizio_ticket']) ? 1 : 0;
    $srvProgetti = !empty($req->body['servizio_progetti']) ? 1 : 0;
    $srvAi = !empty($req->body['servizio_ai']) ? 1 : 0;

    Database::execute(
        'INSERT INTO clienti (nome_azienda, referente, email, telefono, indirizzo, citta, provincia, note, portale_slug, sla_reazione, servizio_ticket, servizio_progetti, servizio_ai) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$nomeAzienda, $req->body['referente'] ?? null, $email, $req->body['telefono'] ?? null, $req->body['indirizzo'] ?? null, $req->body['citta'] ?? null, $req->body['provincia'] ?? null, $req->body['note'] ?? null, $slug, $sla, $srvTicket, $srvProgetti, $srvAi]
    );
    Response::created(Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [Database::lastInsertId()]));
});

// PUT /api/clients/:id
$router->put('/clients/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $client = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]);
    if (!$client) Response::error('Cliente non trovato', 404);

    $newSlug = array_key_exists('portale_slug', $req->body) ? $req->body['portale_slug'] : $client['portale_slug'];
    if ($newSlug && $newSlug !== $client['portale_slug']) {
        $dup = Database::fetchOne('SELECT id FROM clienti WHERE portale_slug = ? AND id != ?', [$newSlug, $id]);
        if ($dup) Response::error('Slug già in uso da un altro cliente', 400);
    }

    $sla = isset($req->body['sla_reazione']) ? (in_array($req->body['sla_reazione'], ['1g', '3g', 'nb']) ? $req->body['sla_reazione'] : $client['sla_reazione']) : $client['sla_reazione'];

    $srvTicket = array_key_exists('servizio_ticket', $req->body) ? ($req->body['servizio_ticket'] ? 1 : 0) : $client['servizio_ticket'];
    $srvProgetti = array_key_exists('servizio_progetti', $req->body) ? ($req->body['servizio_progetti'] ? 1 : 0) : $client['servizio_progetti'];
    $srvAi = array_key_exists('servizio_ai', $req->body) ? ($req->body['servizio_ai'] ? 1 : 0) : $client['servizio_ai'];
    $srvProgettiStm = array_key_exists('servizio_progetti_stm', $req->body) ? ($req->body['servizio_progetti_stm'] ? 1 : 0) : ($client['servizio_progetti_stm'] ?? 0);

    Database::execute(
        'UPDATE clienti SET nome_azienda = COALESCE(?, nome_azienda), referente = ?, email = COALESCE(?, email), telefono = ?, indirizzo = ?, citta = ?, provincia = ?, note = ?, portale_slug = ?, sla_reazione = ?, servizio_ticket = ?, servizio_progetti = ?, servizio_ai = ?, servizio_progetti_stm = ? WHERE id = ?',
        [
            $req->body['nome_azienda'] ?? null,
            array_key_exists('referente', $req->body) ? $req->body['referente'] : $client['referente'],
            $req->body['email'] ?? null,
            array_key_exists('telefono', $req->body) ? $req->body['telefono'] : $client['telefono'],
            array_key_exists('indirizzo', $req->body) ? $req->body['indirizzo'] : $client['indirizzo'],
            array_key_exists('citta', $req->body) ? $req->body['citta'] : $client['citta'],
            array_key_exists('provincia', $req->body) ? $req->body['provincia'] : $client['provincia'],
            array_key_exists('note', $req->body) ? $req->body['note'] : $client['note'],
            $newSlug ?: $client['portale_slug'],
            $sla,
            $srvTicket, $srvProgetti, $srvAi, $srvProgettiStm,
            $id,
        ]
    );
    Response::json(Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]));
});

// DELETE /api/clients/:id — delete client and all related data
$router->delete('/clients/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $client = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]);
    if (!$client) Response::error('Cliente non trovato', 404);

    // 1. Unassign ALL emails first (before deleting projects/activities that emails reference)
    try { Database::execute('UPDATE email SET cliente_id = NULL, progetto_id = NULL, attivita_id = NULL WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}

    // 2. Delete ticket emails and tickets
    $tickets = Database::fetchAll('SELECT id FROM ticket WHERE cliente_id = ?', [$id]);
    foreach ($tickets as $tk) {
        try { Database::execute('DELETE FROM email WHERE ticket_id = ?', [$tk['id']]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM note_interne WHERE ticket_id = ?', [$tk['id']]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM chat_ticket_interna WHERE ticket_id = ?', [$tk['id']]); } catch (\Throwable $e) {}
    }
    try { Database::execute('DELETE FROM ticket WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}

    // 3. Delete projects and all nested data
    $projects = Database::fetchAll('SELECT id FROM progetti WHERE cliente_id = ?', [$id]);
    foreach ($projects as $pr) {
        $pid = $pr['id'];
        // Nullify email references to this project's activities
        try { Database::execute('UPDATE email SET progetto_id = NULL, attivita_id = NULL WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
        // Delete activities and nested
        $activities = Database::fetchAll('SELECT id FROM attivita WHERE progetto_id = ?', [$pid]);
        foreach ($activities as $act) {
            try { Database::execute('DELETE FROM note_attivita WHERE attivita_id = ?', [$act['id']]); } catch (\Throwable $e) {}
            try { Database::execute('DELETE FROM allegati_attivita WHERE attivita_id = ?', [$act['id']]); } catch (\Throwable $e) {}
            try { Database::execute('DELETE FROM attivita_programmate WHERE attivita_id = ?', [$act['id']]); } catch (\Throwable $e) {}
        }
        try { Database::execute('DELETE FROM attivita WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM progetto_tecnici WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM progetto_referenti WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM allegati_progetto WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM messaggi_progetto WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
        try { Database::execute('DELETE FROM chat_lettura WHERE progetto_id = ?', [$pid]); } catch (\Throwable $e) {}
    }
    try { Database::execute('DELETE FROM progetti WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}

    // 4. Delete client users, referenti, comunicazioni, schede
    try { Database::execute('DELETE FROM utenti_cliente WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}
    try { Database::execute('DELETE FROM referenti_progetto WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}
    try { Database::execute('DELETE FROM comunicazioni_cliente WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}
    try { Database::execute('DELETE FROM comunicazioni_lette WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}
    try { Database::execute('DELETE FROM schede_cliente WHERE cliente_id = ?', [$id]); } catch (\Throwable $e) {}

    // 5. Delete client
    try { Database::execute('DELETE FROM clienti WHERE id = ?', [$id]); } catch (\Throwable $e) {
        Response::error('Impossibile eliminare il cliente: ' . $e->getMessage(), 500);
    }

    Response::success();
});

// POST /api/clients/:id/logo
$router->post('/clients/:id/logo', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $client = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]);
    if (!$client) Response::error('Cliente non trovato', 404);

    $file = Upload::handleFile('logo', UPLOAD_DIR . '/logos', [
        'maxSize' => 2 * 1024 * 1024,
        'allowedExts' => ['jpg', 'jpeg', 'png'],
    ]);
    if (!$file) Response::error('Nessun file caricato', 400);

    // Remove old logo
    if ($client['logo']) {
        Upload::deleteFile(UPLOAD_DIR . '/logos', $client['logo']);
    }

    Database::execute('UPDATE clienti SET logo = ? WHERE id = ?', [$file['nome_file'], $id]);
    Response::json(Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]));
});

// DELETE /api/clients/:id/logo
$router->delete('/clients/:id/logo', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $client = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]);
    if (!$client) Response::error('Cliente non trovato', 404);

    if ($client['logo']) {
        Upload::deleteFile(UPLOAD_DIR . '/logos', $client['logo']);
        Database::execute('UPDATE clienti SET logo = NULL WHERE id = ?', [$id]);
    }
    Response::json(Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$id]));
});

// --- Client Portal Users (admin side) ---

// GET /api/clients/:id/users
$router->get('/clients/:id/users', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    Response::json(Database::fetchAll(
        'SELECT id, cliente_id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE cliente_id = ? ORDER BY nome',
        [$req->params['id']]
    ));
});

// POST /api/clients/:id/users
$router->post('/clients/:id/users', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $nome = $req->body['nome'] ?? '';
    $email = $req->body['email'] ?? '';
    $password = $req->body['password'] ?? '';
    if (!$nome || !$email || !$password) Response::error('Campi obbligatori: nome, email, password', 400);

    if (Database::fetchOne('SELECT id FROM utenti_cliente WHERE email = ?', [$email])) {
        Response::error('Email già in uso', 400);
    }

    $ruolo = ($req->body['ruolo'] ?? '') === 'admin' ? 'admin' : 'user';
    $visibili = $ruolo === 'admin' ? 'ticket,progetti,ai' : ($req->body['schede_visibili'] ?? 'ticket,progetti,ai');
    $lingua = in_array($req->body['lingua'] ?? '', ['it', 'en', 'fr']) ? $req->body['lingua'] : 'it';

    $cambio_password = isset($req->body['cambio_password']) ? (int)$req->body['cambio_password'] : 1;
    $two_factor = isset($req->body['two_factor']) ? (int)$req->body['two_factor'] : 0;

    Database::execute(
        'INSERT INTO utenti_cliente (cliente_id, nome, cognome, email, password_hash, ruolo, schede_visibili, lingua, cambio_password, two_factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$req->params['id'], $nome, $req->body['cognome'] ?? '', $email, password_hash($password, PASSWORD_BCRYPT), $ruolo, $visibili, $lingua, $cambio_password, $two_factor]
    );

    // Send welcome email
    $loginUrl = 'https://www.stmdomotica.cloud/ticketing/client/login';
    try {
        Mailer::sendNoreply(
            $email,
            'Benvenuto — STM Domotica Ticketing',
            '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
              <div style="text-align:center;margin-bottom:20px;">
                <h2 style="color:#0d9488;margin:0;">STM Domotica</h2>
                <p style="color:#6b7280;font-size:13px;">Portale Assistenza Tecnica</p>
              </div>
              <p>Gentile <strong>' . htmlspecialchars($nome) . '</strong>,</p>
              <p>BENVENUTO! Ti è stato creato un account per utilizzare il servizio di ticketing di STM Domotica.</p>
              <p>Segui il link per accedere:</p>
              <p style="text-align:center;margin:20px 0;">
                <a href="' . $loginUrl . '" style="background:#0d9488;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Accedi al Portale</a>
              </p>
              <p>Di seguito la tua password provvisoria:</p>
              <p style="text-align:center;margin:20px 0;">
                <span style="background:#f0f4f8;border:1px solid #d0d7de;border-radius:8px;padding:12px 24px;font-size:20px;font-weight:bold;letter-spacing:2px;display:inline-block;">' . htmlspecialchars($password) . '</span>
              </p>
              <p style="color:#6b7280;font-size:12px;">Ti consigliamo di cambiare la password al primo accesso.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
              <p style="color:#9ca3af;font-size:11px;text-align:center;">STM Domotica Corporation S.r.l. — Questo messaggio è stato inviato automaticamente.</p>
            </div>'
        );
    } catch (\Exception $e) {
        error_log('Welcome email error: ' . $e->getMessage());
    }

    Response::created(Database::fetchOne(
        'SELECT id, cliente_id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?',
        [Database::lastInsertId()]
    ));
});

// PUT /api/clients/:id/users/:userId
$router->put('/clients/:id/users/:userId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $userId = $req->params['userId'];
    $user = Database::fetchOne('SELECT * FROM utenti_cliente WHERE id = ? AND cliente_id = ?', [$userId, $req->params['id']]);
    if (!$user) Response::error('Utente non trovato', 404);

    $email = $req->body['email'] ?? null;
    if ($email && $email !== $user['email']) {
        if (Database::fetchOne('SELECT id FROM utenti_cliente WHERE email = ? AND id != ?', [$email, $userId])) {
            Response::error('Email già in uso', 400);
        }
    }

    $newHash = !empty($req->body['password']) ? password_hash($req->body['password'], PASSWORD_BCRYPT) : $user['password_hash'];
    $newRuolo = isset($req->body['ruolo']) ? ($req->body['ruolo'] === 'admin' ? 'admin' : 'user') : $user['ruolo'];
    $newVisibili = $newRuolo === 'admin' ? 'ticket,progetti,ai' : ($req->body['schede_visibili'] ?? $user['schede_visibili']);
    $newLingua = isset($req->body['lingua']) && in_array($req->body['lingua'], ['it', 'en', 'fr']) ? $req->body['lingua'] : $user['lingua'];
    $attivo = $req->body['attivo'] ?? null;
    $cambio_password = isset($req->body['cambio_password']) ? (int)$req->body['cambio_password'] : null;
    $two_factor = isset($req->body['two_factor']) ? (int)$req->body['two_factor'] : null;

    Database::execute(
        'UPDATE utenti_cliente SET nome = COALESCE(?, nome), cognome = COALESCE(?, cognome), email = COALESCE(?, email), password_hash = ?, ruolo = ?, schede_visibili = ?, lingua = ?, attivo = COALESCE(?, attivo), cambio_password = COALESCE(?, cambio_password), two_factor = COALESCE(?, two_factor) WHERE id = ?',
        [$req->body['nome'] ?? null, $req->body['cognome'] ?? null, $email, $newHash, $newRuolo, $newVisibili, $newLingua, $attivo, $cambio_password, $two_factor, $userId]
    );

    Response::json(Database::fetchOne(
        'SELECT id, cliente_id, nome, email, ruolo, schede_visibili, lingua, attivo, cambio_password, two_factor, created_at FROM utenti_cliente WHERE id = ?',
        [$userId]
    ));
});

// DELETE /api/clients/:id/users/:userId
$router->delete('/clients/:id/users/:userId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $user = Database::fetchOne('SELECT id FROM utenti_cliente WHERE id = ? AND cliente_id = ?', [$req->params['userId'], $req->params['id']]);
    if (!$user) Response::error('Utente non trovato', 404);
    Database::execute('DELETE FROM utenti_cliente WHERE id = ?', [$req->params['userId']]);
    Response::success();
});

// --- Referenti Progetto (anagrafica referenti del cliente) ---

// GET /api/clients/:id/referenti (admin + tecnico assegnato a progetto del cliente)
$router->get('/clients/:id/referenti', [Auth::class, 'authenticateToken'], function($req) {
    if (($req->user['ruolo'] ?? '') === 'tecnico') {
        $assigned = Database::fetchOne('SELECT 1 FROM progetto_tecnici pt JOIN progetti p ON pt.progetto_id = p.id WHERE p.cliente_id = ? AND pt.utente_id = ?', [$req->params['id'], $req->user['id']]);
        if (!$assigned) Response::error('Accesso non consentito', 403);
    }
    $referenti = Database::fetchAll(
        'SELECT * FROM referenti_progetto WHERE cliente_id = ? ORDER BY cognome, nome',
        [$req->params['id']]
    );
    Response::json($referenti);
});

// POST /api/clients/:id/referenti
$router->post('/clients/:id/referenti', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $nome = trim($req->body['nome'] ?? '');
    $cognome = trim($req->body['cognome'] ?? '');
    $email = trim($req->body['email'] ?? '');
    if (!$nome || !$email) Response::error('Campi obbligatori: nome, email', 400);

    Database::execute(
        'INSERT INTO referenti_progetto (cliente_id, nome, cognome, email, telefono, ruolo) VALUES (?, ?, ?, ?, ?, ?)',
        [$req->params['id'], $nome, $cognome, $email, $req->body['telefono'] ?? null, $req->body['ruolo'] ?? null]
    );
    Response::created(Database::fetchOne('SELECT * FROM referenti_progetto WHERE id = ?', [Database::lastInsertId()]));
});

// PUT /api/clients/:id/referenti/:refId
$router->put('/clients/:id/referenti/:refId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $ref = Database::fetchOne('SELECT * FROM referenti_progetto WHERE id = ? AND cliente_id = ?', [$req->params['refId'], $req->params['id']]);
    if (!$ref) Response::error('Referente non trovato', 404);

    Database::execute(
        'UPDATE referenti_progetto SET nome = COALESCE(?, nome), cognome = COALESCE(?, cognome), email = COALESCE(?, email), telefono = ?, ruolo = ? WHERE id = ?',
        [
            $req->body['nome'] ?? null, $req->body['cognome'] ?? null, $req->body['email'] ?? null,
            array_key_exists('telefono', $req->body) ? $req->body['telefono'] : $ref['telefono'],
            array_key_exists('ruolo', $req->body) ? $req->body['ruolo'] : $ref['ruolo'],
            $req->params['refId']
        ]
    );
    Response::json(Database::fetchOne('SELECT * FROM referenti_progetto WHERE id = ?', [$req->params['refId']]));
});

// DELETE /api/clients/:id/referenti/:refId
$router->delete('/clients/:id/referenti/:refId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $ref = Database::fetchOne('SELECT id FROM referenti_progetto WHERE id = ? AND cliente_id = ?', [$req->params['refId'], $req->params['id']]);
    if (!$ref) Response::error('Referente non trovato', 404);
    // Remove from project associations
    Database::execute('DELETE FROM progetto_referenti WHERE referente_id = ?', [$req->params['refId']]);
    Database::execute('DELETE FROM referenti_progetto WHERE id = ?', [$req->params['refId']]);
    Response::success();
});
