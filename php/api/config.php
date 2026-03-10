<?php
/**
 * Configuration - decrypts config.enc and defines constants
 */

// Decrypt config.enc
$envVars = [];
$encFile = __DIR__ . '/config.enc';
$envFile = __DIR__ . '/config.env';

if (file_exists($encFile)) {
    // Encrypted config (production)
    $enc = json_decode(file_get_contents($encFile), true);
    if ($enc && isset($enc['iv'], $enc['data'])) {
        $passphrase = 'STM-Config-2026-Encrypt';
        $salt = 'stm-config-salt';
        $key = hash_pbkdf2('sha256', $passphrase, $salt, 100000, 32, true);
        $iv = hex2bin($enc['iv']);
        $plaintext = openssl_decrypt($enc['data'], 'aes-256-cbc', $key, 0, $iv);

        if ($plaintext !== false) {
            $lines = explode("\n", $plaintext);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') continue;
                if (strpos($line, '=') === false) continue;
                [$k, $v] = explode('=', $line, 2);
                $k = trim($k);
                $v = trim($v);
                if (preg_match('/^["\'](.*)["\']\s*$/', $v, $m)) {
                    $v = $m[1];
                }
                $envVars[$k] = $v;
            }
        }
    }
} elseif (file_exists($envFile)) {
    // Fallback: plain config.env (development)
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if (preg_match('/^["\'](.*)["\']\s*$/', $v, $m)) {
            $v = $m[1];
        }
        $envVars[$k] = $v;
    }
}

// Set environment
foreach ($envVars as $k => $v) {
    $_ENV[$k] = $v;
    putenv("$k=$v");
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
