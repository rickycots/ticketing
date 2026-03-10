<?php
/**
 * Comunicazioni routes — admin CRUD for client communications
 */

// GET /api/comunicazioni — list all communications (admin only)
$router->get('/comunicazioni',
    [Auth::class, 'authenticateToken'],
    [Auth::class, 'requireAdmin'],
    function($req) {
        $comunicazioni = Database::fetchAll(
            "SELECT c.*, cl.nome_azienda,
                (SELECT COUNT(*) FROM comunicazioni_lette cl2 WHERE cl2.comunicazione_id = c.id) as letti,
                (SELECT COUNT(*) FROM utenti_cliente uc WHERE uc.cliente_id = c.cliente_id AND uc.attivo = 1) as totale_utenti
             FROM comunicazioni_cliente c
             JOIN clienti cl ON cl.id = c.cliente_id
             ORDER BY c.data_ricezione DESC
             LIMIT 100"
        );
        Response::json($comunicazioni);
    }
);

// POST /api/comunicazioni — create a new communication (admin only)
$router->post('/comunicazioni',
    [Auth::class, 'authenticateToken'],
    [Auth::class, 'requireAdmin'],
    function($req) {
        $clienteId = $req->body['cliente_id'] ?? null;
        $oggetto = trim($req->body['oggetto'] ?? '');
        $corpo = trim($req->body['corpo'] ?? '');
        $importante = !empty($req->body['importante']) ? 1 : 0;

        if (!$clienteId || !$oggetto) {
            Response::error('Cliente e titolo sono obbligatori', 400);
        }

        $cliente = Database::fetchOne('SELECT id FROM clienti WHERE id = ?', [$clienteId]);
        if (!$cliente) Response::error('Cliente non trovato', 404);

        Database::execute(
            "INSERT INTO comunicazioni_cliente (cliente_id, oggetto, corpo, mittente, importante, data_ricezione)
             VALUES (?, ?, ?, ?, ?, NOW())",
            [(int)$clienteId, $oggetto, $corpo ?: null, $req->user['nome'] ?? 'Admin', $importante]
        );

        $id = Database::lastInsertId();
        $comm = Database::fetchOne(
            "SELECT c.*, cl.nome_azienda
             FROM comunicazioni_cliente c
             JOIN clienti cl ON cl.id = c.cliente_id
             WHERE c.id = ?",
            [$id]
        );
        Response::created($comm);
    }
);

// DELETE /api/comunicazioni/:id — delete a communication (admin only)
$router->delete('/comunicazioni/:id',
    [Auth::class, 'authenticateToken'],
    [Auth::class, 'requireAdmin'],
    function($req) {
        $id = $req->params['id'];
        $comm = Database::fetchOne('SELECT id FROM comunicazioni_cliente WHERE id = ?', [$id]);
        if (!$comm) Response::error('Comunicazione non trovata', 404);

        Database::execute('DELETE FROM comunicazioni_lette WHERE comunicazione_id = ?', [$id]);
        Database::execute('DELETE FROM comunicazioni_cliente WHERE id = ?', [$id]);
        Response::success();
    }
);
