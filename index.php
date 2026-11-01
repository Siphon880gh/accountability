<?php
declare(strict_types=1);

// Plain PHP entry point. Notes live in IndexedDB; api.php handles uploaded images.
header('Content-Type: text/html; charset=utf-8');

require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/layout.php';
require __DIR__ . '/includes/footer.php';
