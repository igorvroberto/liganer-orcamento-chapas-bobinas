import { numericValue } from './calc'
import type { FieldDef } from './types'

export function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatPercent(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  if (field.type === 'currency') return formatCurrency(numericValue(value))
  if (field.type === 'percent') {
    const n = numericValue(value)
    return formatPercent(n > 1 ? n / 100 : n)
  }
  if (field.type === 'number') return formatNumber(numericValue(value))
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
