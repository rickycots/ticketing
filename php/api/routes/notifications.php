<?php
/**
 * Notifications routes
 */

// GET /api/notifications
$router->get('/notifications', [Auth::class, 'authenticateToken'], function($req) {
    $notifiche = Database::fetchAll(
        'SELECT * FROM notifiche WHERE utente_id = ? ORDER BY letta ASC, created_at DESC LIMIT 50',
        [$req->user['id']]
    );
    Response::json($notifiche);
});

// GET /api/notifications/unread-count
$router->get('/notifications/unread-count', [Auth::class, 'authenticateToken'], function($req) {
    $row = Database::fetchOne(
        'SELECT COUNT(*) as count FROM notifiche WHERE utente_id = ? AND letta = 0',
        [$req->user['id']]
    );
    Response::json(['count' => (int)$row['count']]);
});

// PUT /api/notifications/read-all
$router->put('/notifications/read-all', [Auth::class, 'authenticateToken'], function($req) {
    Database::execute(
        'UPDATE notifiche SET letta = 1 WHERE utente_id = ? AND letta = 0',
        [$req->user['id']]
    );
    Response::json(['ok' => true]);
});

// PUT /api/notifications/:id/read
$router->put('/notifications/:id/read', [Auth::class, 'authenticateToken'], function($req) {
    $id = $req->params['id'];
    $notifica = Database::fetchOne(
        'SELECT * FROM notifiche WHERE id = ? AND utente_id = ?',
        [$id, $req->user['id']]
    );
    if (!$notifica) Response::error('Notifica non trovata', 404);

    Database::execute('UPDATE notifiche SET letta = 1 WHERE id = ?', [$id]);
    Response::json(['ok' => true]);
});
