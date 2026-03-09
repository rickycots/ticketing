<?php
/**
 * Minimal regex-based router
 */
class Router {
    private array $routes = [];
    private string $basePath;

    public function __construct(string $basePath = '') {
        $this->basePath = rtrim($basePath, '/');
    }

    public function get(string $path, ...$handlers): void {
        $this->addRoute('GET', $path, $handlers);
    }

    public function post(string $path, ...$handlers): void {
        $this->addRoute('POST', $path, $handlers);
    }

    public function put(string $path, ...$handlers): void {
        $this->addRoute('PUT', $path, $handlers);
    }

    public function delete(string $path, ...$handlers): void {
        $this->addRoute('DELETE', $path, $handlers);
    }

    private function addRoute(string $method, string $path, array $handlers): void {
        // Convert :param to named regex groups
        $pattern = preg_replace('/\:([a-zA-Z_]+)/', '(?P<$1>[^/]+)', $path);
        $pattern = '#^' . $this->basePath . $pattern . '$#';
        $this->routes[] = [
            'method' => $method,
            'pattern' => $pattern,
            'handlers' => $handlers,
        ];
    }

    /**
     * Dispatch the current request
     */
    public function dispatch(): void {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        // Handle CORS preflight
        if ($method === 'OPTIONS') {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Max-Age: 86400');
            http_response_code(204);
            exit;
        }

        // Set CORS headers for all responses
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) continue;

            if (preg_match($route['pattern'], $uri, $matches)) {
                // Extract named params
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

                // Build request context
                $req = new stdClass();
                $req->params = $params;
                $req->query = $_GET;
                $req->body = $this->getBody();
                $req->files = $_FILES;
                $req->user = null;
                $req->headers = $this->getHeaders();

                // Run handlers chain (middleware + final handler)
                $handlers = $route['handlers'];
                $this->runHandlers($handlers, $req);
                return;
            }
        }

        // No route matched
        Response::error('Endpoint non trovato', 404);
    }

    /**
     * Run middleware chain then final handler
     */
    private function runHandlers(array $handlers, stdClass $req): void {
        foreach ($handlers as $handler) {
            if (is_callable($handler)) {
                $result = $handler($req);
                // If middleware returns false, stop chain
                if ($result === false) return;
            }
        }
    }

    /**
     * Parse request body (JSON or form data)
     */
    private function getBody(): array {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

        if (stripos($contentType, 'application/json') !== false) {
            $raw = file_get_contents('php://input');
            return json_decode($raw, true) ?? [];
        }

        if (stripos($contentType, 'multipart/form-data') !== false) {
            return $_POST;
        }

        if (stripos($contentType, 'application/x-www-form-urlencoded') !== false) {
            return $_POST;
        }

        return [];
    }

    /**
     * Get request headers
     */
    private function getHeaders(): array {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $header = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}
