import type { FieldDef } from './types'

export function normalizeText(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function fieldAliases(field: FieldDef): string[] {
  const base = [field.key, field.label, ...(field.aliases || [])]
  return [...new Set(base.map((s) => normalizeText(String(s).replace(/\n/g, ' '))).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )
}

export function parseSpokenNumber(value: string): number | '' {
  const numberWords: Record<string, number> = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
    treze: 13, quatorze: 14, catorze: 14, quinze: 15, vinte: 20, trinta: 30,
  }
  const clean = normalizeText(value).replace(/\breais?\b|\br\$\b|\bkg\b|\bmm\b/g, '').trim()
  if (numberWords[clean] !== undefined) return numberWords[clean]
  const decimalText = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const numeric = decimalText.match(/-?\d+(\.\d+)?/)
  return numeric ? Number(numeric[0]) : ''
}

export function replaceDictatedSymbols(value: string): string {
  return String(value || '')
    .replace(/\bbarra\b/gi, '/')
    .replace(/\bh[ií]fen\b/gi, '-')
    .replace(/\btra[cç]o\b/gi, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
}

export function coerceDictatedValue(value: string, field: FieldDef): string | number | boolean {
  const raw = field.section === 'Rodapé' ? replaceDictatedSymbols(value) : value

  if (field.key === 'local_expedicao') {
    const clean = normalizeText(raw)
    if (clean === 'sp' || clean === 'sao paulo') return 'SP'
    if (clean === 'ce' || clean === 'ceara') return 'CE'
    return String(raw || '').trim().toUpperCase()
  }

  if (field.type === 'boolean') {
    const clean = normalizeText(raw)
    return /^(sim|true|verdadeiro|marcado|selecionado|check|x)$/.test(clean)
  }

  if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
    const number = parseSpokenNumber(raw)
    return number === '' ? '' : number
  }

  if (field.options?.length) {
    const normalizedValue = normalizeText(raw).replace(/\s/g, '')
    for (const option of field.options) {
      if (normalizeText(option).replace(/\s/g, '') === normalizedValue) return option
      const optionNumber = parseSpokenNumber(option)
      const valueNumber = parseSpokenNumber(raw)
      if (optionNumber !== '' && optionNumber === valueNumber) return option
    }
  }

  return String(raw || '').trim()
}

/** Extrai valor do texto: "tipo 304" ou só "304" para o campo atual. */
export function extractDictatedValue(text: string, field: FieldDef, allFields: FieldDef[]): string {
  const normalized = normalizeText(text)
  if (!normalized) return ''

  // "pular" / "próximo" handled by caller
  for (const candidate of allFields) {
    for (const alias of fieldAliases(candidate)) {
      if (normalized.startsWith(`${alias} `)) {
        if (candidate.key === field.key) return text.slice(alias.length).trim() || text
        // Mentioned another field — ignore for current apply
        return ''
      }
    }
  }

  for (const alias of fieldAliases(field)) {
    if (normalized.startsWith(`${alias} `)) {
      return text.replace(new RegExp(`^${alias}\\s+`, 'i'), '').trim()
    }
  }

  return text.trim()
}

export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } } & { length: number }>
  }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSkipCommand(text: string): boolean {
  return /^(pular|proximo|pr[oó]ximo|avancar|avan[cç]ar)$/i.test(normalizeText(text))
}

export function isNewLineCommand(text: string): boolean {
  return /salvar linha|gravar linha|nova linha/.test(normalizeText(text))
}
