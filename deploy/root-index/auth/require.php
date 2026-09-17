<?php
/**
 * Helper para outros apps PHP no mesmo domínio.
 * Uso: require $_SERVER['DOCUMENT_ROOT'] . '/auth/require.php';
 */
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$user = liganer_auth_user();
if ($user === null) {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $wantsJson = strpos($accept, 'application/json') !== false
        || strpos($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '', 'XMLHttpRequest') !== false;
    if ($wantsJson) {
        liganer_auth_json_headers();
        http_response_code(401);
        echo json_encode(['ok' => false, 'authenticated' => false, 'error' => 'Faça login.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $next = $_SERVER['REQUEST_URI'] ?? '/';
    header('Location: /login.html?next=' . rawurlencode($next));
    exit;
}
