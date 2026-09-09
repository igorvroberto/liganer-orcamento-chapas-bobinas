import * as XLSX from 'xlsx'
import fallbackCatalog from '../data/precos-bobinas-chapas.json'
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

const PRICE_HEADERS: Record<PriceColumnKey, string[]> = {
  bobina_inteira: ['bobina inteira'],
  bobina_reduzida_ou_chapa_sem_pvc: [
    'bobina reduzida ou chapa sem pvc',
    'bobina reduzida',
    'chapa sem pvc',
  ],
  azul: ['azul'],
  preto_e_branco: ['preto e branco'],
  preto: ['preto'],
  nitto_fiber: ['nitto fiber', 'fiber'],
}

/** Colunas de preço que viram opções de PVC (além de NÃO). */
const PVC_OPTION_LABELS: Partial<Record<PriceColumnKey, string>> = {
  azul: 'AZUL',
  preto_e_branco: 'PRETO E BRANCO',
  preto: 'PRETO',
  nitto_fiber: 'NITTO FIBER',
}

const DEFAULT_PVC_COLUMNS = Object.keys(PVC_OPTION_LABELS) as PriceColumnKey[]

export type CatalogSelectOptions = {
  tipo: string[]
  acabamento: string[]
  pvc: string[]
  espessura: string[]
}

export type ParsedPriceWorkbook = {
  rows: PriceCatalogRow[]
  pvcColumns: PriceColumnKey[]
}

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

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function normalizeMaterial(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/** Acabamento canônico: ESCOVADO (planilha pode vir como N4 legado). */
export function normalizeAcabamento(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (raw === 'ESCOVADO' || raw === 'N4') return 'ESCOVADO'
  return raw
}

/** Rótulo de UI do acabamento (já canônico). */
export function displayAcabamentoOption(value: unknown): string {
  return normalizeAcabamento(value)
}

/** Espessura no select no formato pt-BR (ex.: 0,40). */
export function formatThicknessOption(value: number): string {
  return value.toFixed(2).replace('.', ',')
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

function roundPrice(value: unknown): number {
  const n = numericValue(value)
  return n ? Math.round(n * 1e6) / 1e6 : 0
}

function buildIndex(rows: PriceCatalogRow[]): Map<string, PriceCatalogRow> {
  const next = new Map<string, PriceCatalogRow>()
  for (const row of rows) {
    next.set(`${row.tipo}|${thicknessKey(row.espessura)}|${row.acabamento}`, row)
  }
  return next
}

function findHeaderColumn(headers: string[], aliases: string[]): number {
  // Match exato primeiro — evita "preto" capturar a coluna "preto e branco".
  for (const alias of aliases) {
    const exact = headers.findIndex((header) => header === alias)
    if (exact >= 0) return exact
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((header) => header.includes(alias))
    if (partial >= 0) return partial
  }
  return -1
}

/** Converte a 1ª aba do Excel no formato interno do catálogo. */
export function parsePriceWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedPriceWorkbook {
  const book = XLSX.read(buffer, { type: 'array' })
  const sheetName = book.SheetNames[0]
  if (!sheetName) return { rows: [], pvcColumns: [...DEFAULT_PVC_COLUMNS] }
  const sheet = book.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  if (!matrix.length) return { rows: [], pvcColumns: [...DEFAULT_PVC_COLUMNS] }

  const headers = (matrix[0] || []).map(normalizeHeader)
  const colTipo = findHeaderColumn(headers, ['tipo'])
  const colEsp = findHeaderColumn(headers, ['espessura'])
  const colAcab = findHeaderColumn(headers, ['acabamento'])
  const colIcms = findHeaderColumn(headers, ['icms'])
  if (colTipo < 0 || colEsp < 0 || colAcab < 0) {
    return { rows: [], pvcColumns: [...DEFAULT_PVC_COLUMNS] }
  }

  const priceCols = {} as Record<PriceColumnKey, number>
  for (const key of Object.keys(PRICE_HEADERS) as PriceColumnKey[]) {
    priceCols[key] = findHeaderColumn(headers, PRICE_HEADERS[key])
  }
  const pvcColumns = DEFAULT_PVC_COLUMNS.filter((key) => priceCols[key] >= 0)

  const rows: PriceCatalogRow[] = []
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] || []
    const tipo = normalizeTipo(line[colTipo])
    const acabamento = normalizeAcabamento(line[colAcab])
    const espessura = thicknessKey(line[colEsp])
    if (!tipo || !acabamento || !espessura) continue
    const precos = {
      bobina_inteira: 0,
      bobina_reduzida_ou_chapa_sem_pvc: 0,
      azul: 0,
      preto_e_branco: 0,
      preto: 0,
      nitto_fiber: 0,
    } as Record<PriceColumnKey, number>
    for (const key of Object.keys(precos) as PriceColumnKey[]) {
      const col = priceCols[key]
      precos[key] = col >= 0 ? roundPrice(line[col]) : 0
    }
    rows.push({
      tipo,
      espessura,
      acabamento,
      icms: colIcms >= 0 ? numericValue(line[colIcms]) : 0,
      precos,
    })
  }
  return { rows, pvcColumns }
}

const fallback = fallbackCatalog as CatalogFile
let sourceLabel = fallback.source || 'fallback-json'
let catalogRows: PriceCatalogRow[] = fallback.rows
let index = buildIndex(catalogRows)
let pvcColumnsPresent: PriceColumnKey[] = [...DEFAULT_PVC_COLUMNS]

export function getPriceCatalogMeta(): { source: string; rows: number } {
  return { source: sourceLabel, rows: catalogRows.length }
}

export function setPriceCatalogRows(
  rows: PriceCatalogRow[],
  source: string,
  pvcColumns: PriceColumnKey[] = DEFAULT_PVC_COLUMNS,
): void {
  catalogRows = rows
  sourceLabel = source
  index = buildIndex(rows)
  pvcColumnsPresent = pvcColumns.length ? [...pvcColumns] : [...DEFAULT_PVC_COLUMNS]
}

/**
 * Planilha compartilhada entre apps de orçamento (fora deste deploy):
 * https://vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx
 */
export const SHARED_PRICE_WORKBOOK_PATH =
  '/orcamento/tabelas/precos-chapas-bobinas.xlsx'

/** URL pública do Excel compartilhado em /orcamento/tabelas/. */
export function priceWorkbookUrl(): string {
  return SHARED_PRICE_WORKBOOK_PATH
}

/**
 * Busca o Excel no servidor e atualiza o catálogo em memória.
 * Se falhar, mantém o JSON embutido no build.
 */
export async function loadPriceCatalogFromExcel(
  url: string = priceWorkbookUrl(),
): Promise<{ ok: boolean; rows: number; source: string; error?: string }> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return {
        ok: false,
        rows: catalogRows.length,
        source: sourceLabel,
        error: `HTTP ${response.status}`,
      }
    }
    const buffer = await response.arrayBuffer()
    const parsed = parsePriceWorkbook(buffer)
    if (!parsed.rows.length) {
      return {
        ok: false,
        rows: catalogRows.length,
        source: sourceLabel,
        error: 'Planilha sem linhas válidas',
      }
    }
    setPriceCatalogRows(parsed.rows, url, parsed.pvcColumns)
    return { ok: true, rows: parsed.rows.length, source: url }
  } catch (error) {
    return {
      ok: false,
      rows: catalogRows.length,
      source: sourceLabel,
      error: error instanceof Error ? error.message : 'Falha ao carregar planilha',
    }
  }
}

/** Opções de select derivadas da planilha (ou do JSON de fallback). */
export function getCatalogSelectOptions(): CatalogSelectOptions {
  const tipos: string[] = []
  const acabamentos: string[] = []
  const espessuras: number[] = []
  const seenTipo = new Set<string>()
  const seenAcab = new Set<string>()
  const seenEsp = new Set<number>()

  for (const row of catalogRows) {
    if (row.tipo && !seenTipo.has(row.tipo)) {
      seenTipo.add(row.tipo)
      tipos.push(row.tipo)
    }
    if (row.acabamento) {
      const label = displayAcabamentoOption(row.acabamento)
      if (!seenAcab.has(label)) {
        seenAcab.add(label)
        acabamentos.push(label)
      }
    }
    if (row.espessura && !seenEsp.has(row.espessura)) {
      seenEsp.add(row.espessura)
      espessuras.push(row.espessura)
    }
  }

  espessuras.sort((a, b) => a - b)

  return {
    tipo: tipos,
    acabamento: acabamentos,
    pvc: [
      'NÃO',
      ...pvcColumnsPresent
        .map((key) => PVC_OPTION_LABELS[key])
        .filter((label): label is string => Boolean(label)),
    ],
    espessura: espessuras.map(formatThicknessOption),
  }
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
  return modelId === 'chapas'
}
