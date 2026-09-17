<?php
/**
 * Sessão compartilhada de vendas.liganer.com.br
 * Cookie path=/ — válido em /orcamento/*, /prospeccao/, etc.
 */
declare(strict_types=1);

const LIGANER_AUTH_SESSION = 'LIGANER_VENDAS_SESS';

function liganer_auth_bootstrap(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    session_name(LIGANER_AUTH_SESSION);
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 14,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function liganer_auth_json_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
}

/**
 * @return array{id:string,email:string,name:string}|null
 */
function liganer_auth_user(): ?array
{
    liganer_auth_bootstrap();
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || empty($user['email'])) {
        return null;
    }
    return [
        'id' => (string) ($user['id'] ?? $user['email']),
        'email' => (string) $user['email'],
        'name' => (string) ($user['name'] ?? $user['email']),
    ];
}

/**
 * @return list<array{id:string,email:string,name:string,password_hash:string}>
 */
function liganer_auth_users(): array
{
    return [
        [
            'id' => 'igor.roberto',
            'email' => 'igor.roberto@liganer.com.br',
            'name' => 'Igor Roberto',
            // senha definida pela equipe; hash bcrypt (não guardar texto puro)
            'password_hash' => '$2y$10$9XZFUpTeKKQOTj1YUsH5o.D/yyAPy1VLr1B/tnd1qrC7W5UMRzAX6',
        ],
        [
            'id' => 'phelipe.hernandez',
            'email' => 'phelipe.hernandez@liganer.com.br',
            'name' => 'Phelipe Hernandez',
            'password_hash' => '$2y$10$HEDlYs7duOBbuJ26H/OrceWXgtNlryzKU7rjoKpDVILf6GcdCUu0G',
        ],
    ];
}

function liganer_auth_public_user(array $user): array
{
    return [
        'id' => (string) $user['id'],
        'email' => (string) $user['email'],
        'name' => (string) $user['name'],
    ];
}
