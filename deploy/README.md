# Deploy — Orçamento Bobinas/Chapas

Publicar em `https://vendas.liganer.com.br/bobinas-chapas/`, no mesmo padrão de `/blanks` e `/prospeccao`.

## Deploy automático (GitHub → HostGator)

1. Usuário FTP no cPanel / HostGator.
2. Guardar host, usuário, senha e pasta remota como **GitHub Secrets**.
3. Em cada push na `main`, o Action faz `npm run build` e envia `dist/` para `/bobinas-chapas/`.

### Caminho FTP deste projeto

```
ftp://acesso@liganer.com.br@ftp.liganer.com.br/vendas.liganer.com.br/bobinas-chapas
```

| Secret | Valor |
| --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` |
| `FTP_USERNAME` | `acesso@liganer.com.br` |
| `FTP_PASSWORD` | *(senha FTP — só no GitHub Secrets)* |
| `FTP_SERVER_DIR` | `/vendas.liganer.com.br/bobinas-chapas/` |

`FTP_SERVER_DIR` deve terminar com `/` e apontar para dentro da pasta do app (onde ficará o `index.html`).

### Secrets no GitHub

No repositório `liganer-orcamento-bobinas-chapas`:

**Settings → Secrets and variables → Actions → New repository secret**

Prefira **FTPS**. Se o HostGator só aceitar FTP puro, edite `.github/workflows/deploy.yml` e troque `protocol: ftps` por `protocol: ftp`.

**Não cole a senha no chat nem no código.** Só nos Secrets.

### Primeira publicação

1. Confirme que a pasta `bobinas-chapas` existe no servidor (File Manager).
2. Crie **uma vez** no host a pasta `bobinas-chapas/data/` (gravável pelo PHP). O Action **não** cria nem sobrescreve `data/`.
3. Merge do PR / push na `main`, ou **Actions → Deploy… → Run workflow**.
4. No servidor, crie/edite **apenas no host** o `config.json` (o deploy **não sobrescreve** esse arquivo):

```json
{
  "saveUrl": "/bobinas-chapas/api/budgets.php",
  "syncSecret": "SEU_SEGREDO_FORTE"
}
```

### O que o Action envia

- Conteúdo de `dist/` (HTML/JS/CSS do Vite)
- `api/budgets.php`
- **Não** apaga o servidor inteiro (`dangerous-clean-slate: false`)
- **Não** sobrescreve `config.json` nem arquivos em `data/`

## Build local

```bash
npm ci
npm run build
```

A pasta `dist/` sai com `base: /bobinas-chapas/`.

## Checklist

- [ ] Secrets FTP preenchidos no GitHub
- [ ] Pasta `bobinas-chapas/` existe ao lado de `blanks/` e `prospeccao/`
- [ ] Workflow verde em Actions após push na `main`
- [ ] `https://vendas.liganer.com.br/bobinas-chapas/` abre com título `Liganer · Orçamento`
- [ ] `config.json` no servidor (opcional) não foi commitado no Git
