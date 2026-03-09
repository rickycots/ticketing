<?php
/**
 * JSON response helpers
 */
class Response {
    public static function json($data, int $status = 200): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function error(string $message, int $status = 400): void {
        self::json(['error' => $message], $status);
    }

    public static function success(array $data = []): void {
        self::json(array_merge(['success' => true], $data));
    }

    public static function created($data): void {
        self::json($data, 201);
    }

    public static function noContent(): void {
        http_response_code(204);
        exit;
    }
}
