<?php
/**
 * Front Controller — API Router
 * All /api/* requests are routed here via .htaccess
 */

// Load configuration
require_once __DIR__ . '/config.php';

// Load vendor autoload (firebase/php-jwt, phpmailer)
require_once __DIR__ . '/vendor/autoload.php';

// Load core classes
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Router.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/Upload.php';
require_once __DIR__ . '/core/Mailer.php';
require_once __DIR__ . '/core/CronRunner.php';
require_once __DIR__ . '/core/RateLimiter.php';

// Security headers
header("X-Frame-Options: DENY");
header("X-Content-Type-Options: nosniff");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin");
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'");

// Create router with API base path
$router = new Router(API_BASE);

// Health check
$router->get('/health', function($req) {
    Response::json(['status' => 'ok', 'timestamp' => date('c')]);
});

// Load route files
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/clientAuth.php';
require_once __DIR__ . '/routes/tickets.php';
require_once __DIR__ . '/routes/projects.php';
require_once __DIR__ . '/routes/activities.php';
require_once __DIR__ . '/routes/clients.php';
require_once __DIR__ . '/routes/users.php';
require_once __DIR__ . '/routes/emails.php';
require_once __DIR__ . '/routes/notifications.php';
require_once __DIR__ . '/routes/dashboard.php';
require_once __DIR__ . '/routes/knowledgeBase.php';
require_once __DIR__ . '/routes/repository.php';
require_once __DIR__ . '/routes/ai.php';
require_once __DIR__ . '/routes/comunicazioni.php';

// Poor man's cron: poll emails every 10 minutes
// Wrapped in ob to prevent any output from breaking JSON responses
CronRunner::runIfDue('poll_emails', 600, function() {
    if (!MAIL_TICKETING_USER || !MAIL_TICKETING_PASS) return;
    ob_start();
    $oldLevel = error_reporting(0);
    try {
        require __DIR__ . '/cron/poll_emails.php';
    } catch (\Throwable $e) {
        error_log('[CronRunner] poll_emails error: ' . $e->getMessage());
    }
    error_reporting($oldLevel);
    ob_end_clean();
});

// Dispatch request
$router->dispatch();
