<?php
/**
 * JWT Authentication middleware
 * Requires firebase/php-jwt
 */
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class Auth {
    /**
     * Middleware: authenticate admin/tecnico token
     */
    public static function authenticateToken(stdClass $req): bool {
        $token = self::extractToken($req);
        if (!$token) {
            Response::error('Token di autenticazione richiesto', 401);
            return false;
        }

        try {
            $decoded = JWT::decode($token, new Key(JWT_SECRET, 'HS256'));
            $req->user = (array)$decoded;
            return true;
        } catch (\Exception $e) {
            Response::error('Token non valido o scaduto', 401);
            return false;
        }
    }

    /**
     * Middleware: require admin role
     */
    public static function requireAdmin(stdClass $req): bool {
        if (($req->user['ruolo'] ?? '') !== 'admin') {
            Response::error('Accesso riservato agli amministratori', 403);
            return false;
        }
        return true;
    }

    /**
     * Middleware: authenticate client token
     */
    public static function authenticateClientToken(stdClass $req): bool {
        $token = self::extractToken($req);
        if (!$token) {
            Response::error('Token di autenticazione richiesto', 401);
            return false;
        }

        try {
            $decoded = JWT::decode($token, new Key(JWT_SECRET, 'HS256'));
            $user = (array)$decoded;
            if (($user['tipo'] ?? '') !== 'cliente') {
                Response::error('Token non valido per il portale cliente', 403);
                return false;
            }
            $req->user = $user;
            return true;
        } catch (\Exception $e) {
            Response::error('Token non valido o scaduto', 401);
            return false;
        }
    }

    /**
     * Generate JWT token
     */
    public static function generateToken(array $payload, int $expiry = 28800): string {
        $payload['iat'] = time();
        $payload['exp'] = time() + $expiry;
        return JWT::encode($payload, JWT_SECRET, 'HS256');
    }

    /**
     * Extract Bearer token from Authorization header
     */
    private static function extractToken(stdClass $req): ?string {
        $header = $req->headers['authorization'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return $matches[1];
        }
        return null;
    }
}
