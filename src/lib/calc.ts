import type { Conditions, ItemRow, RowCalculation, Summary } from './types'

export function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === undefined || value === null || value === '') return 0
  const text = String(value).trim()
  if (!text) return 0
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/[^\d.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export function percentRate(value: unknown): number {
  const n = numericValue(value)
  if (!n) return 0
  return n > 1 ? n / 100 : n
}

/** Densidade padrão usada no plugin legado (kg/mm³ efetiva via fator 8). */
const STEEL_FACTOR = 8

export function calculateRow(
  modelId: string,
  row: ItemRow,
  conditions: Conditions,
): RowCalculation {
  const espessura = numericValue(row.espessura)
  const largura = numericValue(row.largura)
  const comprimento = numericValue(row.comprimento)
  const unidade = numericValue(row.unidade)
  const fatorUtilizado = numericValue(row.fator_utilizado)
  const precoFator100 = numericValue(row.preco_fator_100 ?? row.preco)
  const precoBobinaFator100 = numericValue(row.preco_bobina_fator_100)
  const precoServico = numericValue(row.preco_servico)
  const larguraBobina = numericValue(row.largura_bobina)
  const frete = percentRate(conditions.frete_percentual)

  const isCoilWeightModel = modelId === 'bobinas' || modelId === 'slitters_fitas'
  const pesoUnitario = isCoilWeightModel
    ? numericValue(row.peso_unitario)
    : STEEL_FACTOR * espessura * (largura / 1000) * (comprimento / 1000)
  const pesoTotal = isCoilWeightModel
    ? unidade * pesoUnitario
    : unidade * STEEL_FACTOR * espessura * (largura / 1000) * (comprimento / 1000)

  const precoFatorUtilizado = fatorUtilizado ? precoFator100 / (fatorUtilizado / 100) : 0
  const precoBobinaFatorUtilizado = fatorUtilizado
    ? precoBobinaFator100 / (fatorUtilizado / 100)
    : 0

  const quantidadeCortes = larguraBobina && largura ? Math.floor(larguraBobina / largura) : 0
  const perdaMm = larguraBobina && largura ? larguraBobina - largura * quantidadeCortes : 0
  const perdaPercentual = larguraBobina ? perdaMm / larguraBobina : 0
  const pesoNecessario = pesoTotal + pesoTotal * perdaPercentual

  const acrescimoPerdaPercentual =
    perdaMm < 100 ? perdaPercentual : perdaMm < 300 ? perdaPercentual * 0.3 : perdaPercentual * 0.2
  const acrescimoPerdaValor = precoBobinaFator100 * acrescimoPerdaPercentual

  const basePrecoTotal =
    modelId === 'chapas' || !precoBobinaFator100 ? precoFatorUtilizado : precoBobinaFatorUtilizado
  const precoTotal =
    modelId === 'slitters_fitas' || modelId === 'blanks'
      ? basePrecoTotal + acrescimoPerdaValor + precoServico
      : basePrecoTotal + precoServico
  const precoSemIpi = frete === 0 ? precoTotal : precoTotal + precoTotal * frete
  const subtotal = pesoTotal && precoSemIpi ? pesoTotal * precoSemIpi : 0

  return {
    pesoUnitario,
    pesoTotal,
    precoFator100,
    precoFatorUtilizado,
    precoBobinaFator100,
    precoBobinaFatorUtilizado,
    precoTotal,
    precoSemIpi,
    subtotal,
    pesoNecessario,
    quantidadeCortes,
    perdaMm,
    perdaPercentual,
    acrescimoPerdaPercentual,
    acrescimoPerdaValor,
  }
}

export function calculateSummary(
  modelId: string,
  rows: ItemRow[],
  conditions: Conditions,
): Summary {
  let totalKg = 0
  let subtotal = 0
  for (const row of rows) {
    const calculated = calculateRow(modelId, row, conditions)
    totalKg += calculated.precoSemIpi !== 0 ? calculated.pesoTotal : 0
    subtotal += calculated.subtotal
  }
  const ipi = subtotal * 0.0325
  const total = subtotal + ipi
  const frete = percentRate(conditions.frete_percentual)
  return { totalKg, subtotal, ipi, total, frete }
}
