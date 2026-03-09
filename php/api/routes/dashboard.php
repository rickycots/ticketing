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
