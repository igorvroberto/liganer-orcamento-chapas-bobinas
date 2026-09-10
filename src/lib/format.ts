import { numericValue } from './calc'
import type { FieldDef } from './types'

export function formatNumber(
  value: number,
  fractionDigits = 2,
  useGrouping = true,
): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping,
  })
}

export function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatPercent(value: number, fractionDigits = 2): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function displayFieldValue(value: unknown, field: FieldDef): string {
  if (field.type === 'boolean') {
    return value ? 'Sim' : 'Não'
  }
  if (value === undefined || value === null || value === '') return '—'
  const digits = field.fractionDigits ?? 2
  if (field.type === 'currency') return formatCurrency(numericValue(value))
  if (field.type === 'percent') {
    const n = numericValue(value)
    return formatPercent(n >= 1 ? n / 100 : n, digits)
  }
  if (field.type === 'number') {
    const n = numericValue(value)
    const rounded = digits === 0 ? Math.round(n) : n
    return formatNumber(rounded, digits, field.useGrouping !== false)
  }
  return String(value)
}

export function emptyRowDefaults(fields: FieldDef[]): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {}
  for (const field of fields) {
    if (field.default !== undefined) row[field.key] = field.default
    if (field.type === 'boolean') row[field.key] = false
  }
  return row
}
