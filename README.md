# Liganer · Orçamento

App interno de orçamento comercial da Liganer, no mesmo padrão dos sistemas em:

- https://vendas.liganer.com.br/blanks/
- https://vendas.liganer.com.br/prospeccao/

Destino de publicação: **https://vendas.liganer.com.br/bobinas-chapas/**

## Stack

- Vite + React + TypeScript
- Base path `/bobinas-chapas/`
- Cálculos e modelos portados do plugin WordPress legado (`legado/`)
- Persistência local (`localStorage`) + API PHP opcional (`deploy/api/budgets.php`)

## Desenvolvimento

```bash
npm install
npm run dev
```

Em dev o Vite serve em `/bobinas-chapas/` (veja `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

O `prebuild` sincroniza a planilha de preços (`legado/precos-bobinas-chapas.xlsx` → `public/` + JSON de fallback). Em produção o app lê o Excel em `/bobinas-chapas/precos-bobinas-chapas.xlsx` automaticamente.

## Atualizar preços

1. Envie/substitua `legado/precos-bobinas-chapas.xlsx` (mesmas colunas).
2. Commit + merge/deploy — ou, no HostGator, troque só `precos-bobinas-chapas.xlsx` e dê hard-refresh.
## Funcionalidades

- Modelo único de chapas e bobinas (material selecionável)
- Cliente (nome / CNPJ), itens, condições (pagamento, frete CIF/FOB, expedição SP/CE…)
- Preço fator 100 e ICMS pela planilha Excel
- Peso, fator utilizado, frete %, IPI 3,25%
- Ditado por voz (Web Speech API)
- Exportação: PDF cliente, PDF Liganer, Excel, CSV
- Salvar orçamento (local e/ou API com `syncSecret`)

## Deploy

Ver [deploy/README.md](deploy/README.md).

## Legado

A pasta `legado/` guarda o plugin WordPress original (`orcamento-liganer`) que hoje roda em https://liganer.com.br/orcamento-liganer/ — referência das regras de negócio.
