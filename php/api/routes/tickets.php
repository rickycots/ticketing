<?php
/**
 * Tickets routes — CRUD + client endpoints + notes
 */

function createNotifica($utenteId, $tipo, $titolo, $messaggio = '', $link = '') {
    if (!$utenteId) return;
    Database::execute(
        'INSERT INTO notifiche (utente_id, tipo, titolo, messaggio, link) VALUES (?, ?, ?, ?, ?)',
        [$utenteId, $tipo, $titolo, $messaggio, $link]
    );
}

function generateTicketCode() {
    $year = date('Y');
    $last = Database::fetchOne(
        "SELECT codice FROM ticket WHERE codice LIKE ? ORDER BY id DESC LIMIT 1",
        ["TK-{$year}-%"]
    );
    $nextNum = 1;
    if ($last) {
        $parts = explode('-', $last['codice']);
        $nextNum = intval($parts[2]) + 1;
    }
    return sprintf("TK-%s-%04d", $year, $nextNum);
}

function getTicketWithEmails($ticketId) {
    $ticket = Database::fetchOne(
        "SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email
         FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id
         WHERE t.id = ?",
        [$ticketId]
    );
    if (!$ticket) return null;
    $ticket['emails'] = Database::fetchAll(
        'SELECT * FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC',
        [$ticketId]
    );
    return $ticket;
}

// --- Client routes (must be before /:id) ---

// GET /api/tickets/client/:clienteId
$router->get('/tickets/client/:clienteId', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }
    $userEmail = $req->user['email'] ?? '';
    $tickets = Database::fetchAll(
        "SELECT t.*, c.nome_azienda as cliente_nome FROM ticket t
         LEFT JOIN clienti c ON t.cliente_id = c.id WHERE t.cliente_id = ? AND (t.privato = 0 OR t.creatore_email = ?)
         ORDER BY FIELD(t.stato, 'in_attesa', 'aperto', 'in_lavorazione', 'risolto', 'chiuso'), t.updated_at DESC",
        [$req->params['clienteId'], $userEmail]
    );
    foreach ($tickets as &$tk) {
        $cnt = Database::fetchOne("SELECT COUNT(DISTINCT mittente) as cnt FROM email WHERE ticket_id = ? AND mittente NOT IN ('ticketing@stmdomotica.it','assistenzatecnica@stmdomotica.it','noreply@stmdomotica.it','admin@ticketing.local')", [$tk['id']]);
        $tk['partecipanti_count'] = $cnt ? (int)$cnt['cnt'] : 0;
        $msgCnt = Database::fetchOne('SELECT COUNT(*) as cnt FROM email WHERE ticket_id = ?', [$tk['id']]);
        $tk['messaggi_count'] = $msgCnt ? (int)$msgCnt['cnt'] : 0;
        $unread = Database::fetchOne("SELECT COUNT(*) as cnt FROM email WHERE ticket_id = ? AND letta = 0 AND direzione = 'inviata'", [$tk['id']]);
        $tk['has_unread'] = $unread && (int)$unread['cnt'] > 0;
    }
    Response::json($tickets);
});

// GET /api/tickets/client/:clienteId/:ticketId
$router->get('/tickets/client/:clienteId/:ticketId', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }
    $userEmail = $req->user['email'] ?? '';
    $ticket = Database::fetchOne(
        "SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email
         FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id
         WHERE t.id = ? AND t.cliente_id = ? AND (t.privato = 0 OR t.creatore_email = ?)",
        [$req->params['ticketId'], $req->params['clienteId'], $userEmail]
    );
    if (!$ticket) Response::error('Ticket non trovato', 404);
    // Mark admin replies as read when client opens ticket
    Database::execute("UPDATE email SET letta = 1 WHERE ticket_id = ? AND letta = 0 AND direzione = 'inviata'", [$ticket['id']]);
    $ticket['emails'] = Database::fetchAll(
        'SELECT * FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC',
        [$ticket['id']]
    );
    Response::json($ticket);
});

// GET /api/tickets/client/:clienteId/:ticketId/chat — list internal chat
$router->get('/tickets/client/:clienteId/:ticketId/chat', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) Response::error('Accesso non consentito', 403);
    $msgs = Database::fetchAll('SELECT * FROM chat_ticket_interna WHERE ticket_id = ? ORDER BY created_at ASC', [$req->params['ticketId']]);
    Response::json($msgs);
});

// POST /api/tickets/client/:clienteId/:ticketId/chat — send internal chat message
$router->post('/tickets/client/:clienteId/:ticketId/chat', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) Response::error('Accesso non consentito', 403);
    $messaggio = trim($req->body['messaggio'] ?? '');
    if (!$messaggio) Response::error('Messaggio obbligatorio', 400);

    $ticket = Database::fetchOne('SELECT t.*, c.email as cliente_email FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id WHERE t.id = ? AND t.cliente_id = ?',
        [$req->params['ticketId'], $req->params['clienteId']]);
    if (!$ticket) Response::error('Ticket non trovato', 404);

    Database::execute(
        'INSERT INTO chat_ticket_interna (ticket_id, utente_id, utente_nome, utente_email, messaggio) VALUES (?, ?, ?, ?, ?)',
        [$req->params['ticketId'], $req->user['id'], $req->user['nome'] ?? '', $req->user['email'] ?? '', $messaggio]
    );

    // Notify other client participants via email (noreply, NOT saved in thread)
    try {
        $systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local'];
        $senderEmail = strtolower($req->user['email'] ?? '');
        // Get all client users who participated in chat for this ticket
        $chatUsers = Database::fetchAll('SELECT DISTINCT utente_email FROM chat_ticket_interna WHERE ticket_id = ? AND utente_email != ?',
            [$req->params['ticketId'], $senderEmail]);
        // Also add ticket creator if different
        $addrs = [];
        foreach ($chatUsers as $cu) { if ($cu['utente_email']) $addrs[strtolower($cu['utente_email'])] = true; }
        if ($ticket['creatore_email'] && strtolower($ticket['creatore_email']) !== $senderEmail) {
            $addrs[strtolower($ticket['creatore_email'])] = true;
        }
        foreach ($systemAddrs as $sys) unset($addrs[$sys]);

        if (!empty($addrs)) {
            $destinatari = implode(', ', array_keys($addrs));
            $htmlMsg = nl2br(htmlspecialchars($messaggio));
            $emailHtml = Mailer::wrapEmailTemplate("<p><i>Un tuo collega ha aggiornato la chat del ticket <b>{$ticket['codice']}</b>:</i></p>
<div style=\"margin:12px 0;padding:12px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:4px\">{$htmlMsg}</div>
<p style=\"font-size:12px;color:#888;margin-top:8px\">Mittente: {$senderEmail}</p>
<br><p><b>Per rispondere alla chat vai sul portale.</b></p>");
            Mailer::sendNoreply($destinatari, "[TICKET #{$ticket['codice']}] Chat interna aggiornata", $emailHtml);
        }
    } catch (\Exception $e) {
        error_log('[MAIL] Errore invio chat interna: ' . $e->getMessage());
    }

    $msgs = Database::fetchAll('SELECT * FROM chat_ticket_interna WHERE ticket_id = ? ORDER BY created_at ASC', [$req->params['ticketId']]);
    Response::json($msgs);
});

// PUT /api/tickets/client/:clienteId/:ticketId/close
$router->put('/tickets/client/:clienteId/:ticketId/close', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }
    $ticket = Database::fetchOne(
        'SELECT * FROM ticket WHERE id = ? AND cliente_id = ?',
        [$req->params['ticketId'], $req->params['clienteId']]
    );
    if (!$ticket) Response::error('Ticket non trovato', 404);
    if ($ticket['stato'] === 'chiuso') Response::error('Ticket già chiuso', 400);

    Database::execute("UPDATE ticket SET stato = 'chiuso', updated_at = NOW() WHERE id = ?", [$ticket['id']]);
    Response::json(getTicketWithEmails($ticket['id']));
});

// POST /api/tickets/client/:clienteId/:ticketId/reply
$router->post('/tickets/client/:clienteId/:ticketId/reply', [Auth::class, 'authenticateClientToken'], function($req) {
    if ($req->user['cliente_id'] != $req->params['clienteId']) {
        Response::error('Accesso non consentito', 403);
    }
    $corpo = trim($req->body['corpo'] ?? '');
    if (!$corpo) Response::error('Il corpo del messaggio è obbligatorio', 400);

    $ticket = Database::fetchOne(
        'SELECT t.*, c.email as cliente_email FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id WHERE t.id = ? AND t.cliente_id = ?',
        [$req->params['ticketId'], $req->params['clienteId']]
    );
    if (!$ticket) Response::error('Ticket non trovato', 404);

    $threadId = "thread-{$ticket['codice']}";
    $oggetto = "Re: [TICKET #{$ticket['codice']}] {$ticket['oggetto']}";
    $ticketingAddr = MAIL_TICKETING_USER ?: 'ticketing@stmdomotica.it';
    $mittenteReale = $req->user['email'] ?: ($ticket['cliente_email'] ?: 'unknown@client.com');

    Database::execute(
        "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id) VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?)",
        [$mittenteReale, $ticketingAddr, $oggetto, $corpo, $req->params['clienteId'], $ticket['id'], $threadId]
    );

    if ($ticket['stato'] === 'in_attesa') {
        Database::execute("UPDATE ticket SET stato = 'in_lavorazione', updated_at = NOW() WHERE id = ?", [$ticket['id']]);
    } elseif (in_array($ticket['stato'], ['risolto', 'chiuso'])) {
        // Reopen: clear data_evasione (it's the resolution date, not a target)
        Database::execute("UPDATE ticket SET stato = 'aperto', data_evasione = NULL, updated_at = NOW() WHERE id = ?", [$ticket['id']]);
    }

    // Notification
    if ($ticket['assegnato_a']) {
        $isReopen = in_array($ticket['stato'], ['risolto', 'chiuso']);
        createNotifica(
            $ticket['assegnato_a'],
            $isReopen ? 'ticket_riaperto' : 'ticket_risposta',
            $isReopen ? "Ticket riaperto: {$ticket['codice']}" : "Risposta cliente: {$ticket['codice']}",
            $isReopen
                ? "Il cliente ha riaperto il ticket \"{$ticket['oggetto']}\""
                : "Il cliente ha risposto al ticket \"{$ticket['oggetto']}\"",
            "/admin/tickets/{$ticket['id']}"
        );
    }

    // Send email to all participants (other clients + admin/tecnici)
    try {
        $systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local'];
        $allEmails = Database::fetchAll('SELECT DISTINCT mittente, destinatario FROM email WHERE ticket_id = ?', [$ticket['id']]);
        $addrs = [];
        foreach ($allEmails as $row) {
            if ($row['destinatario']) foreach (explode(',', $row['destinatario']) as $a) $addrs[strtolower(trim($a))] = true;
            if ($row['mittente']) $addrs[strtolower(trim($row['mittente']))] = true;
        }
        // Add assigned technician + all admins
        if ($ticket['assegnato_a']) {
            $tecnico = Database::fetchOne('SELECT email FROM utenti WHERE id = ?', [$ticket['assegnato_a']]);
            if ($tecnico && $tecnico['email']) $addrs[strtolower($tecnico['email'])] = true;
        }
        $admins = Database::fetchAll("SELECT email FROM utenti WHERE ruolo = 'admin' AND attivo = 1");
        foreach ($admins as $adm) { if ($adm['email']) $addrs[strtolower($adm['email'])] = true; }
        // Remove system addresses and the sender
        foreach ($systemAddrs as $sys) unset($addrs[$sys]);
        unset($addrs[strtolower($mittenteReale)]);

        if (!empty($addrs)) {
            $destinatari = implode(', ', array_keys($addrs));
            $htmlCorpo = nl2br(htmlspecialchars($corpo));
            $emailSubject = "Re: [TICKET #{$ticket['codice']}] {$ticket['oggetto']}";
            $emailHtml = Mailer::wrapEmailTemplate("<p>Segui la risposta al tuo ticket su: <a href=\"https://www.stmdomotica.cloud/ticketing/client/tickets\">portale</a></p>
<br><p><i>Un tuo collega ha aggiornato il ticket, ecco il messaggio:</i></p>
<div style=\"margin:12px 0;padding:12px;background:#f7f7f7;border-left:3px solid #e6a700;border-radius:4px\">{$htmlCorpo}</div>
<p style=\"font-size:12px;color:#888;margin-top:8px\">Mittente: {$mittenteReale}</p>
<br><br><p>Puoi proseguire la discussione facendo reply a questa mail o dal portale.</p>");
            Mailer::sendTicketing($destinatari, $emailSubject, $emailHtml);
        }
    } catch (\Exception $e) {
        error_log('[MAIL] Errore invio notifica partecipanti: ' . $e->getMessage());
    }

    Response::json(getTicketWithEmails($ticket['id']));
});

// --- Admin routes ---

// GET /api/tickets
$router->get('/tickets', [Auth::class, 'authenticateToken'], function($req) {
    $isTecnico = ($req->user['ruolo'] ?? '') === 'tecnico';
    $userId = $req->user['id'];
    $page = (int)($req->query['page'] ?? 1) ?: 1;
    $limit = (int)($req->query['limit'] ?? 25) ?: 25;
    $offset = ($page - 1) * $limit;

    $where = ' WHERE 1=1';
    $params = [];

    if ($isTecnico) { $where .= ' AND t.assegnato_a = ?'; $params[] = $userId; }
    if (!empty($req->query['anno'])) { $where .= " AND YEAR(t.created_at) = ?"; $params[] = $req->query['anno']; }
    if (!empty($req->query['stato'])) {
        $stati = explode(',', $req->query['stato']);
        if (count($stati) === 1) { $where .= ' AND t.stato = ?'; $params[] = $stati[0]; }
        else { $where .= ' AND t.stato IN (' . implode(',', array_fill(0, count($stati), '?')) . ')'; $params = array_merge($params, $stati); }
    }
    if (!empty($req->query['priorita'])) { $where .= ' AND t.priorita = ?'; $params[] = $req->query['priorita']; }
    if (!empty($req->query['cliente_id'])) { $where .= ' AND t.cliente_id = ?'; $params[] = $req->query['cliente_id']; }
    if (!empty($req->query['assegnato_a'])) { $where .= ' AND t.assegnato_a = ?'; $params[] = $req->query['assegnato_a']; }
    if (!empty($req->query['search'])) {
        $where .= ' AND (t.oggetto LIKE ? OR t.codice LIKE ? OR t.descrizione LIKE ?)';
        $s = '%' . $req->query['search'] . '%';
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
    }

    $total = Database::fetchOne("SELECT COUNT(*) as total FROM ticket t{$where}", $params)['total'];

    // Counts per stato (without stato filter)
    $whereNoStato = ' WHERE 1=1';
    $paramsNoStato = [];
    if ($isTecnico) { $whereNoStato .= ' AND t.assegnato_a = ?'; $paramsNoStato[] = $userId; }
    if (!empty($req->query['anno'])) { $whereNoStato .= " AND YEAR(t.created_at) = ?"; $paramsNoStato[] = $req->query['anno']; }
    if (!empty($req->query['priorita'])) { $whereNoStato .= ' AND t.priorita = ?'; $paramsNoStato[] = $req->query['priorita']; }
    if (!empty($req->query['cliente_id'])) { $whereNoStato .= ' AND t.cliente_id = ?'; $paramsNoStato[] = $req->query['cliente_id']; }
    if (!empty($req->query['assegnato_a'])) { $whereNoStato .= ' AND t.assegnato_a = ?'; $paramsNoStato[] = $req->query['assegnato_a']; }
    if (!empty($req->query['search'])) {
        $whereNoStato .= ' AND (t.oggetto LIKE ? OR t.codice LIKE ? OR t.descrizione LIKE ?)';
        $s = '%' . $req->query['search'] . '%';
        $paramsNoStato[] = $s; $paramsNoStato[] = $s; $paramsNoStato[] = $s;
    }
    $statoRows = Database::fetchAll("SELECT t.stato, COUNT(*) as cnt FROM ticket t{$whereNoStato} GROUP BY t.stato", $paramsNoStato);
    $statoCounts = [];
    $totalAll = 0;
    foreach ($statoRows as $r) { $statoCounts[$r['stato']] = (int)$r['cnt']; $totalAll += (int)$r['cnt']; }

    $dataParams = array_merge($params, [$limit, $offset]);
    $data = Database::fetchAll(
        "SELECT t.*, c.nome_azienda as cliente_nome, c.sla_reazione, u.nome as assegnato_nome
         FROM ticket t
         LEFT JOIN clienti c ON t.cliente_id = c.id
         LEFT JOIN utenti u ON t.assegnato_a = u.id
         {$where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?",
        $dataParams
    );

    Response::json([
        'data' => $data,
        'total' => (int)$total,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => (int)ceil($total / $limit),
        'statoCounts' => $statoCounts,
        'totalAll' => $totalAll,
    ]);
});

// GET /api/tickets/:id
$router->get('/tickets/:id', [Auth::class, 'authenticateToken'], function($req) {
    $ticket = Database::fetchOne(
        "SELECT t.*, c.nome_azienda as cliente_nome, c.email as cliente_email,
                c.telefono as cliente_telefono, c.referente as cliente_referente,
                u.nome as assegnato_nome
         FROM ticket t
         LEFT JOIN clienti c ON t.cliente_id = c.id
         LEFT JOIN utenti u ON t.assegnato_a = u.id
         WHERE t.id = ?",
        [$req->params['id']]
    );
    if (!$ticket) Response::error('Ticket non trovato', 404);

    // IDOR protection: tecnico can only see tickets assigned to them
    if (($req->user['ruolo'] ?? '') === 'tecnico' && $ticket['assegnato_a'] != $req->user['id']) {
        Response::error('Accesso non consentito', 403);
    }

    // Mark as read
    if (!$ticket['letta']) {
        Database::execute('UPDATE ticket SET letta = 1 WHERE id = ?', [$req->params['id']]);
        $ticket['letta'] = 1;
    }

    $ticket['emails'] = Database::fetchAll(
        'SELECT * FROM email WHERE ticket_id = ? ORDER BY data_ricezione ASC',
        [$ticket['id']]
    );
    $ticket['note'] = Database::fetchAll(
        "SELECT n.*, u.nome as utente_nome FROM note_interne n
         LEFT JOIN utenti u ON n.utente_id = u.id WHERE n.ticket_id = ? ORDER BY n.created_at ASC",
        [$ticket['id']]
    );
    $ticket['schede_count'] = (int)Database::fetchOne(
        'SELECT COUNT(*) as c FROM schede_cliente WHERE cliente_id = ?',
        [$ticket['cliente_id']]
    )['c'];

    Response::json($ticket);
});

// POST /api/tickets — create (client auth, with optional attachments)
$router->post('/tickets', [Auth::class, 'authenticateClientToken'], function($req) {
    $oggetto = $req->body['oggetto'] ?? '';
    $descrizione = $req->body['descrizione'] ?? '';
    $categoria = $req->body['categoria'] ?? '';
    $priorita = $req->body['priorita'] ?? 'media';
    $clienteId = $req->user['cliente_id'];

    if (!$oggetto || !$categoria) {
        Response::error('Campi obbligatori: oggetto, categoria', 400);
    }

    $codice = generateTicketCode();
    $admin = Database::fetchOne("SELECT id FROM utenti WHERE ruolo='admin' AND attivo=1 LIMIT 1");
    $assegnatoA = $admin ? $admin['id'] : null;
    $creatoreEmail = $req->user['email'] ?? null;

    $privato = !empty($req->body['privato']) ? 1 : 0;

    Database::execute(
        'INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, assegnato_a, creatore_email, privato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$codice, $clienteId, $oggetto, $descrizione, $categoria, $priorita, $assegnatoA, $creatoreEmail, $privato]
    );
    $ticketId = Database::lastInsertId();

    // Handle file attachments
    $allegati = [];
    $files = Upload::handleMultiple('allegati', UPLOAD_DIR . '/tickets', [
        'maxSize' => 10 * 1024 * 1024,
        'allowedExts' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'xlsx', 'zip'],
    ]);
    foreach ($files as $f) {
        $allegati[] = [
            'nome' => $f['nome_originale'],
            'file' => $f['nome_file'],
            'dimensione' => $f['dimensione'],
        ];
    }

    $cliente = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$clienteId]);
    $catLabel = ['assistenza' => 'Assistenza', 'bug' => 'Bug', 'richiesta_info' => 'Richiesta Info', 'altro' => 'Altro'];
    $emailOggetto = "[TICKET #{$codice}] [" . ($catLabel[$categoria] ?? $categoria) . "] {$oggetto} — Cliente: " . ($cliente ? $cliente['nome_azienda'] : 'N/A');

    $ticketingAddr = MAIL_TICKETING_USER ?: 'ticketing@stmdomotica.it';

    // Send confirmation email via noreply
    $sentMessageId = null;
    $destinatarioConferma = $creatoreEmail ?: ($cliente ? $cliente['email'] : null);
    if ($destinatarioConferma) {
        try {
            $utenteCliente = Database::fetchOne('SELECT lingua FROM utenti_cliente WHERE email = ?', [$creatoreEmail]);
            $lingua = ($utenteCliente && $utenteCliente['lingua']) ? $utenteCliente['lingua'] : 'it';

            $descEscaped = htmlspecialchars($descrizione ?: $oggetto);
            $msgLabel = $lingua === 'en' ? 'Your message' : ($lingua === 'fr' ? 'Votre message' : 'Il tuo messaggio');
            $ticketBox = "<div style=\"background:#f0f4f8;border:1px solid #d0d7de;border-radius:8px;padding:16px;margin:16px 0\">
<p style=\"font-size:12px;color:#666;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:600\">{$msgLabel}</p>
<p style=\"font-size:13px;color:#333;margin:0;white-space:pre-wrap\">{$descEscaped}</p>
</div>";

            $itBlock = "<p>Gentile cliente,</p>
<p>abbiamo ricevuto il suo ticket <b>{$codice}</b>.</p>
" . ($lingua === 'it' ? $ticketBox : '') . "
<p>I nostri tecnici lo elaboreranno appena possibile nel rispetto dei tempi previsti dal suo contratto.</p>
<p>Riceverà risposta sul nostro portale e direttamente nella sua mail.</p>
<p>Distinti Saluti.</p>";

            $enBlock = "<p>Dear customer,</p>
<p>we have received your ticket <b>{$codice}</b>.</p>
" . ($lingua === 'en' ? $ticketBox : '') . "
<p>Our technicians will process it as soon as possible in accordance with the terms of your contract.</p>
<p>You will receive a response on our portal and directly in your email.</p>
<p>Best regards.</p>";

            $frBlock = "<p>Cher client,</p>
<p>nous avons bien reçu votre ticket <b>{$codice}</b>.</p>
" . ($lingua === 'fr' ? $ticketBox : '') . "
<p>Nos techniciens le traiteront dans les meilleurs délais, conformément aux conditions de votre contrat.</p>
<p>Vous recevrez une réponse sur notre portail et directement par e-mail.</p>
<p>Cordialement.</p>";

            if ($lingua === 'en') {
                $primaryBlock = $enBlock;
                $secondaryBlock = "<div style=\"color:#888\">{$itBlock}</div>";
            } elseif ($lingua === 'fr') {
                $primaryBlock = $frBlock;
                $secondaryBlock = "<div style=\"color:#888\">{$itBlock}</div>";
            } else {
                $primaryBlock = $itBlock;
                $secondaryBlock = "<div style=\"color:#888\">{$enBlock}</div>";
            }

            $confermaOggetto = "[TICKET #{$codice}] " . ($lingua === 'en' ? 'Confirmation of receipt' : ($lingua === 'fr' ? 'Confirmation de réception' : 'Conferma ricezione'));
            $confermaHtml = Mailer::wrapEmailTemplate("{$primaryBlock}
<hr style=\"margin:20px 0;border:none;border-top:1px solid #ccc\">
{$secondaryBlock}");
            $sentMessageId = Mailer::sendNoreply($destinatarioConferma, $confermaOggetto, $confermaHtml);
        } catch (\Exception $e) {
            error_log('[MAIL] Errore invio conferma ticket: ' . $e->getMessage());
        }
    }

    // Notify admin via noreply email
    try {
        $adminUsers = Database::fetchAll("SELECT email FROM utenti WHERE ruolo = 'admin' AND attivo = 1");
        if ($adminUsers) {
            $adminEmails = implode(',', array_column($adminUsers, 'email'));
            $priLabel = ['urgente' => 'URGENTE', 'alta' => 'Alta', 'media' => 'Media', 'bassa' => 'Bassa'];
            $descPreview = mb_substr($descrizione ?: '(nessuna descrizione)', 0, 300);

            $adminHtml = Mailer::wrapEmailTemplate("
<p><b>Nuovo ticket aperto da un cliente</b></p>
<table style=\"width:100%;border-collapse:collapse;font-size:13px;margin:12px 0\">
<tr><td style=\"padding:6px 12px;background:#f0f4f8;font-weight:600;width:130px\">Codice</td><td style=\"padding:6px 12px\">{$codice}</td></tr>
<tr><td style=\"padding:6px 12px;background:#f0f4f8;font-weight:600\">Cliente</td><td style=\"padding:6px 12px\">" . ($cliente ? htmlspecialchars($cliente['nome_azienda']) : 'N/A') . "</td></tr>
<tr><td style=\"padding:6px 12px;background:#f0f4f8;font-weight:600\">Aperto da</td><td style=\"padding:6px 12px\">" . htmlspecialchars($creatoreEmail ?: 'N/A') . "</td></tr>
<tr><td style=\"padding:6px 12px;background:#f0f4f8;font-weight:600\">Categoria</td><td style=\"padding:6px 12px\">" . ($catLabel[$categoria] ?? $categoria) . "</td></tr>
<tr><td style=\"padding:6px 12px;background:#f0f4f8;font-weight:600\">Priorità</td><td style=\"padding:6px 12px\">" . ($priLabel[$priorita] ?? $priorita) . "</td></tr>
<tr><td style=\"padding:6px 12px;background:#f0f4f8;font-weight:600\">Oggetto</td><td style=\"padding:6px 12px\">" . htmlspecialchars($oggetto) . "</td></tr>
</table>
<div style=\"background:#f0f4f8;border:1px solid #d0d7de;border-radius:8px;padding:16px;margin:12px 0\">
<p style=\"font-size:12px;color:#666;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:600\">Descrizione</p>
<p style=\"font-size:13px;color:#333;margin:0;white-space:pre-wrap\">" . htmlspecialchars($descPreview) . "</p>
</div>
<p style=\"margin-top:16px\"><a href=\"https://www.stmdomotica.cloud/ticketing/admin/tickets/{$ticketId}\" style=\"background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600\">Apri Ticket nel Pannello</a></p>");

            Mailer::sendNoreply($adminEmails, "[TICKET #{$codice}] Nuovo ticket: {$oggetto}", $adminHtml);
        }
    } catch (\Exception $e) {
        error_log('[MAIL] Errore notifica admin nuovo ticket: ' . $e->getMessage());
    }

    // Save email record
    Database::execute(
        "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id, message_id, allegati) VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $creatoreEmail ?: ($cliente ? $cliente['email'] : 'unknown@client.com'),
            $ticketingAddr, $emailOggetto, $descrizione, $clienteId, $ticketId,
            "thread-{$codice}", $sentMessageId, json_encode($allegati)
        ]
    );

    $newTicket = Database::fetchOne('SELECT * FROM ticket WHERE id = ?', [$ticketId]);
    Response::created($newTicket);
});

// POST /api/tickets/from-email/:emailId — crea ticket a partire da una mail (admin only)
$router->post('/tickets/from-email/:emailId', [Auth::class, 'authenticateToken'], [Auth::class, 'requireAdmin'], function($req) {
    $emailId = (int)$req->params['emailId'];
    $email = Database::fetchOne('SELECT * FROM email WHERE id = ?', [$emailId]);
    if (!$email) Response::error('Email non trovata', 404);
    if ($email['tipo'] === 'ticket' && $email['ticket_id']) {
        Response::error('Questa email è già collegata a un ticket', 400);
    }

    $clienteId = (int)($req->body['cliente_id'] ?? 0);
    if (!$clienteId) Response::error('cliente_id obbligatorio', 400);
    $oggetto = trim($req->body['oggetto'] ?? ($email['oggetto'] ?? ''));
    $descrizione = $req->body['descrizione'] ?? ($email['corpo'] ?? '');
    $categoria = $req->body['categoria'] ?? 'altro';
    $priorita = $req->body['priorita'] ?? 'media';
    $utentePortaleId = !empty($req->body['utente_portale_id']) ? (int)$req->body['utente_portale_id'] : null;
    if (!$oggetto) Response::error('oggetto obbligatorio', 400);

    $cliente = Database::fetchOne('SELECT * FROM clienti WHERE id = ?', [$clienteId]);
    if (!$cliente) Response::error('Cliente non trovato', 404);

    $codice = generateTicketCode();
    $admin = Database::fetchOne("SELECT id FROM utenti WHERE ruolo='admin' AND attivo=1 LIMIT 1");
    $assegnatoA = $admin ? (int)$admin['id'] : null;
    $creatoreEmail = $email['mittente'] ?? null;

    Database::execute(
        'INSERT INTO ticket (codice, cliente_id, oggetto, descrizione, categoria, priorita, assegnato_a, creatore_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$codice, $clienteId, $oggetto, $descrizione, $categoria, $priorita, $assegnatoA, $creatoreEmail]
    );
    $ticketId = (int)Database::lastInsertId();
    // NB: la mail sorgente resta intatta nell'inbox. La descrizione del ticket diventa il primo messaggio del thread (mittente = creatore_email). Le risposte del cliente al subject [TICKET #...] verranno auto-agganciate dal cron IMAP su ticketing@.

    // Auto-reply al mittente da ticketing@
    if ($creatoreEmail) {
        $subjectReply = "[TICKET #{$codice}] Re: {$oggetto}";
        $content = '<p>Gentile Cliente,</p>' .
            "<p>abbiamo aperto il ticket <strong>{$codice}</strong> per la tua richiesta.</p>" .
            '<p>Per proseguire puoi <strong>accedere al portale</strong> o <strong>rispondere a questa mail</strong>.</p>' .
            '<p>Ci occuperemo della tua richiesta nel più breve tempo possibile.</p>' .
            '<p>Cordiali saluti,<br>Assistenza STM Domotica</p>';
        try { Mailer::sendTicketing($creatoreEmail, $subjectReply, Mailer::wrapEmailTemplate($content)); } catch (\Throwable $e) { error_log('[from-email] auto-reply fail: ' . $e->getMessage()); }
    }

    // Notifica utente portale (opzionale)
    if ($utentePortaleId) {
        $portalUser = Database::fetchOne('SELECT id, email FROM utenti_cliente WHERE id = ? AND cliente_id = ?', [$utentePortaleId, $clienteId]);
        if ($portalUser) {
            $mittenteMsg = $creatoreEmail ?: 'email diretta';
            $content = "<p>Ciao,</p>" .
                "<p>è stato aperto un nuovo ticket <strong>{$codice}</strong> originato da <strong>{$mittenteMsg}</strong>.</p>" .
                "<p>Oggetto: <em>{$oggetto}</em></p>" .
                "<p>Accedi al portale per seguirne l'evoluzione.</p>";
            try { Mailer::sendTicketing($portalUser['email'], "Nuovo ticket {$codice}", Mailer::wrapEmailTemplate($content)); } catch (\Throwable $e) { error_log('[from-email] portal notify fail: ' . $e->getMessage()); }
        }
    }

    $ticket = Database::fetchOne('SELECT * FROM ticket WHERE id = ?', [$ticketId]);
    Response::json(['ticket' => $ticket, 'codice' => $codice]);
});

// PUT /api/tickets/:id
$router->put('/tickets/:id', [Auth::class, 'authenticateToken'], function($req) {
    $id = $req->params['id'];
    $ticket = Database::fetchOne('SELECT * FROM ticket WHERE id = ?', [$id]);
    if (!$ticket) Response::error('Ticket non trovato', 404);

    $stato = $req->body['stato'] ?? null;
    $priorita = $req->body['priorita'] ?? null;
    $assegnatoA = array_key_exists('assegnato_a', $req->body) ? $req->body['assegnato_a'] : null;
    $progettoId = array_key_exists('progetto_id', $req->body) ? $req->body['progetto_id'] : null;

    // Only client can close tickets — admin/tecnico cannot set "chiuso"
    if ($stato === 'chiuso') {
        Response::error('Solo il cliente può chiudere un ticket', 403);
    }

    // Auto "in_lavorazione" when assigning a technician (if ticket is still "aperto")
    $effectiveStato = $stato;
    if (!$stato && $assegnatoA !== null && $ticket['stato'] === 'aperto') {
        $effectiveStato = 'in_lavorazione';
    }

    Database::execute(
        'UPDATE ticket SET stato = COALESCE(?, stato), priorita = COALESCE(?, priorita), assegnato_a = COALESCE(?, assegnato_a), progetto_id = COALESCE(?, progetto_id), updated_at = NOW() WHERE id = ?',
        [$effectiveStato, $priorita, $assegnatoA, $progettoId, $id]
    );

    // Set data_evasione when resolved (if not already set)
    if ($stato === 'risolto' && empty($ticket['data_evasione'])) {
        Database::execute('UPDATE ticket SET data_evasione = CURDATE() WHERE id = ?', [$id]);
    }

    // Clear data_evasione when reopened
    if ($stato === 'aperto' && in_array($ticket['stato'], ['risolto', 'chiuso'])) {
        Database::execute('UPDATE ticket SET data_evasione = NULL WHERE id = ?', [$id]);
    }

    // Notification: assignment changed
    if ($assegnatoA !== null && $assegnatoA != $ticket['assegnato_a']) {
        createNotifica(
            $assegnatoA,
            'ticket_assegnato',
            "Ticket assegnato: {$ticket['codice']}",
            "Ti è stato assegnato il ticket \"{$ticket['oggetto']}\"",
            "/admin/tickets/{$ticket['id']}"
        );
    }

    // Notification: status changed
    if ($stato && $stato !== $ticket['stato'] && $ticket['assegnato_a']) {
        $targetUser = ($assegnatoA !== null) ? $assegnatoA : $ticket['assegnato_a'];
        if (!($assegnatoA !== null && $assegnatoA != $ticket['assegnato_a'] && $targetUser == $assegnatoA)) {
            createNotifica(
                $targetUser,
                'ticket_stato',
                "Stato ticket aggiornato: {$ticket['codice']}",
                "Lo stato del ticket \"{$ticket['oggetto']}\" è cambiato in \"{$stato}\"",
                "/admin/tickets/{$ticket['id']}"
            );
        }
    }

    $updated = Database::fetchOne(
        "SELECT t.*, c.nome_azienda as cliente_nome, c.sla_reazione, u.nome as assegnato_nome
         FROM ticket t LEFT JOIN clienti c ON t.cliente_id = c.id LEFT JOIN utenti u ON t.assegnato_a = u.id WHERE t.id = ?",
        [$id]
    );
    Response::json($updated);
});

// POST /api/tickets/:id/notes
$router->post('/tickets/:id/notes', [Auth::class, 'authenticateToken'], function($req) {
    $testo = trim($req->body['testo'] ?? '');
    $salvaInKb = !empty($req->body['salva_in_kb']);
    if (!$testo) Response::error('Il testo della nota è obbligatorio', 400);

    $ticket = Database::fetchOne('SELECT id, assegnato_a, cliente_id, codice, oggetto FROM ticket WHERE id = ?', [$req->params['id']]);
    if (!$ticket) Response::error('Ticket non trovato', 404);

    // IDOR protection: tecnico can only add notes to assigned tickets
    if (($req->user['ruolo'] ?? '') === 'tecnico' && $ticket['assegnato_a'] != $req->user['id']) {
        Response::error('Accesso non consentito', 403);
    }

    Database::execute(
        'INSERT INTO note_interne (ticket_id, utente_id, testo) VALUES (?, ?, ?)',
        [$req->params['id'], $req->user['id'], $testo]
    );

    // Auto "in_lavorazione" when adding a note to an "aperto" ticket
    $ticketState = Database::fetchOne('SELECT stato FROM ticket WHERE id = ?', [$req->params['id']]);
    if ($ticketState && $ticketState['stato'] === 'aperto') {
        Database::execute("UPDATE ticket SET stato = 'in_lavorazione', updated_at = NOW() WHERE id = ?", [$req->params['id']]);
    }

    // Save to KB if flag is set
    if ($salvaInKb && $ticket['cliente_id']) {
        $titolo = "Nota {$ticket['codice']} — {$ticket['oggetto']}";
        Database::execute(
            'INSERT INTO schede_cliente (cliente_id, titolo, contenuto) VALUES (?, ?, ?)',
            [$ticket['cliente_id'], $titolo, $testo]
        );
    }

    $note = Database::fetchOne(
        "SELECT n.*, u.nome as utente_nome FROM note_interne n
         LEFT JOIN utenti u ON n.utente_id = u.id WHERE n.id = ?",
        [Database::lastInsertId()]
    );
    Response::created($note);
});
