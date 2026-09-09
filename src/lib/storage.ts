import type { BudgetRecord } from './types'

const STORAGE_KEY = 'liganer-orcamento-draft-v1'
const SAVED_KEY = 'liganer-orcamento-saved-v1'

const memory: Record<string, string> = {}

function getItem(key: string, fallback = ''): string {
  try {
    return window.localStorage?.getItem(key) ?? fallback
  } catch {
    return memory[key] ?? fallback
  }
}

function setItem(key: string, value: string): void {
  try {
    window.localStorage?.setItem(key, value)
  } catch {
    memory[key] = value
  }
}

export type DraftState = {
  modelId: string
  client: { name: string; cnpj: string }
  rowsByModel: Record<string, Record<string, string | number | boolean | undefined>[]>
  draftsByModel: Record<string, Record<string, string | number | undefined>>
}

export function loadDraft(): DraftState | null {
  try {
    const raw = getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DraftState
  } catch {
    return null
  }
}

export function saveDraft(state: DraftState): void {
  setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadSavedBudgets(): BudgetRecord[] {
  try {
    return JSON.parse(getItem(SAVED_KEY, '[]')) as BudgetRecord[]
  } catch {
    return []
  }
}

export function pushSavedBudget(record: BudgetRecord): void {
  const list = loadSavedBudgets()
  list.push(record)
  setItem(SAVED_KEY, JSON.stringify(list))
}

export type SyncConfig = {
  saveUrl?: string
  printNumberUrl?: string
  syncSecret?: string
}

export async function loadConfig(): Promise<SyncConfig> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (!res.ok) return {}
    return (await res.json()) as SyncConfig
  } catch {
    return {}
  }
}

export async function saveBudgetRemote(
  record: BudgetRecord,
  config: SyncConfig,
): Promise<{ ok: boolean; number?: string; error?: string }> {
  const url = config.saveUrl || `${import.meta.env.BASE_URL}api/budgets.php`
  if (!config.syncSecret) {
    return { ok: false, error: 'Sync não configurado (sem syncSecret). Salvo só neste navegador.' }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': config.syncSecret,
      },
      body: JSON.stringify(record),
    })
    const data = (await res.json().catch(() => ({}))) as { number?: string; error?: string }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, number: data.number }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export function localPrintNumber(): string {
  const stamp = new Date()
  const ymd = [
    String(stamp.getFullYear()).slice(2),
    String(stamp.getMonth() + 1).padStart(2, '0'),
    String(stamp.getDate()).padStart(2, '0'),
  ].join('')
  const key = `liganer-orcamento-print-${ymd}`
  const next = Number(getItem(key, '0')) + 1
  setItem(key, String(next))
  return `${ymd}${String(next).padStart(2, '0')}`
}
