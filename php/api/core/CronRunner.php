<?php
/**
 * Poor Man's Cron — triggers background tasks on API requests
 * Uses a lock file to avoid running more than once per interval
 */
class CronRunner {

    private static string $lockDir = __DIR__ . '/../data';

    /**
     * Run a task if enough time has passed since last run
     * @param string $taskName Unique task identifier
     * @param int $intervalSeconds Minimum seconds between runs
     * @param callable $task The task to execute
     */
    public static function runIfDue(string $taskName, int $intervalSeconds, callable $task): void {
        // Ensure lock directory exists
        if (!is_dir(self::$lockDir)) {
            @mkdir(self::$lockDir, 0755, true);
        }

        $lockFile = self::$lockDir . '/cron_' . $taskName . '.lock';

        // Check if enough time has passed
        if (file_exists($lockFile)) {
            $lastRun = (int)file_get_contents($lockFile);
            if (time() - $lastRun < $intervalSeconds) {
                return; // Not due yet
            }
        }

        // Update lock file immediately to prevent concurrent runs
        file_put_contents($lockFile, (string)time());

        // Run task (suppress errors to not break the API response)
        try {
            $task();
        } catch (\Throwable $e) {
            error_log("[CronRunner] {$taskName} error: " . $e->getMessage());
        }
    }
}
