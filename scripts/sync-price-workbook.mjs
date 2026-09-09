#!/usr/bin/env node
/**
 * Regenera o JSON de fallback a partir da planilha compartilhada:
 *   https://vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx
 *
 * Se o download falhar (offline), usa `legado/precos-chapas-bobinas.xlsx`
 * ou o nome antigo `legado/precos-bobinas-chapas.xlsx`.
 *
 * A planilha NÃO é mais publicada com este app — fica em /orcamento/tabelas/
 * para outros repositórios compartilharem a mesma fonte.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED_URL =
  'https://vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx'
const legadoCandidates = [
  resolve(root, 'legado/precos-chapas-bobinas.xlsx'),
  resolve(root, 'legado/precos-bobinas-chapas.xlsx'),
]
const publicXlsxLegacy = resolve(root, 'public/precos-bobinas-chapas.xlsx')
const jsonOut = resolve(root, 'src/data/precos-bobinas-chapas.json')

const PRICE_HEADERS = {
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

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function normalizeTipo(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function normalizeAcabamento(value) {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (raw === 'ESCOVADO' || raw === 'N4') return 'ESCOVADO'
  return raw
}

function numericValue(value) {
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

function thicknessKey(value) {
  return Math.round(numericValue(value) * 1000) / 1000
}

function roundPrice(value) {
  const n = numericValue(value)
  return n ? Math.round(n * 1e6) / 1e6 : 0
}

function findHeaderColumn(headers, aliases) {
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

function parseWorkbookBuffer(buffer) {
  const book = XLSX.read(buffer, { type: 'buffer' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  const headers = (matrix[0] || []).map(normalizeHeader)
  const colTipo = findHeaderColumn(headers, ['tipo'])
  const colEsp = findHeaderColumn(headers, ['espessura'])
  const colAcab = findHeaderColumn(headers, ['acabamento'])
  const colIcms = findHeaderColumn(headers, ['icms'])

  const priceCols = {}
  for (const [key, aliases] of Object.entries(PRICE_HEADERS)) {
    priceCols[key] = findHeaderColumn(headers, aliases)
  }

  const rows = []
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] || []
    const tipo = normalizeTipo(line[colTipo])
    const acabamento = normalizeAcabamento(line[colAcab])
    const espessura = thicknessKey(line[colEsp])
    if (!tipo || !acabamento || !espessura) continue
    const precos = {}
    for (const key of Object.keys(PRICE_HEADERS)) {
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
  return rows
}

async function loadWorkbook() {
  try {
    const response = await fetch(SHARED_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, source: SHARED_URL }
  } catch (error) {
    const local = legadoCandidates.find((path) => existsSync(path))
    if (!local) {
      console.error(
        'Não foi possível baixar a planilha compartilhada e nenhum arquivo local foi encontrado.',
      )
      console.error('URL:', SHARED_URL)
      console.error('Erro:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
    console.warn(
      `Aviso: download falhou (${error instanceof Error ? error.message : error}). Usando ${local}`,
    )
    return { buffer: readFileSync(local), source: local.replace(`${root}/`, '') }
  }
}

const { buffer, source } = await loadWorkbook()
const rows = parseWorkbookBuffer(buffer)
if (!rows.length) {
  console.error('Planilha sem linhas válidas:', source)
  process.exit(1)
}

mkdirSync(dirname(jsonOut), { recursive: true })
writeFileSync(
  jsonOut,
  `${JSON.stringify({ source, rows }, null, 2)}\n`,
  'utf8',
)

if (existsSync(publicXlsxLegacy)) {
  unlinkSync(publicXlsxLegacy)
  console.log('Removido: public/precos-bobinas-chapas.xlsx (fonte agora é compartilhada)')
}

console.log(`OK: ${rows.length} linhas de ${source} → src/data/precos-bobinas-chapas.json`)
