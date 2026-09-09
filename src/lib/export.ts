import * as XLSX from 'xlsx'
import { calculateRow, usesManualUnitWeight } from './calc'
import { displayFieldValue, formatCurrency, formatNumber, formatPercent } from './format'
import { HIDDEN_FROM_CLIENT, fieldLabel, footerFields, isSupplierKey, itemFields } from './models'
import { localPrintNumber } from './storage'
import type { ClientInfo, Conditions, FieldDef, ItemRow, ModelDef, Summary } from './types'

function valueForField(
  field: FieldDef,
  modelId: string,
  row: ItemRow,
  conditions: Conditions,
  index: number,
): unknown {
  if (field.key === '_item') return index + 1
  const calc = calculateRow(modelId, row, conditions)
  if (field.weightByMaterial && field.calc && field.calc in calc) {
    return usesManualUnitWeight(modelId, row) ? row[field.key] : calc[field.calc]
  }
  if (field.calculated && field.calc && field.calc in calc) {
    return calc[field.calc]
  }
  return row[field.key]
}

function exportableFields(model: ModelDef, kind: 'cliente' | 'liganer'): FieldDef[] {
  const fields = itemFields(model).filter((f) => !f.hiddenInApp)
  if (kind === 'liganer') return fields
  return fields.filter(
    (f) => !HIDDEN_FROM_CLIENT.has(f.key) && f.type !== 'boolean' && !isSupplierKey(f.key),
  )
}

export function exportExcel(
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
): void {
  const fields = exportableFields(model, 'liganer')
  const aoa: (string | number)[][] = [
    ['Cliente', 'CNPJ', ...fields.map((f) => fieldLabel(f.label))],
  ]
  rows.forEach((row, index) => {
    aoa.push([
      client.name,
      client.cnpj,
      ...fields.map((f) => {
        const v = valueForField(f, model.id, row, conditions, index)
        if (typeof v === 'boolean') return v ? 'X' : ''
        if (typeof v === 'number') return v
        return v == null ? '' : String(v)
      }),
    ])
  })
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Orcamento')
  XLSX.writeFile(book, `orcamento-${model.id}.xlsx`)
}

export function exportCsv(
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
): void {
  const fields = exportableFields(model, 'liganer')
  const lines = [
    ['Cliente', 'CNPJ', ...fields.map((f) => fieldLabel(f.label))]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(';'),
  ]
  rows.forEach((row, index) => {
    const cols = [
      client.name,
      client.cnpj,
      ...fields.map((f) => {
        const v = valueForField(f, model.id, row, conditions, index)
        return displayFieldValue(v, f)
      }),
    ]
    lines.push(cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
  })
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orcamento-${model.id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPdf(
  kind: 'cliente' | 'liganer',
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
  summary: Summary,
): void {
  if (!rows.length) return
  const fields = exportableFields(model, kind)
  const footer = footerFields(model).filter((f) => String(conditions[f.key] ?? '').trim())
  const number = localPrintNumber()
  const now = new Date().toLocaleDateString('pt-BR')
  const title = kind === 'liganer' ? 'PDF Liganer' : 'PDF cliente'

  const itemRows = rows
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        ${fields
          .map((field) => {
            const value = valueForField(field, model.id, row, conditions, index)
            return `<td>${escapeHtml(displayFieldValue(value, field))}</td>`
          })
          .join('')}
      </tr>`,
    )
    .join('')

  const summaryRows = [
    ['Total (Kg)', `${formatNumber(summary.totalKg, 0)} Kg`],
    ['Subtotal', formatCurrency(summary.subtotal)],
    ['IPI 3,25%', formatCurrency(summary.ipi)],
    ['Total', formatCurrency(summary.total)],
    ...(kind === 'liganer' ? [['Frete', formatPercent(summary.frete)]] : []),
  ]

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${title} · ${number}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #152028; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #5a6b78; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #c9d4dc; padding: 6px 8px; text-align: left; }
    th { background: #eef3f6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
    .box h2 { font-size: 13px; margin: 0 0 8px; }
    .box div { margin: 4px 0; font-size: 12px; }
    @media print { .noprint { display: none; } }
  </style>
</head>
<body>
  <button class="noprint" onclick="window.print()">Imprimir / salvar PDF</button>
  <h1>Liganer · Orçamento (${model.name})</h1>
  <div class="meta">Nº ${number} · ${now} · ${title}</div>
  <p><strong>Cliente:</strong> ${escapeHtml(client.name || '—')}<br/>
  <strong>CNPJ:</strong> ${escapeHtml(client.cnpj || '—')}</p>
  <table>
    <thead>
      <tr><th>#</th>${fields.map((f) => `<th>${escapeHtml(fieldLabel(f.label))}</th>`).join('')}</tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="grid">
    <div class="box">
      <h2>Totais</h2>
      ${summaryRows.map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
    </div>
    <div class="box">
      <h2>Condições</h2>
      ${
        footer.length
          ? footer
              .map(
                (f) =>
                  `<div><strong>${escapeHtml(fieldLabel(f.label))}:</strong> ${escapeHtml(
                    displayFieldValue(conditions[f.key], f),
                  )}</div>`,
              )
              .join('')
          : '<div>—</div>'
      }
    </div>
  </div>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('O navegador bloqueou a janela de PDF. Permita pop-ups para exportar.')
    return
  }
  win.document.write(html)
  win.document.close()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
