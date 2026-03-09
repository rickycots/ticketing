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

// Dispatch request
$router->dispatch();
