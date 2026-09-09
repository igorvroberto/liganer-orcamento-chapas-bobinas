import type { FieldDef, ModelDef } from './types'

export const TYPE_OPTIONS = ['304', '430', 'J4', '410S', '316L', '410D', '201', 'QN1803', '439']
export const FINISH_OPTIONS = ['2B', 'BA', 'BQ', 'ESCOVADO']
export const PVC_OPTIONS = ['NÃO', 'AZUL', 'PRETO E BRANCO', 'PRETO', 'NITTO FIBER']
export const THICKNESS_OPTIONS = [
  '0,35', '0,40', '0,50', '0,60', '0,80', '1,00', '1,20', '1,50',
  '2,00', '2,50', '3,00', '3,50', '4,00', '4,50', '5,00', '6,00', '8,00',
]
export const ICMS_OPTIONS = ['4%', '12%']
export const COMMISSION_OPTIONS = ['Bonificada', 'Normal', 'Reduzida']
export const COIL_TYPE_OPTIONS = ['Inteira', 'Cortada', 'Com PVC']
export const MATERIAL_OPTIONS = ['BOBINA INTEIRA', 'BOBINA REDUZIDA', 'CHAPA']

function calcField(
  key: string,
  label: string,
  type: FieldDef['type'],
  calc: FieldDef['calc'],
  extra: Partial<FieldDef> = {},
): FieldDef {
  return { key, label, type, virtual: true, calculated: true, calc, ...extra }
}

function footerFieldsModule(): FieldDef[] {
  return [
    { key: 'pagamento', label: 'Pagamento', aliases: ['pagamento', 'condicao', 'condição'], section: 'Rodapé' },
    { key: 'prazo_entrega', label: 'Prazo de entrega', aliases: ['prazo de entrega', 'entrega', 'prazo'], section: 'Rodapé' },
    {
      key: 'local_expedicao',
      label: 'Local de expedição',
      aliases: ['local de expedicao', 'local de expedição', 'expedicao', 'expedição'],
      options: ['SP', 'CE'],
      askWhenNew: true,
      section: 'Rodapé',
    },
    {
      key: 'cidade_cliente',
      label: 'Cidade do cliente',
      aliases: ['cidade do cliente', 'cidade', 'cliente cidade'],
      section: 'Rodapé',
    },
    {
      key: 'tipo_frete',
      label: 'Tipo de frete',
      aliases: ['tipo de frete', 'frete'],
      options: ['CIF', 'FOB'],
      askWhenNew: true,
      section: 'Rodapé',
    },
    {
      key: 'observacoes_gerais',
      label: 'Observações gerais',
      aliases: ['observacoes gerais', 'observações gerais', 'observacoes', 'observações'],
      section: 'Rodapé',
    },
    {
      key: 'frete_percentual',
      label: 'Frete (%)',
      aliases: ['frete', 'percentual frete', 'frete percentual'],
      type: 'percent',
      section: 'Rodapé',
    },
  ]
}

function alloyFields(
  materialDefault: string,
  { selectableMaterial = false }: { selectableMaterial?: boolean } = {},
): FieldDef[] {
  const materialField: FieldDef = selectableMaterial
    ? {
        key: 'material',
        label: 'Material',
        aliases: ['material', 'produto'],
        options: MATERIAL_OPTIONS,
        default: materialDefault,
        askWhenNew: true,
      }
    : {
        key: 'material',
        label: 'Material',
        aliases: ['material', 'produto'],
        default: materialDefault,
        locked: true,
      }
  return [
    materialField,
    { key: 'tipo', label: 'Tipo', aliases: ['tipo', 'liga', 'aco', 'aço'], options: TYPE_OPTIONS, askWhenNew: true },
    { key: 'acabamento', label: 'Acabamento', aliases: ['acabamento'], options: FINISH_OPTIONS, askWhenNew: true },
    { key: 'pvc', label: 'PVC', aliases: ['pvc', 'plastico', 'plástico'], options: PVC_OPTIONS, askWhenNew: true, default: 'NÃO' },
    {
      key: 'espessura',
      label: 'Espessura',
      aliases: ['espessura', 'esp'],
      type: 'number',
      options: THICKNESS_OPTIONS,
      askWhenNew: true,
    },
  ]
}

function pesoUnitarioField(): FieldDef {
  return {
    key: 'peso_unitario',
    label: 'Peso\nunitário',
    aliases: ['peso unitario', 'peso unitário'],
    type: 'number',
    weightByMaterial: true,
    calc: 'pesoUnitario',
    fractionDigits: 0,
  }
}

function commercialFields({
  coil = false,
  catalogPrice = false,
}: { coil?: boolean; catalogPrice?: boolean } = {}): FieldDef[] {
  const key100 = coil ? 'preco_bobina_fator_100' : 'preco_fator_100'
  const keyUsed = coil ? '_preco_bobina_fator_utilizado' : '_preco_fator_utilizado'
  const label100 = coil ? 'Preço bobina\nfator 100' : 'Preço\nfator 100'
  const labelUsed = coil ? 'Preço bobina\nfator utilizado' : 'Preço\nfator utilizado'
  const calc = coil ? 'precoBobinaFatorUtilizado' : 'precoFatorUtilizado'
  const calc100 = coil ? 'precoBobinaFator100' : 'precoFator100'
  const priceField: FieldDef = catalogPrice
    ? {
        key: key100,
        label: label100,
        aliases: [
          'preco fator 100', 'preço fator 100', 'preco', 'preço', 'valor',
          'preco bobina fator 100', 'preço bobina fator 100',
        ],
        type: 'currency',
        calculated: true,
        virtual: true,
        calc: calc100,
      }
    : {
        key: key100,
        label: label100,
        aliases: [
          'preco fator 100', 'preço fator 100', 'preco', 'preço', 'valor',
          'preco bobina fator 100', 'preço bobina fator 100',
        ],
        type: 'currency',
      }
  return [
    { key: 'observacao', label: 'Observação', aliases: ['observacao', 'observação', 'obs'] },
    priceField,
    { key: 'fator_maximo', label: 'Fator\nmáximo', aliases: ['fator maximo', 'fator máximo'], type: 'number' },
    { key: 'fator_utilizado', label: 'Fator\nutilizado', aliases: ['fator utilizado', 'fator usado'], type: 'number' },
    calcField(keyUsed, labelUsed, 'currency', calc),
    ...(coil
      ? [{ key: 'tipo_bobina', label: 'Tipo\nbobina', aliases: ['tipo bobina'], options: COIL_TYPE_OPTIONS, askWhenNew: true } as FieldDef]
      : []),
    { key: 'comissao', label: 'Comissão', aliases: ['comissao', 'comissão'], options: COMMISSION_OPTIONS, askWhenNew: true },
  ]
}

function icmsField({ fromCatalog = false }: { fromCatalog?: boolean } = {}): FieldDef {
  if (fromCatalog) {
    return {
      key: 'icms',
      label: 'ICMS',
      aliases: ['icms'],
      type: 'percent',
      calculated: true,
      virtual: true,
      calc: 'icms',
      fractionDigits: 0,
    }
  }
  return { key: 'icms', label: 'ICMS', aliases: ['icms'], options: ICMS_OPTIONS, askWhenNew: true }
}

/** Ordem: ACE MTS/MTO, FIL IND, AÇOS PRIME, IMG, CSA, TETTO (cada um MTS depois MTO). */
function supplierFields(
  suffixes: Array<'mts' | 'mto'> = ['mto'],
  { includeAce = false }: { includeAce?: boolean } = {},
): FieldDef[] {
  const groups: {
    key: (suffix: string) => string
    label: string
    alias: (suffix: string) => string[]
  }[] = []

  if (includeAce) {
    groups.push({
      key: (suffix) => `ace_${suffix}`,
      label: 'ACE',
      alias: (suffix) => [`ace ${suffix}`],
    })
  }

  groups.push(
    {
      key: (suffix) => `filial_industria_${suffix}`,
      label: 'FIL IND',
      alias: (suffix) => [
        `filial industria ${suffix}`,
        `filial indústria ${suffix}`,
        `fil ind ${suffix}`,
      ],
    },
    {
      key: (suffix) => `acos_prime_${suffix}`,
      label: 'AÇOS PRIME',
      alias: (suffix) => [`acos prime ${suffix}`, `aços prime ${suffix}`],
    },
    {
      key: (suffix) => `img_${suffix}`,
      label: 'IMG',
      alias: (suffix) => [`img ${suffix}`],
    },
    {
      key: (suffix) => `csa_${suffix}`,
      label: 'CSA',
      alias: (suffix) => [`csa ${suffix}`],
    },
    {
      key: (suffix) => `tetto_${suffix}`,
      label: 'TETTO',
      alias: (suffix) => [`tetto ${suffix}`],
    },
  )

  const fields: FieldDef[] = []
  for (const group of groups) {
    for (const suffix of suffixes) {
      fields.push({
        key: group.key(suffix),
        label: `${group.label}\n${suffix.toUpperCase()}`,
        aliases: group.alias(suffix),
        type: 'boolean',
      })
    }
  }
  return fields
}

function placeholderFields(materialDefault: string): FieldDef[] {
  return [
    { key: 'material', label: 'Material', aliases: ['material', 'produto'], default: materialDefault, locked: true },
    { key: 'tipo', label: 'Tipo', aliases: ['tipo', 'liga', 'aço', 'aco'], askWhenNew: true },
    { key: 'acabamento', label: 'Acabamento', aliases: ['acabamento'], askWhenNew: true },
    { key: 'espessura', label: 'Espessura', aliases: ['espessura', 'esp'], type: 'number' },
    { key: 'largura', label: 'Largura', aliases: ['largura'], type: 'number' },
    { key: 'comprimento', label: 'Comprimento', aliases: ['comprimento'], type: 'number' },
    { key: 'quantidade', label: 'Quantidade', aliases: ['quantidade', 'qtd'], type: 'number' },
    { key: 'preco', label: 'Preço', aliases: ['preco', 'preço', 'valor'], type: 'currency' },
    { key: 'observacao', label: 'Observação', aliases: ['observacao', 'obs'] },
    ...footerFieldsModule(),
  ]
}

export const MODELS: ModelDef[] = [
  {
    id: 'chapas',
    name: 'Chapas',
    status: 'configured',
    sheet: 'Orçamento',
    rowRange: '3 a 12',
    fields: [
      ...alloyFields('CHAPA', { selectableMaterial: true }),
      { key: 'largura', label: 'Largura', aliases: ['largura', 'larg'], type: 'number' },
      { key: 'comprimento', label: 'Comprimento', aliases: ['comprimento', 'comp'], type: 'number' },
      { key: 'unidade', label: 'Quantidade', aliases: ['unidade', 'quantidade', 'qtd', 'peças', 'pecas'], type: 'number' },
      pesoUnitarioField(),
      calcField('_peso_total', 'Peso\ntotal', 'number', 'pesoTotal', { fractionDigits: 0 }),
      { key: 'um', label: 'UM', aliases: ['um', 'unidade medida'], default: 'KG', hiddenInApp: true },
      calcField('_preco_sem_ipi', 'Preço\nsem IPI', 'currency', 'precoSemIpi'),
      icmsField({ fromCatalog: true }),
      calcField('_subtotal', 'Subtotal', 'currency', 'subtotal'),
      ...commercialFields({ coil: false, catalogPrice: true }),
      { key: 'preco_servico', label: 'Preço\nserviço', aliases: ['preco servico', 'preço serviço'], type: 'currency' },
      { key: 'descricao_servico', label: 'Descrição\nserviço', aliases: ['descricao servico', 'descrição serviço'] },
      calcField('_preco_total', 'Preço\ntotal', 'currency', 'precoTotal'),
      ...supplierFields(['mts', 'mto'], { includeAce: true }),
      ...footerFieldsModule(),
    ],
  },
  {
    id: 'bobinas',
    name: 'Bobinas',
    status: 'configured',
    fields: [
      ...alloyFields('BOBINA INTEIRA', { selectableMaterial: true }),
      { key: 'largura', label: 'Largura', aliases: ['largura', 'larg'], type: 'number' },
      { key: 'comprimento', label: 'Comprimento', aliases: ['comprimento', 'comp'], type: 'number' },
      { key: 'unidade', label: 'Quantidade', aliases: ['unidade', 'quantidade', 'qtd'], type: 'number' },
      pesoUnitarioField(),
      calcField('_peso_total', 'Peso\ntotal', 'number', 'pesoTotal', { fractionDigits: 0 }),
      { key: 'um', label: 'UM', aliases: ['um'], default: 'KG', hiddenInApp: true },
      calcField('_preco_sem_ipi', 'Preço\nsem IPI', 'currency', 'precoSemIpi'),
      icmsField({ fromCatalog: true }),
      calcField('_subtotal', 'Subtotal', 'currency', 'subtotal'),
      ...commercialFields({ coil: true, catalogPrice: true }),
      { key: 'preco_servico', label: 'Preço\nserviço', aliases: ['preco servico', 'preço serviço'], type: 'currency' },
      { key: 'descricao_servico', label: 'Descrição\nserviço', aliases: ['descricao servico', 'descrição serviço'] },
      calcField('_preco_total', 'Preço\ntotal', 'currency', 'precoTotal'),
      ...supplierFields(['mts', 'mto'], { includeAce: true }),
      ...footerFieldsModule(),
    ],
  },
  {
    id: 'slitters_fitas',
    name: 'Slitters e fitas',
    status: 'configured',
    fields: [
      ...alloyFields('FITA'),
      { key: 'largura', label: 'Largura', aliases: ['largura', 'larg'], type: 'number' },
      { key: 'unidade', label: 'Quantidade', aliases: ['unidade', 'quantidade', 'qtd'], type: 'number' },
      { key: 'peso_unitario', label: 'Peso\nunitário', aliases: ['peso unitario', 'peso unitário'], type: 'number', fractionDigits: 0 },
      calcField('_peso_total', 'Peso\ntotal', 'number', 'pesoTotal', { fractionDigits: 0 }),
      { key: 'um', label: 'UM', aliases: ['um'], default: 'KG', hiddenInApp: true },
      calcField('_preco_sem_ipi', 'Preço\nsem IPI', 'currency', 'precoSemIpi'),
      { key: 'icms', label: 'ICMS', aliases: ['icms'], options: ICMS_OPTIONS, askWhenNew: true },
      calcField('_subtotal', 'Subtotal', 'currency', 'subtotal'),
      ...commercialFields({ coil: true }),
      { key: 'largura_bobina', label: 'Largura\nbobina', aliases: ['largura bobina'], type: 'number' },
      { key: 'peso_bobina', label: 'Peso\nbobina', aliases: ['peso bobina'], type: 'number' },
      calcField('_peso_necessario', 'Peso\nnecessário', 'number', 'pesoNecessario'),
      calcField('_quantidade_cortes', 'Quantidade\nde cortes', 'number', 'quantidadeCortes'),
      calcField('_perda_mm', 'Perda (mm)', 'number', 'perdaMm'),
      calcField('_perda_percentual', 'Perda (%)', 'percent', 'perdaPercentual'),
      calcField('_acrescimo_perda_percentual', 'Acréscimo\nperda (%)', 'percent', 'acrescimoPerdaPercentual'),
      calcField('_acrescimo_perda_valor', 'Acréscimo perda (R$)', 'currency', 'acrescimoPerdaValor'),
      { key: 'preco_servico', label: 'Preço\nserviço', aliases: ['preco servico', 'preço serviço'], type: 'currency' },
      { key: 'descricao_servico', label: 'Descrição\nserviço', aliases: ['descricao servico', 'descrição serviço'] },
      calcField('_preco_total', 'Preço\ntotal', 'currency', 'precoTotal'),
      ...supplierFields(['mto']),
      ...footerFieldsModule(),
    ],
  },
  {
    id: 'blanks',
    name: 'Blanks',
    status: 'configured',
    fields: [
      ...alloyFields('BLANK'),
      { key: 'largura', label: 'Largura', aliases: ['largura', 'larg'], type: 'number' },
      { key: 'comprimento', label: 'Comprimento', aliases: ['comprimento', 'comp'], type: 'number' },
      { key: 'unidade', label: 'Quantidade', aliases: ['unidade', 'quantidade', 'qtd'], type: 'number' },
      calcField('_peso_unitario', 'Peso\nunitário', 'number', 'pesoUnitario', { fractionDigits: 0 }),
      calcField('_peso_total', 'Peso\ntotal', 'number', 'pesoTotal', { fractionDigits: 0 }),
      { key: 'um', label: 'UM', aliases: ['um'], default: 'KG', hiddenInApp: true },
      calcField('_preco_sem_ipi', 'Preço\nsem IPI', 'currency', 'precoSemIpi'),
      { key: 'icms', label: 'ICMS', aliases: ['icms'], options: ICMS_OPTIONS, askWhenNew: true },
      calcField('_subtotal', 'Subtotal', 'currency', 'subtotal'),
      ...commercialFields({ coil: true }),
      { key: 'largura_bobina', label: 'Largura\nbobina', aliases: ['largura bobina'], type: 'number' },
      { key: 'peso_bobina', label: 'Peso\nbobina', aliases: ['peso bobina'], type: 'number' },
      calcField('_peso_necessario', 'Peso\nnecessário', 'number', 'pesoNecessario'),
      calcField('_quantidade_cortes', 'Quantidade\nde cortes', 'number', 'quantidadeCortes'),
      calcField('_perda_mm', 'Perda (mm)', 'number', 'perdaMm'),
      calcField('_perda_percentual', 'Perda (%)', 'percent', 'perdaPercentual'),
      calcField('_acrescimo_perda_percentual', 'Acréscimo\nperda (%)', 'percent', 'acrescimoPerdaPercentual'),
      calcField('_acrescimo_perda_valor', 'Acréscimo\nperda (R$)', 'currency', 'acrescimoPerdaValor'),
      { key: 'preco_servico', label: 'Preço\nserviço', aliases: ['preco servico', 'preço serviço'], type: 'currency' },
      { key: 'descricao_servico', label: 'Descrição\nserviço', aliases: ['descricao servico', 'descrição serviço'] },
      calcField('_preco_total', 'Preço\ntotal', 'currency', 'precoTotal'),
      ...supplierFields(['mto']),
      ...footerFieldsModule(),
    ],
  },
  {
    id: 'tubos_barras',
    name: 'Tubos e barras',
    status: 'pending',
    fields: placeholderFields('TUBO/BARRA'),
  },
]

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}

export function itemFields(model: ModelDef): FieldDef[] {
  return model.fields.filter((f) => f.section !== 'Rodapé' && !f.hiddenInApp)
}

export function footerFields(model: ModelDef): FieldDef[] {
  return model.fields.filter((f) => f.section === 'Rodapé')
}

export function fieldLabel(label: string): string {
  return label.replace(/\n/g, ' ')
}

/** Campos internos omitidos no PDF do cliente */
export const HIDDEN_FROM_CLIENT = new Set([
  'fator_maximo',
  'fator_utilizado',
  'comissao',
  'preco_fator_100',
  '_preco_fator_utilizado',
  'preco_bobina_fator_100',
  '_preco_bobina_fator_utilizado',
  'preco_servico',
  'descricao_servico',
  'campanha',
  'acrescimo_perda_percentual',
  '_acrescimo_perda_percentual',
  '_acrescimo_perda_valor',
  '_preco_total',
  'icms',
])

export function isSupplierKey(key: string): boolean {
  return /^(ace_|filial_industria_|acos_prime_|img_|csa_|tetto_)/.test(key)
}
