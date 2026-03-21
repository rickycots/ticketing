<?php
/**
 * Projects routes — CRUD + attachments + chat + client endpoints
 */

// Helper: get tecnici IDs for a project
function getProjectTecnici($progettoId) {
    $rows = Database::fetchAll(
        'SELECT utente_id FROM progetto_tecnici WHERE progetto_id = ?',
        [$progettoId]
    );
    return array_map(function($r) { return $r['utente_id']; }, $rows);
}

// Helper: set tecnici for a project (replace all)
function setProjectTecnici($progettoId, $tecnicoIds) {
    Database::execute('DELETE FROM progetto_tecnici WHERE progetto_id = ?', [$progettoId]);
    foreach ($tecnicoIds as $uid) {
        Database::execute(
            'INSERT INTO progetto_tecnici (progetto_id, utente_id) VALUES (?, ?)',
            [$progettoId, $uid]
        );
    }
}

// Helper: get referenti IDs for a project
function getProjectReferenti($progettoId) {
    return Database::fetchAll(
        'SELECT r.* FROM referenti_progetto r INNER JOIN progetto_referenti pr ON pr.referente_id = r.id WHERE pr.progetto_id = ? ORDER BY r.cognome, r.nome',
        [$progettoId]
    );
}

// Helper: set referenti for a project (replace all)
function setProjectReferenti($progettoId, $referenteIds) {
    Database::execute('DELETE FROM progetto_referenti WHERE progetto_id = ?', [$progettoId]);
    foreach ($referenteIds as $rid) {
        Database::execute(
            'INSERT INTO progetto_referenti (progetto_id, referente_id) VALUES (?, ?)',
            [$progettoId, (int)$rid]
        );
    }
}

// Helper: count unread chat messages for a user in a project
function chatNonLette($progettoId, $utenteId) {
    $row = Database::fetchOne(
        "SELECT COUNT(*) as cnt FROM messaggi_progetto
         WHERE progetto_id = ?
           AND utente_id != ?
           AND created_at > COALESCE(
             (SELECT ultimo_letto_at FROM chat_lettura WHERE utente_id = ? AND progetto_id = ?),
             '1970-01-01'
           )",
        [$progettoId, $utenteId, $utenteId, $progettoId]
    );
    return $row ? (int)$row['cnt'] : 0;
}

// --- Client routes (must be before /:id) ---

// GET /api/projects/client/:clienteId — projects for client portal
$router->get('/projects/client/:clienteId', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }

    $projects = Database::fetchAll(
        "SELECT p.id, p.nome, p.descrizione, p.stato, p.blocco, p.data_scadenza, p.updated_at, p.email_bloccante_id, p.manutenzione_ordinaria
         FROM progetti p
         WHERE p.cliente_id = ? AND p.stato != 'annullato'
         ORDER BY p.updated_at DESC",
        [$req->params['clienteId']]
    );

    $result = [];
    foreach ($projects as $p) {
        $activities = Database::fetchAll(
            'SELECT avanzamento, stato FROM attivita WHERE progetto_id = ?',
            [$p['id']]
        );

        $avanzamento = 0;
        if (count($activities) > 0) {
            $sum = array_reduce($activities, function($carry, $a) {
                return $carry + $a['avanzamento'];
            }, 0);
            $avanzamento = round($sum / count($activities));
        }

        // Computed project status based on activities
        $stato_calcolato = 'senza_attivita';
        if (count($activities) > 0) {
            $allCompleted = true;
            $anyBlocked = false;
            foreach ($activities as $a) {
                if ($a['stato'] !== 'completata') $allCompleted = false;
                if ($a['stato'] === 'bloccata') $anyBlocked = true;
            }
            if ($allCompleted) $stato_calcolato = 'chiuso';
            elseif ($anyBlocked) $stato_calcolato = 'bloccato';
            else $stato_calcolato = 'attivo';
        }

        $emailBloccante = null;
        if ($p['blocco'] === 'lato_cliente' && $p['email_bloccante_id']) {
            $emailBloccante = Database::fetchOne(
                'SELECT oggetto, corpo, data_ricezione FROM email WHERE id = ?',
                [$p['email_bloccante_id']]
            );
        }

        $p['avanzamento'] = $avanzamento;
        $p['stato_calcolato'] = $stato_calcolato;
        $p['email_bloccante_oggetto'] = $emailBloccante ? $emailBloccante['oggetto'] : null;
        $p['email_bloccante_corpo'] = $emailBloccante ? $emailBloccante['corpo'] : null;
        $p['email_bloccante_data'] = $emailBloccante ? $emailBloccante['data_ricezione'] : null;
        $p['referenti'] = getProjectReferenti($p['id']);
        $result[] = $p;
    }

    Response::json($result);
});

// GET /api/projects/client/:clienteId/:projectId — project detail for client portal
$router->get('/projects/client/:clienteId/:projectId', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }

    $project = Database::fetchOne(
        "SELECT p.id, p.nome, p.descrizione, p.stato, p.blocco, p.data_inizio, p.data_scadenza, p.updated_at, p.email_bloccante_id, p.manutenzione_ordinaria
         FROM progetti p
         WHERE p.id = ? AND p.cliente_id = ? AND p.stato != 'annullato'",
        [$req->params['projectId'], $req->params['clienteId']]
    );

    if (!$project) {
        Response::error('Progetto non trovato', 404);
    }

    $attivita = Database::fetchAll(
        "SELECT a.id, a.nome, a.stato, a.avanzamento, a.priorita, a.data_inizio, a.data_scadenza,
                a.ordine, a.dipende_da, a.data_completamento
         FROM attivita a
         WHERE a.progetto_id = ?
         ORDER BY a.ordine ASC,
           FIELD(a.priorita, 'alta', 'media', 'bassa'),
           a.created_at ASC",
        [$project['id']]
    );

    $avanzamento = 0;
    if (count($attivita) > 0) {
        $sum = array_reduce($attivita, function($carry, $a) {
            return $carry + $a['avanzamento'];
        }, 0);
        $avanzamento = round($sum / count($attivita));
    }

    $emailBloccante = null;
    if ($project['blocco'] === 'lato_cliente' && $project['email_bloccante_id']) {
        $emailBloccante = Database::fetchOne(
            'SELECT oggetto, corpo, data_ricezione FROM email WHERE id = ?',
            [$project['email_bloccante_id']]
        );
    }

    $project['avanzamento'] = $avanzamento;
    $project['attivita'] = $attivita;
    $project['email_bloccante_oggetto'] = $emailBloccante ? $emailBloccante['oggetto'] : null;
    $project['email_bloccante_corpo'] = $emailBloccante ? $emailBloccante['corpo'] : null;
    $project['email_bloccante_data'] = $emailBloccante ? $emailBloccante['data_ricezione'] : null;
    $project['referenti'] = getProjectReferenti($project['id']);

    Response::json($project);
});

// GET /api/projects/client/:clienteId/:projectId/allegati — client list attachments
$router->get('/projects/client/:clienteId/:projectId/allegati', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }

    $project = Database::fetchOne(
        'SELECT id FROM progetti WHERE id = ? AND cliente_id = ?',
        [$req->params['projectId'], $req->params['clienteId']]
    );
    if (!$project) Response::error('Progetto non trovato', 404);

    $allegati = Database::fetchAll(
        'SELECT id, nome_originale, dimensione, tipo_mime, created_at FROM allegati_progetto WHERE progetto_id = ? ORDER BY created_at DESC',
        [$req->params['projectId']]
    );
    Response::json($allegati);
});

// GET /api/projects/client/:clienteId/:projectId/allegati/:allegatoId/download — client download
$router->get('/projects/client/:clienteId/:projectId/allegati/:allegatoId/download', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }

    $allegato = Database::fetchOne(
        'SELECT * FROM allegati_progetto WHERE id = ? AND progetto_id = ?',
        [$req->params['allegatoId'], $req->params['projectId']]
    );
    if (!$allegato) Response::error('Allegato non trovato', 404);

    $filePath = UPLOAD_DIR . '/progetti/' . $allegato['nome_file'];
    if (!file_exists($filePath)) Response::error('File non trovato', 404);
    header('Content-Type: ' . ($allegato['tipo_mime'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . basename(str_replace(["\r", "\n", '"'], '', $allegato['nome_originale'])) . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
});

// GET /api/projects/chat-unread — unread chat summary for sidebar notifications
$router->get('/projects/chat-unread', [Auth::class, 'authenticateToken'], function($req) {
    $isTecnico = $req->user['ruolo'] === 'tecnico';

    $query = 'SELECT p.id, p.nome FROM progetti p';
    $params = [];

    if ($isTecnico) {
        $query .= ' INNER JOIN progetto_tecnici pt ON pt.progetto_id = p.id AND pt.utente_id = ?';
        $params[] = $req->user['id'];
    }

    $projs = Database::fetchAll($query, $params);

    $result = [];
    foreach ($projs as $p) {
        $nonLette = chatNonLette($p['id'], $req->user['id']);
        if ($nonLette > 0) {
            $p['non_lette'] = $nonLette;
            $result[] = $p;
        }
    }

    Response::json($result);
});

// --- Admin/Tecnico routes ---

// GET /api/projects — list projects (admin: all, tecnico: only assigned)
$router->get('/projects', [Auth::class, 'authenticateToken'], function($req) {
    $clienteId = $req->query['cliente_id'] ?? null;
    $stato = $req->query['stato'] ?? null;
    $page = intval($req->query['page'] ?? 1) ?: 1;
    $limit = intval($req->query['limit'] ?? 25) ?: 25;
    $offset = ($page - 1) * $limit;
    $isTecnico = $req->user['ruolo'] === 'tecnico';

    $from = ' FROM progetti p LEFT JOIN clienti c ON p.cliente_id = c.id';
    $params = [];

    if ($isTecnico) {
        $from .= ' INNER JOIN progetto_tecnici pt ON pt.progetto_id = p.id AND pt.utente_id = ?';
        $params[] = $req->user['id'];
    }

    $where = ' WHERE 1=1';

    if ($clienteId) {
        $where .= ' AND p.cliente_id = ?';
        $params[] = $clienteId;
    }
    if ($stato) {
        $where .= ' AND p.stato = ?';
        $params[] = $stato;
    }

    $countRow = Database::fetchOne('SELECT COUNT(DISTINCT p.id) as total' . $from . $where, $params);
    $total = (int)$countRow['total'];

    $dataParams = array_merge($params, [$limit, $offset]);
    $projects = Database::fetchAll(
        'SELECT DISTINCT p.*, c.nome_azienda as cliente_nome' . $from . $where . ' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?',
        $dataParams
    );

    $data = [];
    foreach ($projects as $p) {
        $activities = Database::fetchAll(
            'SELECT avanzamento, stato FROM attivita WHERE progetto_id = ?',
            [$p['id']]
        );

        $avanzamento = 0;
        if (count($activities) > 0) {
            $sum = array_reduce($activities, function($carry, $a) {
                return $carry + $a['avanzamento'];
            }, 0);
            $avanzamento = round($sum / count($activities));
        }

        $stato_calcolato = 'senza_attivita';
        if (count($activities) > 0) {
            $allCompleted = true;
            $anyBlocked = false;
            foreach ($activities as $a) {
                if ($a['stato'] !== 'completata') $allCompleted = false;
                if ($a['stato'] === 'bloccata') $anyBlocked = true;
            }
            if ($allCompleted) $stato_calcolato = 'chiuso';
            elseif ($anyBlocked) $stato_calcolato = 'bloccato';
            else $stato_calcolato = 'attivo';
        }

        $p['avanzamento'] = $avanzamento;
        $p['stato_calcolato'] = $stato_calcolato;
        $p['num_attivita'] = count($activities);
        $p['tecnici'] = getProjectTecnici($p['id']);
        $p['referenti'] = getProjectReferenti($p['id']);
        $p['chat_non_lette'] = chatNonLette($p['id'], $req->user['id']);
        $data[] = $p;
    }

    Response::json([
        'data' => $data,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => ceil($total / $limit),
    ]);
});

// GET /api/projects/:id — project detail (admin: any, tecnico: only assigned)
$router->get('/projects/:id', [Auth::class, 'authenticateToken'], function($req) {
    $project = Database::fetchOne(
        "SELECT p.*, c.nome_azienda as cliente_nome, c.email as cliente_email,
                c.telefono as cliente_telefono, c.referente as cliente_referente
         FROM progetti p
         LEFT JOIN clienti c ON p.cliente_id = c.id
         WHERE p.id = ?",
        [$req->params['id']]
    );

    if (!$project) {
        Response::error('Progetto non trovato', 404);
    }

    // Tecnico can only see projects they're assigned to
    if ($req->user['ruolo'] === 'tecnico') {
        $visible = Database::fetchOne(
            'SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?',
            [$req->params['id'], $req->user['id']]
        );
        if (!$visible) Response::error('Accesso non consentito', 403);
    }

    $attivitaRaw = Database::fetchAll(
        "SELECT a.*, u.nome as assegnato_nome
         FROM attivita a
         LEFT JOIN utenti u ON a.assegnato_a = u.id
         WHERE a.progetto_id = ?
         ORDER BY a.ordine ASC,
           FIELD(a.priorita, 'alta', 'media', 'bassa'),
           a.created_at ASC",
        [$project['id']]
    );

    // Include notes and blocking email info for each activity
    $attivita = [];
    foreach ($attivitaRaw as $a) {
        $a['note_attivita'] = Database::fetchAll(
            "SELECT n.*, u.nome as utente_nome
             FROM note_attivita n
             LEFT JOIN utenti u ON n.utente_id = u.id
             WHERE n.attivita_id = ?
             ORDER BY n.created_at ASC",
            [$a['id']]
        );
        $emailBloccante = Database::fetchOne(
            'SELECT id, oggetto FROM email WHERE attivita_id = ? AND is_bloccante = 1',
            [$a['id']]
        );
        $a['email_bloccante'] = $emailBloccante ?: null;
        $attivita[] = $a;
    }

    $avanzamento = 0;
    if (count($attivita) > 0) {
        $sum = array_reduce($attivita, function($carry, $a) {
            return $carry + $a['avanzamento'];
        }, 0);
        $avanzamento = round($sum / count($attivita));
    }

    $emails = Database::fetchAll(
        "SELECT e.*, a.nome as attivita_nome,
           CASE WHEN e.thread_id IS NOT NULL
             THEN (SELECT COUNT(*) FROM email e2 WHERE e2.thread_id = e.thread_id)
             ELSE 0
           END as thread_count
         FROM email e
         LEFT JOIN attivita a ON e.attivita_id = a.id
         WHERE e.progetto_id = ?
         ORDER BY e.data_ricezione DESC",
        [$project['id']]
    );

    $note = Database::fetchAll(
        "SELECT n.*, u.nome as utente_nome
         FROM note_interne n
         LEFT JOIN utenti u ON n.utente_id = u.id
         WHERE n.progetto_id = ?
         ORDER BY n.created_at ASC",
        [$project['id']]
    );

    $chat = Database::fetchAll(
        "SELECT m.*, u.nome as utente_nome, u.ruolo as utente_ruolo
         FROM messaggi_progetto m
         LEFT JOIN utenti u ON m.utente_id = u.id
         WHERE m.progetto_id = ?
         ORDER BY m.created_at ASC",
        [$project['id']]
    );

    $tecnici = getProjectTecnici($project['id']);

    // Mark chat as read for this user
    Database::execute(
        "INSERT INTO chat_lettura (utente_id, progetto_id, ultimo_letto_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE ultimo_letto_at = NOW()",
        [$req->user['id'], $project['id']]
    );

    $referenti = getProjectReferenti($project['id']);

    $project['avanzamento'] = $avanzamento;
    $project['attivita'] = $attivita;
    $project['emails'] = $emails;
    $project['note'] = $note;
    $project['chat'] = $chat;
    $project['tecnici'] = $tecnici;
    $project['referenti'] = $referenti;

    // Scheduled activities
    try { $project['attivita_programmate'] = Database::fetchAll('SELECT * FROM attivita_programmate WHERE progetto_id = ? ORDER BY data_pianificata ASC', [$project['id']]); } catch (\Exception $e) { $project['attivita_programmate'] = []; }

    Response::json($project);
});

// POST /api/projects/:id/chat — send chat message
$router->post('/projects/:id/chat', [Auth::class, 'authenticateToken'], function($req) {
    $testo = $req->body['testo'] ?? '';
    if (!$testo || !trim($testo)) {
        Response::error('Il testo del messaggio è obbligatorio', 400);
    }

    $project = Database::fetchOne('SELECT id FROM progetti WHERE id = ?', [$req->params['id']]);
    if (!$project) {
        Response::error('Progetto non trovato', 404);
    }

    // Check access: admin always, tecnico only if assigned
    if ($req->user['ruolo'] === 'tecnico') {
        $visible = Database::fetchOne(
            'SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?',
            [$req->params['id'], $req->user['id']]
        );
        if (!$visible) Response::error('Accesso non consentito', 403);
    }

    Database::execute(
        'INSERT INTO messaggi_progetto (progetto_id, utente_id, testo) VALUES (?, ?, ?)',
        [$req->params['id'], $req->user['id'], trim($testo)]
    );
    $msgId = Database::lastInsertId();

    // Auto-mark as read for sender
    Database::execute(
        "INSERT INTO chat_lettura (utente_id, progetto_id, ultimo_letto_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE ultimo_letto_at = NOW()",
        [$req->user['id'], $req->params['id']]
    );

    $msg = Database::fetchOne(
        "SELECT m.*, u.nome as utente_nome, u.ruolo as utente_ruolo
         FROM messaggi_progetto m
         LEFT JOIN utenti u ON m.utente_id = u.id
         WHERE m.id = ?",
        [$msgId]
    );

    Response::created($msg);
});

// POST /api/projects — create project (admin only)
$router->post('/projects', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $clienteId = $req->body['cliente_id'] ?? null;
    $nome = $req->body['nome'] ?? null;
    $descrizione = $req->body['descrizione'] ?? null;
    $dataInizio = $req->body['data_inizio'] ?? null;
    $dataScadenza = $req->body['data_scadenza'] ?? null;
    $stato = $req->body['stato'] ?? 'attivo';
    $manutenzioneOrdinaria = !empty($req->body['manutenzione_ordinaria']) ? 1 : 0;
    $tecnici = $req->body['tecnici'] ?? [];
    $referenti = $req->body['referenti'] ?? [];
    $nuoviReferenti = $req->body['nuovi_referenti'] ?? [];

    if (!$clienteId || !$nome) {
        Response::error('Campi obbligatori: cliente_id, nome', 400);
    }

    Database::execute(
        'INSERT INTO progetti (cliente_id, nome, descrizione, data_inizio, data_scadenza, stato, manutenzione_ordinaria) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$clienteId, $nome, $descrizione, $dataInizio, $dataScadenza, $stato, $manutenzioneOrdinaria]
    );
    $projectId = Database::lastInsertId();

    if (is_array($tecnici) && count($tecnici) > 0) {
        setProjectTecnici($projectId, $tecnici);
    }

    // Create new referenti inline and collect their IDs
    $allReferenteIds = is_array($referenti) ? $referenti : [];
    if (is_array($nuoviReferenti)) {
        foreach ($nuoviReferenti as $nr) {
            $nrNome = trim($nr['nome'] ?? '');
            $nrEmail = trim($nr['email'] ?? '');
            if (!$nrNome || !$nrEmail) continue;
            Database::execute(
                'INSERT INTO referenti_progetto (cliente_id, nome, cognome, email, telefono) VALUES (?, ?, ?, ?, ?)',
                [$clienteId, $nrNome, trim($nr['cognome'] ?? ''), $nrEmail, $nr['telefono'] ?? null]
            );
            $allReferenteIds[] = (int)Database::lastInsertId();
        }
    }
    if (count($allReferenteIds) > 0) {
        setProjectReferenti($projectId, $allReferenteIds);
    }

    $project = Database::fetchOne('SELECT * FROM progetti WHERE id = ?', [$projectId]);
    $project['tecnici'] = getProjectTecnici($project['id']);
    $project['referenti'] = getProjectReferenti($project['id']);
    Response::created($project);
});

// PUT /api/projects/:id — update project (admin only)
$router->put('/projects/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $project = Database::fetchOne('SELECT * FROM progetti WHERE id = ?', [$req->params['id']]);
    if (!$project) {
        Response::error('Progetto non trovato', 404);
    }

    $nome = $req->body['nome'] ?? null;
    $descrizione = array_key_exists('descrizione', $req->body) ? $req->body['descrizione'] : $project['descrizione'];
    $stato = $req->body['stato'] ?? null;
    $blocco = $req->body['blocco'] ?? null;
    $emailBloccanteId = array_key_exists('email_bloccante_id', $req->body) ? $req->body['email_bloccante_id'] : $project['email_bloccante_id'];
    $dataScadenza = $req->body['data_scadenza'] ?? null;
    $tecnici = $req->body['tecnici'] ?? null;

    Database::execute(
        "UPDATE progetti SET
           nome = COALESCE(?, nome),
           descrizione = ?,
           stato = COALESCE(?, stato),
           blocco = COALESCE(?, blocco),
           email_bloccante_id = ?,
           data_scadenza = COALESCE(?, data_scadenza),
           updated_at = NOW()
         WHERE id = ?",
        [$nome, $descrizione, $stato, $blocco, $emailBloccanteId, $dataScadenza, $req->params['id']]
    );

    if ($tecnici !== null && is_array($tecnici)) {
        setProjectTecnici($req->params['id'], $tecnici);
    }

    // Handle referenti update
    $referenti = $req->body['referenti'] ?? null;
    $nuoviReferenti = $req->body['nuovi_referenti'] ?? [];
    if ($referenti !== null || count($nuoviReferenti) > 0) {
        $allReferenteIds = is_array($referenti) ? $referenti : [];
        if (is_array($nuoviReferenti)) {
            foreach ($nuoviReferenti as $nr) {
                $nrNome = trim($nr['nome'] ?? '');
                $nrEmail = trim($nr['email'] ?? '');
                if (!$nrNome || !$nrEmail) continue;
                Database::execute(
                    'INSERT INTO referenti_progetto (cliente_id, nome, cognome, email, telefono) VALUES (?, ?, ?, ?, ?)',
                    [$project['cliente_id'], $nrNome, trim($nr['cognome'] ?? ''), $nrEmail, $nr['telefono'] ?? null]
                );
                $allReferenteIds[] = (int)Database::lastInsertId();
            }
        }
        setProjectReferenti($req->params['id'], $allReferenteIds);
    }

    $updated = Database::fetchOne(
        "SELECT p.*, c.nome_azienda as cliente_nome
         FROM progetti p
         LEFT JOIN clienti c ON p.cliente_id = c.id
         WHERE p.id = ?",
        [$req->params['id']]
    );
    $updated['tecnici'] = getProjectTecnici($req->params['id']);
    $updated['referenti'] = getProjectReferenti($req->params['id']);

    Response::json($updated);
});

// === Project Attachments ===

// GET /api/projects/:id/allegati — list attachments (admin/tecnico)
$router->get('/projects/:id/allegati', [Auth::class, 'authenticateToken'], function($req) {
    $allegati = Database::fetchAll(
        'SELECT id, nome_originale, dimensione, tipo_mime, created_at FROM allegati_progetto WHERE progetto_id = ? ORDER BY created_at DESC',
        [$req->params['id']]
    );
    Response::json($allegati);
});

// POST /api/projects/:id/allegati — upload attachments (admin only, multiple files)
$router->post('/projects/:id/allegati', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $project = Database::fetchOne('SELECT id FROM progetti WHERE id = ?', [$req->params['id']]);
    if (!$project) Response::error('Progetto non trovato', 404);

    $files = Upload::handleMultiple('files', UPLOAD_DIR . '/progetti', [
        'maxSize' => 20 * 1024 * 1024,
        'allowedExts' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'xlsx', 'zip', 'rar', '7z', 'csv', 'md'],
    ]);

    $results = [];
    foreach ($files as $file) {
        Database::execute(
            'INSERT INTO allegati_progetto (progetto_id, nome_file, nome_originale, dimensione, tipo_mime, caricato_da) VALUES (?, ?, ?, ?, ?, ?)',
            [$req->params['id'], $file['nome_file'], $file['nome_originale'], $file['dimensione'], $file['tipo_mime'], $req->user['id']]
        );
        $results[] = [
            'id' => Database::lastInsertId(),
            'nome_originale' => $file['nome_originale'],
            'dimensione' => $file['dimensione'],
            'tipo_mime' => $file['tipo_mime'],
        ];
    }

    Response::created($results);
});

// DELETE /api/projects/:id/allegati/:allegatoId — delete attachment (admin only)
$router->delete('/projects/:id/allegati/:allegatoId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $allegato = Database::fetchOne(
        'SELECT * FROM allegati_progetto WHERE id = ? AND progetto_id = ?',
        [$req->params['allegatoId'], $req->params['id']]
    );
    if (!$allegato) Response::error('Allegato non trovato', 404);

    // Delete file from disk
    Upload::deleteFile(UPLOAD_DIR . '/progetti', $allegato['nome_file']);

    Database::execute('DELETE FROM allegati_progetto WHERE id = ?', [$req->params['allegatoId']]);
    Response::success();
});

// DELETE /api/projects/:id — delete project and all related data (admin only)
$router->delete('/projects/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $projectId = $req->params['id'];
    $project = Database::fetchOne('SELECT id FROM progetti WHERE id = ?', [$projectId]);
    if (!$project) Response::error('Progetto non trovato', 404);

    // Delete attachment files
    $allegati = Database::fetchAll('SELECT nome_file FROM allegati_progetto WHERE progetto_id = ?', [$projectId]);
    foreach ($allegati as $a) {
        Upload::deleteFile(UPLOAD_DIR . '/progetti', $a['nome_file']);
    }
    Database::execute('DELETE FROM allegati_progetto WHERE progetto_id = ?', [$projectId]);
    Database::execute('DELETE FROM note_attivita WHERE attivita_id IN (SELECT id FROM attivita WHERE progetto_id = ?)', [$projectId]);
    Database::execute('DELETE FROM attivita WHERE progetto_id = ?', [$projectId]);
    Database::execute('DELETE FROM progetto_tecnici WHERE progetto_id = ?', [$projectId]);
    Database::execute('DELETE FROM progetto_referenti WHERE progetto_id = ?', [$projectId]);
    Database::execute('DELETE FROM messaggi_progetto WHERE progetto_id = ?', [$projectId]);
    Database::execute('DELETE FROM chat_lettura WHERE progetto_id = ?', [$projectId]);
    Database::execute('DELETE FROM progetti WHERE id = ?', [$projectId]);

    Response::success();
});

// GET /api/projects/:id/allegati/:allegatoId/download — download attachment (admin/tecnico)
$router->get('/projects/:id/allegati/:allegatoId/download', [Auth::class, 'authenticateToken'], function($req) {
    // IDOR protection: tecnico can only download from assigned projects
    if (($req->user['ruolo'] ?? '') === 'tecnico') {
        $assigned = Database::fetchOne(
            'SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?',
            [$req->params['id'], $req->user['id']]
        );
        if (!$assigned) Response::error('Accesso non consentito', 403);
    }

    $allegato = Database::fetchOne(
        'SELECT * FROM allegati_progetto WHERE id = ? AND progetto_id = ?',
        [$req->params['allegatoId'], $req->params['id']]
    );
    if (!$allegato) Response::error('Allegato non trovato', 404);

    $filePath = UPLOAD_DIR . '/progetti/' . $allegato['nome_file'];
    if (!file_exists($filePath)) Response::error('File non trovato', 404);
    header('Content-Type: ' . ($allegato['tipo_mime'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . basename(str_replace(["\r", "\n", '"'], '', $allegato['nome_originale'])) . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
});
