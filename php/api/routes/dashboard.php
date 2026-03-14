<?php
/**
 * Dashboard routes — GET /api/dashboard, GET /api/dashboard/sidebar-counts
 */

// GET /api/dashboard
$router->get('/dashboard', [Auth::class, 'authenticateToken'], function($req) {
    $isTecnico = ($req->user['ruolo'] ?? '') === 'tecnico';
    $userId = $req->user['id'];
    $ticketFilter = $isTecnico ? ' AND assegnato_a = ?' : '';
    $ticketParams = $isTecnico ? [$userId] : [];

    // Open tickets
    $ticketAperti = Database::fetchOne(
        "SELECT COUNT(*) as count FROM ticket WHERE stato IN ('aperto', 'in_lavorazione', 'in_attesa'){$ticketFilter}",
        $ticketParams
    );

    // Urgent tickets
    $ticketUrgenti = Database::fetchAll(
        "SELECT * FROM ticket WHERE stato IN ('aperto', 'in_lavorazione') AND priorita IN ('urgente', 'alta'){$ticketFilter} ORDER BY created_at DESC LIMIT 5",
        $ticketParams
    );

    // Active projects
    $progettiAttivi = Database::fetchOne("SELECT COUNT(*) as count FROM progetti WHERE stato = 'attivo'");

    // Projects blocked by client
    $progettiBloccoCliente = Database::fetchOne("SELECT COUNT(*) as count FROM progetti WHERE stato = 'attivo' AND blocco = 'lato_cliente'");

    // Unread emails
    $emailNonLette = $isTecnico
        ? ['count' => 0]
        : Database::fetchOne("SELECT COUNT(*) as count FROM email WHERE letta = 0 AND tipo != 'ticket'");

    // Upcoming deadlines (7 days)
    $scadenzeFilter = $isTecnico ? ' AND a.assegnato_a = ?' : '';
    $scadenzeParams = $isTecnico ? [$userId] : [];
    $scadenze = Database::fetchAll(
        "SELECT a.*, p.nome as progetto_nome, u.nome as assegnato_nome
         FROM attivita a
         LEFT JOIN progetti p ON a.progetto_id = p.id
         LEFT JOIN utenti u ON a.assegnato_a = u.id
         WHERE a.data_scadenza IS NOT NULL
           AND a.stato != 'completata'
           AND a.data_scadenza <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
           AND a.data_scadenza >= CURDATE()
           {$scadenzeFilter}
         ORDER BY a.data_scadenza ASC
         LIMIT 10",
        $scadenzeParams
    );

    // Workload per technician
    $caricoTecnici = Database::fetchAll(
        "SELECT u.id, u.nome,
            (SELECT COUNT(*) FROM ticket t WHERE t.assegnato_a = u.id AND t.stato IN ('aperto', 'in_lavorazione')) as ticket_attivi,
            (SELECT COUNT(*) FROM attivita a WHERE a.assegnato_a = u.id AND a.stato IN ('da_fare', 'in_corso')) as attivita_attive
         FROM utenti u
         WHERE u.attivo = 1
         ORDER BY u.nome"
    );

    // Tickets by status
    $ticketPerStato = Database::fetchAll(
        "SELECT stato, COUNT(*) as count FROM ticket WHERE 1=1{$ticketFilter} GROUP BY stato",
        $ticketParams
    );

    // Recent tickets
    $recentFilter = $isTecnico ? ' AND t.assegnato_a = ?' : '';
    $ticketRecenti = Database::fetchAll(
        "SELECT t.*, c.nome_azienda as cliente_nome
         FROM ticket t
         LEFT JOIN clienti c ON t.cliente_id = c.id
         WHERE 1=1{$recentFilter}
         ORDER BY t.created_at DESC
         LIMIT 5",
        $ticketParams
    );

    Response::json([
        'ticket_aperti' => (int)$ticketAperti['count'],
        'ticket_urgenti' => $ticketUrgenti,
        'progetti_attivi' => (int)$progettiAttivi['count'],
        'progetti_blocco_cliente' => (int)$progettiBloccoCliente['count'],
        'email_non_lette' => (int)$emailNonLette['count'],
        'scadenze_imminenti' => $scadenze,
        'carico_tecnici' => $caricoTecnici,
        'ticket_per_stato' => $ticketPerStato,
        'ticket_recenti' => $ticketRecenti,
    ]);
});

// GET /api/dashboard/client/:clienteId — client-specific dashboard stats (admin only)
$router->get('/dashboard/client/:clienteId', [Auth::class, 'authenticateToken'], function($req) {
    if (($req->user['ruolo'] ?? '') !== 'admin') Response::error('Solo admin', 403);
    $clienteId = $req->params['clienteId'];

    $cliente = Database::fetchOne('SELECT id, nome_azienda, email, telefono, referente FROM clienti WHERE id = ?', [$clienteId]);
    if (!$cliente) Response::error('Cliente non trovato', 404);

    // Ticket stats
    $ticketTotali = (int)Database::fetchOne('SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ?', [$clienteId])['count'];
    $ticketAperti = (int)Database::fetchOne("SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ? AND stato IN ('aperto','in_lavorazione','in_attesa')", [$clienteId])['count'];
    $ticketChiusi = (int)Database::fetchOne("SELECT COUNT(*) as count FROM ticket WHERE cliente_id = ? AND stato IN ('risolto','chiuso')", [$clienteId])['count'];

    // Average ticket handling time
    $tempoMedio = Database::fetchOne(
        "SELECT AVG(DATEDIFF(updated_at, created_at)) as avg_days FROM ticket WHERE cliente_id = ? AND stato IN ('risolto','chiuso')",
        [$clienteId]
    );
    $tempoMedioTicket = $tempoMedio['avg_days'] ? round((float)$tempoMedio['avg_days'], 1) : null;

    // Email stats
    $emailTotali = (int)Database::fetchOne(
        'SELECT COUNT(*) as count FROM email e JOIN ticket t ON e.ticket_id = t.id WHERE t.cliente_id = ?',
        [$clienteId]
    )['count'];
    $emailAssegnate = (int)Database::fetchOne(
        'SELECT COUNT(*) as count FROM email e JOIN ticket t ON e.ticket_id = t.id WHERE t.cliente_id = ? AND e.ticket_id IS NOT NULL',
        [$clienteId]
    )['count'];
    $emailNonAssegnate = (int)Database::fetchOne(
        "SELECT COUNT(*) as count FROM email e LEFT JOIN ticket t ON e.ticket_id = t.id WHERE (t.cliente_id = ? OR e.tipo = 'email_cliente') AND e.ticket_id IS NULL",
        [$clienteId]
    )['count'];

    // Project stats (compute status dynamically)
    $allProjects = Database::fetchAll('SELECT id FROM progetti WHERE cliente_id = ?', [$clienteId]);
    $progettiTotali = count($allProjects);
    $progettiAttivi = 0; $progettiChiusi = 0; $progettiBloccati = 0; $progettiSenzaAttivita = 0;
    foreach ($allProjects as $p) {
        $att = Database::fetchAll('SELECT stato FROM attivita WHERE progetto_id = ?', [$p['id']]);
        if (empty($att)) { $progettiSenzaAttivita++; continue; }
        $stati = array_column($att, 'stato');
        if (count(array_filter($stati, fn($s) => $s === 'completata')) === count($stati)) { $progettiChiusi++; continue; }
        if (in_array('bloccata', $stati)) { $progettiBloccati++; continue; }
        $progettiAttivi++;
    }

    // Average activity duration
    $tempoAtt = Database::fetchOne(
        "SELECT AVG(DATEDIFF(a.data_scadenza, a.data_inizio)) as avg_days
         FROM attivita a JOIN progetti p ON a.progetto_id = p.id
         WHERE p.cliente_id = ? AND a.stato = 'completata' AND a.data_inizio IS NOT NULL AND a.data_scadenza IS NOT NULL",
        [$clienteId]
    );
    $tempoMedioAttivita = $tempoAtt['avg_days'] ? round((float)$tempoAtt['avg_days'], 1) : null;

    // Recent tickets
    $ticketRecenti = Database::fetchAll(
        'SELECT id, codice, oggetto, stato, priorita, created_at FROM ticket WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 5',
        [$clienteId]
    );

    Response::json([
        'cliente' => $cliente,
        'ticket' => ['totali' => $ticketTotali, 'aperti' => $ticketAperti, 'chiusi' => $ticketChiusi],
        'tempo_medio_ticket' => $tempoMedioTicket,
        'email' => ['totali' => $emailTotali, 'assegnate' => $emailAssegnate, 'non_assegnate' => $emailNonAssegnate],
        'progetti' => ['totali' => $progettiTotali, 'attivi' => $progettiAttivi, 'chiusi' => $progettiChiusi, 'bloccati' => $progettiBloccati, 'senza_attivita' => $progettiSenzaAttivita],
        'tempo_medio_attivita' => $tempoMedioAttivita,
        'ticket_recenti' => $ticketRecenti,
    ]);
});

// GET /api/dashboard/sidebar-counts
$router->get('/dashboard/sidebar-counts', [Auth::class, 'authenticateToken'], function($req) {
    $isTecnico = ($req->user['ruolo'] ?? '') === 'tecnico';
    $userId = $req->user['id'];

    if ($isTecnico) {
        $ticketCount = Database::fetchOne(
            "SELECT COUNT(*) as count FROM ticket WHERE letta = 0 AND assegnato_a = ?",
            [$userId]
        )['count'];
    } else {
        $ticketCount = Database::fetchOne(
            "SELECT COUNT(*) as count FROM ticket WHERE letta = 0"
        )['count'];
    }

    $emailCount = 0;
    if (!$isTecnico) {
        $emailCount = Database::fetchOne(
            "SELECT COUNT(*) as count FROM email WHERE letta = 0 AND tipo != 'ticket'"
        )['count'];
    }

    Response::json([
        'tickets_nuovi' => (int)$ticketCount,
        'email_nuove' => (int)$emailCount,
    ]);
});
