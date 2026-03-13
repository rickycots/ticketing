<?php
// Force no-cache headers for SPA entry point
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Serve _app.html content (renamed from index.html to bypass Aruba CDN cache)
readfile(__DIR__ . '/_app.html');
