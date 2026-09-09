# Deploy — Orçamento Chapas/Bobinas

Publicar em `https://vendas.liganer.com.br/orcamento/chapas-bobinas/`.

## Deploy automático (GitHub → HostGator)

1. Usuário FTP no cPanel / HostGator.
2. Guardar host, usuário, senha e pasta remota como **GitHub Secrets**.
3. Em cada push na `main`, o Action faz `npm run build` e envia `dist/` para `/orcamento/chapas-bobinas/`.

### Caminho FTP deste projeto

```
ftp://acesso@liganer.com.br@ftp.liganer.com.br/vendas.liganer.com.br/orcamento/chapas-bobinas
```

| Secret | Valor |
| --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` |
| `FTP_USERNAME` | `acesso@liganer.com.br` |
| `FTP_PASSWORD` | *(senha FTP — só no GitHub Secrets)* |
| `FTP_SERVER_DIR` | `/vendas.liganer.com.br/orcamento/chapas-bobinas/` |

`FTP_SERVER_DIR` deve terminar com `/` e apontar para dentro da pasta do app (onde ficará o `index.html`).

### Secrets no GitHub

No repositório:

**Settings → Secrets and variables → Actions → New repository secret**

Prefira **FTPS**. Se o HostGator só aceitar FTP puro, edite `.github/workflows/deploy.yml` e troque `protocol: ftps` por `protocol: ftp`.

**Não cole a senha no chat nem no código.** Só nos Secrets.

### Home simples em `vendas.liganer.com.br/`

Há um workflow separado: **Deploy root index to vendas.liganer.com.br**.

- Fonte: `deploy/root-index/index.html`
- Destino FTP: `/vendas.liganer.com.br/`
- Publica apenas o `index.html` da raiz, sem mexer em `/orcamento/blanks-slitters/`, `/orcamento/chapas-bobinas/` e `/prospeccao/`

Roda automaticamente no push da `main` quando `deploy/root-index/` (ou o próprio workflow) muda. Também dá para disparar em **Actions → Run workflow**.

### Atualizar preços (planilha Excel)

O app carrega `precos-bobinas-chapas.xlsx` ao abrir a página.

- **Via GitHub:** substitua `legado/precos-bobinas-chapas.xlsx`, faça merge — o build copia para `public/` e publica no FTP.
- **Via FTP direto:** substitua apenas `…/orcamento/chapas-bobinas/precos-bobinas-chapas.xlsx` no HostGator e faça hard-refresh (sem precisar rebuild), mantendo os mesmos cabeçalhos.

### Primeira publicação

1. Confirme que a pasta `orcamento/chapas-bobinas` existe no servidor (File Manager).
2. Crie **uma vez** no host a pasta `orcamento/chapas-bobinas/data/` (gravável pelo PHP). O Action **não** cria nem sobrescreve `data/`.
3. Merge do PR / push na `main`, ou **Actions → Deploy… → Run workflow**.
4. No servidor, crie/edite **apenas no host** o `config.json` (o deploy **não sobrescreve** esse arquivo):

```json
{
  "saveUrl": "/orcamento/chapas-bobinas/api/budgets.php",
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

A pasta `dist/` sai com `base: /orcamento/chapas-bobinas/`.

## Checklist

- [ ] Secrets FTP preenchidos no GitHub (`FTP_SERVER_DIR` = `/vendas.liganer.com.br/orcamento/chapas-bobinas/`)
- [ ] Pasta `orcamento/chapas-bobinas/` existe no host
- [ ] Workflow verde em Actions após push na `main`
- [ ] `https://vendas.liganer.com.br/orcamento/chapas-bobinas/` abre com título `Liganer · Orçamento`
- [ ] `config.json` no servidor (opcional) não foi commitado no Git
