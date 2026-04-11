<?php
/**
 * IMAP Email Poller — Cron script
 * Polls ticketing@ and assistenzatecnica@ IMAP mailboxes for new emails
 *
 * Setup on Aruba cron (every 10 minutes):
 *   /usr/bin/php /path/to/poll_emails.php
 *
 * Or via web with key:
 *   https://www.stmdomotica.it/cloud/ticketing/api/cron/poll_emails.php?key=YOUR_JWT_SECRET
 */

set_time_limit(120);

// When called internally (from CronRunner), config and Database are already loaded
$isInternal = defined('JWT_SECRET');
if (!$isInternal) {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../core/Database.php';
}

// Security: require JWT_SECRET as key parameter (web) or CLI or internal call
$isCli = php_sapi_name() === 'cli';
if (!$isCli && !$isInternal) {
    $key = $_GET['key'] ?? '';
    if ($key !== JWT_SECRET) {
        http_response_code(403);
        die(json_encode(['error' => 'Accesso negato']));
    }
    header('Content-Type: text/plain; charset=utf-8');
}

// Ticket code pattern: [TICKET #TK-YYYY-NNNN]
define('TICKET_CODE_RE', '/\[TICKET\s*#(TK-\d{4}-\d{4})\]/i');

// Communication tag pattern: [COMM slug]
define('COMM_TAG_RE', '/\[COMM\s+([a-z0-9-]+)\]/i');

// Project/Activity tag pattern: [PRJ-123 ACT-456] or [PRJ-123]
define('PRJ_TAG_RE', '/\[PRJ-(\d+)(?:\s+ACT-(\d+))?\]/i');

function logMsg(string $msg): void {
    $ts = date('Y-m-d H:i:s');
    echo "[{$ts}] {$msg}\n";
    if (php_sapi_name() !== 'cli') ob_flush();
}

/**
 * Find client ID by sender email
 */
function findClienteByEmail(string $email): ?int {
    $cliente = Database::fetchOne('SELECT id FROM clienti WHERE email = ?', [$email]);
    if ($cliente) return (int)$cliente['id'];

    $utente = Database::fetchOne('SELECT cliente_id FROM utenti_cliente WHERE email = ?', [$email]);
    if ($utente) return (int)$utente['cliente_id'];

    $referente = Database::fetchOne('SELECT cliente_id FROM referenti_progetto WHERE email = ?', [$email]);
    if ($referente) return (int)$referente['cliente_id'];

    return null;
}

/**
 * Check if message_id already exists in email table
 */
function messageExists(?string $messageId): bool {
    if (!$messageId) return false;
    $row = Database::fetchOne('SELECT id FROM email WHERE message_id = ?', [$messageId]);
    return (bool)$row;
}

/**
 * Check if message_id already exists in comunicazioni_cliente
 */
function comunicazioneExists(?string $messageId): bool {
    if (!$messageId) return false;
    $row = Database::fetchOne('SELECT id FROM comunicazioni_cliente WHERE message_id = ?', [$messageId]);
    return (bool)$row;
}

/**
 * Connect to IMAP mailbox and fetch unseen messages
 * Uses PHP's native IMAP extension
 */
function pollMailbox(string $user, string $pass, callable $handler): void {
    if (!$user || !$pass) return;

    if (!function_exists('imap_open')) {
        logMsg("[IMAP] Estensione php-imap non disponibile. Installare php-imap.");
        return;
    }

    $mailbox = '{' . MAIL_IMAP_HOST . ':' . MAIL_IMAP_PORT . '/imap/ssl}INBOX';

    $inbox = @imap_open($mailbox, $user, $pass, 0, 1);
    if (!$inbox) {
        logMsg("[IMAP] Errore connessione {$user}: " . imap_last_error());
        return;
    }

    // Search for unseen messages
    $emails = imap_search($inbox, 'UNSEEN');
    if (!$emails) {
        logMsg("[IMAP] {$user}: nessun messaggio nuovo");
        imap_close($inbox);
        return;
    }

    logMsg("[IMAP] {$user}: " . count($emails) . " messaggi nuovi");

    foreach ($emails as $emailNum) {
        $header = imap_headerinfo($inbox, $emailNum);
        $overview = imap_fetch_overview($inbox, (string)$emailNum, 0);

        if (!$header) continue;

        // Extract fields
        $messageId = $header->message_id ?? null;
        if ($messageId) {
            $messageId = trim($messageId, '<>');
            $messageId = '<' . $messageId . '>';
        }

        $from = '';
        if (isset($header->from[0])) {
            $f = $header->from[0];
            $from = isset($f->mailbox, $f->host) ? $f->mailbox . '@' . $f->host : '';
        }

        $to = $user;
        if (isset($header->to[0])) {
            $t = $header->to[0];
            $to = isset($t->mailbox, $t->host) ? $t->mailbox . '@' . $t->host : $user;
        }

        $subject = '';
        if (isset($overview[0]->subject)) {
            $subject = imap_utf8($overview[0]->subject);
        } elseif (isset($header->subject)) {
            $subject = imap_utf8($header->subject);
        }
        if (!$subject) $subject = '(nessun oggetto)';

        $date = isset($header->date) ? $header->date : date('r');

        $inReplyTo = $header->in_reply_to ?? null;

        // Get body text (prefer plain text, fallback to HTML)
        $body = getMessageBody($inbox, $emailNum);

        $handler([
            'messageId' => $messageId,
            'from' => strtolower($from),
            'to' => strtolower($to),
            'subject' => $subject,
            'date' => $date,
            'body' => $body,
            'inReplyTo' => $inReplyTo,
        ]);

        // Mark as seen
        imap_setflag_full($inbox, (string)$emailNum, '\\Seen');
    }

    imap_close($inbox);
}

/**
 * Extract plain text body from email message
 */
function getMessageBody($inbox, int $emailNum): string {
    $structure = imap_fetchstructure($inbox, $emailNum);

    if (!$structure) {
        return imap_fetchbody($inbox, $emailNum, '1') ?: '';
    }

    // Simple message (not multipart)
    if (empty($structure->parts)) {
        $body = imap_fetchbody($inbox, $emailNum, '1');
        $body = decodeBody($body, $structure->encoding ?? 0);
        if (($structure->subtype ?? '') === 'HTML') {
            $body = stripHtml($body);
        }
        return $body;
    }

    // Multipart: look for text/plain first, then text/html
    $plainBody = '';
    $htmlBody = '';

    foreach ($structure->parts as $partNum => $part) {
        $partIndex = (string)($partNum + 1);
        $subtype = strtoupper($part->subtype ?? '');

        if ($subtype === 'PLAIN') {
            $plainBody = imap_fetchbody($inbox, $emailNum, $partIndex);
            $plainBody = decodeBody($plainBody, $part->encoding ?? 0);
        } elseif ($subtype === 'HTML') {
            $htmlBody = imap_fetchbody($inbox, $emailNum, $partIndex);
            $htmlBody = decodeBody($htmlBody, $part->encoding ?? 0);
        } elseif (strtoupper($part->type ?? '') === 1 || ($part->type ?? 0) === 1) {
            // Nested multipart — check sub-parts
            if (!empty($part->parts)) {
                foreach ($part->parts as $subPartNum => $subPart) {
                    $subIndex = $partIndex . '.' . ($subPartNum + 1);
                    $subSubtype = strtoupper($subPart->subtype ?? '');
                    if ($subSubtype === 'PLAIN' && !$plainBody) {
                        $plainBody = imap_fetchbody($inbox, $emailNum, $subIndex);
                        $plainBody = decodeBody($plainBody, $subPart->encoding ?? 0);
                    } elseif ($subSubtype === 'HTML' && !$htmlBody) {
                        $htmlBody = imap_fetchbody($inbox, $emailNum, $subIndex);
                        $htmlBody = decodeBody($htmlBody, $subPart->encoding ?? 0);
                    }
                }
            }
        }
    }

    if ($plainBody) return $plainBody;
    if ($htmlBody) return stripHtml($htmlBody);
    return '';
}

/**
 * Decode email body based on encoding type
 */
function decodeBody(string $body, int $encoding): string {
    switch ($encoding) {
        case 3: // BASE64
            return base64_decode($body) ?: $body;
        case 4: // QUOTED-PRINTABLE
            return quoted_printable_decode($body);
        default:
            return $body;
    }
}

/**
 * Strip HTML tags to plain text
 */
function stripHtml(string $html): string {
    $text = preg_replace('/<br\s*\/?>/i', "\n", $html);
    $text = preg_replace('/<\/p>/i', "\n", $text);
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
    return trim($text);
}

/**
 * Handle messages from ticketing@ inbox
 */
function handleTicketingMessage(array $msg): void {
    if (messageExists($msg['messageId'])) {
        logMsg("[IMAP ticketing@] Skip duplicato: {$msg['messageId']}");
        return;
    }

    $clienteId = findClienteByEmail($msg['from']);

    $ticketId = null;
    $threadId = null;

    if (preg_match(TICKET_CODE_RE, $msg['subject'], $m)) {
        $codice = $m[1];
        $ticket = Database::fetchOne('SELECT id FROM ticket WHERE codice = ?', [$codice]);
        if ($ticket) {
            $ticketId = (int)$ticket['id'];
            $threadId = "thread-{$codice}";
        }
    }

    Database::execute(
        "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, ticket_id, thread_id, message_id, letta) VALUES ('ticket', ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        [$msg['from'], $msg['to'], $msg['subject'], $msg['body'], $clienteId, $ticketId, $threadId, $msg['messageId']]
    );

    logMsg("[IMAP ticketing@] Importata: {$msg['subject']} (da: {$msg['from']})");

    // If ticket found and was in_attesa, revert to in_lavorazione
    if ($ticketId) {
        Database::execute(
            "UPDATE ticket SET stato = 'in_lavorazione', updated_at = NOW() WHERE id = ? AND stato = 'in_attesa'",
            [$ticketId]
        );
    }
}

/**
 * Handle messages from assistenzatecnica@ inbox
 */
function handleAssistenzaMessage(array $msg): void {
    // Check for [COMM slug] tag
    if (preg_match(COMM_TAG_RE, $msg['subject'], $m)) {
        $slug = strtolower($m[1]);
        $cliente = Database::fetchOne('SELECT id FROM clienti WHERE portale_slug = ?', [$slug]);

        if ($cliente) {
            if (comunicazioneExists($msg['messageId'])) {
                logMsg("[IMAP assistenza@] Skip comunicazione duplicata: {$msg['messageId']}");
                return;
            }

            $oggettoClean = trim(preg_replace(COMM_TAG_RE, '', $msg['subject']));

            $dateFormatted = date('Y-m-d H:i:s', strtotime($msg['date']));

            Database::execute(
                "INSERT INTO comunicazioni_cliente (cliente_id, oggetto, corpo, mittente, message_id, data_ricezione) VALUES (?, ?, ?, ?, ?, ?)",
                [(int)$cliente['id'], $oggettoClean, $msg['body'], $msg['from'], $msg['messageId'], $dateFormatted]
            );

            logMsg("[IMAP assistenza@] Comunicazione cliente ({$slug}): {$oggettoClean}");
            return;
        } else {
            logMsg("[IMAP assistenza@] [COMM] slug non trovato: \"{$slug}\" — trattata come email normale");
        }
    }

    // Check for [PRJ-123 ACT-456] tag (project/activity reply)
    if (preg_match(PRJ_TAG_RE, $msg['subject'], $pm)) {
        if (messageExists($msg['messageId'])) {
            logMsg("[IMAP assistenza@] Skip duplicato PRJ: {$msg['messageId']}");
            return;
        }

        $prjId = (int)$pm[1];
        $actId = !empty($pm[2]) ? (int)$pm[2] : null;

        // Verify project exists
        $prj = Database::fetchOne('SELECT id, cliente_id FROM progetti WHERE id = ?', [$prjId]);
        if ($prj) {
            $clienteId = $prj['cliente_id'];
            $oggettoClean = trim(preg_replace(PRJ_TAG_RE, '', $msg['subject']));
            // Remove Re:/Fwd: prefixes
            $oggettoClean = trim(preg_replace('/^(Re|Fwd|Fw)\s*:\s*/i', '', $oggettoClean));

            Database::execute(
                "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, progetto_id, attivita_id, message_id, letta) VALUES ('email_cliente', ?, ?, ?, ?, ?, ?, ?, ?, 0)",
                [$msg['from'], $msg['to'], $oggettoClean, $msg['body'], $clienteId, $prjId, $actId, $msg['messageId']]
            );

            logMsg("[IMAP assistenza@] Reply progetto PRJ-{$prjId}" . ($actId ? " ACT-{$actId}" : '') . ": {$oggettoClean}");
            return;
        } else {
            logMsg("[IMAP assistenza@] [PRJ] progetto non trovato: PRJ-{$prjId} — trattata come email normale");
        }
    }

    if (messageExists($msg['messageId'])) {
        logMsg("[IMAP assistenza@] Skip duplicato: {$msg['messageId']}");
        return;
    }

    $clienteId = findClienteByEmail($msg['from']);

    Database::execute(
        "INSERT INTO email (tipo, mittente, destinatario, oggetto, corpo, cliente_id, message_id, letta) VALUES ('email_cliente', ?, ?, ?, ?, ?, ?, 0)",
        [$msg['from'], $msg['to'], $msg['subject'], $msg['body'], $clienteId, $msg['messageId']]
    );

    logMsg("[IMAP assistenza@] Importata: {$msg['subject']} (da: {$msg['from']})");
}

// --- MAIN ---
logMsg("=== IMAP Polling avviato ===");

if (MAIL_TICKETING_USER && MAIL_TICKETING_PASS) {
    logMsg("Polling ticketing@...");
    pollMailbox(MAIL_TICKETING_USER, MAIL_TICKETING_PASS, 'handleTicketingMessage');
}

if (MAIL_ASSISTENZA_USER && MAIL_ASSISTENZA_PASS) {
    logMsg("Polling assistenzatecnica@...");
    pollMailbox(MAIL_ASSISTENZA_USER, MAIL_ASSISTENZA_PASS, 'handleAssistenzaMessage');
}

logMsg("=== Polling completato ===");
