<?php
/**
 * File upload handler (replaces multer)
 * Security: extension whitelist, magic byte validation, double-extension block, execution prevention
 */
class Upload {

    // Global whitelist — only these extensions are ever accepted
    private static $SAFE_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',           // images
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',   // documents
        'txt', 'md', 'csv',                                     // text
        'zip', 'rar', '7z',                                     // archives
    ];

    // Magic bytes signatures for file type validation
    private static $MAGIC_BYTES = [
        'jpg'  => ["\xFF\xD8\xFF"],
        'jpeg' => ["\xFF\xD8\xFF"],
        'png'  => ["\x89\x50\x4E\x47\x0D\x0A\x1A\x0A"],
        'gif'  => ["GIF87a", "GIF89a"],
        'bmp'  => ["BM"],
        'webp' => ["RIFF"],
        'pdf'  => ["%PDF"],
        'zip'  => ["PK\x03\x04", "PK\x05\x06"],
        'rar'  => ["Rar!\x1A\x07"],
        '7z'   => ["\x37\x7A\xBC\xAF\x27\x1C"],
        'doc'  => ["\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"],  // OLE2 (doc, xls, ppt)
        'xls'  => ["\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"],
        'ppt'  => ["\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"],
        'docx' => ["PK\x03\x04"],  // OOXML (zip-based)
        'xlsx' => ["PK\x03\x04"],
        'pptx' => ["PK\x03\x04"],
    ];

    // Dangerous extensions that must NEVER be uploaded
    private static $DANGEROUS_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'phtml', 'phar',
        'asp', 'aspx', 'jsp', 'jspx', 'cgi', 'pl', 'py', 'rb',
        'sh', 'bash', 'bat', 'cmd', 'com', 'exe', 'msi', 'dll',
        'htaccess', 'htpasswd', 'ini', 'env', 'config',
        'shtml', 'shtm', 'svg', 'swf',
    ];

    /**
     * Validate file security: extension, double-extension, magic bytes
     * @return string sanitized extension (lowercase)
     */
    private static function validateFile(string $filename, string $tmpPath, array $options): string {
        // Extract and lowercase extension
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        // Block empty extension
        if ($ext === '') {
            Response::error('File senza estensione non consentito', 400);
            exit;
        }

        // Block dangerous extensions anywhere in filename (double-extension attack)
        $parts = explode('.', strtolower($filename));
        array_shift($parts); // remove basename
        foreach ($parts as $part) {
            if (in_array($part, self::$DANGEROUS_EXTENSIONS)) {
                Response::error('Nome file non consentito (estensione pericolosa)', 400);
                exit;
            }
        }

        // Check against global safe list
        if (!in_array($ext, self::$SAFE_EXTENSIONS)) {
            Response::error('Tipo di file non consentito: .' . $ext, 400);
            exit;
        }

        // Check against route-specific whitelist (if provided)
        $allowedExts = $options['allowedExts'] ?? null;
        if ($allowedExts && !in_array($ext, $allowedExts)) {
            Response::error('Tipo di file non consentito', 400);
            exit;
        }

        // Validate magic bytes for known types
        if (isset(self::$MAGIC_BYTES[$ext]) && file_exists($tmpPath)) {
            $header = file_get_contents($tmpPath, false, null, 0, 16);
            if ($header !== false) {
                $valid = false;
                foreach (self::$MAGIC_BYTES[$ext] as $magic) {
                    if (substr($header, 0, strlen($magic)) === $magic) {
                        $valid = true;
                        break;
                    }
                }
                if (!$valid) {
                    Response::error('Il contenuto del file non corrisponde all\'estensione dichiarata', 400);
                    exit;
                }
            }
        }

        return $ext;
    }

    /**
     * Handle single file upload
     * @return array{nome_file: string, nome_originale: string, dimensione: int, tipo_mime: string}
     */
    public static function handleFile(string $fieldName, string $destDir, array $options = []): ?array {
        if (!isset($_FILES[$fieldName]) || $_FILES[$fieldName]['error'] === UPLOAD_ERR_NO_FILE) {
            return null;
        }

        $file = $_FILES[$fieldName];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('Errore durante l\'upload del file', 400);
            return null;
        }

        $maxSize = $options['maxSize'] ?? 20 * 1024 * 1024; // 20MB default
        if ($file['size'] > $maxSize) {
            Response::error('File troppo grande (max ' . round($maxSize / 1024 / 1024) . 'MB)', 400);
            return null;
        }

        // Security validation: extension, double-ext, magic bytes
        $ext = self::validateFile($file['name'], $file['tmp_name'], $options);

        // Ensure destination directory exists
        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }

        // Generate random filename (only ONE extension)
        $newName = bin2hex(random_bytes(16)) . '.' . $ext;
        $destPath = $destDir . '/' . $newName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('Errore nel salvataggio del file', 500);
            return null;
        }

        // Get real MIME from file content, not client header
        $realMime = mime_content_type($destPath) ?: 'application/octet-stream';

        return [
            'nome_file' => $newName,
            'nome_originale' => $file['name'],
            'dimensione' => $file['size'],
            'tipo_mime' => $realMime,
        ];
    }

    /**
     * Handle multiple file uploads
     */
    public static function handleMultiple(string $fieldName, string $destDir, array $options = []): array {
        if (!isset($_FILES[$fieldName])) return [];

        $files = [];
        $count = is_array($_FILES[$fieldName]['name']) ? count($_FILES[$fieldName]['name']) : 1;

        if ($count === 1 && !is_array($_FILES[$fieldName]['name'])) {
            $result = self::handleFile($fieldName, $destDir, $options);
            return $result ? [$result] : [];
        }

        for ($i = 0; $i < $count; $i++) {
            if ($_FILES[$fieldName]['error'][$i] !== UPLOAD_ERR_OK) continue;

            $maxSize = $options['maxSize'] ?? 20 * 1024 * 1024;
            if ($_FILES[$fieldName]['size'][$i] > $maxSize) continue;

            // Security validation
            $ext = self::validateFile(
                $_FILES[$fieldName]['name'][$i],
                $_FILES[$fieldName]['tmp_name'][$i],
                $options
            );

            if (!is_dir($destDir)) mkdir($destDir, 0755, true);

            $newName = bin2hex(random_bytes(16)) . '.' . $ext;
            $destPath = $destDir . '/' . $newName;

            if (move_uploaded_file($_FILES[$fieldName]['tmp_name'][$i], $destPath)) {
                $realMime = mime_content_type($destPath) ?: 'application/octet-stream';
                $files[] = [
                    'nome_file' => $newName,
                    'nome_originale' => $_FILES[$fieldName]['name'][$i],
                    'dimensione' => $_FILES[$fieldName]['size'][$i],
                    'tipo_mime' => $realMime,
                ];
            }
        }

        return $files;
    }

    /**
     * Delete an uploaded file
     */
    public static function deleteFile(string $dir, string $filename): bool {
        // Prevent directory traversal
        $filename = basename($filename);
        $path = $dir . '/' . $filename;
        if (file_exists($path)) {
            return unlink($path);
        }
        return false;
    }
}
