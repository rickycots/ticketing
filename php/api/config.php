<?php
/**
 * Configuration - loads environment and defines constants
 */

// Load config from config.env file
$envFile = __DIR__ . '/config.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Remove surrounding quotes
        if (preg_match('/^["\'](.*)["\']\s*$/', $value, $m)) {
            $value = $m[1];
        }
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

// JWT Secret (mandatory)
define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? '');
if (!JWT_SECRET) {
    http_response_code(500);
    die(json_encode(['error' => 'FATAL: JWT_SECRET non configurato']));
}

// Database
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'ticketing');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');
define('DB_PORT', $_ENV['DB_PORT'] ?? '3306');

// Groq AI
define('GROQ_API_KEY', $_ENV['GROQ_API_KEY'] ?? '');

// Email SMTP/IMAP
define('MAIL_TICKETING_USER', $_ENV['MAIL_TICKETING_USER'] ?? '');
define('MAIL_TICKETING_PASS', $_ENV['MAIL_TICKETING_PASS'] ?? '');
define('MAIL_ASSISTENZA_USER', $_ENV['MAIL_ASSISTENZA_USER'] ?? '');
define('MAIL_ASSISTENZA_PASS', $_ENV['MAIL_ASSISTENZA_PASS'] ?? '');
define('MAIL_NOREPLY_USER', $_ENV['MAIL_NOREPLY_USER'] ?? '');
define('MAIL_NOREPLY_PASS', $_ENV['MAIL_NOREPLY_PASS'] ?? '');
define('MAIL_SMTP_HOST', $_ENV['MAIL_SMTP_HOST'] ?? 'smtps.aruba.it');
define('MAIL_SMTP_PORT', (int)($_ENV['MAIL_SMTP_PORT'] ?? 465));
define('MAIL_IMAP_HOST', $_ENV['MAIL_IMAP_HOST'] ?? 'imaps.aruba.it');
define('MAIL_IMAP_PORT', (int)($_ENV['MAIL_IMAP_PORT'] ?? 993));

// Base path for deployment
define('BASE_PATH', $_ENV['BASE_PATH'] ?? '/ticketing');
define('API_BASE', BASE_PATH . '/api');

// Upload directories
define('UPLOAD_DIR', __DIR__ . '/uploads');
