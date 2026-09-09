import catalog from '../data/precos-bobinas-chapas.json'
import type { ItemRow } from './types'

export type PriceColumnKey =
  | 'bobina_inteira'
  | 'bobina_reduzida_ou_chapa_sem_pvc'
  | 'azul'
  | 'preto_e_branco'
  | 'preto'
  | 'nitto_fiber'

export type PriceCatalogRow = {
  tipo: string
  espessura: number
  acabamento: string
  icms: number
  precos: Record<PriceColumnKey, number>
}

type CatalogFile = {
  source: string
  rows: PriceCatalogRow[]
}

const data = catalog as CatalogFile

function numericValue(value: unknown): number {
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

function normalizeMaterial(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/** Acabamento do app ESCOVADO = N4 na planilha. */
export function normalizeAcabamento(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (raw === 'ESCOVADO' || raw === 'N4') return 'N4'
  return raw
}

export function normalizeTipo(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

export function normalizePvc(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

/**
 * Coluna de preço na planilha:
 * - PVC colorido / Fiber → coluna do PVC
 * - Sem PVC + Bobina inteira → Bobina inteira
 * - Sem PVC + Bobina reduzida ou Chapa → Bobina reduzida ou chapa sem PVC
 */
export function resolvePriceColumn(row: ItemRow): PriceColumnKey | null {
  const pvc = normalizePvc(row.pvc)
  if (!pvc || pvc === 'NAO') {
    const material = normalizeMaterial(row.material)
    if (material === 'bobina inteira') return 'bobina_inteira'
    if (material === 'bobina reduzida' || material === 'chapa') {
      return 'bobina_reduzida_ou_chapa_sem_pvc'
    }
    return null
  }
  if (pvc === 'AZUL') return 'azul'
  if (pvc === 'PRETO E BRANCO') return 'preto_e_branco'
  if (pvc === 'PRETO') return 'preto'
  if (pvc === 'NITTO FIBER' || pvc === 'FIBER' || pvc === 'NITTO') return 'nitto_fiber'
  return null
}

function thicknessKey(value: unknown): number {
  return Math.round(numericValue(value) * 1000) / 1000
}

const index = new Map<string, PriceCatalogRow>()
for (const row of data.rows) {
  const key = `${row.tipo}|${thicknessKey(row.espessura)}|${row.acabamento}`
  index.set(key, row)
}

export function findPriceRow(row: ItemRow): PriceCatalogRow | null {
  const tipo = normalizeTipo(row.tipo)
  const acabamento = normalizeAcabamento(row.acabamento)
  const espessura = thicknessKey(row.espessura)
  if (!tipo || !acabamento || !espessura) return null
  return index.get(`${tipo}|${espessura}|${acabamento}`) ?? null
}

export type CatalogLookup = {
  precoFator100: number
  icms: number
  matched: boolean
  column: PriceColumnKey | null
}

export function lookupCatalogPrice(row: ItemRow): CatalogLookup {
  const priceRow = findPriceRow(row)
  const column = resolvePriceColumn(row)
  if (!priceRow) {
    return { precoFator100: 0, icms: 0, matched: false, column }
  }
  const precoFator100 = column ? priceRow.precos[column] || 0 : 0
  return {
    precoFator100,
    icms: priceRow.icms || 0,
    matched: Boolean(column) && precoFator100 > 0,
    column,
  }
}

export function usesPriceCatalog(modelId: string): boolean {
  return modelId === 'chapas' || modelId === 'bobinas'
}
