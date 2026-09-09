# Liganer · Orçamento

App interno de orçamento comercial da Liganer, no mesmo padrão dos sistemas em:

- https://vendas.liganer.com.br/blanks/
- https://vendas.liganer.com.br/prospeccao/

Destino de publicação: **https://vendas.liganer.com.br/orcamento/**

## Stack

- Vite + React + TypeScript
- Base path `/orcamento/`
- Cálculos e modelos portados do plugin WordPress legado (`legado/`)
- Persistência local (`localStorage`) + API PHP opcional (`deploy/api/budgets.php`)

## Desenvolvimento

```bash
npm install
npm run dev
```

Em dev o Vite serve em `/orcamento/` (veja `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

## Funcionalidades

- Modelos: Chapas, Bobinas, Slitters e fitas, Blanks (Tubos e barras ainda pendente)
- Cliente (nome / CNPJ), itens, condições (pagamento, frete CIF/FOB, expedição SP/CE…)
- Peso, fator utilizado, frete %, IPI 3,25%
- Ditado por voz (Web Speech API)
- Exportação: PDF cliente, PDF Liganer, Excel, CSV
- Salvar orçamento (local e/ou API com `syncSecret`)

## Deploy

Ver [deploy/README.md](deploy/README.md).

## Legado

A pasta `legado/` guarda o plugin WordPress original (`orcamento-liganer`) que hoje roda em https://liganer.com.br/orcamento-liganer/ — referência das regras de negócio.
