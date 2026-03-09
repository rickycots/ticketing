<?php
/**
 * File upload handler (replaces multer)
 */
class Upload {
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

        $allowedExts = $options['allowedExts'] ?? null;
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($allowedExts && !in_array($ext, $allowedExts)) {
            Response::error('Tipo di file non consentito', 400);
            return null;
        }

        // Ensure destination directory exists
        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }

        // Generate unique filename
        $newName = bin2hex(random_bytes(16)) . '.' . $ext;
        $destPath = $destDir . '/' . $newName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('Errore nel salvataggio del file', 500);
            return null;
        }

        return [
            'nome_file' => $newName,
            'nome_originale' => $file['name'],
            'dimensione' => $file['size'],
            'tipo_mime' => $file['type'] ?: mime_content_type($destPath),
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

            $ext = strtolower(pathinfo($_FILES[$fieldName]['name'][$i], PATHINFO_EXTENSION));
            $allowedExts = $options['allowedExts'] ?? null;
            if ($allowedExts && !in_array($ext, $allowedExts)) continue;

            if (!is_dir($destDir)) mkdir($destDir, 0755, true);

            $newName = bin2hex(random_bytes(16)) . '.' . $ext;
            $destPath = $destDir . '/' . $newName;

            if (move_uploaded_file($_FILES[$fieldName]['tmp_name'][$i], $destPath)) {
                $files[] = [
                    'nome_file' => $newName,
                    'nome_originale' => $_FILES[$fieldName]['name'][$i],
                    'dimensione' => $_FILES[$fieldName]['size'][$i],
                    'tipo_mime' => $_FILES[$fieldName]['type'][$i] ?: mime_content_type($destPath),
                ];
            }
        }

        return $files;
    }

    /**
     * Delete an uploaded file
     */
    public static function deleteFile(string $dir, string $filename): bool {
        $path = $dir . '/' . $filename;
        if (file_exists($path)) {
            return unlink($path);
        }
        return false;
    }
}
