<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

liganer_auth_json_headers();

$user = liganer_auth_user();
if ($user === null) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'authenticated' => false], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'ok' => true,
    'authenticated' => true,
    'user' => $user,
], JSON_UNESCAPED_UNICODE);
