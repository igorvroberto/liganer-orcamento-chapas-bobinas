<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

liganer_auth_json_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Use POST'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode((string) $raw, true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$email = strtolower(trim((string) ($payload['email'] ?? '')));
$password = (string) ($payload['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Informe e-mail e senha.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$matched = null;
foreach (liganer_auth_users() as $candidate) {
    if (strtolower($candidate['email']) !== $email) {
        continue;
    }
    if (password_verify($password, $candidate['password_hash'])) {
        $matched = $candidate;
    }
    break;
}

if ($matched === null) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'E-mail ou senha inválidos.'], JSON_UNESCAPED_UNICODE);
    exit;
}

liganer_auth_bootstrap();
session_regenerate_id(true);
$_SESSION['user'] = liganer_auth_public_user($matched);

echo json_encode([
    'ok' => true,
    'user' => liganer_auth_public_user($matched),
], JSON_UNESCAPED_UNICODE);
