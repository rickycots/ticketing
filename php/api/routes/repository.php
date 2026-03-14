<?php
/**
 * Repository routes — documents with upload/download
 */

// GET /api/repository
$router->get('/repository', [Auth::class, 'authenticateToken'], function($req) {
    $sql = 'SELECT id, nome_originale, dimensione, tipo_mime, categoria, descrizione, caricato_da, created_at FROM documenti_repository';
    $params = [];
    if (!empty($req->query['categoria'])) {
        $sql .= ' WHERE categoria = ?';
        $params[] = $req->query['categoria'];
    }
    $sql .= ' ORDER BY created_at DESC';
    Response::json(Database::fetchAll($sql, $params));
});

// GET /api/repository/categorie
$router->get('/repository/categorie', [Auth::class, 'authenticateToken'], function($req) {
    $cats = Database::fetchAll('SELECT DISTINCT categoria FROM documenti_repository ORDER BY categoria');
    Response::json(array_column($cats, 'categoria'));
});

// POST /api/repository/upload
$router->post('/repository/upload', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $files = Upload::handleMultiple('files', UPLOAD_DIR . '/repository', [
        'maxSize' => 20 * 1024 * 1024,
        'allowedExts' => ['txt', 'pdf', 'doc', 'docx', 'md'],
    ]);
    if (empty($files)) Response::error('Nessun file caricato', 400);

    $categoria = $req->body['categoria'] ?? 'generale';
    $descrizione = $req->body['descrizione'] ?? null;
    $results = [];

    foreach ($files as $f) {
        // Extract text from txt/md files
        $contenutoTesto = null;
        $ext = strtolower(pathinfo($f['nome_originale'], PATHINFO_EXTENSION));
        $filePath = UPLOAD_DIR . '/repository/' . $f['nome_file'];
        if (in_array($ext, ['txt', 'md'])) {
            $contenutoTesto = file_get_contents($filePath);
        }

        Database::execute(
            'INSERT INTO documenti_repository (nome_file, nome_originale, dimensione, tipo_mime, contenuto_testo, categoria, descrizione, caricato_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$f['nome_file'], $f['nome_originale'], $f['dimensione'], $f['tipo_mime'], $contenutoTesto, $categoria, $descrizione, $req->user['id']]
        );
        $results[] = Database::fetchOne(
            'SELECT id, nome_originale, dimensione, tipo_mime, categoria, descrizione, caricato_da, created_at FROM documenti_repository WHERE id = ?',
            [Database::lastInsertId()]
        );
    }

    Response::created($results);
});

// PUT /api/repository/:id
$router->put('/repository/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $doc = Database::fetchOne('SELECT * FROM documenti_repository WHERE id = ?', [$req->params['id']]);
    if (!$doc) Response::error('Documento non trovato', 404);

    Database::execute(
        'UPDATE documenti_repository SET categoria = COALESCE(?, categoria), descrizione = COALESCE(?, descrizione) WHERE id = ?',
        [$req->body['categoria'] ?? null, array_key_exists('descrizione', $req->body) ? $req->body['descrizione'] : null, $req->params['id']]
    );

    Response::json(Database::fetchOne(
        'SELECT id, nome_originale, dimensione, tipo_mime, categoria, descrizione, caricato_da, created_at FROM documenti_repository WHERE id = ?',
        [$req->params['id']]
    ));
});

// DELETE /api/repository/:id
$router->delete('/repository/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $doc = Database::fetchOne('SELECT * FROM documenti_repository WHERE id = ?', [$req->params['id']]);
    if (!$doc) Response::error('Documento non trovato', 404);

    Upload::deleteFile(UPLOAD_DIR . '/repository', $doc['nome_file']);
    Database::execute('DELETE FROM documenti_repository WHERE id = ?', [$req->params['id']]);
    Response::success();
});

// GET /api/repository/:id/download (admin + tecnico only)
$router->get('/repository/:id/download', [Auth::class, 'authenticateToken'], function($req) {
    // Repository is accessible to admin and tecnico only — authenticateToken already ensures this
    // No per-document IDOR since repository is a shared knowledge base (not tenant-specific)
    $doc = Database::fetchOne('SELECT * FROM documenti_repository WHERE id = ?', [$req->params['id']]);
    if (!$doc) Response::error('Documento non trovato', 404);

    $filePath = UPLOAD_DIR . '/repository/' . $doc['nome_file'];
    if (!file_exists($filePath)) Response::error('File non trovato su disco', 404);

    header('Content-Type: ' . ($doc['tipo_mime'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . basename(str_replace(["\r", "\n", '"'], '', $doc['nome_originale'])) . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
});
