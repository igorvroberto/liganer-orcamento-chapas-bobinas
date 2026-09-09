# Deploy — Orçamento Liganer

Publicar em `https://vendas.liganer.com.br/orcamento/`, no mesmo padrão de `/blanks` e `/prospeccao`.

## Build

```bash
npm ci
npm run build
```

A pasta `dist/` já sai com `base: /orcamento/`.

## Publicação

1. Envie o conteúdo de `dist/` para o docroot em `/orcamento/` (ou equivalente no HostGator / Apache).
2. Copie `deploy/api/budgets.php` para `/orcamento/api/budgets.php`.
3. Garanta que `/orcamento/data/` exista e seja gravável pelo PHP (para salvar JSON dos orçamentos).
4. Em `/orcamento/config.json`, defina `syncSecret` **somente no servidor** (não commitar segredo real). Sem ele, o app salva só no `localStorage` do navegador.

Exemplo de `config.json` no servidor:

```json
{
  "saveUrl": "/orcamento/api/budgets.php",
  "syncSecret": "SEU_SEGREDO"
}
```

Ou exporte `ORCAMENTO_SYNC_SECRET` no ambiente do PHP.

## SPA fallback

Se o host não reescrever rotas, o app é single-page em `/orcamento/` (sem rotas client-side obrigatórias). Mantenha `index.html` como documento padrão da pasta.

## Checklist

- [ ] `https://vendas.liganer.com.br/orcamento/` abre com título `Liganer · Orçamento`
- [ ] Cálculo de chapas / bobinas responde ao editar medidas e fator
- [ ] PDF cliente / PDF Liganer / Excel / CSV funcionam
- [ ] Salvar sem `syncSecret` grava localmente; com segredo chama a API
