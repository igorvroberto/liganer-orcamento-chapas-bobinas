<?php
/**
 * API opcional de persistência para vendas.liganer.com.br/orcamento/
 * Mesmo espírito de /prospeccao/api/leads.php — autenticação por X-Sync-Secret.
 *
 * POST   — cria ou atualiza (se number já existir) data/orcamento-{numero}.json
 * GET    — lista resumos; com ?number= retorna o JSON completo
 * DELETE — remove orçamento (?number=)
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST' && $method !== 'GET' && $method !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Use GET, POST ou DELETE']);
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

if ($method === 'DELETE') {
    $requestedNumber = preg_replace('/\D+/', '', (string) ($_GET['number'] ?? ''));
    if ($requestedNumber === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Informe number']);
        exit;
    }
    $file = $dataDir . '/orcamento-' . $requestedNumber . '.json';
    if (!is_readable($file)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Orçamento não encontrado']);
        exit;
    }
    if (!unlink($file)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Falha ao excluir']);
        exit;
    }
    echo json_encode(['ok' => true, 'number' => $requestedNumber], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'GET') {
    $requestedNumber = preg_replace('/\D+/', '', (string) ($_GET['number'] ?? ''));
    if ($requestedNumber !== '') {
        $file = $dataDir . '/orcamento-' . $requestedNumber . '.json';
        if (!is_readable($file)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Orçamento não encontrado']);
            exit;
        }
        $rawFile = file_get_contents($file);
        $data = json_decode((string) $rawFile, true);
        if (!is_array($data)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Arquivo inválido']);
            exit;
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

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
        $name = $number !== '' ? $number : trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $name = '—';
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

$existingNumber = preg_replace('/\D+/', '', (string) ($payload['number'] ?? ''));
$existingFile = $existingNumber !== '' ? ($dataDir . '/orcamento-' . $existingNumber . '.json') : '';
$updating = $existingNumber !== '' && is_readable($existingFile);

if ($updating) {
    $number = $existingNumber;
    $previous = json_decode((string) file_get_contents($existingFile), true);
    if (is_array($previous) && !empty($previous['createdAt']) && empty($payload['createdAt'])) {
        $payload['createdAt'] = $previous['createdAt'];
    }
    if (is_array($previous) && !empty($previous['id']) && empty($payload['id'])) {
        $payload['id'] = $previous['id'];
    }
} else {
    $stamp = date('ymd');
    $counterFile = $dataDir . '/counter-' . $stamp . '.txt';
    $next = 1;
    if (is_readable($counterFile)) {
        $next = ((int) file_get_contents($counterFile)) + 1;
    }
    file_put_contents($counterFile, (string) $next, LOCK_EX);
    $number = $stamp . str_pad((string) $next, 2, '0', STR_PAD_LEFT);
}

$payload['number'] = $number;
$payload['name'] = $number;
$payload['savedAt'] = date('c');
if (empty($payload['createdAt'])) {
    $payload['createdAt'] = $payload['savedAt'];
}
$file = $dataDir . '/orcamento-' . $number . '.json';
file_put_contents($file, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

echo json_encode([
    'ok' => true,
    'number' => $number,
    'id' => $payload['id'] ?? $number,
    'name' => $number,
    'updated' => $updating,
], JSON_UNESCAPED_UNICODE);
