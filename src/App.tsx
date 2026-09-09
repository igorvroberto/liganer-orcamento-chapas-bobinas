import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateRow, calculateSummary, isBobinaMaterial, numericValue, sheetUnitWeight, usesManualUnitWeight } from './lib/calc'
import { exportCsv, exportExcel, exportPdf } from './lib/export'
import {
  displayFieldValue,
  emptyRowDefaults,
  formatCnpj,
  formatCurrency,
  formatNumber,
  formatPercent,
} from './lib/format'
import {
  MODELS,
  fieldLabel,
  footerFields,
  getModel,
  itemFields,
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
  loadConfig,
  loadDraft,
  pushSavedBudget,
  saveBudgetRemote,
  saveDraft,
  type SyncConfig,
} from './lib/storage'
import { loadPriceCatalogFromExcel } from './lib/priceCatalog'
import type { ClientInfo, Conditions, FieldDef, ItemRow } from './lib/types'

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

  if (field.options?.length) {
    return (
      <select
        className="cell-control"
        disabled={field.locked}
        value={value == null ? '' : String(value)}
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

  return (
    <input
      className="cell-control"
      disabled={field.locked}
      inputMode={
        field.type === 'number' || field.type === 'currency' || field.type === 'percent'
          ? 'decimal'
          : 'text'
      }
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
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
  const [modelId, setModelId] = useState(draft?.modelId || 'chapas')
  const [client, setClient] = useState<ClientInfo>(draft?.client || { name: '', cnpj: '' })
  const [rowsByModel, setRowsByModel] = useState<Record<string, ItemRow[]>>(
    draft?.rowsByModel || { chapas: [emptyRowDefaults(itemFields(getModel('chapas')))] },
  )
  const [draftsByModel, setDraftsByModel] = useState<Record<string, Conditions>>(
    draft?.draftsByModel || {},
  )
  const [status, setStatus] = useState<{ text: string; kind?: 'ok' | 'error' }>({ text: '' })
  const [config, setConfig] = useState<SyncConfig>({})
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
  const fields = itemFields(model)
  const conditionsFields = footerFields(model)
  const rows = rowsByModel[modelId] || []
  const conditions = draftsByModel[modelId] || {}
  const summary = useMemo(
    () => calculateSummary(modelId, rows, conditions),
    [modelId, rows, conditions, priceCatalogVersion],
  )

  const safeRowIndex = rows.length ? Math.min(Math.max(activeRowIndex, 0), rows.length - 1) : 0
  const activeRow = rows[safeRowIndex] || {}
  const dictatableItemFields = fields.filter((f) => {
    if (f.hiddenInApp || f.calculated || f.locked) return false
    if (f.weightByMaterial && isCalculatedForRow(f, modelId, activeRow)) return false
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
      const nextRow: ItemRow = { ...previous, [key]: value }
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
    const itemFs = itemFields(modelNow).filter((f) => {
      if (f.hiddenInApp || f.calculated || f.locked) return false
      if (f.weightByMaterial && isCalculatedForRow(f, snap.modelId, rowForDictation)) return false
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

  async function handleSave() {
    if (!rows.length) {
      setStatus({ text: 'Adicione ao menos um item antes de salvar.', kind: 'error' })
      return
    }
    const record = {
      id: `orcamento-${Date.now()}`,
      createdAt: new Date().toISOString(),
      modelId,
      modelName: model.name,
      client: { ...client },
      rows,
      conditions,
      summary,
    }
    pushSavedBudget(record)
    const remote = await saveBudgetRemote(record, config)
    if (remote.ok) {
      setStatus({ text: remote.number ? `Orçamento salvo: ${remote.number}.` : 'Orçamento salvo.', kind: 'ok' })
    } else {
      setStatus({
        text: `Salvo neste navegador. ${remote.error || ''}`.trim(),
        kind: config.syncSecret ? 'error' : 'ok',
      })
    }
  }

  const itemListening = autoListen && dictationTarget === 'item'
  const footerListening = autoListen && dictationTarget === 'footer'

  return (
    <div className="app-shell">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden>
          LG
        </div>
        <div>
          <p className="eyebrow">Liganer · Aço inoxidável</p>
          <h1>Orçamento comercial</h1>
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
        <div className="grid-3">
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
          <label className="field">
            <span>Modelo</span>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.status === 'pending' ? ' (pendente)' : ''}
                </option>
              ))}
            </select>
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
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const calc = calculateRow(modelId, row, conditions)
                const isActive = index === safeRowIndex
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
                    {fields.map((field) => {
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
            <strong>{formatNumber(summary.totalKg)} Kg</strong>
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
          <div className="summary-item">
            <span>Frete</span>
            <strong>{formatPercent(summary.frete)}</strong>
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
          <button type="button" className="btn btn-dark" onClick={() => void handleSave()}>
            Salvar
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportPdf('cliente', model, client, rows, conditions, summary)}
          >
            PDF cliente
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportPdf('liganer', model, client, rows, conditions, summary)}
          >
            PDF Liganer
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportExcel(model, client, rows, conditions)}
          >
            Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportCsv(model, client, rows, conditions)}
          >
            CSV
          </button>
        </div>
      </section>

      <p className={`status ${status.kind || ''}`}>{status.text}</p>
    </div>
  )
}
