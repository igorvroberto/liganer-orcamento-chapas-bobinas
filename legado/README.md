# Plugin WordPress legado

Código original do plugin `orcamento-liganer` (v0.2.1) que alimenta
https://liganer.com.br/orcamento-liganer/.

Mantido apenas como referência das regras de negócio. O app ativo deste
repositório é a SPA Vite/React publicada em
`vendas.liganer.com.br/orcamento/chapas-bobinas/`.

## Planilha de preços

A fonte oficial (compartilhada com outros apps) fica no HostGator:

`/vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx`

URL: `https://vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx`

Arquivos `legado/precos-*.xlsx` neste diretório são só fallback local para
`npm run sync:prices` quando o download da URL compartilhada falha.
