# Liganer · Orçamento

App interno de orçamento comercial da Liganer, no mesmo padrão dos sistemas em:

- https://vendas.liganer.com.br/orcamento/blanks-slitters/
- https://vendas.liganer.com.br/prospeccao/

Destino de publicação: **https://vendas.liganer.com.br/orcamento/chapas-bobinas/**

## Stack

- Vite + React + TypeScript
- Base path `/orcamento/chapas-bobinas/`
- Cálculos e modelos portados do plugin WordPress legado (`legado/`)
- Persistência local (`localStorage`) + API PHP opcional (`deploy/api/budgets.php`)

## Desenvolvimento

```bash
npm install
npm run dev
```

Em dev o Vite serve em `/orcamento/chapas-bobinas/` (veja `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

O `prebuild` regenera o JSON de fallback a partir da planilha compartilhada
(`/orcamento/tabelas/precos-chapas-bobinas.xlsx`). Em produção o app lê esse Excel
direto no host (fora da pasta deste app), para outros repositórios usarem a mesma fonte.

## Atualizar preços

1. Substitua no HostGator: `/vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx`
2. Hard-refresh no navegador — sem rebuild. (Opcional: `npm run sync:prices` para atualizar o JSON de fallback no repo.)

As opções de **Tipo**, **Acabamento**, **PVC** e **Espessura** também vêm dessa planilha.
Acabamento é filtrado pelo tipo; espessura pelo par tipo+acabamento (como em blanks-slitters).

## Funcionalidades

- Modelo único de chapas e bobinas (material selecionável)
- Cliente (nome / CNPJ), itens, condições (pagamento, frete CIF/FOB, expedição SP/CE…)
- Preço fator 100 e ICMS pela planilha Excel
- Peso, fator utilizado, frete %, IPI 3,25%
- Exportação: PDF cliente, PDF Liganer, Excel, CSV
- Salvar orçamento (local e/ou API com `syncSecret`)

## Deploy

Ver [deploy/README.md](deploy/README.md).

## Legado

A pasta `legado/` guarda o plugin WordPress original (`orcamento-liganer`) que hoje roda em https://liganer.com.br/orcamento-liganer/ — referência das regras de negócio.

## Fluxo de contribuição

Alterações entram via **pull request** (sem push direto na `main` pelo agent).
