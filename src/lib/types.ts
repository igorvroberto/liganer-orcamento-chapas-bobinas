export type FieldType = 'number' | 'currency' | 'percent' | 'boolean' | 'text'

export type FieldDef = {
  key: string
  label: string
  aliases?: string[]
  type?: FieldType
  options?: string[]
  default?: string | number | boolean
  locked?: boolean
  hiddenInApp?: boolean
  askWhenNew?: boolean
  section?: 'Rodapé'
  virtual?: boolean
  calculated?: boolean
  calc?: keyof RowCalculation
}

export type ModelDef = {
  id: string
  name: string
  status: 'configured' | 'pending'
  fields: FieldDef[]
  sheet?: string
  rowRange?: string
  formulaNote?: string
}

export type ItemRow = Record<string, string | number | boolean | undefined>

export type Conditions = Record<string, string | number | boolean | undefined>

export type ClientInfo = {
  name: string
  cnpj: string
}

export type RowCalculation = {
  pesoUnitario: number
  pesoTotal: number
  precoFator100: number
  precoFatorUtilizado: number
  precoBobinaFator100: number
  precoBobinaFatorUtilizado: number
  precoTotal: number
  precoSemIpi: number
  subtotal: number
  pesoNecessario: number
  quantidadeCortes: number
  perdaMm: number
  perdaPercentual: number
  acrescimoPerdaPercentual: number
  acrescimoPerdaValor: number
}

export type Summary = {
  totalKg: number
  subtotal: number
  ipi: number
  total: number
  frete: number
}

export type BudgetRecord = {
  id: string
  createdAt: string
  modelId: string
  modelName: string
  client: ClientInfo
  rows: ItemRow[]
  conditions: Conditions
  summary: Summary
  number?: string
}
