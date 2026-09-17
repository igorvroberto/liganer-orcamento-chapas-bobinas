import type { BudgetListItem, BudgetRecord, Conditions, ItemRow } from './types'

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
  rowsByModel: Record<string, ItemRow[]>
  draftsByModel: Record<string, Conditions>
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

export function budgetDisplayName(record: {
  name?: string | null
  number?: string | null
  createdAt?: string | null
}): string {
  const number = String(record.number ?? '').trim()
  if (number) return number
  const named = String(record.name ?? '').trim()
  if (named) return named
  if (record.createdAt) {
    return new Date(record.createdAt).toLocaleString('pt-BR')
  }
  return '—'
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

export function upsertSavedBudget(record: BudgetRecord): void {
  const list = loadSavedBudgets()
  const index = list.findIndex(
    (item) =>
      item.id === record.id ||
      (record.number && item.number === record.number) ||
      (record.name && item.name === record.name),
  )
  if (index >= 0) list[index] = { ...list[index], ...record }
  else list.push(record)
  setItem(SAVED_KEY, JSON.stringify(list))
}

export function removeSavedBudget(idOrNumber: string): void {
  const key = String(idOrNumber ?? '').trim()
  if (!key) return
  const list = loadSavedBudgets().filter(
    (item) => item.id !== key && item.number !== key && item.name !== key,
  )
  setItem(SAVED_KEY, JSON.stringify(list))
}

export function savedBudgetsAsListItems(records: BudgetRecord[] = loadSavedBudgets()): BudgetListItem[] {
  return records
    .map((record) => ({
      id: record.id,
      name: budgetDisplayName(record),
      number: record.number ?? null,
      client: {
        name: record.client?.name ?? '',
        cnpj: record.client?.cnpj ?? '',
      },
      createdAt: record.createdAt ?? null,
      savedAt: record.savedAt ?? record.createdAt ?? null,
      source: record.source ?? null,
      owner: record.owner
        ? {
            id: record.owner.id,
            email: record.owner.email,
            name: record.owner.name,
          }
        : null,
    }))
    .sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))
}

export type SyncConfig = {
  saveUrl?: string
  printNumberUrl?: string
  syncSecret?: string
}

function budgetsApiUrl(config: SyncConfig): string {
  return config.saveUrl || `${import.meta.env.BASE_URL}api/budgets.php`
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
): Promise<{ ok: boolean; number?: string; name?: string; error?: string }> {
  const url = budgetsApiUrl(config)
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
    const data = (await res.json().catch(() => ({}))) as {
      number?: string
      name?: string
      error?: string
    }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, number: data.number, name: data.name }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export async function fetchBudgetRemote(
  number: string,
  config: SyncConfig,
): Promise<{ ok: boolean; record?: BudgetRecord; error?: string }> {
  const trimmed = String(number ?? '').trim()
  if (!trimmed) return { ok: false, error: 'Número inválido.' }
  if (!config.syncSecret) {
    return { ok: false, error: 'Sync não configurado.' }
  }
  try {
    const url = new URL(budgetsApiUrl(config), window.location.origin)
    url.searchParams.set('number', trimmed)
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Sync-Secret': config.syncSecret,
      },
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as BudgetRecord & { error?: string; ok?: boolean }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    if (!data || !Array.isArray(data.rows)) {
      return { ok: false, error: 'Orçamento incompleto no servidor.' }
    }
    return { ok: true, record: data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export async function deleteBudgetRemote(
  number: string,
  config: SyncConfig,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = String(number ?? '').trim()
  if (!trimmed) return { ok: false, error: 'Número inválido.' }
  if (!config.syncSecret) {
    return { ok: false, error: 'Sync não configurado.' }
  }
  try {
    const url = new URL(budgetsApiUrl(config), window.location.origin)
    url.searchParams.set('number', trimmed)
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'X-Sync-Secret': config.syncSecret,
      },
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export async function listBudgetsRemote(
  config: SyncConfig,
): Promise<{ ok: boolean; items: BudgetListItem[]; error?: string }> {
  if (!config.syncSecret) {
    return { ok: false, items: [], error: 'Sync não configurado.' }
  }
  try {
    const res = await fetch(budgetsApiUrl(config), {
      method: 'GET',
      headers: {
        'X-Sync-Secret': config.syncSecret,
      },
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as {
      items?: BudgetListItem[]
      error?: string
    }
    if (!res.ok) return { ok: false, items: [], error: data.error || `HTTP ${res.status}` }
    return { ok: true, items: Array.isArray(data.items) ? data.items : [] }
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : 'Falha de rede',
    }
  }
}

/** Envia orçamentos só locais para o servidor (ainda sem id remoto). */
export async function uploadLocalBudgetsMissingRemote(
  config: SyncConfig,
): Promise<{ uploaded: number; error?: string }> {
  if (!config.syncSecret) return { uploaded: 0 }
  const remote = await listBudgetsRemote(config)
  if (!remote.ok) {
    return { uploaded: 0, error: remote.error || 'Falha ao listar remoto.' }
  }
  const remoteIds = new Set(remote.items.map((item) => String(item.id ?? '').trim()).filter(Boolean))
  const remoteNumbers = new Set(
    remote.items.map((item) => String(item.number ?? '').trim()).filter(Boolean),
  )
  let uploaded = 0
  for (const record of loadSavedBudgets()) {
    if (!record.rows?.length) continue
    const id = String(record.id ?? '').trim()
    if (id && remoteIds.has(id)) continue
    // Sem número no POST de criação: servidor atribui e nunca sobrescreve alheio.
    const { number: _number, name: _name, ...toSend } = record
    void _number
    void _name
    const saved = await saveBudgetRemote(toSend, config)
    if (!saved.ok || !saved.number) continue
    uploaded += 1
    if (id) remoteIds.add(id)
    remoteNumbers.add(saved.number)
    upsertSavedBudget({
      ...record,
      number: saved.number,
      name: saved.number,
      savedAt: new Date().toISOString(),
    })
  }
  return { uploaded }
}

/** Junta remoto + local, priorizando remoto quando houver o mesmo número. */
export function mergeBudgetLists(
  remote: BudgetListItem[],
  local: BudgetListItem[],
): BudgetListItem[] {
  const byKey = new Map<string, BudgetListItem>()
  for (const item of local) {
    const key = item.number ? `n:${item.number}` : `id:${item.id}`
    byKey.set(key, {
      ...item,
      name: budgetDisplayName(item),
    })
  }
  for (const item of remote) {
    const key = item.number ? `n:${item.number}` : `id:${item.id}`
    byKey.set(key, {
      ...item,
      name: budgetDisplayName(item),
    })
  }
  return [...byKey.values()].sort((a, b) =>
    String(b.savedAt ?? b.createdAt ?? '').localeCompare(String(a.savedAt ?? a.createdAt ?? '')),
  )
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

export function findSavedBudget(idOrNumber: string): BudgetRecord | null {
  const key = String(idOrNumber ?? '').trim()
  if (!key) return null
  return (
    loadSavedBudgets().find((item) => item.id === key || item.number === key || item.name === key) ??
    null
  )
}
