<?php
/**
 * API opcional de persistência para vendas.liganer.com.br/orcamento/
 * Mesmo espírito de /prospeccao/api/leads.php — autenticação por X-Sync-Secret.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Use POST']);
    exit;
}

$secret = getenv('ORCAMENTO_SYNC_SECRET') ?: '';
$configPath = dirname(__DIR__) . '/config.json';
if (is_readable($configPath)) {
    $cfg = json_decode((string) file_get_contents($configPath), true);
    if (is_array($cfg) && !empty($cfg['syncSecret'])) {
        $secret = (string) $cfg['syncSecret'];
    }
}

$provided = $_SERVER['HTTP_X_SYNC_SECRET'] ?? '';
if ($secret === '' || !hash_equals($secret, $provided)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Sem permissão']);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode((string) $raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido']);
    exit;
}

$dataDir = dirname(__DIR__) . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$stamp = date('ymd');
$counterFile = $dataDir . '/counter-' . $stamp . '.txt';
$next = 1;
if (is_readable($counterFile)) {
    $next = ((int) file_get_contents($counterFile)) + 1;
}
file_put_contents($counterFile, (string) $next, LOCK_EX);
$number = $stamp . str_pad((string) $next, 2, '0', STR_PAD_LEFT);

$payload['number'] = $number;
$payload['savedAt'] = date('c');
$file = $dataDir . '/orcamento-' . $number . '.json';
file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

echo json_encode(['ok' => true, 'number' => $number, 'id' => $number], JSON_UNESCAPED_UNICODE);
