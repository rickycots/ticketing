<?php
/**
 * Emails routes — CRUD emails (admin only)
 */

// POST /api/emails/poll — trigger IMAP polling (admin only, fire-and-forget)
$router->post('/emails/poll', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    try {
        require_once __DIR__ . '/../cron/poll_emails.php';
    } catch (\Throwable $e) {
        // Ignore errors — polling is best-effort
    }
    Response::json(['polled' => true]);
});

// GET /api/emails
$router->get('/emails', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $page = (int)($req->query['page'] ?? 1) ?: 1;
    $limit = (int)($req->query['limit'] ?? 25) ?: 25;
    $offset = ($page - 1) * $limit;

    $baseWhere = " WHERE e.tipo != 'ticket'";
    $baseParams = [];

    if (!empty($req->query['tipo'])) { $baseWhere .= ' AND e.tipo = ?'; $baseParams[] = $req->query['tipo']; }
    if (isset($req->query['letta']) && empty($req->query['quick_filter'])) { $baseWhere .= ' AND e.letta = ?'; $baseParams[] = (int)$req->query['letta']; }
    if (!empty($req->query['cliente_id'])) { $baseWhere .= ' AND e.cliente_id = ?'; $baseParams[] = $req->query['cliente_id']; }
    if (!empty($req->query['progetto_id'])) { $baseWhere .= ' AND e.progetto_id = ?'; $baseParams[] = $req->query['progetto_id']; }
    if (!empty($req->query['attivita_id'])) { $baseWhere .= ' AND e.attivita_id = ?'; $baseParams[] = $req->query['attivita_id']; }
    if (!empty($req->query['rilevanza']) && empty($req->query['quick_filter'])) { $baseWhere .= ' AND e.rilevanza = ?'; $baseParams[] = $req->query['rilevanza']; }
    if (!empty($req->query['direzione'])) { $baseWhere .= ' AND e.direzione = ?'; $baseParams[] = $req->query['direzione']; }

    // Quick filter counts
    $counts = [
        'tutte' => (int)Database::fetchOne("SELECT COUNT(*) as c FROM email e{$baseWhere}", $baseParams)['c'],
        'da_leggere' => (int)Database::fetchOne("SELECT COUNT(*) as c FROM email e{$baseWhere} AND e.letta = 0", $baseParams)['c'],
        'non_assegnate' => (int)Database::fetchOne("SELECT COUNT(*) as c FROM email e{$baseWhere} AND e.progetto_id IS NULL AND e.attivita_id IS NULL", $baseParams)['c'],
        'bloccanti' => (int)Database::fetchOne("SELECT COUNT(*) as c FROM email e{$baseWhere} AND e.is_bloccante = 1", $baseParams)['c'],
        'rilevanti' => (int)Database::fetchOne("SELECT COUNT(*) as c FROM email e{$baseWhere} AND e.rilevanza = 'rilevante'", $baseParams)['c'],
    ];

    $where = $baseWhere;
    $params = $baseParams;
    $qf = $req->query['quick_filter'] ?? '';
    if ($qf === 'da_leggere') $where .= ' AND e.letta = 0';
    elseif ($qf === 'non_assegnate') $where .= ' AND e.progetto_id IS NULL AND e.attivita_id IS NULL';
    elseif ($qf === 'bloccanti') $where .= ' AND e.is_bloccante = 1';
    elseif ($qf === 'rilevanti') $where .= " AND e.rilevanza = 'rilevante'";

    $total = (int)Database::fetchOne("SELECT COUNT(*) as total FROM email e{$where}", $params)['total'];

    $data = Database::fetchAll(
        "SELECT e.*, c.nome_azienda as cliente_nome, u.nome as inviata_da_nome FROM email e LEFT JOIN clienti c ON e.cliente_id = c.id LEFT JOIN utenti u ON e.inviata_da = u.id {$where} ORDER BY e.data_ricezione DESC LIMIT ? OFFSET ?",
        array_merge($params, [$limit, $offset])
    );

    Response::json(['data' => $data, 'total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit), 'counts' => $counts]);
});

// GET /api/emails/:id
$router->get('/emails/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $email = Database::fetchOne(
        "SELECT e.*, c.nome_azienda as cliente_nome, a.nome as attivita_nome, u.nome as inviata_da_nome
         FROM email e LEFT JOIN clienti c ON e.cliente_id = c.id LEFT JOIN attivita a ON e.attivita_id = a.id LEFT JOIN utenti u ON e.inviata_da = u.id
         WHERE e.id = ?",
        [$req->params['id']]
    );
    if (!$email) Response::error('Email non trovata', 404);

    if (!$email['letta']) {
        Database::execute('UPDATE email SET letta = 1 WHERE id = ?', [$req->params['id']]);
        $email['letta'] = 1;
    }

    $thread = [];
    if ($email['thread_id']) {
        $thread = Database::fetchAll('SELECT * FROM email WHERE thread_id = ? ORDER BY data_ricezione ASC', [$email['thread_id']]);
    }

    $email['thread'] = $thread;
    Response::json($email);
});

// POST /api/emails
$router->post('/emails', [Auth::class, 'authenticateToken'], function($req) {
    // Tecnico: can send on assigned tickets or assigned projects
    if (($req->user['ruolo'] ?? '') === 'tecnico') {
        $tkId = !empty($req->body['ticket_id']) ? (int)$req->body['ticket_id'] : null;
        $pjId = !empty($req->body['progetto_id']) ? (int)$req->body['progetto_id'] : null;
        if ($tkId) {
            $tk = Database::fetchOne('SELECT assegnato_a FROM ticket WHERE id = ?', [$tkId]);
            if (!$tk || $tk['assegnato_a'] != $req->user['id']) {
                Response::error('Non sei assegnato a questo ticket', 403);
            }
        } elseif ($pjId) {
            $pt = Database::fetchOne('SELECT id FROM progetto_tecnici WHERE progetto_id = ? AND tecnico_id = ?', [$pjId, $req->user['id']]);
            if (!$pt) Response::error('Non sei assegnato a questo progetto', 403);
        } else {
            Response::error('Tecnico deve specificare un ticket o progetto', 403);
        }
    }

    $tipo = $req->body['tipo'] ?? 'altro';
    $destinatario = $req->body['destinatario'] ?? '';
    $oggetto = $req->body['oggetto'] ?? '';
    $corpo = $req->body['corpo'] ?? '';
    $isBloccante = !empty($req->body['is_bloccante']);
    $threadId = $req->body['thread_id'] ?? null;
    $clienteId = !empty($req->body['cliente_id']) ? (int)$req->body['cliente_id'] : null;
    $ticketId = !empty($req->body['ticket_id']) ? (int)$req->body['ticket_id'] : null;
    $progettoId = !empty($req->body['progetto_id']) ? (int)$req->body['progetto_id'] : null;
    $attivitaId = !empty($req->body['attivita_id']) ? (int)$req->body['attivita_id'] : null;

    if (!$destinatario || !$oggetto) Response::error('Campi obbligatori: destinatario, oggetto', 400);

    $isTicketEmail = $tipo === 'ticket' || $ticketId;
    $mittente = $isTicketEmail ? (MAIL_TICKETING_USER ?: 'ticketing@stmdomotica.it') : (MAIL_ASSISTENZA_USER ?: 'assistenzatecnica@stmdomotica.it');

    // Handle attachments
    $allegati = [];
    $files = Upload::handleMultiple('allegati', UPLOAD_DIR . '/tickets', [
        'maxSize' => 10 * 1024 * 1024,
        'allowedExts' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'xlsx', 'zip'],
    ]);
    foreach ($files as $f) {
        $allegati[] = ['nome' => $f['nome_originale'], 'file' => $f['nome_file'], 'dimensione' => $f['dimensione']];
    }

    // Threading
    $inReplyTo = null;
    if ($threadId) {
        $parent = Database::fetchOne('SELECT message_id FROM email WHERE thread_id = ? AND message_id IS NOT NULL ORDER BY data_ricezione DESC LIMIT 1', [$threadId]);
        if ($parent) $inReplyTo = $parent['message_id'];
    }

    // Collect all recipients for ticket replies
    $allDestinatari = $destinatario;
    if ($isTicketEmail && $ticketId) {
        $systemAddrs = array_map('strtolower', array_filter([MAIL_TICKETING_USER, MAIL_ASSISTENZA_USER, MAIL_NOREPLY_USER]));
        $ticket = Database::fetchOne('SELECT creatore_email FROM ticket WHERE id = ?', [$ticketId]);
        $threadEmails = Database::fetchAll('SELECT DISTINCT mittente FROM email WHERE ticket_id = ?', [$ticketId]);
        $addrs = [];
        if ($ticket && $ticket['creatore_email']) $addrs[strtolower($ticket['creatore_email'])] = true;
        foreach ($threadEmails as $row) {
            if ($row['mittente']) $addrs[strtolower($row['mittente'])] = true;
        }
        foreach ($systemAddrs as $sys) unset($addrs[$sys]);
        if (!empty($addrs)) $allDestinatari = implode(', ', array_keys($addrs));
    }

    // Send email via SMTP
    $sentMessageId = null;
    try {
        $htmlCorpo = nl2br(htmlspecialchars($corpo));
        if ($isTicketEmail && $ticketId) {
            $ticketInfo = Database::fetchOne('SELECT codice FROM ticket WHERE id = ?', [$ticketId]);
            $codice = $ticketInfo ? $ticketInfo['codice'] : '';
            $emailSubject = "[TICKET #{$codice}] STM Domotica Reply";
            $emailHtml = Mailer::wrapEmailTemplate("<p>Segui la risposta al tuo ticket su: <a href=\"https://www.stmdomotica.it/cloud/ticketing/client/tickets\">portale</a></p>
<br><p><i>Ecco la tua risposta:</i></p>
<div style=\"margin:12px 0;padding:12px;background:#f7f7f7;border-left:3px solid #0066cc;border-radius:4px\">{$htmlCorpo}</div>
<br><br><p>Puoi proseguire la discussione facendo reply a questa mail o dal portale.</p>");
        } else {
            $emailSubject = $oggetto;
            $emailHtml = Mailer::wrapEmailTemplate("<div>{$htmlCorpo}</div>");
        }

        $sendFn = $isTicketEmail ? 'sendTicketing' : 'sendAssistenza';
        $sentMessageId = Mailer::$sendFn($allDestinatari, $emailSubject, $emailHtml, $inReplyTo);
    } catch (\Exception $e) {
        error_log('[MAIL] Errore invio: ' . $e->getMessage());
    }

    Database::execute(
        "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, progetto_id, attivita_id, is_bloccante, thread_id, message_id, allegati, direzione, inviata_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inviata', ?)",
        [$tipo, $mittente, $allDestinatari ?: $destinatario, $oggetto, $corpo, $clienteId, $ticketId, $progettoId, $attivitaId, $isBloccante ? 1 : 0, $threadId, $sentMessageId, json_encode($allegati), $req->user['id']]
    );
    $emailId = Database::lastInsertId();

    // Auto "in_lavorazione" when replying to a ticket that is "aperto"
    if ($ticketId) {
        $tk = Database::fetchOne('SELECT stato FROM ticket WHERE id = ?', [$ticketId]);
        if ($tk && $tk['stato'] === 'aperto') {
            Database::execute("UPDATE ticket SET stato = 'in_lavorazione', updated_at = NOW() WHERE id = ?", [$ticketId]);
        }
    }

    // Blocking logic
    if ($isBloccante && $progettoId) {
        Database::execute("UPDATE progetti SET blocco = 'lato_cliente', email_bloccante_id = ?, updated_at = NOW() WHERE id = ?", [$emailId, $progettoId]);
    }
    if ($isBloccante && $attivitaId) {
        Database::execute("UPDATE attivita SET stato = 'bloccata' WHERE id = ?", [$attivitaId]);
    }

    $newEmail = Database::fetchOne('SELECT * FROM email WHERE id = ?', [$emailId]);
    Response::created($newEmail);
});

// PUT /api/emails/:id
$router->put('/emails/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $id = $req->params['id'];
    $email = Database::fetchOne('SELECT * FROM email WHERE id = ?', [$id]);
    if (!$email) Response::error('Email non trovata', 404);

    $progettoId = array_key_exists('progetto_id', $req->body) ? $req->body['progetto_id'] : $email['progetto_id'];
    $attivitaId = array_key_exists('attivita_id', $req->body) ? $req->body['attivita_id'] : null;
    if (!array_key_exists('attivita_id', $req->body)) {
        $attivitaId = (array_key_exists('progetto_id', $req->body) && $req->body['progetto_id'] != $email['progetto_id']) ? null : $email['attivita_id'];
    }

    $clienteId = array_key_exists('cliente_id', $req->body) ? $req->body['cliente_id'] : $email['cliente_id'];
    $isBloccante = array_key_exists('is_bloccante', $req->body) ? ($req->body['is_bloccante'] ? 1 : 0) : null;
    $letta = array_key_exists('letta', $req->body) ? ($req->body['letta'] ? 1 : 0) : null;
    $tipo = $req->body['tipo'] ?? null;
    $rilevanza = array_key_exists('rilevanza', $req->body) ? ($req->body['rilevanza'] ?: null) : $email['rilevanza'];

    Database::execute(
        "UPDATE email SET cliente_id = ?, progetto_id = ?, attivita_id = ?, is_bloccante = COALESCE(?, is_bloccante), letta = COALESCE(?, letta), tipo = COALESCE(?, tipo), rilevanza = ? WHERE id = ?",
        [$clienteId, $progettoId, $attivitaId, $isBloccante, $letta, $tipo, $rilevanza, $id]
    );

    // Blocking logic
    if ($isBloccante === 1 && $progettoId) {
        Database::execute("UPDATE progetti SET blocco = 'lato_cliente', email_bloccante_id = ?, updated_at = NOW() WHERE id = ?", [$id, $progettoId]);
    } elseif ($isBloccante === 0 && $email['is_bloccante']) {
        Database::execute("UPDATE progetti SET blocco = 'nessuno', email_bloccante_id = NULL, updated_at = NOW() WHERE email_bloccante_id = ?", [$id]);
    }

    if ($isBloccante === 1 && $attivitaId) {
        Database::execute("UPDATE attivita SET stato = 'bloccata' WHERE id = ?", [$attivitaId]);
    } elseif ($isBloccante === 0 && $email['is_bloccante'] && $email['attivita_id']) {
        Database::execute("UPDATE attivita SET stato = 'in_corso' WHERE id = ? AND stato = 'bloccata'", [$email['attivita_id']]);
    }

    $updated = Database::fetchOne("SELECT e.*, c.nome_azienda as cliente_nome FROM email e LEFT JOIN clienti c ON e.cliente_id = c.id WHERE e.id = ?", [$id]);
    Response::json($updated);
});

// DELETE /api/emails/:id — delete email (admin only)
$router->delete('/emails/:id', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $email = Database::fetchOne('SELECT id FROM email WHERE id = ?', [$req->params['id']]);
    if (!$email) Response::error('Email non trovata', 404);
    Database::execute('DELETE FROM email WHERE id = ?', [$req->params['id']]);
    Response::success();
});
