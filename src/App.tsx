import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateRow, calculateSummary, isBobinaMaterial, numericValue, sheetUnitWeight, usesManualUnitWeight } from './lib/calc'
import { exportExcel, exportPdf } from './lib/export'
import {
  displayFieldValue,
  emptyRowDefaults,
  formatCnpj,
  formatCurrency,
  formatNumber,
} from './lib/format'
import {
  fieldLabel,
  footerFields,
  getModel,
  itemFields,
  itemHeaderLabel,
  withCatalogFieldOptions,
} from './lib/models'
import {
  coerceDictatedValue,
  extractDictatedValue,
  getSpeechRecognitionCtor,
  isNewLineCommand,
  isSkipCommand,
  type SpeechRecognitionLike,
} from './lib/speech'
import {
  deleteBudgetRemote,
  fetchBudgetRemote,
  findSavedBudget,
  loadConfig,
  listBudgetsRemote,
  loadDraft,
  localPrintNumber,
  mergeBudgetLists,
  pushSavedBudget,
  removeSavedBudget,
  saveBudgetRemote,
  saveDraft,
  savedBudgetsAsListItems,
  upsertSavedBudget,
  type SyncConfig,
} from './lib/storage'
import {
  getCatalogSelectOptions,
  loadPriceCatalogFromExcel,
  pruneInvalidCatalogSelections,
} from './lib/priceCatalog'
import type { BudgetListItem, BudgetRecord, ClientInfo, Conditions, FieldDef, ItemRow } from './lib/types'

type DictationTarget = 'item' | 'footer'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  )
}

function isCalculatedForRow(field: FieldDef, modelId: string, row: ItemRow): boolean {
  if (field.calculated) return true
  if (field.weightByMaterial) return !usesManualUnitWeight(modelId, row)
  return false
}

function CellControl({
  field,
  value,
  modelId,
  row,
  onChange,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  modelId: string
  row: ItemRow
  onChange: (value: string | number | boolean) => void
}) {
  if (isCalculatedForRow(field, modelId, row)) {
    return <span className="calculated-cell">{displayFieldValue(value, field)}</span>
  }

  if (field.type === 'boolean') {
    return (
      <input
        className="cell-check"
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={fieldLabel(field.label)}
      />
    )
  }

  const cascadeLocked =
    (field.key === 'acabamento' && !String(row.tipo ?? '').trim()) ||
    (field.key === 'espessura' &&
      (!String(row.tipo ?? '').trim() || !String(row.acabamento ?? '').trim())) ||
    (field.key === 'comprimento' && isBobinaMaterial(row))
  const locked = Boolean(field.locked || cascadeLocked)

  if (Array.isArray(field.options)) {
    const normalizedValue = value == null ? '' : String(value)
    const supportsCustom = Boolean(field.customOptionLabel)
    const hasPreset = field.options.includes(normalizedValue)
    const customSelected = supportsCustom && normalizedValue === field.customOptionLabel
    const usingCustom = supportsCustom && !customSelected && normalizedValue !== '' && !hasPreset

    if (supportsCustom) {
      return (
        <div className="cell-control-stack">
          <select
            className="cell-control"
            disabled={locked}
            value={usingCustom ? field.customOptionLabel : normalizedValue}
            onChange={(e) => {
              const next = e.target.value
              if (next === field.customOptionLabel) {
                onChange(field.customOptionLabel!)
                return
              }
              onChange(next)
            }}
            aria-label={fieldLabel(field.label)}
          >
            <option value="">—</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={field.customOptionLabel}>{field.customOptionLabel}</option>
          </select>
          {usingCustom || customSelected ? (
            <input
              className="cell-control"
              disabled={locked}
              inputMode="numeric"
              value={customSelected ? '' : normalizedValue}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${fieldLabel(field.label)} personalizada`}
              placeholder={field.customOptionLabel}
            />
          ) : null}
        </div>
      )
    }

    return (
      <select
        className="cell-control"
        disabled={locked}
        value={normalizedValue}
        onChange={(e) => onChange(e.target.value)}
        aria-label={fieldLabel(field.label)}
      >
        <option value="">—</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  const showGroupedNumber =
    field.type === 'number' && field.useGrouping !== false && (field.fractionDigits ?? 2) === 0
  const groupedDisplay =
    showGroupedNumber && value !== '' && value != null
      ? formatNumber(numericValue(value), 0, true)
      : value == null
        ? ''
        : String(value)

  return (
    <input
      className="cell-control"
      disabled={locked}
      inputMode={
        field.type === 'number' || field.type === 'currency' || field.type === 'percent'
          ? 'decimal'
          : 'text'
      }
      value={groupedDisplay}
      onChange={(e) => {
        if (!showGroupedNumber) {
          onChange(e.target.value)
          return
        }
        const digits = e.target.value.replace(/\D/g, '')
        onChange(digits === '' ? '' : Number(digits))
      }}
      aria-label={fieldLabel(field.label)}
    />
  )
}

function ConditionField({
  field,
  value,
  onChange,
  highlighted,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  onChange: (value: string | number | boolean) => void
  highlighted?: boolean
}) {
  if (field.options?.length) {
    return (
      <label className={`field ${highlighted ? 'field-listening' : ''}`}>
        <span>{field.label}</span>
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecionar…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className={`field ${highlighted ? 'field-listening' : ''}`}>
      <span>{field.label}</span>
      <input
        inputMode={
          field.type === 'number' || field.type === 'currency' || field.type === 'percent'
            ? 'decimal'
            : 'text'
        }
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export default function App() {
  const draft = useMemo(() => loadDraft(), [])
  const [modelId] = useState('chapas')
  const [client, setClient] = useState<ClientInfo>(draft?.client || { name: '', cnpj: '' })
  const [rowsByModel, setRowsByModel] = useState<Record<string, ItemRow[]>>({
    chapas:
      draft?.rowsByModel?.chapas?.length
        ? draft.rowsByModel.chapas
        : [emptyRowDefaults(itemFields(getModel('chapas')))],
  })
  const [draftsByModel, setDraftsByModel] = useState<Record<string, Conditions>>({
    chapas: draft?.draftsByModel?.chapas || {},
  })
  const [status, setStatus] = useState<{ text: string; kind?: 'ok' | 'error' }>({ text: '' })
  const [config, setConfig] = useState<SyncConfig>({})
  const [savedBudgets, setSavedBudgets] = useState<BudgetListItem[]>(() => savedBudgetsAsListItems())
  const [editingBudget, setEditingBudget] = useState<{
    id: string
    number: string
    createdAt?: string
  } | null>(null)
  const [priceCatalogVersion, setPriceCatalogVersion] = useState(0)
  const [listening, setListening] = useState(false)
  const [autoListen, setAutoListen] = useState(false)
  const [dictationTarget, setDictationTarget] = useState<DictationTarget>('item')
  const [itemStepIndex, setItemStepIndex] = useState(0)
  const [footerStepIndex, setFooterStepIndex] = useState(0)
  const [activeRowIndex, setActiveRowIndex] = useState(0)
  const [interimText, setInterimText] = useState('')

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const autoListenRef = useRef(false)
  const targetRef = useRef<DictationTarget>('item')
  const retryRef = useRef(0)
  const startedAtRef = useRef(0)
  const hadResultRef = useRef(false)

  // Keep latest state for speech callbacks
  const stateRef = useRef({
    modelId,
    rowsByModel,
    draftsByModel,
    itemStepIndex,
    footerStepIndex,
    activeRowIndex,
  })
  stateRef.current = {
    modelId,
    rowsByModel,
    draftsByModel,
    itemStepIndex,
    footerStepIndex,
    activeRowIndex,
  }

  const model = getModel(modelId)
  const baseFields = useMemo(() => itemFields(model), [model])
  const fields = baseFields
  const conditionsFields = footerFields(model)
  const rows = rowsByModel[modelId] || []
  const conditions = draftsByModel[modelId] || {}
  const summary = useMemo(
    () => calculateSummary(modelId, rows, conditions),
    [modelId, rows, conditions, priceCatalogVersion],
  )

  const safeRowIndex = rows.length ? Math.min(Math.max(activeRowIndex, 0), rows.length - 1) : 0
  const activeRow = rows[safeRowIndex] || {}
  const activeRowFields = useMemo(
    () =>
      withCatalogFieldOptions(
        baseFields,
        getCatalogSelectOptions({
          tipo: activeRow.tipo,
          acabamento: activeRow.acabamento,
        }),
      ),
    [baseFields, activeRow.tipo, activeRow.acabamento, priceCatalogVersion],
  )
  const dictatableItemFields = activeRowFields.filter((f) => {
    if (f.hiddenInApp || f.calculated || f.locked) return false
    if (f.weightByMaterial && isCalculatedForRow(f, modelId, activeRow)) return false
    if (f.key === 'acabamento' && !String(activeRow.tipo ?? '').trim()) return false
    if (
      f.key === 'espessura' &&
      (!String(activeRow.tipo ?? '').trim() || !String(activeRow.acabamento ?? '').trim())
    ) {
      return false
    }
    return true
  })
  const safeItemStep = dictatableItemFields.length
    ? ((itemStepIndex % dictatableItemFields.length) + dictatableItemFields.length) %
      dictatableItemFields.length
    : 0
  const safeFooterStep = conditionsFields.length
    ? ((footerStepIndex % conditionsFields.length) + conditionsFields.length) %
      conditionsFields.length
    : 0
  const currentItemField = dictatableItemFields[safeItemStep]
  const currentFooterField = conditionsFields[safeFooterStep]

  useEffect(() => {
    void loadConfig().then(setConfig)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function refreshSavedBudgets(nextConfig: SyncConfig) {
      const local = savedBudgetsAsListItems()
      if (!nextConfig.syncSecret) {
        if (!cancelled) setSavedBudgets(local)
        return
      }
      const remote = await listBudgetsRemote(nextConfig)
      if (cancelled) return
      if (remote.ok) setSavedBudgets(mergeBudgetLists(remote.items, local))
      else setSavedBudgets(local)
    }
    void refreshSavedBudgets(config)
    return () => {
      cancelled = true
    }
  }, [config])

  useEffect(() => {
    void loadPriceCatalogFromExcel().then((result) => {
      setPriceCatalogVersion((v) => v + 1)
      if (!result.ok) {
        console.warn('Catálogo de preços: usando fallback JSON.', result.error)
      }
    })
  }, [])

  useEffect(() => {
    saveDraft({ modelId, client, rowsByModel, draftsByModel })
  }, [modelId, client, rowsByModel, draftsByModel])

  useEffect(() => {
    if (!rowsByModel[modelId]?.length) {
      setRowsByModel((prev) => ({
        ...prev,
        [modelId]: [emptyRowDefaults(itemFields(getModel(modelId)))],
      }))
    }
  }, [modelId, rowsByModel])

  useEffect(() => {
    setItemStepIndex(0)
    setFooterStepIndex(0)
  }, [modelId])

  useEffect(() => {
    autoListenRef.current = autoListen
  }, [autoListen])

  useEffect(() => {
    targetRef.current = dictationTarget
  }, [dictationTarget])

  useEffect(() => {
    return () => {
      autoListenRef.current = false
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  function updateRow(index: number, key: string, value: string | number | boolean) {
    setRowsByModel((prev) => {
      const list = [...(prev[modelId] || [])]
      const previous = list[index] || {}
      let nextRow: ItemRow = { ...previous, [key]: value }
      if (key === 'material' && isBobinaMaterial({ material: value })) {
        // Ao mudar para bobina, sugere o peso calculado da chapa se ainda não houver peso manual.
        const suggested = sheetUnitWeight({ ...nextRow, material: 'CHAPA' })
        if (!numericValue(previous.peso_unitario) && suggested > 0) {
          nextRow.peso_unitario = Math.round(suggested)
        }
      }
      if (key === 'material') {
        nextRow.material = String(value).trim().toUpperCase()
      }
      if (key === 'peso_unitario' && value !== '' && value !== undefined) {
        nextRow.peso_unitario = Math.round(numericValue(value))
      }
      if (key === 'tipo' || key === 'acabamento') {
        nextRow = pruneInvalidCatalogSelections(nextRow)
      }
      list[index] = nextRow
      return { ...prev, [modelId]: list }
    })
  }

  function updateCondition(key: string, value: string | number | boolean) {
    setDraftsByModel((prev) => ({
      ...prev,
      [modelId]: { ...(prev[modelId] || {}), [key]: value },
    }))
  }

  function addItem(selectNew = true) {
    setRowsByModel((prev) => {
      const next = [...(prev[modelId] || []), emptyRowDefaults(fields)]
      if (selectNew) {
        setActiveRowIndex(next.length - 1)
        setItemStepIndex(0)
      }
      return { ...prev, [modelId]: next }
    })
  }

  function removeItem(index: number) {
    setRowsByModel((prev) => {
      const list = [...(prev[modelId] || [])]
      list.splice(index, 1)
      const next = list.length ? list : [emptyRowDefaults(fields)]
      setActiveRowIndex((current) => Math.min(current, next.length - 1))
      return { ...prev, [modelId]: next }
    })
  }

  function advanceItemField() {
    setItemStepIndex((idx) => {
      const next = idx + 1
      if (next >= dictatableItemFields.length) {
        // Finish current row → next dictation creates/moves to new line
        setStatus({ text: 'Item concluído. Próximo ditado iniciará uma nova linha.', kind: 'ok' })
        setRowsByModel((prev) => {
          const list = [...(prev[modelId] || [])]
          list.push(emptyRowDefaults(fields))
          setActiveRowIndex(list.length - 1)
          return { ...prev, [modelId]: list }
        })
        return 0
      }
      return next
    })
  }

  function advanceFooterField() {
    setFooterStepIndex((idx) => idx + 1)
  }

  function applySpeechResult(transcript: string, target: DictationTarget) {
    const text = transcript.trim()
    if (!text) return

    if (isSkipCommand(text)) {
      if (target === 'footer') advanceFooterField()
      else advanceItemField()
      setStatus({ text: 'Campo pulado.', kind: 'ok' })
      return
    }

    if (target === 'item' && isNewLineCommand(text)) {
      addItem(true)
      setItemStepIndex(0)
      setStatus({ text: 'Nova linha pronta para ditado.', kind: 'ok' })
      return
    }

    const snap = stateRef.current
    const modelNow = getModel(snap.modelId)
    const rowsNow = snap.rowsByModel[snap.modelId] || []
    let rowIndex = rowsNow.length
      ? Math.min(Math.max(snap.activeRowIndex, 0), rowsNow.length - 1)
      : 0
    const rowForDictation = rowsNow[rowIndex] || emptyRowDefaults(itemFields(modelNow))
    const itemFs = withCatalogFieldOptions(
      itemFields(modelNow),
      getCatalogSelectOptions({
        tipo: rowForDictation.tipo,
        acabamento: rowForDictation.acabamento,
      }),
    ).filter((f) => {
      if (f.hiddenInApp || f.calculated || f.locked) return false
      if (f.weightByMaterial && isCalculatedForRow(f, snap.modelId, rowForDictation)) return false
      if (f.key === 'acabamento' && !String(rowForDictation.tipo ?? '').trim()) return false
      if (
        f.key === 'espessura' &&
        (!String(rowForDictation.tipo ?? '').trim() ||
          !String(rowForDictation.acabamento ?? '').trim())
      ) {
        return false
      }
      return true
    })
    const footerFs = footerFields(modelNow)

    if (target === 'footer') {
      if (!footerFs.length) return
      const step =
        ((snap.footerStepIndex % footerFs.length) + footerFs.length) % footerFs.length
      const field = footerFs[step]
      const extracted = extractDictatedValue(text, field, footerFs) || text
      const value = coerceDictatedValue(extracted, field)
      updateCondition(field.key, value)
      advanceFooterField()
      setStatus({
        text: `Condição gravada: ${fieldLabel(field.label)}.`,
        kind: 'ok',
      })
      return
    }

    if (!itemFs.length) return
    if (!rowsNow.length) {
      addItem(true)
      rowIndex = 0
    }
    const step = ((snap.itemStepIndex % itemFs.length) + itemFs.length) % itemFs.length
    const field = itemFs[step]
    const extracted = extractDictatedValue(text, field, itemFs)
    if (!extracted) {
      setStatus({
        text: `Nenhum valor reconhecido para ${fieldLabel(field.label)}. Tente de novo ou diga "pular".`,
        kind: 'error',
      })
      return
    }
    const value = coerceDictatedValue(extracted, field)
    updateRow(rowIndex, field.key, value)
    setActiveRowIndex(rowIndex)
    advanceItemField()
    setStatus({
      text: `Item ${rowIndex + 1}: ${fieldLabel(field.label)} = ${String(value)}.`,
      kind: 'ok',
    })
  }

  function initRecognition(): SpeechRecognitionLike | null {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setStatus({ text: 'Reconhecimento de voz indisponível neste navegador (use Chrome/Edge).', kind: 'error' })
      return null
    }
    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
      startedAtRef.current = Date.now()
      hadResultRef.current = false
      setStatus({ text: 'Ouvindo…', kind: 'ok' })
    }

    recognition.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const piece = result[0]?.transcript || ''
        if (result.isFinal) finalText += `${piece} `
        else interim += piece
      }
      setInterimText(interim.trim())
      if (finalText.trim()) {
        hadResultRef.current = true
        retryRef.current = 0
        setInterimText('')
        applySpeechResult(finalText.trim(), targetRef.current)
      }
    }

    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        autoListenRef.current = false
        setAutoListen(false)
        setStatus({
          text: 'Microfone bloqueado. Libere a permissão do site e toque em Ditar novamente.',
          kind: 'error',
        })
      }
    }

    recognition.onend = () => {
      setListening(false)
      const endedQuickly = Date.now() - startedAtRef.current < 1800
      if (
        autoListenRef.current &&
        endedQuickly &&
        !hadResultRef.current &&
        retryRef.current < 1
      ) {
        retryRef.current += 1
        recognitionRef.current = initRecognition()
        try {
          recognitionRef.current?.start()
        } catch {
          /* ignore */
        }
        return
      }
      if (autoListenRef.current) {
        setStatus({
          text: 'Escuta pausada pelo navegador. Toque em Ditar para ouvir novamente.',
          kind: 'error',
        })
        autoListenRef.current = false
        setAutoListen(false)
      }
    }

    return recognition
  }

  function stopListening() {
    autoListenRef.current = false
    setAutoListen(false)
    retryRef.current = 0
    setInterimText('')
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }

  function startListening(target: DictationTarget) {
    if (!getSpeechRecognitionCtor()) {
      setStatus({ text: 'Reconhecimento de voz indisponível neste navegador (use Chrome/Edge).', kind: 'error' })
      return
    }
    if (target === 'item' && !dictatableItemFields.length) {
      setStatus({ text: 'Sem campos para ditar neste modelo.', kind: 'error' })
      return
    }
    if (target === 'footer' && !conditionsFields.length) {
      setStatus({ text: 'Sem condições para ditar.', kind: 'error' })
      return
    }

    if (targetRef.current !== target) retryRef.current = 0
    targetRef.current = target
    setDictationTarget(target)
    autoListenRef.current = true
    setAutoListen(true)
    hadResultRef.current = false
    setInterimText('')

    if (!recognitionRef.current) recognitionRef.current = initRecognition()
    if (!recognitionRef.current) return

    if (listening && dictationTarget === target) return

    try {
      recognitionRef.current.start()
    } catch {
      recognitionRef.current = initRecognition()
      try {
        recognitionRef.current?.start()
      } catch {
        setStatus({
          text: 'Não consegui iniciar a escuta. Toque em Ditar novamente e confira o microfone.',
          kind: 'error',
        })
        autoListenRef.current = false
        setAutoListen(false)
      }
    }
  }

  function toggleDictation(target: DictationTarget) {
    if (autoListen && dictationTarget === target) stopListening()
    else startListening(target)
  }

  async function refreshSavedBudgetsList(nextConfig: SyncConfig = config) {
    const local = savedBudgetsAsListItems()
    if (!nextConfig.syncSecret) {
      setSavedBudgets(local)
      return
    }
    const remote = await listBudgetsRemote(nextConfig)
    setSavedBudgets(remote.ok ? mergeBudgetLists(remote.items, local) : local)
  }

  async function resolveSavedRecord(item: BudgetListItem): Promise<BudgetRecord | null> {
    let record = findSavedBudget(item.id) || (item.number ? findSavedBudget(item.number) : null)
    if (!record && item.number && config.syncSecret) {
      const remote = await fetchBudgetRemote(item.number, config)
      if (remote.ok && remote.record) {
        record = remote.record
        upsertSavedBudget({
          ...remote.record,
          number: remote.record.number || item.number,
          name: remote.record.number || item.number,
        })
      } else {
        setStatus({
          text: remote.error || 'Não foi possível carregar este orçamento.',
          kind: 'error',
        })
        return null
      }
    }
    if (!record) {
      setStatus({ text: 'Orçamento não encontrado neste navegador.', kind: 'error' })
      return null
    }
    return record
  }

  async function savePdfClienteBudget(): Promise<string | null> {
    if (!rows.length) {
      setStatus({
        text: 'Adicione ao menos um item antes de exportar o PDF.',
        kind: 'error',
      })
      return null
    }
    const nowIso = new Date().toISOString()
    const editing = editingBudget
    let number = editing?.number || localPrintNumber()
    const record = {
      id: editing?.id || `orcamento-${Date.now()}`,
      createdAt: editing?.createdAt || nowIso,
      savedAt: nowIso,
      modelId,
      modelName: model.name,
      client: { ...client },
      rows,
      conditions,
      summary,
      source: 'pdf-cliente' as const,
      number,
      name: number,
    }
    if (editing) upsertSavedBudget(record)
    else pushSavedBudget(record)

    const remote = await saveBudgetRemote(record, config)
    if (remote.ok && remote.number) {
      number = remote.number
      upsertSavedBudget({
        ...record,
        number,
        name: number,
        savedAt: new Date().toISOString(),
      })
      setStatus({
        text: editing
          ? `Orçamento ${number} atualizado e PDF gerado.`
          : `PDF cliente gerado e orçamento salvo: ${number}.`,
        kind: 'ok',
      })
    } else {
      upsertSavedBudget(record)
      setStatus({
        text: `PDF cliente gerado. Salvo neste navegador${remote.error ? ` — ${remote.error}` : ''}.`.trim(),
        kind: config.syncSecret ? 'error' : 'ok',
      })
    }
    setEditingBudget(null)
    await refreshSavedBudgetsList()
    return number
  }

  async function handlePdfCliente() {
    const number = await savePdfClienteBudget()
    if (!number) return
    exportPdf('cliente', model, client, rows, conditions, summary, { number })
  }

  async function openSavedPdfCliente(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para gerar o PDF.', kind: 'error' })
      return
    }
    const key = record.number || item.number || item.name || item.id
    const savedModel = getModel(record.modelId || modelId)
    const savedConditions = record.conditions || {}
    const savedSummary =
      record.summary || calculateSummary(savedModel.id, record.rows, savedConditions)
    exportPdf(
      'cliente',
      savedModel,
      record.client || { name: '', cnpj: '' },
      record.rows,
      savedConditions,
      savedSummary,
      { number: key },
    )
    setStatus({
      text: `PDF do orçamento ${key} aberto.`,
      kind: 'ok',
    })
  }

  async function exportSavedXlsx(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para exportar XLSX.', kind: 'error' })
      return
    }
    const key = record.number || item.number || item.name || item.id
    const savedModel = getModel(record.modelId || modelId)
    exportExcel(
      savedModel,
      record.client || { name: '', cnpj: '' },
      record.rows,
      record.conditions || {},
      { number: key },
    )
    setStatus({
      text: `XLSX do orçamento ${key} baixado.`,
      kind: 'ok',
    })
  }

  async function editSavedBudget(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para editar.', kind: 'error' })
      return
    }
    const number = record.number || item.number || item.name || item.id
    const mid = record.modelId || modelId
    setClient({
      name: record.client?.name || '',
      cnpj: record.client?.cnpj || '',
    })
    setRowsByModel((prev) => ({
      ...prev,
      [mid]: record.rows.map((row) => ({ ...row })),
    }))
    setDraftsByModel((prev) => ({
      ...prev,
      [mid]: { ...(record.conditions || {}) },
    }))
    setActiveRowIndex(0)
    setItemStepIndex(0)
    setFooterStepIndex(0)
    setEditingBudget({
      id: record.id,
      number,
      createdAt: record.createdAt,
    })
    setStatus({
      text: `Editando orçamento ${number}. Altere os campos e clique em PDF cliente para atualizar.`,
      kind: 'ok',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditingBudget() {
    setEditingBudget(null)
    setStatus({ text: 'Edição cancelada.', kind: 'ok' })
  }

  async function deleteSavedBudget(item: BudgetListItem) {
    const number = item.number || item.name || item.id
    const ok = window.confirm(`Excluir o orçamento ${number}?`)
    if (!ok) return

    removeSavedBudget(item.id)
    if (item.number) removeSavedBudget(item.number)
    if (item.name && item.name !== item.id) removeSavedBudget(item.name)

    if (item.number && config.syncSecret) {
      const remote = await deleteBudgetRemote(item.number, config)
      if (!remote.ok) {
        setStatus({
          text: `Removido neste navegador, mas falhou no servidor: ${remote.error || ''}`.trim(),
          kind: 'error',
        })
        await refreshSavedBudgetsList()
        return
      }
    }

    if (editingBudget && (editingBudget.id === item.id || editingBudget.number === item.number)) {
      setEditingBudget(null)
    }
    await refreshSavedBudgetsList()
    setStatus({ text: `Orçamento ${number} excluído.`, kind: 'ok' })
  }

  const itemListening = autoListen && dictationTarget === 'item'
  const footerListening = autoListen && dictationTarget === 'footer'

  return (
    <div className="app-shell">
      <div className="brand-row">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}liganer_favicon.webp`}
          alt="Liganer"
          width={42}
          height={42}
        />
        <div>
          <p className="eyebrow">Liganer</p>
          <h1>Orçamento de chapas e bobinas</h1>
        </div>
      </div>
      <p className="lede">
        Preencha por voz ou na tabela — diga o valor do campo atual, “pular” para avançar, ou “nova
        linha” para o próximo item.
      </p>

      {model.status === 'pending' && (
        <div className="notice">
          O modelo <strong>{model.name}</strong> ainda está pendente (campos placeholder). Use Chapas,
          Bobinas, Slitters ou Blanks para cotação completa.
        </div>
      )}

      <section className="card toolbar-card">
        <div className="grid-2">
          <label className="field">
            <span>Nome do cliente</span>
            <input
              value={client.name}
              onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
              autoComplete="organization"
            />
          </label>
          <label className="field">
            <span>CNPJ</span>
            <input
              value={client.cnpj}
              inputMode="numeric"
              onChange={(e) => setClient((c) => ({ ...c, cnpj: formatCnpj(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="card voice-panel" aria-label="Ditado dos itens">
        <button
          type="button"
          className={`mic-button ${itemListening ? 'listening' : ''}`}
          onClick={() => toggleDictation('item')}
        >
          <span className="mic-glyph">
            <MicIcon />
          </span>
          <span>{itemListening ? 'Ouvindo orçamento' : 'Ditar orçamento'}</span>
        </button>
        <div className="dictation-current">
          <span>Campo atual · item {safeRowIndex + 1}</span>
          <strong>{currentItemField ? fieldLabel(currentItemField.label) : 'Sem campos'}</strong>
          <div className="field-nav">
            <button
              type="button"
              className="nav-button"
              aria-label="Campo anterior"
              onClick={() => setItemStepIndex((i) => i - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="nav-button"
              aria-label="Próximo campo"
              onClick={() => setItemStepIndex((i) => i + 1)}
            >
              ›
            </button>
          </div>
        </div>
        {interimText && <p className="interim">“…{interimText}”</p>}
        <p className="voice-hint">
          Dicas: “304”, “tipo 430”, “pular”, “nova linha”. Funciona melhor no Chrome/Edge com microfone
          liberado.
        </p>
      </section>

      <section className="card table-card">
        <div className="section-heading">
          <h2>Itens</h2>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => addItem(true)}>
              + Adicionar item
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th className="delete-column" aria-label="Ações" />
                <th className="item-number-column">Item</th>
                {fields.map((field) => (
                  <th
                    key={field.key}
                    className={field.type === 'boolean' ? 'boolean-column' : undefined}
                  >
                    {itemHeaderLabel(field.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const calc = calculateRow(modelId, row, conditions)
                const isActive = index === safeRowIndex
                const rowFields = withCatalogFieldOptions(
                  baseFields,
                  getCatalogSelectOptions({
                    tipo: row.tipo,
                    acabamento: row.acabamento,
                  }),
                )
                return (
                  <tr
                    key={index}
                    className={isActive ? 'editing-row' : undefined}
                    onClick={() => setActiveRowIndex(index)}
                  >
                    <td className="delete-column">
                      <button
                        type="button"
                        className="trash-button"
                        aria-label={`Remover item ${index + 1}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeItem(index)
                        }}
                      >
                        ×
                      </button>
                    </td>
                    <td className="item-number-cell">{index + 1}</td>
                    {rowFields.map((field) => {
                      const value = isCalculatedForRow(field, modelId, row)
                        ? field.calc
                          ? calc[field.calc]
                          : row[field.key]
                        : row[field.key]
                      const isDictationCell =
                        itemListening && isActive && currentItemField?.key === field.key
                      return (
                        <td
                          key={field.key}
                          className={[
                            field.type === 'boolean' ? 'boolean-column' : '',
                            isCalculatedForRow(field, modelId, row) ? 'formula-cell' : '',
                            isDictationCell ? 'dictation-cell' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <CellControl
                            field={field}
                            value={value}
                            modelId={modelId}
                            row={row}
                            onChange={(v) => {
                              setActiveRowIndex(index)
                              const step = dictatableItemFields.findIndex((f) => f.key === field.key)
                              if (step >= 0) setItemStepIndex(step)
                              updateRow(index, field.key, v)
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Totais</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <span>Total (Kg)</span>
            <strong>{formatNumber(summary.totalKg, 0)} Kg</strong>
          </div>
          <div className="summary-item">
            <span>Subtotal</span>
            <strong>{formatCurrency(summary.subtotal)}</strong>
          </div>
          <div className="summary-item">
            <span>IPI 3,25%</span>
            <strong>{formatCurrency(summary.ipi)}</strong>
          </div>
          <div className="summary-item">
            <span>Total</span>
            <strong>{formatCurrency(summary.total)}</strong>
          </div>
        </div>
      </section>

      <section className="card voice-panel footer-voice-panel" aria-label="Ditado das condições">
        <button
          type="button"
          className={`mic-button ${footerListening ? 'listening' : ''}`}
          onClick={() => toggleDictation('footer')}
        >
          <span className="mic-glyph">
            <MicIcon />
          </span>
          <span>{footerListening ? 'Ouvindo condições' : 'Ditar condições'}</span>
        </button>
        <div className="dictation-current">
          <span>Campo atual</span>
          <strong>{currentFooterField ? fieldLabel(currentFooterField.label) : 'Sem campos'}</strong>
          <div className="field-nav">
            <button
              type="button"
              className="nav-button"
              aria-label="Campo anterior"
              onClick={() => setFooterStepIndex((i) => i - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="nav-button"
              aria-label="Próximo campo"
              onClick={() => setFooterStepIndex((i) => i + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Condições</h2>
        <div className="grid-2">
          {conditionsFields.map((field) => (
            <ConditionField
              key={field.key}
              field={field}
              value={conditions[field.key]}
              highlighted={footerListening && currentFooterField?.key === field.key}
              onChange={(v) => {
                const step = conditionsFields.findIndex((f) => f.key === field.key)
                if (step >= 0) setFooterStepIndex(step)
                updateCondition(field.key, v)
              }}
            />
          ))}
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => void handlePdfCliente()}
          >
            {editingBudget ? `Atualizar PDF ${editingBudget.number}` : 'PDF cliente'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportPdf('liganer', model, client, rows, conditions, summary)}
          >
            PDF Liganer
          </button>
          {editingBudget ? (
            <button type="button" className="btn btn-secondary" onClick={cancelEditingBudget}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Orçamentos salvos</h2>
        {editingBudget ? (
          <p className="editing-banner">
            Editando orçamento <strong>{editingBudget.number}</strong>. Ao gerar o PDF cliente, este
            número será atualizado.
          </p>
        ) : null}
        {savedBudgets.length ? (
          <div className="table-scroll saved-budgets-scroll">
            <table className="saved-budgets-table">
              <thead>
                <tr>
                  <th>Nome do orçamento</th>
                  <th>Cliente</th>
                  <th>CNPJ</th>
                  <th>Dia/horário</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {savedBudgets.map((item) => {
                  const when = item.savedAt || item.createdAt
                  const isEditing =
                    editingBudget &&
                    (editingBudget.id === item.id || editingBudget.number === item.number)
                  return (
                    <tr key={item.id} className={isEditing ? 'is-editing' : undefined}>
                      <td>{item.name}</td>
                      <td>{item.client.name?.trim() || '—'}</td>
                      <td>{item.client.cnpj?.trim() || '—'}</td>
                      <td>{when ? new Date(when).toLocaleString('pt-BR') : '—'}</td>
                      <td>
                        <div className="saved-budget-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void openSavedPdfCliente(item)}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void exportSavedXlsx(item)}
                          >
                            XLSX
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void editSavedBudget(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-compact"
                            onClick={() => void deleteSavedBudget(item)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-note">Nenhum orçamento salvo ainda. Use PDF cliente.</p>
        )}
      </section>

      <p className={`status ${status.kind || ''}`}>{status.text}</p>
    </div>
  )
}
