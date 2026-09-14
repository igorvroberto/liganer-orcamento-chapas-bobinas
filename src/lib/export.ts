import * as XLSX from 'xlsx'
import { calculateRow, usesManualUnitWeight } from './calc'
import { displayFieldValue, formatCurrency, formatNumber } from './format'
import {
  HIDDEN_FROM_CLIENT,
  fieldLabel,
  footerFields,
  isSupplierKey,
  itemFields,
  itemHeaderLabel,
} from './models'
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
  const visible = fields.filter(
    (f) => !HIDDEN_FROM_CLIENT.has(f.key) && f.type !== 'boolean' && !isSupplierKey(f.key),
  )
  return orderClientePdfFields(visible)
}

/** PDF cliente: ICMS após peso total; preço sem IPI antes do subtotal. */
function orderClientePdfFields(fields: FieldDef[]): FieldDef[] {
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const result: FieldDef[] = []
  for (const field of fields) {
    if (field.key === 'icms' || field.key === '_preco_sem_ipi') continue
    if (field.key === '_peso_total') {
      result.push(field)
      const icms = byKey.get('icms')
      if (icms) result.push(icms)
      continue
    }
    if (field.key === '_subtotal') {
      const precoSemIpi = byKey.get('_preco_sem_ipi')
      if (precoSemIpi) result.push(precoSemIpi)
      result.push(field)
      continue
    }
    result.push(field)
  }
  return result
}

export function exportExcel(
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
  options?: { number?: string },
): void {
  if (!rows.length) return
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
  const number = String(options?.number ?? '').trim()
  const filename = number ? `${number}.xlsx` : `orcamento-${model.id}.xlsx`
  XLSX.writeFile(book, filename)
}

function logoUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${window.location.origin}${base}liganer_favicon.webp`
}

export function exportPdf(
  kind: 'cliente' | 'liganer',
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
  summary: Summary,
  options?: { number?: string },
): void {
  if (!rows.length) return
  const fields = exportableFields(model, kind)
  const footer = footerFields(model).filter((f) => {
    if (!String(conditions[f.key] ?? '').trim()) return false
    if (kind === 'cliente' && f.key === 'frete_percentual') return false
    return true
  })
  const number = String(options?.number ?? '').trim() || localPrintNumber()
  const now = new Date().toLocaleString('pt-BR')
  const pdfClass = kind === 'liganer' ? 'pdf-liganer' : 'pdf-cliente'
  const logo = logoUrl()

  const itemRows = rows
    .map((row, index) => {
      const cells = fields
        .map((field) => {
          const value = valueForField(field, model.id, row, conditions, index)
          const text =
            field.type === 'boolean'
              ? value
                ? 'X'
                : ''
              : displayFieldValue(value, field)
          return `<td>${escapeHtml(text)}</td>`
        })
        .join('')
      return `<tr><td class="item-no">${index + 1}</td>${cells}</tr>`
    })
    .join('')

  const summaryRows = [
    ['Total (Kg)', `${formatNumber(summary.totalKg, 0)} Kg`],
    ['Subtotal', formatCurrency(summary.subtotal)],
    ['IPI 3,25%', formatCurrency(summary.ipi)],
    ['Total', formatCurrency(summary.total)],
  ]

  const summaryHtml = `
    <section class="panel">
      <h2>Totais</h2>
      <div class="kv">
        ${summaryRows
          .map(
            ([label, value]) => `
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
          </div>`,
          )
          .join('')}
      </div>
    </section>`

  const conditionsHtml = footer.length
    ? `
    <section class="panel">
      <h2>Condições</h2>
      <div class="kv">
        ${footer
          .map(
            (field) => `
          <div>
            <strong>${escapeHtml(fieldLabel(field.label))}</strong>
            <span>${escapeHtml(displayFieldValue(conditions[field.key], field))}</span>
          </div>`,
          )
          .join('')}
      </div>
    </section>`
    : ''

  const clientName = String(client.name ?? '').trim()
  const clientCnpj = String(client.cnpj ?? '').trim()
  const clientArticles = [
    clientName
      ? `<article>
      <span>Cliente</span>
      <strong>${escapeHtml(clientName)}</strong>
    </article>`
      : '',
    clientCnpj
      ? `<article>
      <span>CNPJ</span>
      <strong>${escapeHtml(clientCnpj)}</strong>
    </article>`
      : '',
  ].filter(Boolean)
  const clientCardHtml = clientArticles.length
    ? `<section class="client-card${clientArticles.length === 1 ? ' solo' : ''}">
    ${clientArticles.join('\n    ')}
  </section>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(number)}</title>
  <style>
    /* A4 retrato (210×297mm). */
    @page {
      size: 210mm 297mm;
      margin: 8mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      color: #17211d;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      background: #fff;
    }
    body {
      min-width: 210mm;
      max-width: 210mm;
    }
    body.pdf-liganer { font-size: 7px; }

    .print-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 10px;
    }
    .print-actions button {
      border: 0;
      border-radius: 6px;
      background: #c60000;
      color: #fff;
      padding: 8px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .print-actions .print-hint {
      color: #56635d;
      font-size: 11px;
    }
    @media print {
      .print-actions { display: none; }
      @page {
        size: 210mm 297mm;
        margin: 8mm;
      }
      html, body {
        width: 210mm;
        min-height: 297mm;
        max-width: none;
      }
    }

    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: #c60000;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand img {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #fff;
      object-fit: contain;
      flex: none;
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.1;
      font-weight: 800;
    }
    body.pdf-liganer .brand h1 { font-size: 14px; }
    .banner-meta {
      text-align: right;
      font-size: 11px;
      line-height: 1.45;
      white-space: nowrap;
    }
    body.pdf-liganer .banner-meta { font-size: 8px; }

    .client-card {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .client-card.solo {
      grid-template-columns: 1fr;
    }
    .client-card article {
      border: 1px solid #d8dfd9;
      border-radius: 8px;
      padding: 8px 10px;
      background: #f2f2f2;
    }
    .client-card span {
      display: block;
      color: #56635d;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 3px;
    }
    .client-card strong {
      font-size: 12px;
      font-weight: 700;
    }
    body.pdf-liganer .client-card strong { font-size: 9px; }

    table.items {
      width: max-content;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }
    table.items th,
    table.items td {
      border: 1px solid #d8dfd9;
      padding: 5px 4px;
      vertical-align: middle;
      text-align: center;
      overflow: visible;
      width: auto;
      max-width: none;
    }
    table.items th {
      background: #c60000;
      color: #fff;
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.15;
      white-space: pre-line;
      letter-spacing: 0.01em;
    }
    table.items td {
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    table.items td.item-no {
      width: 1%;
      white-space: nowrap;
      font-weight: 700;
      color: #56635d;
    }
    table.items th.item-no {
      width: 1%;
      white-space: nowrap;
    }
    body.pdf-liganer table.items th {
      font-size: 5px;
      padding: 3px 2px;
    }
    body.pdf-liganer table.items td {
      font-size: 5.4px;
      padding: 2px 1px;
      line-height: 1.12;
    }

    .bottom {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
      break-inside: avoid;
    }
    .panel {
      border: 1px solid #d8dfd9;
      border-radius: 8px;
      overflow: hidden;
      height: fit-content;
      align-self: start;
    }
    .panel h2 {
      margin: 0;
      padding: 8px 10px;
      background: #fce8e8;
      color: #c60000;
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      border-bottom: 1px solid #d8dfd9;
    }
    body.pdf-liganer .panel h2 { font-size: 9px; padding: 5px 8px; }
    .kv div {
      display: grid;
      grid-template-columns: 1fr 1.1fr;
      border-bottom: 1px solid #d8dfd9;
      min-height: 28px;
    }
    .kv div:last-child { border-bottom: 0; }
    .kv strong,
    .kv span {
      display: grid;
      place-items: center;
      padding: 6px 8px;
      text-align: center;
    }
    .kv strong {
      color: #56635d;
      font-size: 8px;
      text-transform: uppercase;
      border-right: 1px solid #d8dfd9;
      background: #fafafa;
    }
    .kv span {
      font-size: 11px;
      font-weight: 700;
    }
    body.pdf-liganer .kv strong { font-size: 6px; }
    body.pdf-liganer .kv span { font-size: 8px; }
  </style>
</head>
<body class="${pdfClass}">
  <div class="print-actions">
    <span class="print-hint">Orientação: retrato (vertical)</span>
    <button type="button" onclick="window.print()">Salvar em PDF</button>
  </div>

  <header class="banner">
    <div class="brand">
      <img src="${escapeHtml(logo)}" alt="Liganer" width="40" height="40" />
      <div>
        <h1>Liganer</h1>
      </div>
    </div>
    <div class="banner-meta">
      <div><strong>Nº ${escapeHtml(number)}</strong></div>
      <div>${escapeHtml(now)}</div>
      <div>${rows.length} item(ns)</div>
    </div>
  </header>

  ${clientCardHtml}

  <table class="items">
    <thead>
      <tr>
        <th class="item-no">Item</th>
        ${fields
          .map((field) => `<th>${escapeHtml(itemHeaderLabel(field.label))}</th>`)
          .join('')}
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="bottom">
    ${summaryHtml}
    ${conditionsHtml}
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 400)
    })
  </script>
</body>
</html>`

  // Janela em proporção retrato. Não usar noopener: em Chrome/Edge
  // window.open(..., 'noopener') devolve null e o PDF deixa de abrir.
  const win = window.open('', '_blank', 'width=900,height=1200,left=40,top=20')
  if (!win) {
    alert('O navegador bloqueou a janela de PDF. Permita pop-ups para exportar.')
    return
  }
  try {
    win.opener = null
  } catch {
    /* ignore */
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  try {
    win.focus()
  } catch {
    /* ignore */
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
