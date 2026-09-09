#!/usr/bin/env node
/**
 * Sincroniza a planilha Excel de preços:
 * - copia legado/precos-bobinas-chapas.xlsx → public/ (publicado no site)
 * - regenera src/data/precos-bobinas-chapas.json (fallback do app)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceXlsx = resolve(root, 'legado/precos-bobinas-chapas.xlsx')
const publicXlsx = resolve(root, 'public/precos-bobinas-chapas.xlsx')
const jsonOut = resolve(root, 'src/data/precos-bobinas-chapas.json')

if (!existsSync(sourceXlsx)) {
  console.error('Arquivo não encontrado:', sourceXlsx)
  process.exit(1)
}

mkdirSync(dirname(publicXlsx), { recursive: true })
copyFileSync(sourceXlsx, publicXlsx)

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
  if (raw === 'ESCOVADO' || raw === 'N4') return 'N4'
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
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]
    if (aliases.some((alias) => header === alias || header.includes(alias))) return i
  }
  return -1
}

const book = XLSX.read(readFileSync(sourceXlsx), { type: 'buffer' })
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

mkdirSync(dirname(jsonOut), { recursive: true })
writeFileSync(
  jsonOut,
  `${JSON.stringify({ source: 'legado/precos-bobinas-chapas.xlsx', rows }, null, 2)}\n`,
  'utf8',
)

console.log(`OK: ${rows.length} linhas → public/precos-bobinas-chapas.xlsx + src/data/precos-bobinas-chapas.json`)
