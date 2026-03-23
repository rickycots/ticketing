<?php
/**
 * Activities routes — CRUD for project activities (nested under /projects/:id/activities)
 */

/**
 * Check project access for tecnico users.
 * Admin has full access; tecnico can only access assigned projects.
 */
function checkProjectAccess($req) {
    if ($req->user['ruolo'] === 'admin') return;
    $visible = Database::fetchOne(
        'SELECT 1 FROM progetto_tecnici WHERE progetto_id = ? AND utente_id = ?',
        [$req->params['id'], $req->user['id']]
    );
    if (!$visible) {
        Response::error('Accesso non consentito', 403);
    }
}

// GET /projects/:id/activities — list activities
$router->get('/projects/:id/activities', [Auth::class, 'authenticateToken'], function($req) {
    checkProjectAccess($req);

    $activities = Database::fetchAll(
        "SELECT a.*, u.nome as assegnato_nome
         FROM attivita a
         LEFT JOIN utenti u ON a.assegnato_a = u.id
         WHERE a.progetto_id = ?
         ORDER BY a.ordine ASC,
           FIELD(a.priorita, 'alta', 'media', 'bassa'),
           a.created_at ASC",
        [$req->params['id']]
    );

    Response::json($activities);
});

// GET /projects/:id/activities/:activityId — single activity detail
$router->get('/projects/:id/activities/:activityId', [Auth::class, 'authenticateToken'], function($req) {
    checkProjectAccess($req);

    $activity = Database::fetchOne(
        "SELECT a.*, u.nome as assegnato_nome
         FROM attivita a
         LEFT JOIN utenti u ON a.assegnato_a = u.id
         WHERE a.id = ? AND a.progetto_id = ?",
        [$req->params['activityId'], $req->params['id']]
    );

    if (!$activity) {
        Response::error('Attività non trovata', 404);
    }

    // Tecnico can only view activities assigned to them
    if (($req->user['ruolo'] ?? '') === 'tecnico') {
        $assignedIds = array_filter(array_map('intval', explode(',', $activity['tecnici_ids'] ?? '')));
        if ($activity['assegnato_a'] != $req->user['id'] && !in_array((int)$req->user['id'], $assignedIds)) {
            Response::error('Non sei abilitato su questa attività', 403);
        }
    }

    // Project info
    $project = Database::fetchOne(
        "SELECT p.id, p.nome, p.stato, c.nome_azienda as cliente_nome, c.id as cliente_id,
                c.email as cliente_email, c.telefono as cliente_telefono, c.referente as cliente_referente
         FROM progetti p
         LEFT JOIN clienti c ON p.cliente_id = c.id
         WHERE p.id = ?",
        [$req->params['id']]
    );

    // Notes
    $noteAttivita = Database::fetchAll(
        "SELECT n.*, u.nome as utente_nome
         FROM note_attivita n
         LEFT JOIN utenti u ON n.utente_id = u.id
         WHERE n.attivita_id = ?
         ORDER BY n.created_at ASC",
        [$req->params['activityId']]
    );

    // Dependency info
    $dipendenza = null;
    if (!empty($activity['dipende_da'])) {
        $dipendenza = Database::fetchOne(
            'SELECT id, nome, stato FROM attivita WHERE id = ?',
            [$activity['dipende_da']]
        );
    }

    // Dependents (activities that depend on this one)
    $dipendenti = Database::fetchAll(
        'SELECT id, nome, stato FROM attivita WHERE dipende_da = ?',
        [$req->params['activityId']]
    );

    // Blocking email
    $emailBloccante = Database::fetchOne(
        'SELECT id, oggetto FROM email WHERE attivita_id = ? AND is_bloccante = 1',
        [$req->params['activityId']]
    );

    // Associated emails
    $emails = Database::fetchAll(
        'SELECT * FROM email WHERE attivita_id = ? ORDER BY data_ricezione ASC',
        [$req->params['activityId']]
    );

    // Resolve tecnici names
    $tecniciNomi = [];
    if (!empty($activity['tecnici_ids'])) {
        $ids = array_filter(array_map('intval', explode(',', $activity['tecnici_ids'])));
        foreach ($ids as $tid) {
            $u = Database::fetchOne('SELECT id, nome FROM utenti WHERE id = ?', [$tid]);
            if ($u) $tecniciNomi[] = $u;
        }
    }

    $activity['progetto'] = $project;
    $activity['note_attivita'] = $noteAttivita;
    $activity['dipendenza'] = $dipendenza ?: null;
    $activity['dipendenti'] = $dipendenti;
    $activity['email_bloccante'] = $emailBloccante ?: null;
    $activity['emails'] = $emails;
    $activity['tecnici_nomi'] = $tecniciNomi;

    Response::json($activity);
});

// POST /projects/:id/activities — create activity (admin only)
$router->post('/projects/:id/activities', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $progettoId = $req->params['id'];
    $body = $req->body;

    $nome = $body['nome'] ?? null;
    $descrizione = $body['descrizione'] ?? null;
    $assegnato_a = $body['assegnato_a'] ?? null;
    $stato = $body['stato'] ?? 'da_fare';
    $avanzamento = $body['avanzamento'] ?? 0;
    $priorita = $body['priorita'] ?? 'media';
    $data_scadenza = $body['data_scadenza'] ?? null;
    $note = $body['note'] ?? null;
    $data_inizio = $body['data_inizio'] ?? null;
    $ordine = $body['ordine'] ?? null;
    $dipende_da = $body['dipende_da'] ?? null;

    if (!$nome) {
        Response::error('Campo obbligatorio: nome', 400);
    }

    $project = Database::fetchOne('SELECT id FROM progetti WHERE id = ?', [$progettoId]);
    if (!$project) {
        Response::error('Progetto non trovato', 404);
    }

    // Validate dipende_da is in same project
    if ($dipende_da) {
        $dep = Database::fetchOne(
            'SELECT id FROM attivita WHERE id = ? AND progetto_id = ?',
            [$dipende_da, $progettoId]
        );
        if (!$dep) {
            Response::error('Attività dipendenza non trovata nello stesso progetto', 400);
        }
    }

    // Ordine: only for primary activities (no dipende_da)
    $finalOrdine = null;
    if (!$dipende_da) {
        $finalOrdine = $ordine;
        if ($finalOrdine === null || $finalOrdine === '') {
            // Auto: next after max ordine of primary activities in this project
            $maxOrd = Database::fetchOne(
                'SELECT MAX(ordine) as m FROM attivita WHERE progetto_id = ? AND (dipende_da IS NULL OR dipende_da = 0)',
                [$progettoId]
            );
            $finalOrdine = ($maxOrd && $maxOrd['m'] !== null) ? $maxOrd['m'] + 1 : 1;
        } else {
            // Explicit ordine: shift existing primary activities >= this ordine
            $finalOrdine = intval($finalOrdine);
            Database::execute(
                'UPDATE attivita SET ordine = ordine + 1 WHERE progetto_id = ? AND (dipende_da IS NULL OR dipende_da = 0) AND ordine >= ?',
                [$progettoId, $finalOrdine]
            );
        }
    }

    Database::execute(
        "INSERT INTO attivita (progetto_id, nome, descrizione, assegnato_a, stato, avanzamento, priorita, data_scadenza, note, data_inizio, ordine, dipende_da, tecnici_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $progettoId,
            $nome,
            $descrizione ?: null,
            $assegnato_a ?: null,
            $stato,
            $avanzamento,
            $priorita,
            $data_scadenza ?: null,
            $note ?: null,
            $data_inizio ?: null,
            $finalOrdine,
            $dipende_da ?: null,
            isset($req->body['tecnici_ids']) ? (is_array($req->body['tecnici_ids']) ? implode(',', $req->body['tecnici_ids']) : $req->body['tecnici_ids']) : null
        ]
    );

    $newId = Database::lastInsertId();

    Database::execute(
        'UPDATE progetti SET updated_at = NOW() WHERE id = ?',
        [$progettoId]
    );

    $activity = Database::fetchOne(
        "SELECT a.*, u.nome as assegnato_nome
         FROM attivita a
         LEFT JOIN utenti u ON a.assegnato_a = u.id
         WHERE a.id = ?",
        [$newId]
    );

    Response::created($activity);
});

// PUT /projects/:id/activities/:activityId — update activity
// Admin: can update everything. Tecnico: can update stato and note on assigned activities.
$router->put('/projects/:id/activities/:activityId', [Auth::class, 'authenticateToken'], function($req) {
    checkProjectAccess($req);

    $body = $req->body;
    $activityId = $req->params['activityId'];
    $projectId = $req->params['id'];

    $activity = Database::fetchOne(
        'SELECT * FROM attivita WHERE id = ? AND progetto_id = ?',
        [$activityId, $projectId]
    );

    if (!$activity) {
        Response::error('Attività non trovata', 404);
    }

    $stato = $body['stato'] ?? null;
    $note = array_key_exists('note', $body) ? $body['note'] : null;
    $nome = $body['nome'] ?? null;
    $descrizione = $body['descrizione'] ?? null;
    $assegnato_a = array_key_exists('assegnato_a', $body) ? $body['assegnato_a'] : null;
    $avanzamento = array_key_exists('avanzamento', $body) ? $body['avanzamento'] : null;
    $priorita = $body['priorita'] ?? null;
    $data_scadenza = $body['data_scadenza'] ?? null;
    $data_inizio = $body['data_inizio'] ?? null;
    $ordine = array_key_exists('ordine', $body) ? $body['ordine'] : null;
    $dipende_da = array_key_exists('dipende_da', $body) ? $body['dipende_da'] : null;

    // If activity is blocked by a blocking email, prevent status changes
    if ($stato && $stato !== $activity['stato']) {
        $blockingEmail = Database::fetchOne(
            'SELECT id FROM email WHERE attivita_id = ? AND is_bloccante = 1',
            [$activityId]
        );
        if ($blockingEmail) {
            Response::error("L'attività è bloccata da un'email bloccante. Rimuovi prima il blocco dall'email.", 400);
        }
    }

    // Tecnico can only update stato and note on activities assigned to them
    if ($req->user['ruolo'] === 'tecnico') {
        $assignedIds = array_filter(array_map('intval', explode(',', $activity['tecnici_ids'] ?? '')));
        $isAssigned = $activity['assegnato_a'] == $req->user['id'] || in_array((int)$req->user['id'], $assignedIds);
        if (!$isAssigned) {
            Response::error('Puoi modificare solo le attività assegnate a te', 403);
        }

        // Only allow stato and note updates
        $allowedStato = $stato ?: $activity['stato'];
        $allowedNote = array_key_exists('note', $body) ? $body['note'] : $activity['note'];

        // Auto-manage data_completamento
        $dataCompletamento = $activity['data_completamento'];
        if ($allowedStato === 'completata' && $activity['stato'] !== 'completata') {
            $dataCompletamento = date('Y-m-d H:i:s');
        } elseif ($allowedStato !== 'completata' && $activity['stato'] === 'completata') {
            $dataCompletamento = null;
        }

        Database::execute(
            "UPDATE attivita SET
                stato = ?,
                note = ?,
                data_completamento = ?,
                updated_at = NOW()
             WHERE id = ?",
            [$allowedStato, $allowedNote, $dataCompletamento, $activityId]
        );
    } else {
        // Admin: full update
        $newStato = $stato ?: $activity['stato'];

        // Auto-manage data_completamento
        $dataCompletamento = $activity['data_completamento'];
        if ($newStato === 'completata' && $activity['stato'] !== 'completata') {
            $dataCompletamento = date('Y-m-d H:i:s');
        } elseif ($newStato !== 'completata' && $activity['stato'] === 'completata') {
            $dataCompletamento = null;
        }

        // Validate dipende_da is in same project
        if ($dipende_da !== null && $dipende_da !== '' && $dipende_da !== 0) {
            $dep = Database::fetchOne(
                'SELECT id FROM attivita WHERE id = ? AND progetto_id = ?',
                [$dipende_da, $projectId]
            );
            if (!$dep) {
                Response::error('Attività dipendenza non trovata nello stesso progetto', 400);
            }
        }

        // Determine final dipende_da
        $finalDipendeDa = array_key_exists('dipende_da', $body) ? ($dipende_da ?: null) : $activity['dipende_da'];

        // Determine final ordine based on dependency status
        if ($finalDipendeDa) {
            // Dependent activity: no ordine
            $finalOrdine = null;
        } elseif (array_key_exists('ordine', $body) && $ordine !== null && $ordine !== '') {
            // Primary with explicit ordine: shift others
            $finalOrdine = intval($ordine);
            if ($finalOrdine !== intval($activity['ordine'])) {
                Database::execute(
                    'UPDATE attivita SET ordine = ordine + 1 WHERE progetto_id = ? AND id != ? AND (dipende_da IS NULL OR dipende_da = 0) AND ordine >= ?',
                    [$projectId, $activityId, $finalOrdine]
                );
            }
        } else {
            // Primary, keep current ordine (or auto-assign if was dependent before)
            if ($activity['dipende_da'] && !$finalDipendeDa) {
                // Was dependent, becoming primary: auto-assign next ordine
                $maxOrd = Database::fetchOne(
                    'SELECT MAX(ordine) as m FROM attivita WHERE progetto_id = ? AND (dipende_da IS NULL OR dipende_da = 0)',
                    [$projectId]
                );
                $finalOrdine = ($maxOrd && $maxOrd['m'] !== null) ? $maxOrd['m'] + 1 : 1;
            } else {
                $finalOrdine = $activity['ordine'];
            }
        }

        Database::execute(
            "UPDATE attivita SET
                nome = COALESCE(?, nome),
                descrizione = COALESCE(?, descrizione),
                assegnato_a = ?,
                stato = COALESCE(?, stato),
                avanzamento = COALESCE(?, avanzamento),
                priorita = COALESCE(?, priorita),
                data_scadenza = COALESCE(?, data_scadenza),
                data_completamento = ?,
                note = COALESCE(?, note),
                data_inizio = COALESCE(?, data_inizio),
                ordine = ?,
                dipende_da = ?,
                tecnici_ids = COALESCE(?, tecnici_ids),
                updated_at = NOW()
             WHERE id = ?",
            [
                $nome ?: null,
                $descrizione ?: null,
                array_key_exists('assegnato_a', $body) ? $assegnato_a : $activity['assegnato_a'],
                $stato ?: null,
                array_key_exists('avanzamento', $body) ? $avanzamento : null,
                $priorita ?: null,
                $data_scadenza ?: null,
                $dataCompletamento,
                $note ?: null,
                $data_inizio ?: null,
                $finalOrdine,
                $finalDipendeDa,
                isset($body['tecnici_ids']) ? (is_array($body['tecnici_ids']) ? implode(',', $body['tecnici_ids']) : $body['tecnici_ids']) : null,
                $activityId
            ]
        );
    }

    Database::execute(
        'UPDATE progetti SET updated_at = NOW() WHERE id = ?',
        [$projectId]
    );

    $updated = Database::fetchOne(
        "SELECT a.*, u.nome as assegnato_nome
         FROM attivita a
         LEFT JOIN utenti u ON a.assegnato_a = u.id
         WHERE a.id = ?",
        [$activityId]
    );

    Response::json($updated);
});

// POST /projects/:id/activities/:activityId/notes — add note to activity
$router->post('/projects/:id/activities/:activityId/notes', [Auth::class, 'authenticateToken'], function($req) {
    checkProjectAccess($req);

    $testo = $req->body['testo'] ?? null;
    $salvaInKb = !empty($req->body['salva_in_kb']);
    if (!$testo || !trim($testo)) {
        Response::error('Il testo della nota è obbligatorio', 400);
    }

    $activity = Database::fetchOne(
        'SELECT a.*, p.cliente_id, p.nome as progetto_nome FROM attivita a JOIN progetti p ON a.progetto_id = p.id WHERE a.id = ? AND a.progetto_id = ?',
        [$req->params['activityId'], $req->params['id']]
    );
    if (!$activity) {
        Response::error('Attività non trovata', 404);
    }

    // Tecnico can only add notes on activities assigned to them
    if (($req->user['ruolo'] ?? '') === 'tecnico') {
        $assignedIds = array_filter(array_map('intval', explode(',', $activity['tecnici_ids'] ?? '')));
        if ($activity['assegnato_a'] != $req->user['id'] && !in_array((int)$req->user['id'], $assignedIds)) {
            Response::error('Non sei abilitato su questa attività', 403);
        }
    }

    Database::execute(
        'INSERT INTO note_attivita (attivita_id, utente_id, testo) VALUES (?, ?, ?)',
        [$req->params['activityId'], $req->user['id'], trim($testo)]
    );

    // Save to KB if flag is set
    if ($salvaInKb && $activity['cliente_id']) {
        $titolo = "Nota attività \"{$activity['titolo']}\" — {$activity['progetto_nome']}";
        Database::execute(
            'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)',
            [$activity['cliente_id'], $titolo, trim($testo)]
        );
    }

    $newId = Database::lastInsertId();

    $nota = Database::fetchOne(
        "SELECT n.*, u.nome as utente_nome
         FROM note_attivita n
         LEFT JOIN utenti u ON n.utente_id = u.id
         WHERE n.id = ?",
        [$newId]
    );

    Response::created($nota);
});

// DELETE /projects/:id/activities/:activityId — delete activity (admin only)
$router->delete('/projects/:id/activities/:activityId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $activity = Database::fetchOne(
        'SELECT * FROM attivita WHERE id = ? AND progetto_id = ?',
        [$req->params['activityId'], $req->params['id']]
    );

    if (!$activity) {
        Response::error('Attività non trovata', 404);
    }

    Database::execute('DELETE FROM attivita WHERE id = ?', [$req->params['activityId']]);
    Database::execute('UPDATE progetti SET updated_at = NOW() WHERE id = ?', [$req->params['id']]);

    Response::success('Attività eliminata');
});

// === Scheduled Activities (Attivita Programmate) ===

// GET /projects/:id/activities/:activityId/scheduled
$router->get('/projects/:id/activities/:activityId/scheduled', [Auth::class, 'authenticateToken'], function($req) {
    checkProjectAccess($req);
    $items = Database::fetchAll(
        'SELECT ap.*, u.nome as creato_da_nome FROM attivita_programmate ap LEFT JOIN utenti u ON ap.creato_da = u.id WHERE ap.attivita_id = ? AND ap.progetto_id = ? ORDER BY ap.data_pianificata ASC',
        [$req->params['activityId'], $req->params['id']]
    );
    Response::json($items);
});

// POST /projects/:id/activities/:activityId/scheduled
$router->post('/projects/:id/activities/:activityId/scheduled', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $nota = $req->body['nota'] ?? '';
    $data = $req->body['data_pianificata'] ?? '';
    if (!$nota || !$data) Response::error('Nota e data sono obbligatori', 400);
    // Fix 2-digit year from some browsers (0026 -> 2026)
    if (preg_match('/^00\d{2}-/', $data)) $data = '2' . substr($data, 1);

    Database::execute(
        'INSERT INTO attivita_programmate (attivita_id, progetto_id, nota, data_pianificata, referenti_ids, creato_da) VALUES (?, ?, ?, ?, ?, ?)',
        [$req->params['activityId'], $req->params['id'], $nota, $data, $req->body['referenti_ids'] ?? null, $req->user['id']]
    );
    $item = Database::fetchOne('SELECT ap.*, u.nome as creato_da_nome FROM attivita_programmate ap LEFT JOIN utenti u ON ap.creato_da = u.id WHERE ap.id = ?', [Database::lastInsertId()]);
    Response::created($item);
});

// DELETE /projects/:id/activities/:activityId/scheduled/:scheduledId
$router->delete('/projects/:id/activities/:activityId/scheduled/:scheduledId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    Database::execute('DELETE FROM attivita_programmate WHERE id = ? AND attivita_id = ?', [$req->params['scheduledId'], $req->params['activityId']]);
    Response::success();
});
