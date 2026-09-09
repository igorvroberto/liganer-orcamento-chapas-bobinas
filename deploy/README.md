# Deploy — Orçamento Liganer

Publicar em `https://vendas.liganer.com.br/orcamento/`, no mesmo padrão de `/blanks` e `/prospeccao`.

## Deploy automático (GitHub → HostGator)

Não é preciso “dar o FTP ao GitHub” como usuário permanente. O jeito certo:

1. Criar (ou reutilizar) um usuário FTP no cPanel / HostGator.
2. Guardar host, usuário, senha e pasta remota como **GitHub Secrets**.
3. Em cada push na `main`, o Action `Deploy to vendas.liganer.com.br/orcamento` faz `npm run build` e envia a pasta `dist/` para `/orcamento/`.

### 1) Credenciais no HostGator

No cPanel:

- **FTP Accounts** → criar conta só para deploy (recomendado) ou usar a conta principal.
- Anote:
  - **Servidor** — em geral `ftp.liganer.com.br` ou o IP / host que o cPanel mostrar
  - **Usuário** — ex.: `deploy@liganer.com.br` ou `usuario`
  - **Senha**
  - **Pasta remota do app** — algo como `public_html/orcamento/` ou a pasta do subdomínio `vendas.liganer.com.br` + `/orcamento/`
- Prefira **FTPS** (FTP com TLS). Se o host só aceitar FTP puro, use protocolo `ftp`.

Confirme no File Manager onde estão `/blanks` e `/prospeccao` — a pasta irmã `orcamento` deve ficar no mesmo nível.

### 2) Secrets no GitHub

No repositório `liganer-orcamento`:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Exemplo | Obrigatório |
| --- | --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` | sim |
| `FTP_USERNAME` | `usuario@liganer.com.br` | sim |
| `FTP_PASSWORD` | *(sua senha)* | sim |
| `FTP_SERVER_DIR` | `/public_html/orcamento/` ou `/home/.../vendas.liganer.com.br/orcamento/` | sim |

Se o HostGator **não** aceitar FTPS, edite `.github/workflows/deploy.yml` e troque `protocol: ftps` por `protocol: ftp` (e a porta se o cPanel indicar outra).

**Não cole a senha no chat nem no código.** Só nos Secrets.

O caminho `FTP_SERVER_DIR` deve terminar com `/` e apontar **para dentro** da pasta `orcamento` (onde ficará o `index.html` do build).

### 3) Primeira publicação

1. Crie a pasta `orcamento` no servidor (vazia ou com o API já preparado).
2. Faça merge do PR / push na `main` **ou** rode o workflow manualmente: **Actions → Deploy to vendas… → Run workflow**.
3. No servidor, crie/edite **apenas no host** o arquivo `config.json` (o deploy **não sobrescreve** esse arquivo):

```json
{
  "saveUrl": "/orcamento/api/budgets.php",
  "syncSecret": "SEU_SEGREDO_FORTE"
}
```

4. Garanta que `orcamento/data/` seja gravável pelo PHP (`chmod 755` ou 775 conforme o host).

### 4) O que o Action envia

- Conteúdo de `dist/` (HTML/JS/CSS do Vite)
- `api/budgets.php`
- **Não** apaga o servidor inteiro (`dangerous-clean-slate: false`)
- **Não** sobrescreve `config.json` nem arquivos em `data/`

## Build local

```bash
npm ci
npm run build
```

A pasta `dist/` já sai com `base: /orcamento/`.

## Checklist

- [ ] Secrets FTP preenchidos no GitHub
- [ ] Pasta `orcamento/` existe ao lado de `blanks/` e `prospeccao/`
- [ ] Workflow verde em Actions após push na `main`
- [ ] `https://vendas.liganer.com.br/orcamento/` abre com título `Liganer · Orçamento`
- [ ] `config.json` no servidor (opcional, para sync) não foi commitado no Git
