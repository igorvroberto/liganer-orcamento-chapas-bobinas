# Login compartilhado — vendas.liganer.com.br

Auth na **raiz** do domínio (publicado por este repo via `deploy/root-index/` + workflow **Deploy root index**).

## Endpoints

| URL | Uso |
| --- | --- |
| `/login.html` | Tela de login |
| `/auth/login.php` | `POST` `{email,password}` → sessão |
| `/auth/logout.php` | `POST` encerra sessão |
| `/auth/me.php` | `GET` usuário logado (`credentials: 'same-origin'`) |
| `/auth/require.php` | `require` em PHP de outros apps |

Cookie de sessão: `LIGANER_VENDAS_SESS`, `path=/` (vale em `/orcamento/*`, `/prospeccao/`, etc.).

## Usuários

Definidos em `deploy/root-index/auth/bootstrap.php` (senha só como hash bcrypt).

## Nos outros apps (JS)

```ts
const res = await fetch('/auth/me.php', { credentials: 'same-origin', cache: 'no-store' })
if (!res.ok) location.assign('/login.html?next=' + encodeURIComponent(location.pathname))
const { user } = await res.json()
// gravar owner: { id, email, name } no orçamento/lead
```

Referência neste repo: `src/lib/vendasAuth.ts` + coluna **Dono** em orçamentos salvos.
