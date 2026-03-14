<?php
/**
 * DB-based rate limiter for PHP endpoints (no Redis on Aruba shared hosting)
 * Tracks attempts by IP + action in rate_limits table
 */
class RateLimiter {

    /**
     * Check if IP is rate-limited for an action
     * @param string $action Action name (e.g., 'login', 'ai', 'impersonate')
     * @param int $maxAttempts Max attempts allowed in window
     * @param int $windowSeconds Time window in seconds
     * @return bool true if rate-limited (should block)
     */
    public static function isLimited(string $action, int $maxAttempts, int $windowSeconds): bool {
        $ip = self::getIp();

        // Clean old entries (older than window)
        try {
            Database::execute(
                'DELETE FROM rate_limits WHERE azione = ? AND created_at < DATE_SUB(NOW(), INTERVAL ? SECOND)',
                [$action, $windowSeconds]
            );
        } catch (\PDOException $e) {
            // Table might not exist yet — allow request
            return false;
        }

        // Count recent attempts
        $row = Database::fetchOne(
            'SELECT COUNT(*) as cnt FROM rate_limits WHERE ip = ? AND azione = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)',
            [$ip, $action, $windowSeconds]
        );

        return ($row['cnt'] ?? 0) >= $maxAttempts;
    }

    /**
     * Record an attempt
     */
    public static function record(string $action): void {
        $ip = self::getIp();
        try {
            Database::execute(
                'INSERT INTO rate_limits (ip, azione) VALUES (?, ?)',
                [$ip, $action]
            );
        } catch (\PDOException $e) {
            // Silently fail if table doesn't exist yet
        }
    }

    /**
     * Clear attempts for IP + action (e.g., on successful login)
     */
    public static function clear(string $action): void {
        $ip = self::getIp();
        try {
            Database::execute(
                'DELETE FROM rate_limits WHERE ip = ? AND azione = ?',
                [$ip, $action]
            );
        } catch (\PDOException $e) {
            // Silently fail
        }
    }

    /**
     * Block with 429 if rate-limited
     */
    public static function enforce(string $action, int $maxAttempts, int $windowSeconds, string $message = null): void {
        if (self::isLimited($action, $maxAttempts, $windowSeconds)) {
            $mins = ceil($windowSeconds / 60);
            Response::error($message ?? "Troppe richieste. Riprova tra {$mins} minuti.", 429);
        }
    }

    private static function getIp(): string {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
}
