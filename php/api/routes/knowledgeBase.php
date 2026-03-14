<?php
/**
 * Knowledge Base routes — KB cards per client
 */

// GET /api/clients/:clienteId/schede (admin only)
$router->get('/clients/:clienteId/schede', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    Response::json(Database::fetchAll(
        'SELECT * FROM schede_cliente WHERE cliente_id = ? ORDER BY updated_at DESC',
        [$req->params['clienteId']]
    ));
});

// POST /api/clients/:clienteId/schede
$router->post('/clients/:clienteId/schede', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $titolo = $req->body['titolo'] ?? '';
    $contenuto = $req->body['contenuto'] ?? '';
    if (!$titolo || !$contenuto) Response::error('Titolo e contenuto sono obbligatori', 400);

    Database::execute(
        'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)',
        [$req->params['clienteId'], $titolo, $contenuto]
    );
    Response::created(Database::fetchOne('SELECT * FROM schede_cliente WHERE id = ?', [Database::lastInsertId()]));
});

// PUT /api/clients/:clienteId/schede/:id
$router->put('/clients/:clienteId/schede/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $scheda = Database::fetchOne(
        'SELECT * FROM schede_cliente WHERE id = ? AND cliente_id = ?',
        [$req->params['id'], $req->params['clienteId']]
    );
    if (!$scheda) Response::error('Scheda non trovata', 404);

    Database::execute(
        'UPDATE schede_cliente SET titolo = COALESCE(?, titolo), contenuto = COALESCE(?, contenuto), updated_at = NOW() WHERE id = ?',
        [$req->body['titolo'] ?? null, $req->body['contenuto'] ?? null, $req->params['id']]
    );
    Response::json(Database::fetchOne('SELECT * FROM schede_cliente WHERE id = ?', [$req->params['id']]));
});

// DELETE /api/clients/:clienteId/schede/:id
$router->delete('/clients/:clienteId/schede/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $scheda = Database::fetchOne(
        'SELECT * FROM schede_cliente WHERE id = ? AND cliente_id = ?',
        [$req->params['id'], $req->params['clienteId']]
    );
    if (!$scheda) Response::error('Scheda non trovata', 404);

    Database::execute('DELETE FROM schede_cliente WHERE id = ?', [$req->params['id']]);
    Response::success();
});
