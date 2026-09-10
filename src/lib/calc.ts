import { lookupCatalogPrice, usesPriceCatalog } from './priceCatalog'
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
  // 1 = 1% (não 100%). Só valores < 1 são tratados como taxa já decimal (ex.: 0,05).
  return n >= 1 ? n / 100 : n
}

/** Densidade padrão usada no plugin legado (kg/mm³ efetiva via fator 8). */
const STEEL_FACTOR = 8

/** Bobina (inteira/reduzida): peso manual. Chapa: peso pela fórmula. Sem material, cai no padrão do modelo. */
export function normalizeMaterial(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function isChapaMaterial(row: ItemRow): boolean {
  return normalizeMaterial(row.material) === 'chapa'
}

export function isBobinaMaterial(row: ItemRow): boolean {
  const material = normalizeMaterial(row.material)
  return material === 'bobina' || material.startsWith('bobina ')
}

export function usesManualUnitWeight(_modelId: string, row: ItemRow): boolean {
  if (isBobinaMaterial(row)) return true
  if (isChapaMaterial(row)) return false
  return false
}

export function sheetUnitWeight(row: ItemRow): number {
  const espessura = numericValue(row.espessura)
  const largura = numericValue(row.largura)
  const comprimento = numericValue(row.comprimento)
  return STEEL_FACTOR * espessura * (largura / 1000) * (comprimento / 1000)
}

export function calculateRow(
  modelId: string,
  row: ItemRow,
  _conditions: Conditions,
): RowCalculation {
  const unidade = numericValue(row.unidade)
  const fatorUtilizado = numericValue(row.fator_utilizado)
  const catalog = usesPriceCatalog(modelId) ? lookupCatalogPrice(row) : null
  const catalogPrice = catalog?.precoFator100 ?? 0
  const precoFator100 = catalogPrice || numericValue(row.preco_fator_100 ?? row.preco)
  const precoBobinaFator100 = catalogPrice || numericValue(row.preco_bobina_fator_100)
  const precoServico = numericValue(row.preco_servico)
  const largura = numericValue(row.largura)
  const larguraBobina = numericValue(row.largura_bobina)
  const frete = percentRate(row.frete_percentual)
  const icms = catalog?.icms ?? percentRate(row.icms)

  const manualWeight = usesManualUnitWeight(modelId, row)
  const rawUnitWeight = manualWeight ? numericValue(row.peso_unitario) : sheetUnitWeight(row)
  const pesoUnitario = Math.round(rawUnitWeight)
  const pesoTotal = Math.round(unidade * rawUnitWeight)

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

  const precoTotal = precoFatorUtilizado + precoServico
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
    icms,
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
  return { totalKg, subtotal, ipi, total, frete: 0 }
}
