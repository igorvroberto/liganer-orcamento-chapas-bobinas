<?php
/**
 * API opcional de persistência para vendas.liganer.com.br/orcamento/
 * Mesmo espírito de /prospeccao/api/leads.php — autenticação por X-Sync-Secret.
 *
 * POST — grava orçamento em data/orcamento-{numero}.json
 * GET  — lista resumos (nome, cliente, CNPJ, data/hora)
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST' && $method !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Use GET ou POST']);
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

$dataDir = dirname(__DIR__) . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

if ($method === 'GET') {
    $items = [];
    foreach (glob($dataDir . '/orcamento-*.json') ?: [] as $file) {
        $rawFile = file_get_contents($file);
        $data = json_decode((string) $rawFile, true);
        if (!is_array($data)) {
            continue;
        }
        $number = isset($data['number']) ? (string) $data['number'] : '';
        $client = is_array($data['client'] ?? null) ? $data['client'] : [];
        $createdAt = (string) ($data['createdAt'] ?? $data['savedAt'] ?? '');
        $savedAt = (string) ($data['savedAt'] ?? $data['createdAt'] ?? '');
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $name = $number !== '' ? ('Orçamento Nº ' . $number) : 'Orçamento';
        }
        $items[] = [
            'id' => (string) ($data['id'] ?? basename($file, '.json')),
            'number' => $number !== '' ? $number : null,
            'name' => $name,
            'client' => [
                'name' => (string) ($client['name'] ?? ''),
                'cnpj' => (string) ($client['cnpj'] ?? ''),
            ],
            'createdAt' => $createdAt !== '' ? $createdAt : null,
            'savedAt' => $savedAt !== '' ? $savedAt : null,
            'source' => isset($data['source']) ? (string) $data['source'] : null,
        ];
    }

    usort($items, static function (array $a, array $b): int {
        $ta = (string) ($a['savedAt'] ?? $a['createdAt'] ?? '');
        $tb = (string) ($b['savedAt'] ?? $b['createdAt'] ?? '');
        return strcmp($tb, $ta);
    });

    echo json_encode(['ok' => true, 'items' => $items], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode((string) $raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido']);
    exit;
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
if (!isset($payload['name']) || trim((string) $payload['name']) === '') {
    $payload['name'] = 'Orçamento Nº ' . $number;
}
$file = $dataDir . '/orcamento-' . $number . '.json';
file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

echo json_encode([
    'ok' => true,
    'number' => $number,
    'id' => $number,
    'name' => $payload['name'],
], JSON_UNESCAPED_UNICODE);
