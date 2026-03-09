<?php
/**
 * FAQ Scraper — Cron script
 * Scrapes Suprema support FAQ articles and stores them in documenti_repository
 *
 * Setup on Aruba cron (once per day):
 *   /usr/bin/php /path/to/scrape_faq.php
 *
 * Or via web with key:
 *   https://www.stmdomotica.it/cloud/ticketing/api/cron/scrape_faq.php?key=YOUR_JWT_SECRET
 */

set_time_limit(300); // 5 minutes max

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

// Security
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if ($key !== JWT_SECRET) {
        http_response_code(403);
        die(json_encode(['error' => 'Accesso negato']));
    }
    header('Content-Type: text/plain; charset=utf-8');
}

define('BASE_URL', 'https://support.supremainc.com');
define('FAQ_CATEGORIA', 'FAQ Suprema');
define('SYNC_INTERVAL_HOURS', 24);

$FOLDERS = [
    ['id' => '24000003537', 'name' => 'New Features'],
    ['id' => '24000005099', 'name' => 'Announcements'],
    ['id' => '24000001228', 'name' => 'Database & Integration'],
    ['id' => '24000002163', 'name' => 'Known Issues'],
    ['id' => '24000001233', 'name' => 'General'],
    ['id' => '6000145258', 'name' => 'Getting Started'],
    ['id' => '24000001230', 'name' => 'Connection'],
    ['id' => '24000001231', 'name' => 'Device'],
    ['id' => '24000001232', 'name' => 'Server'],
    ['id' => '24000006512', 'name' => 'User'],
    ['id' => '24000002787', 'name' => 'Card'],
    ['id' => '24000001229', 'name' => 'SDK'],
];

function logMsg(string $msg): void {
    $ts = date('Y-m-d H:i:s');
    echo "[{$ts}] {$msg}\n";
    if (php_sapi_name() !== 'cli') ob_flush();
}

/**
 * Check if sync is needed (24h interval)
 */
function needsSync(): bool {
    $row = Database::fetchOne("SELECT valore FROM impostazioni WHERE chiave = 'faq_suprema_last_sync'");
    if (!$row) return true;
    $lastSync = strtotime($row['valore']);
    return (time() - $lastSync) > (SYNC_INTERVAL_HOURS * 3600);
}

/**
 * Update last sync timestamp
 */
function setLastSyncTime(): void {
    $now = date('Y-m-d H:i:s');
    $existing = Database::fetchOne("SELECT chiave FROM impostazioni WHERE chiave = 'faq_suprema_last_sync'");
    if ($existing) {
        Database::execute("UPDATE impostazioni SET valore = ? WHERE chiave = 'faq_suprema_last_sync'", [$now]);
    } else {
        Database::execute("INSERT INTO impostazioni (chiave, valore) VALUES ('faq_suprema_last_sync', ?)", [$now]);
    }
}

/**
 * Fetch a web page via cURL
 */
function fetchPage(string $url): string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept: text/html',
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        throw new \Exception("HTTP {$httpCode} for {$url}");
    }
    return $response;
}

/**
 * Extract article URLs from a folder page (follows pagination)
 */
function getArticleUrls(string $folderId): array {
    $urls = [];
    $page = 1;
    $hasMore = true;

    while ($hasMore) {
        $url = BASE_URL . "/en/support/solutions/folders/{$folderId}?page={$page}";
        try {
            $html = fetchPage($url);

            // Extract article links using regex (no DOM parser dependency)
            if (preg_match_all('/href="([^"]*\/solutions\/articles\/[^"]+)"/', $html, $matches)) {
                foreach ($matches[1] as $href) {
                    $fullUrl = str_starts_with($href, 'http') ? $href : BASE_URL . $href;
                    if (!in_array($fullUrl, $urls)) {
                        $urls[] = $fullUrl;
                    }
                }
            }

            // Check for next page
            $hasMore = (bool)preg_match('/rel="next"|class="[^"]*next[^"]*"/', $html) && $page < 50;
            $page++;
        } catch (\Exception $e) {
            logMsg("[FAQ Scraper] Errore pagina {$url}: " . $e->getMessage());
            $hasMore = false;
        }

        // Rate limiting
        usleep(500000); // 500ms
    }

    return $urls;
}

/**
 * Scrape a single article and return its content
 */
function scrapeArticle(string $articleUrl): ?array {
    try {
        $html = fetchPage($articleUrl);

        // Extract title from <h1> or og:title
        $title = '';
        if (preg_match('/<h1[^>]*>([^<]+)<\/h1>/i', $html, $m)) {
            $title = trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
        } elseif (preg_match('/property="og:title"\s+content="([^"]+)"/i', $html, $m)) {
            $title = trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
        }

        if (!$title) return null;

        // Extract article body
        $body = '';
        // Try common article body selectors
        $patterns = [
            '/<div[^>]*class="[^"]*article[_-]?body[^"]*"[^>]*>(.*?)<\/div>/si',
            '/<div[^>]*itemprop="articleBody"[^>]*>(.*?)<\/div>/si',
            '/<article[^>]*>(.*?)<\/article>/si',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                $body = $m[1];
                break;
            }
        }

        if (!$body) {
            // Fallback: get content between main tags
            if (preg_match('/<main[^>]*>(.*?)<\/main>/si', $html, $m)) {
                $body = $m[1];
            }
        }

        // Clean HTML to text
        $body = preg_replace('/<script[^>]*>.*?<\/script>/si', '', $body);
        $body = preg_replace('/<style[^>]*>.*?<\/style>/si', '', $body);
        $body = preg_replace('/<img[^>]*>/i', '', $body);
        $body = preg_replace('/<br\s*\/?>/i', "\n", $body);
        $body = preg_replace('/<\/p>/i', "\n", $body);
        $body = strip_tags($body);
        $body = html_entity_decode($body, ENT_QUOTES, 'UTF-8');
        $body = preg_replace('/\s+/', ' ', $body);
        $body = trim($body);

        // Truncate very long articles (max 8000 chars)
        if (strlen($body) > 8000) {
            $body = substr($body, 0, 8000) . '...';
        }

        if (!$body || strlen($body) < 20) return null;

        // Extract article ID from URL
        $articleId = '';
        if (preg_match('/articles\/(\d+)/', $articleUrl, $m)) {
            $articleId = $m[1];
        } else {
            $articleId = md5($articleUrl);
        }

        return [
            'title' => $title,
            'body' => $body,
            'articleId' => $articleId,
            'url' => $articleUrl,
        ];
    } catch (\Exception $e) {
        logMsg("[FAQ Scraper] Errore articolo {$articleUrl}: " . $e->getMessage());
        return null;
    }
}

// --- MAIN ---

if (!needsSync()) {
    logMsg("FAQ sync non necessario (ultimo sync < " . SYNC_INTERVAL_HOURS . "h fa). Uso ?force=1 per forzare.");
    if (!($isCli && in_array('--force', $argv ?? [])) && !isset($_GET['force'])) {
        exit(0);
    }
    logMsg("Sync forzato.");
}

logMsg("=== Inizio sincronizzazione FAQ Suprema ===");
$startTime = time();

$totalArticles = 0;
$newArticles = 0;
$updatedArticles = 0;

foreach ($FOLDERS as $folder) {
    logMsg("Scansione cartella: {$folder['name']}...");

    try {
        $articleUrls = getArticleUrls($folder['id']);
        logMsg("{$folder['name']}: " . count($articleUrls) . " articoli trovati");

        foreach ($articleUrls as $url) {
            $article = scrapeArticle($url);
            if (!$article) continue;

            $totalArticles++;

            // Use article URL as unique identifier (stored in descrizione)
            $existing = Database::fetchOne(
                "SELECT id, contenuto_testo FROM documenti_repository WHERE descrizione = ? AND categoria = ?",
                [$article['url'], FAQ_CATEGORIA]
            );

            $content = "[{$folder['name']}] {$article['title']}\n\n{$article['body']}";

            if ($existing) {
                if ($existing['contenuto_testo'] !== $content) {
                    Database::execute(
                        "UPDATE documenti_repository SET nome_originale = ?, contenuto_testo = ? WHERE id = ?",
                        [$article['title'], $content, $existing['id']]
                    );
                    $updatedArticles++;
                }
            } else {
                Database::execute(
                    "INSERT INTO documenti_repository (nome_originale, nome_file, categoria, descrizione, contenuto_testo, dimensione) VALUES (?, ?, ?, ?, ?, ?)",
                    [
                        $article['title'],
                        "faq-suprema-{$article['articleId']}.txt",
                        FAQ_CATEGORIA,
                        $article['url'],
                        $content,
                        strlen($content),
                    ]
                );
                $newArticles++;
            }

            // Rate limiting
            usleep(300000); // 300ms
        }
    } catch (\Exception $e) {
        logMsg("Errore cartella {$folder['name']}: " . $e->getMessage());
    }
}

setLastSyncTime();

$elapsed = time() - $startTime;
logMsg("=== Sincronizzazione completata in {$elapsed}s — {$totalArticles} articoli totali, {$newArticles} nuovi, {$updatedArticles} aggiornati ===");
