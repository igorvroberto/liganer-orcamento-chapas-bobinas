import { useEffect, useMemo, useState } from 'react'
import { calculateRow, calculateSummary } from './lib/calc'
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
  loadConfig,
  loadDraft,
  pushSavedBudget,
  saveBudgetRemote,
  saveDraft,
  type SyncConfig,
} from './lib/storage'
import type { ClientInfo, Conditions, FieldDef, ItemRow } from './lib/types'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  onChange: (value: string | number | boolean) => void
}) {
  if (field.calculated) {
    return (
      <label className="field">
        <span>{field.label}</span>
        <input disabled value={displayFieldValue(value, field)} />
      </label>
    )
  }

  if (field.type === 'boolean') {
    const on = Boolean(value)
    return (
      <label className="field boolean">
        <span>{field.label}</span>
        <div className="toggle-row">
          <button type="button" className={on ? 'active' : ''} onClick={() => onChange(true)}>
            Sim
          </button>
          <button type="button" className={!on ? 'active' : ''} onClick={() => onChange(false)}>
            Não
          </button>
        </div>
      </label>
    )
  }

  if (field.options?.length) {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select
          disabled={field.locked}
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
    <label className="field">
      <span>{field.label}</span>
      <input
        disabled={field.locked}
        inputMode={field.type === 'number' || field.type === 'currency' || field.type === 'percent' ? 'decimal' : 'text'}
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
  const [listening, setListening] = useState(false)
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null)

  const model = getModel(modelId)
  const fields = itemFields(model)
  const conditionsFields = footerFields(model)
  const rows = rowsByModel[modelId] || []
  const conditions = draftsByModel[modelId] || {}
  const summary = calculateSummary(modelId, rows, conditions)

  useEffect(() => {
    void loadConfig().then(setConfig)
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

  function updateRow(index: number, key: string, value: string | number | boolean) {
    setRowsByModel((prev) => {
      const list = [...(prev[modelId] || [])]
      list[index] = { ...list[index], [key]: value }
      return { ...prev, [modelId]: list }
    })
  }

  function updateCondition(key: string, value: string | number) {
    setDraftsByModel((prev) => ({
      ...prev,
      [modelId]: { ...(prev[modelId] || {}), [key]: value },
    }))
  }

  function addItem() {
    setRowsByModel((prev) => ({
      ...prev,
      [modelId]: [...(prev[modelId] || []), emptyRowDefaults(fields)],
    }))
  }

  function removeItem(index: number) {
    setRowsByModel((prev) => {
      const list = [...(prev[modelId] || [])]
      list.splice(index, 1)
      return { ...prev, [modelId]: list.length ? list : [emptyRowDefaults(fields)] }
    })
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

  function startDictation() {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setStatus({ text: 'Reconhecimento de voz indisponível neste navegador.', kind: 'error' })
      return
    }
    const editable = fields.filter((f) => !f.calculated && !f.locked)
    if (!editable.length) return
    const currentKey = activeFieldKey && editable.some((f) => f.key === activeFieldKey)
      ? activeFieldKey
      : editable[0].key
    setActiveFieldKey(currentKey)

    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (!transcript || !rows.length) return
      updateRow(0, currentKey, transcript)
      const idx = editable.findIndex((f) => f.key === currentKey)
      const next = editable[(idx + 1) % editable.length]
      setActiveFieldKey(next.key)
      setStatus({ text: `Gravado em ${fieldLabel(editable[idx].label)}. Próximo: ${fieldLabel(next.label)}.`, kind: 'ok' })
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    try {
      recognition.start()
      setListening(true)
      setStatus({ text: `Ouvindo: ${fieldLabel(editable.find((f) => f.key === currentKey)!.label)}`, kind: 'ok' })
    } catch {
      setStatus({ text: 'Não foi possível iniciar o microfone.', kind: 'error' })
    }
  }

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
        Monte orçamentos de chapas, bobinas, slitters/fitas e blanks com cálculo de peso, fator,
        frete e IPI — no mesmo padrão dos apps de vendas Liganer.
      </p>

      {model.status === 'pending' && (
        <div className="notice">
          O modelo <strong>{model.name}</strong> ainda está pendente (campos placeholder). Use Chapas,
          Bobinas, Slitters ou Blanks para cotação completa.
        </div>
      )}

      <section className="card">
        <h2>Cliente</h2>
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

      <section className="card">
        <h2>Modelo</h2>
        <label className="field">
          <span>Tipo de material / linha</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.status === 'pending' ? ' (pendente)' : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="section-heading">
          <h2>Itens</h2>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={startDictation}>
              {listening ? 'Ouvindo…' : 'Ditar orçamento'}
            </button>
            <button type="button" className="btn btn-primary" onClick={addItem}>
              + Adicionar item
            </button>
          </div>
        </div>
        {activeFieldKey && (
          <p className="mic-row hint">Campo de ditado atual: {fieldLabel(fields.find((f) => f.key === activeFieldKey)?.label || activeFieldKey)}</p>
        )}

        {rows.map((row, index) => {
          const calc = calculateRow(modelId, row, conditions)
          return (
            <article className="item-card" key={index}>
              <header>
                <strong>Item {index + 1}</strong>
                <button type="button" className="btn btn-danger" onClick={() => removeItem(index)}>
                  Remover
                </button>
              </header>
              <div className="grid-2">
                {fields.map((field) => {
                  const value = field.calculated && field.calc
                    ? calc[field.calc]
                    : row[field.key]
                  return (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={value}
                      onChange={(v) => updateRow(index, field.key, v)}
                    />
                  )
                })}
              </div>
            </article>
          )
        })}
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

      <section className="card">
        <h2>Condições</h2>
        <div className="grid-2">
          {conditionsFields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={conditions[field.key]}
              onChange={(v) => updateCondition(field.key, v as string | number)}
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
