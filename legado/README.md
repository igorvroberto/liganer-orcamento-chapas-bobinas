# Plugin WordPress legado

Código original do plugin `orcamento-liganer` (v0.2.1) que alimenta
https://liganer.com.br/orcamento-liganer/.

Mantido apenas como referência das regras de negócio. O app ativo deste
repositório é a SPA Vite/React publicada em
`vendas.liganer.com.br/orcamento/chapas-bobinas/`.

A planilha `precos-bobinas-chapas.xlsx` é a **fonte dos preços** (fator 100 / ICMS).

Fluxo de atualização:
1. Substitua `legado/precos-bobinas-chapas.xlsx` pela nova planilha (mesmo formato de colunas).
2. Rode `npm run sync:prices` (ou qualquer `npm run build` — o `prebuild` já sincroniza).
3. Isso atualiza `public/precos-bobinas-chapas.xlsx` (lido pelo app no ar) e o JSON de fallback.

No navegador, o app busca `/orcamento/chapas-bobinas/precos-bobinas-chapas.xlsx` ao abrir. Também é possível trocar só esse arquivo no HostGator (FTP) e dar hard-refresh, sem rebuild — desde que o cabeçalho/colunas permaneçam iguais.
