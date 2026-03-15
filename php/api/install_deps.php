<?php
/**
 * Dependency installer — downloads Composer and installs dependencies
 * Run this on a machine with PHP installed:
 *   php install_deps.php
 *
 * Or via web:
 *   https://yourdomain.com/cloud/ticketing/api/install_deps.php
 *
 * After running, upload the generated vendor/ directory to the server via FTP.
 * Then DELETE this file from production!
 */

// Increase execution time for shared hosting
set_time_limit(600);
ini_set('max_execution_time', 600);

// Security: only run in CLI or with confirmation
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    if (!isset($_GET['confirm'])) {
        die("Add ?confirm=1 to URL to proceed. WARNING: Delete this file after use!");
    }
    header('Content-Type: text/plain; charset=utf-8');
}

echo "=== Installing Composer dependencies ===\n\n";

$composerJson = __DIR__ . '/composer.json';
if (!file_exists($composerJson)) {
    die("ERROR: composer.json not found in " . __DIR__ . "\n");
}

// Check if Composer is available
$composerPath = null;
$possiblePaths = ['composer', 'composer.phar', __DIR__ . '/composer.phar'];

foreach ($possiblePaths as $path) {
    exec("{$path} --version 2>&1", $output, $code);
    if ($code === 0) {
        $composerPath = $path;
        echo "Found Composer: {$output[0]}\n";
        break;
    }
    $output = [];
}

// If Composer not found, download it
if (!$composerPath) {
    echo "Composer not found. Downloading...\n";
    $pharPath = __DIR__ . '/composer.phar';

    // Download Composer installer
    $installerUrl = 'https://getcomposer.org/installer';
    $installer = file_get_contents($installerUrl);
    if (!$installer) {
        die("ERROR: Could not download Composer installer. Check internet connection.\n");
    }

    file_put_contents(__DIR__ . '/composer-setup.php', $installer);

    // Run installer
    $phpBin = PHP_BINARY ?: 'php';
    exec("{$phpBin} " . __DIR__ . "/composer-setup.php --install-dir=" . escapeshellarg(__DIR__) . " 2>&1", $output, $code);
    echo implode("\n", $output) . "\n";

    if (file_exists($pharPath)) {
        $composerPath = $pharPath;
        echo "Composer downloaded successfully.\n";
    } else {
        die("ERROR: Failed to download Composer.\n");
    }

    // Cleanup installer
    @unlink(__DIR__ . '/composer-setup.php');
}

// Run composer install
echo "\nInstalling dependencies...\n";
$phpBin = PHP_BINARY ?: 'php';
$cmd = "{$phpBin} {$composerPath} install --no-dev --optimize-autoloader --working-dir=" . escapeshellarg(__DIR__) . " 2>&1";
echo "Running: {$cmd}\n\n";

$proc = popen($cmd, 'r');
while ($line = fgets($proc)) {
    echo $line;
    if (!$isCli) ob_flush();
}
$code = pclose($proc);

if ($code === 0) {
    echo "\n=== Dependencies installed successfully! ===\n";
    echo "vendor/ directory is ready.\n";

    // Cleanup composer.phar if we downloaded it
    if (file_exists(__DIR__ . '/composer.phar') && $composerPath === __DIR__ . '/composer.phar') {
        echo "Keeping composer.phar for future use.\n";
    }
} else {
    echo "\nERROR: Composer install failed with code {$code}\n";
}

echo "\nIMPORTANT: Delete this file (install_deps.php) from production!\n";
