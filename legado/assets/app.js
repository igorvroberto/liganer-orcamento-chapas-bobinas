const memoryStorage = {};

function storageGet(key, fallback = "") {
  try {
    return window.localStorage?.getItem(key) ?? fallback;
  } catch {
    return memoryStorage[key] ?? fallback;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    memoryStorage[key] = value;
  }
}

function storageJson(key, fallback) {
  try {
    return JSON.parse(storageGet(key, JSON.stringify(fallback)));
  } catch {
    return fallback;
  }
}

const TYPE_OPTIONS = ["304", "430", "J4", "410S", "316L", "410D", "201", "QN1803"];
const FINISH_OPTIONS = ["2B", "BA", "BQ", "ESCOVADO"];
const PVC_OPTIONS = ["NÃO", "AZUL", "PRETO E BRANCO", "PRETO", "NITTO FIBER"];
const THICKNESS_OPTIONS = ["0,35", "0,40", "0,50", "0,60", "0,80", "1,00", "1,20", "1,50", "2,00", "2,50", "3,00", "3,50", "4,00", "4,50", "5,00", "6,00", "8,00"];
const ICMS_OPTIONS = ["4%", "12%"];
const COMMISSION_OPTIONS = ["Bonificada", "Normal", "Reduzida"];
const COIL_TYPE_OPTIONS = ["Inteira", "Cortada", "Com PVC"];

function calcField(key, label, type, calc) {
  return { key, label, type, virtual: true, calculated: true, calc };
}

function footerFieldsModule() {
  return [
    { key: "pagamento", label: "Pagamento", aliases: ["pagamento", "condicao", "condição"], section: "Rodapé" },
    { key: "prazo_entrega", label: "Prazo de entrega", aliases: ["prazo de entrega", "entrega", "prazo"], section: "Rodapé" },
    { key: "local_expedicao", label: "Local de expedição", aliases: ["local de expedicao", "local de expedição", "expedicao", "expedição"], options: ["SP", "CE"], askWhenNew: true, section: "Rodapé" },
    { key: "cidade_cliente", label: "Cidade do cliente", aliases: ["cidade do cliente", "cidade", "cliente cidade"], section: "Rodapé" },
    { key: "tipo_frete", label: "Tipo de frete", aliases: ["tipo de frete", "frete"], options: ["CIF", "FOB"], askWhenNew: true, section: "Rodapé" },
    { key: "observacoes_gerais", label: "Observações gerais", aliases: ["observacoes gerais", "observações gerais", "observacoes", "observações"], section: "Rodapé" },
    { key: "frete_percentual", label: "Frete (%)", aliases: ["frete", "percentual frete", "frete percentual"], type: "percent", section: "Rodapé" }
  ];
}

function alloyFields(materialDefault) {
  return [
    { key: "material", label: "Material", aliases: ["material", "produto"], default: materialDefault, locked: true },
    { key: "tipo", label: "Tipo", aliases: ["tipo", "liga", "aco", "aço"], options: TYPE_OPTIONS, askWhenNew: true },
    { key: "acabamento", label: "Acabamento", aliases: ["acabamento"], options: FINISH_OPTIONS, askWhenNew: true },
    { key: "pvc", label: "PVC", aliases: ["pvc", "plastico", "plástico"], options: PVC_OPTIONS, askWhenNew: true },
    { key: "espessura", label: "Espessura", aliases: ["espessura", "esp"], type: "number", options: THICKNESS_OPTIONS, askWhenNew: true }
  ];
}

function commercialFields({ coil = false } = {}) {
  const key100 = coil ? "preco_bobina_fator_100" : "preco_fator_100";
  const keyUsed = coil ? "_preco_bobina_fator_utilizado" : "_preco_fator_utilizado";
  const label100 = coil ? "Preço bobina\nfator 100" : "Preço\nfator 100";
  const labelUsed = coil ? "Preço bobina\nfator utilizado" : "Preço\nfator utilizado";
  const calc = coil ? "precoBobinaFatorUtilizado" : "precoFatorUtilizado";
  return [
    { key: "observacao", label: "Observação", aliases: ["observacao", "observação", "obs"] },
    { key: key100, label: label100, aliases: ["preco fator 100", "preço fator 100", "preco", "preço", "valor", "preco bobina fator 100", "preço bobina fator 100"], type: "currency" },
    { key: "fator_maximo", label: "Fator\nmáximo", aliases: ["fator maximo", "fator máximo"], type: "number" },
    { key: "fator_utilizado", label: "Fator\nutilizado", aliases: ["fator utilizado", "fator usado"], type: "number" },
    calcField(keyUsed, labelUsed, "currency", calc),
    ...(coil ? [{ key: "tipo_bobina", label: "Tipo\nbobina", aliases: ["tipo bobina"], options: COIL_TYPE_OPTIONS, askWhenNew: true }] : []),
    { key: "comissao", label: "Comissão", aliases: ["comissao", "comissão"], options: COMMISSION_OPTIONS, askWhenNew: true },
    { key: "campanha", label: "Campanha", aliases: ["campanha"] }
  ];
}

function supplierFields(prefixes = ["mto"], includeAce = false) {
  const fields = [];
  if (includeAce) {
    fields.push(
      { key: "ace_mts", label: "ACE\nMTS", aliases: ["ace mts"], type: "boolean" },
      { key: "ace_mto", label: "ACE\nMTO", aliases: ["ace mto"], type: "boolean" }
    );
  }
  prefixes.forEach((suffix) => {
    const labelSuffix = suffix.toUpperCase();
    fields.push(
      { key: `filial_industria_${suffix}`, label: `FIL IND\n${labelSuffix}`, aliases: [`filial industria ${suffix}`, `filial indústria ${suffix}`, `fil ind ${suffix}`], type: "boolean" },
      { key: `acos_prime_${suffix}`, label: `Aços Prime\n${labelSuffix}`, aliases: [`acos prime ${suffix}`, `aços prime ${suffix}`], type: "boolean" },
      { key: `img_${suffix}`, label: `IMG\n${labelSuffix}`, aliases: [`img ${suffix}`], type: "boolean" },
      { key: `csa_${suffix}`, label: `CSA\n${labelSuffix}`, aliases: [`csa ${suffix}`], type: "boolean" },
      { key: `tetto_${suffix}`, label: `Tetto\n${labelSuffix}`, aliases: [`tetto ${suffix}`], type: "boolean" }
    );
  });
  return fields;
}

const models = [
  {
    id: "chapas",
    name: "Chapas",
    status: "configured",
    sheet: "Orçamento",
    rowRange: "3 a 12",
    formulaNote: "",
    fields: [
      { key: "material", label: "Material", aliases: ["material", "produto"], default: "CHAPA", locked: true },
      { key: "tipo", label: "Tipo", aliases: ["tipo", "liga", "aco", "aço"], options: ["304", "430", "J4", "410S", "316L", "410D", "201", "QN1803"], askWhenNew: true },
      { key: "acabamento", label: "Acabamento", aliases: ["acabamento"], options: ["2B", "BA", "BQ", "ESCOVADO"], askWhenNew: true },
      { key: "pvc", label: "PVC", aliases: ["pvc", "plastico", "plástico"], options: ["NÃO", "AZUL", "PRETO E BRANCO", "PRETO", "NITTO FIBER"], askWhenNew: true },
      { key: "espessura", label: "Espessura", aliases: ["espessura", "esp"], type: "number", options: ["0,35", "0,40", "0,50", "0,60", "0,80", "1,00", "1,20", "1,50", "2,00", "2,50", "3,00", "3,50", "4,00", "4,50", "5,00", "6,00", "8,00"], askWhenNew: true },
      { key: "largura", label: "Largura", aliases: ["largura", "larg"], type: "number" },
      { key: "comprimento", label: "Comprimento", aliases: ["comprimento", "comp"], type: "number" },
      { key: "unidade", label: "Quantidade", aliases: ["unidade", "quantidade", "qtd", "peças", "pecas"], type: "number" },
      { key: "um", label: "UM", aliases: ["um", "unidade medida"], default: "KG", hiddenInApp: true },
      { key: "icms", label: "ICMS", aliases: ["icms"], options: ["4%", "12%"], askWhenNew: true },
      { key: "observacao", label: "Observação", aliases: ["observacao", "observação", "obs"] },
      { key: "preco_fator_100", label: "Preço\nfator 100", aliases: ["preco fator 100", "preço fator 100", "preco", "preço", "valor"], type: "currency" },
      { key: "fator_maximo", label: "Fator\nmáximo", aliases: ["fator maximo", "fator máximo"], type: "number" },
      { key: "fator_utilizado", label: "Fator\nutilizado", aliases: ["fator utilizado", "fator usado"], type: "number" },
      { key: "comissao", label: "Comissão", aliases: ["comissao", "comissão"], options: ["Bonificada", "Normal", "Reduzida"], askWhenNew: true },
      { key: "campanha", label: "Campanha", aliases: ["campanha"] },
      { key: "preco_servico", label: "Preço\nserviço", aliases: ["preco servico", "preço serviço", "valor servico", "valor serviço"], type: "currency" },
      { key: "descricao_servico", label: "Descrição\nserviço", aliases: ["descricao servico", "descrição serviço", "descricao do servico", "descrição do serviço"] },
      { key: "ace_mts", label: "ACE\nMTS", aliases: ["ace mts"], type: "boolean" },
      { key: "ace_mto", label: "ACE\nMTO", aliases: ["ace mto"], type: "boolean" },
      { key: "filial_industria_mts", label: "FIL IND\nMTS", aliases: ["filial industria mts", "filial indústria mts", "fil ind mts"], type: "boolean" },
      { key: "filial_industria_mto", label: "FIL IND\nMTO", aliases: ["filial industria mto", "filial indústria mto", "fil ind mto"], type: "boolean" },
      { key: "acos_prime_mto", label: "Aços Prime\nMTO", aliases: ["acos prime mto", "aços prime mto"], type: "boolean" },
      { key: "img_mto", label: "IMG\nMTO", aliases: ["img mto"], type: "boolean" },
      { key: "csa_mto", label: "CSA\nMTO", aliases: ["csa mto"], type: "boolean" },
      { key: "tetto_mts", label: "Tetto\nMTS", aliases: ["tetto mts"], type: "boolean" },
      { key: "tetto_mto", label: "Tetto\nMTO", aliases: ["tetto mto"], type: "boolean" },
      { key: "pagamento", label: "Pagamento", aliases: ["pagamento", "condicao", "condição"], section: "Rodapé" },
      { key: "prazo_entrega", label: "Prazo de entrega", aliases: ["prazo de entrega", "entrega", "prazo"], section: "Rodapé" },
      { key: "local_expedicao", label: "Local de expedição", aliases: ["local de expedicao", "local de expedição", "expedicao", "expedição"], options: ["SP", "CE"], askWhenNew: true, section: "Rodapé" },
      { key: "cidade_cliente", label: "Cidade do cliente", aliases: ["cidade do cliente", "cidade", "cliente cidade"], section: "Rodapé" },
      { key: "tipo_frete", label: "Tipo de frete", aliases: ["tipo de frete", "frete"], options: ["CIF", "FOB"], askWhenNew: true, section: "Rodapé" },
      { key: "observacoes_gerais", label: "Observações gerais", aliases: ["observacoes gerais", "observações gerais", "observacoes", "observações"], section: "Rodapé" },
      { key: "frete_percentual", label: "Frete (%)", aliases: ["frete", "percentual frete", "frete percentual"], type: "percent", section: "Rodapé" }
    ]
  },
  {
    id: "bobinas",
    name: "Bobinas",
    status: "configured",
    fields: [
      ...alloyFields("BOBINA"),
      { key: "largura", label: "Largura", aliases: ["largura", "larg"], type: "number" },
      { key: "unidade", label: "Quantidade", aliases: ["unidade", "quantidade", "qtd"], type: "number" },
      { key: "peso_unitario", label: "Peso\nunitário", aliases: ["peso unitario", "peso unitário"], type: "number" },
      calcField("_peso_total", "Peso\ntotal", "number", "pesoTotal"),
      { key: "um", label: "UM", aliases: ["um"], default: "KG", hiddenInApp: true },
      calcField("_preco_sem_ipi", "Preço\nsem IPI", "currency", "precoSemIpi"),
      { key: "icms", label: "ICMS", aliases: ["icms"], options: ICMS_OPTIONS, askWhenNew: true },
      calcField("_subtotal", "Subtotal", "currency", "subtotal"),
      ...commercialFields({ coil: true }),
      { key: "preco_servico", label: "Preço\nserviço", aliases: ["preco servico", "preço serviço"], type: "currency" },
      { key: "descricao_servico", label: "Descrição\nserviço", aliases: ["descricao servico", "descrição serviço"] },
      calcField("_preco_total", "Preço\ntotal", "currency", "precoTotal"),
      ...supplierFields(["mts", "mto"]),
      ...footerFieldsModule()
    ]
  },
  {
    id: "slitters_fitas",
    name: "Slitters e fitas",
    status: "configured",
    fields: [
      ...alloyFields("FITA"),
      { key: "largura", label: "Largura", aliases: ["largura", "larg"], type: "number" },
      { key: "unidade", label: "Quantidade", aliases: ["unidade", "quantidade", "qtd"], type: "number" },
      { key: "peso_unitario", label: "Peso\nunitário", aliases: ["peso unitario", "peso unitário"], type: "number" },
      calcField("_peso_total", "Peso\ntotal", "number", "pesoTotal"),
      { key: "um", label: "UM", aliases: ["um"], default: "KG", hiddenInApp: true },
      calcField("_preco_sem_ipi", "Preço\nsem IPI", "currency", "precoSemIpi"),
      { key: "icms", label: "ICMS", aliases: ["icms"], options: ICMS_OPTIONS, askWhenNew: true },
      calcField("_subtotal", "Subtotal", "currency", "subtotal"),
      ...commercialFields({ coil: true }),
      { key: "largura_bobina", label: "Largura\nbobina", aliases: ["largura bobina"], type: "number" },
      { key: "peso_bobina", label: "Peso\nbobina", aliases: ["peso bobina"], type: "number" },
      calcField("_peso_necessario", "Peso\nnecessário", "number", "pesoNecessario"),
      calcField("_quantidade_cortes", "Quantidade\nde cortes", "number", "quantidadeCortes"),
      calcField("_perda_mm", "Perda (mm)", "number", "perdaMm"),
      calcField("_perda_percentual", "Perda (%)", "percent", "perdaPercentual"),
      calcField("_acrescimo_perda_percentual", "Acréscimo\nperda (%)", "percent", "acrescimoPerdaPercentual"),
      calcField("_acrescimo_perda_valor", "Acréscimo perda (R$)", "currency", "acrescimoPerdaValor"),
      { key: "preco_servico", label: "Preço\nserviço", aliases: ["preco servico", "preço serviço"], type: "currency" },
      { key: "descricao_servico", label: "Descrição\nserviço", aliases: ["descricao servico", "descrição serviço"] },
      calcField("_preco_total", "Preço\ntotal", "currency", "precoTotal"),
      ...supplierFields(["mto"]),
      ...footerFieldsModule()
    ]
  },
  {
    id: "blanks",
    name: "Blanks",
    status: "configured",
    fields: [
      ...alloyFields("BLANK"),
      { key: "largura", label: "Largura", aliases: ["largura", "larg"], type: "number" },
      { key: "comprimento", label: "Comprimento", aliases: ["comprimento", "comp"], type: "number" },
      { key: "unidade", label: "Quantidade", aliases: ["unidade", "quantidade", "qtd"], type: "number" },
      calcField("_peso_unitario", "Peso\nunitário", "number", "pesoUnitario"),
      calcField("_peso_total", "Peso\ntotal", "number", "pesoTotal"),
      { key: "um", label: "UM", aliases: ["um"], default: "KG", hiddenInApp: true },
      calcField("_preco_sem_ipi", "Preço\nsem IPI", "currency", "precoSemIpi"),
      { key: "icms", label: "ICMS", aliases: ["icms"], options: ICMS_OPTIONS, askWhenNew: true },
      calcField("_subtotal", "Subtotal", "currency", "subtotal"),
      ...commercialFields({ coil: true }),
      { key: "largura_bobina", label: "Largura\nbobina", aliases: ["largura bobina"], type: "number" },
      { key: "peso_bobina", label: "Peso\nbobina", aliases: ["peso bobina"], type: "number" },
      calcField("_peso_necessario", "Peso\nnecessário", "number", "pesoNecessario"),
      calcField("_quantidade_cortes", "Quantidade\nde cortes", "number", "quantidadeCortes"),
      calcField("_perda_mm", "Perda (mm)", "number", "perdaMm"),
      calcField("_perda_percentual", "Perda (%)", "percent", "perdaPercentual"),
      calcField("_acrescimo_perda_percentual", "Acréscimo\nperda (%)", "percent", "acrescimoPerdaPercentual"),
      calcField("_acrescimo_perda_valor", "Acréscimo\nperda (R$)", "currency", "acrescimoPerdaValor"),
      { key: "preco_servico", label: "Preço\nserviço", aliases: ["preco servico", "preço serviço"], type: "currency" },
      { key: "descricao_servico", label: "Descrição\nserviço", aliases: ["descricao servico", "descrição serviço"] },
      calcField("_preco_total", "Preço\ntotal", "currency", "precoTotal"),
      ...supplierFields(["mto"]),
      ...footerFieldsModule()
    ]
  },
  { id: "tubos_barras", name: "Tubos e barras", status: "pending", fields: placeholderFields("TUBO/BARRA") }
];

const state = {
  modelId: storageGet("voiceSheetModelId", "chapas") || "chapas",
  client: storageJson("voiceSheetClient", { name: "", cnpj: "" }),
  rowsByModel: storageJson("voiceSheetRowsByModel", {}),
  draftsByModel: storageJson("voiceSheetDraftsByModel", {}),
  stepIndexByModel: storageJson("voiceSheetStepIndexByModel", {}),
  editRowIndexByModel: storageJson("voiceSheetEditRowIndexByModel", {}),
  footerStepIndexByModel: storageJson("voiceSheetFooterStepIndexByModel", {}),
  dictationTarget: "item",
  pendingUnknowns: [],
  recognition: null,
  listening: false,
  autoListen: false,
  speechStartedAt: 0,
  speechHadResult: false,
  speechRetryCount: 0,
  speechLastPreviewText: ""
};

const els = {};

function collectElements() {
  Object.assign(els, {
    modelSelect: document.querySelector("#modelSelect"),
    clientNameInput: document.querySelector("#clientNameInput"),
    clientCnpjInput: document.querySelector("#clientCnpjInput"),
    modelMeta: document.querySelector("#modelMeta"),
    modelNotice: document.querySelector("#modelNotice"),
    micButton: document.querySelector("#micButton"),
    micLabel: document.querySelector("#micLabel"),
    stepStatus: document.querySelector("#stepStatus"),
    prevItemFieldButton: document.querySelector("#prevItemFieldButton"),
    nextItemFieldButton: document.querySelector("#nextItemFieldButton"),
    footerMicButton: document.querySelector("#footerMicButton"),
    footerMicLabel: document.querySelector("#footerMicLabel"),
    footerStepStatus: document.querySelector("#footerStepStatus"),
    prevFooterFieldButton: document.querySelector("#prevFooterFieldButton"),
    nextFooterFieldButton: document.querySelector("#nextFooterFieldButton"),
    applyTextButton: document.querySelector("#applyTextButton"),
    saveRowButton: document.querySelector("#saveRowButton"),
    transcriptInput: document.querySelector("#transcriptInput"),
    exportClientPdfButton: document.querySelector("#exportClientPdfButton"),
    exportLiganerPdfButton: document.querySelector("#exportLiganerPdfButton"),
    exportXlsxButton: document.querySelector("#exportXlsxButton"),
    exportCsvButton: document.querySelector("#exportCsvButton"),
    saveBudgetButton: document.querySelector("#saveBudgetButton"),
    settingsButton: document.querySelector("#settingsButton"),
    settingsDialog: document.querySelector("#settingsDialog"),
    columnsConfig: document.querySelector("#columnsConfig"),
    saveColumnsButton: document.querySelector("#saveColumnsButton"),
    resetColumnsButton: document.querySelector("#resetColumnsButton"),
    summaryGrid: document.querySelector("#summaryGrid"),
    footerGrid: document.querySelector("#footerGrid"),
    tableHead: document.querySelector("#tableHead"),
    tableBody: document.querySelector("#tableBody"),
    addItemButton: document.querySelector("#addItemButton"),
    statusLine: document.querySelector("#statusLine")
  });
}

function placeholderFields(materialDefault) {
  return [
    { key: "material", label: "Material", aliases: ["material", "produto"], default: materialDefault, locked: true },
    { key: "tipo", label: "Tipo", aliases: ["tipo", "liga", "aço", "aco"], askWhenNew: true },
    { key: "acabamento", label: "Acabamento", aliases: ["acabamento"], askWhenNew: true },
    { key: "espessura", label: "Espessura", aliases: ["espessura", "esp"], type: "number" },
    { key: "largura", label: "Largura", aliases: ["largura"], type: "number" },
    { key: "comprimento", label: "Comprimento", aliases: ["comprimento"], type: "number" },
    { key: "quantidade", label: "Quantidade", aliases: ["quantidade", "qtd"], type: "number" },
    { key: "preco", label: "Preço", aliases: ["preco", "preço", "valor"], type: "currency" },
    { key: "observacao", label: "Observação", aliases: ["observacao", "observação", "obs"] }
  ];
}

function activeModel() {
  return models.find((model) => model.id === state.modelId) || models[0];
}

function activeFields() {
  return activeModel().fields;
}

function itemFields() {
  return activeFields().filter((field) => field.section !== "Rodapé");
}

function footerFields() {
  return activeFields().filter((field) => field.section === "Rodapé");
}

function registerFields() {
  const visibleItemFields = itemFields().filter((field) => !field.hiddenInApp);
  if (visibleItemFields.some((field) => field.calculated)) {
    return [
      { key: "_delete", label: "", virtual: true, action: "delete" },
      { key: "_item", label: "Item", type: "number", virtual: true },
      ...visibleItemFields
    ];
  }
  return [
    { key: "_delete", label: "", virtual: true, action: "delete" },
    { key: "_item", label: "Item", type: "number", virtual: true },
    ...visibleItemFields.flatMap((field) => field.key === "unidade"
      ? [
          field,
          { key: "_peso_unitario", label: "Peso\nunitário", type: "number", virtual: true, calculated: true },
          { key: "_peso_total", label: "Peso\ntotal", type: "number", virtual: true, calculated: true }
        ]
      : field.key === "preco_fator_100"
        ? [field]
      : field.key === "fator_utilizado"
        ? [field, { key: "_preco_fator_utilizado", label: "Preço\nfator utilizado", type: "currency", virtual: true, calculated: true }]
      : field.key === "descricao_servico"
        ? [field, { key: "_preco_total", label: "Preço\ntotal", type: "currency", virtual: true, calculated: true }]
      : field.key === "icms"
        ? [{ key: "_preco_sem_ipi", label: "Preço\nsem IPI", type: "currency", virtual: true, calculated: true }, field, { key: "_subtotal", label: "Subtotal", type: "currency", virtual: true, calculated: true }]
      : [field])
  ];
}

function exportFields() {
  return registerFields().filter((field) => field.action !== "delete");
}

function activeRows() {
  if (!state.rowsByModel[state.modelId]) state.rowsByModel[state.modelId] = [];
  return state.rowsByModel[state.modelId];
}

function ensureInitialItemRow() {
  const rows = activeRows();
  if (!rows.length) {
    rows.push({});
    state.editRowIndexByModel[state.modelId] = 0;
    state.stepIndexByModel[state.modelId] = 0;
    saveState();
  }
}

function activeDraft() {
  if (!state.draftsByModel[state.modelId]) state.draftsByModel[state.modelId] = {};
  return state.draftsByModel[state.modelId];
}

function activeEditRowIndex() {
  const rows = activeRows();
  const saved = Number(state.editRowIndexByModel[state.modelId]);
  if (Number.isInteger(saved) && saved >= 0 && saved < rows.length) return saved;
  return -1;
}

function activeItemRow({ create = false } = {}) {
  const rows = activeRows();
  let index = activeEditRowIndex();
  if (index === -1 && create) {
    rows.push({});
    index = rows.length - 1;
    state.editRowIndexByModel[state.modelId] = index;
    saveState();
  }
  return index === -1 ? null : rows[index];
}

function setActiveEditRow(index, stepIndex = activeStepIndex()) {
  const rows = activeRows();
  if (index < 0 || index >= rows.length) {
    delete state.editRowIndexByModel[state.modelId];
  } else {
    state.editRowIndexByModel[state.modelId] = index;
  }
  setStepIndex(stepIndex);
  saveState();
}

function fieldStepIndex(fieldKey) {
  return stepFields().findIndex((field) => field.key === fieldKey);
}

function stepFields() {
  return itemFields().filter((field) => !field.hiddenInApp && !field.calculated && !field.virtual && !field.locked);
}

function footerStepFields() {
  return footerFields();
}

function activeStepIndex() {
  const fields = stepFields();
  const saved = Number(state.stepIndexByModel[state.modelId] || 0);
  return Math.min(Math.max(saved, 0), Math.max(fields.length - 1, 0));
}

function activeStepField() {
  return stepFields()[activeStepIndex()];
}

function setStepIndex(index) {
  const fields = stepFields();
  state.stepIndexByModel[state.modelId] = Math.min(Math.max(index, 0), Math.max(fields.length - 1, 0));
  saveState();
}

function activeFooterStepIndex() {
  const fields = footerStepFields();
  const saved = Number(state.footerStepIndexByModel[state.modelId] || 0);
  return Math.min(Math.max(saved, 0), Math.max(fields.length - 1, 0));
}

function activeFooterStepField() {
  return footerStepFields()[activeFooterStepIndex()];
}

function setFooterStepIndex(index) {
  const fields = footerStepFields();
  state.footerStepIndexByModel[state.modelId] = Math.min(Math.max(index, 0), Math.max(fields.length - 1, 0));
  saveState();
}

function saveState() {
  storageSet("voiceSheetModelId", state.modelId);
  storageSet("voiceSheetClient", JSON.stringify(state.client));
  storageSet("voiceSheetRowsByModel", JSON.stringify(state.rowsByModel));
  storageSet("voiceSheetDraftsByModel", JSON.stringify(state.draftsByModel));
  storageSet("voiceSheetStepIndexByModel", JSON.stringify(state.stepIndexByModel));
  storageSet("voiceSheetEditRowIndexByModel", JSON.stringify(state.editRowIndexByModel));
  storageSet("voiceSheetFooterStepIndexByModel", JSON.stringify(state.footerStepIndexByModel));
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9,%./\s_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldAliases(field) {
  const base = [field.key, field.label, ...(field.aliases || [])];
  return [...new Set(base.map(normalize).filter(Boolean))].sort((a, b) => b.length - a.length);
}

function parseNumber(value) {
  const numberWords = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
    treze: 13, quatorze: 14, catorze: 14, quinze: 15, vinte: 20, trinta: 30
  };
  const clean = normalize(value).replace(/\breais?\b|\br\$\b|\bkg\b|\bmm\b/g, "").trim();
  if (numberWords[clean] !== undefined) return numberWords[clean];
  const decimalText = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const numeric = decimalText.match(/-?\d+(\.\d+)?/);
  return numeric ? Number(numeric[0]) : value;
}

function sanitizeNumericInput(value) {
  let text = String(value ?? "").replace(/[^\d,.-]/g, "");
  text = text.replace(/(?!^)-/g, "");
  const commaIndex = text.indexOf(",");
  if (commaIndex !== -1) {
    text = text.slice(0, commaIndex + 1) + text.slice(commaIndex + 1).replace(/,/g, "");
  }
  return text;
}

function normalizeExpeditionLocation(value) {
  const clean = normalize(value);
  if (clean === "sp" || clean === "sao paulo") return "SP";
  if (clean === "ce" || clean === "ceara") return "CE";
  return String(value || "").trim().toUpperCase();
}

function formatClientCity(value) {
  const text = String(value || "").trim().replace(/\s*[-–—]\s*/g, " - ");
  const [city, state] = text.split(/\s+-\s+/);
  const formattedCity = String(city || "")
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)([a-záàâãéêíóôõúç])/g, (match) => match.toLocaleUpperCase("pt-BR"));
  const formattedState = state ? ` - ${state.toLocaleUpperCase("pt-BR")}` : "";
  return `${formattedCity}${formattedState}`.trim();
}

function formatCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function coerceValue(value, field) {
  if (field.key === "local_expedicao") return normalizeExpeditionLocation(value);
  if (field.key === "cidade_cliente") return formatClientCity(value);
  if (field.type === "number" || field.type === "currency") {
    const number = parseNumber(value);
    return typeof number === "number" && Number.isFinite(number) ? number : "";
  }
  if (field.type === "percent") {
    const number = parseNumber(value);
    return typeof number === "number" && Number.isFinite(number) ? number : "";
  }
  if (field.type === "boolean") {
    const clean = normalize(value);
    return /^(sim|true|verdadeiro|marcado|selecionado|check|x)$/.test(clean);
  }
  if (field.key === "icms") {
    const number = parseNumber(value);
    return typeof number === "number" ? `${number}%` : value.trim();
  }
  return String(value || "").trim();
}

function replaceDictatedSymbols(value) {
  return String(value || "")
    .replace(/\bbarra\b/gi, "/")
    .replace(/\bh[ií]fen\b/gi, "-")
    .replace(/\btra[cç]o\b/gi, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-");
}

function canonicalOption(value, field) {
  if (!field.options?.length) return { value, known: true };
  const normalizedValue = normalize(value).replace(/\s/g, "");
  for (const option of field.options) {
    if (normalize(option).replace(/\s/g, "") === normalizedValue) {
      return { value: option, known: true };
    }
    if (field.type === "number") {
      const optionNumber = parseNumber(option);
      const valueNumber = parseNumber(value);
      if (typeof optionNumber === "number" && typeof valueNumber === "number" && Math.abs(optionNumber - valueNumber) < 0.000001) {
        return { value: option, known: true };
      }
    }
  }
  return { value, known: false };
}

function validateOptions(updates) {
  const unknowns = [];
  for (const field of activeFields()) {
    if (!(field.key in updates)) continue;
    const check = canonicalOption(updates[field.key], field);
    updates[field.key] = check.value;
    if (!check.known && field.askWhenNew) {
      unknowns.push({ field, value: updates[field.key] });
    }
  }
  state.pendingUnknowns = unknowns;
  renderModelNotice();
  return unknowns;
}

function parseDictation(text, target = "item") {
  const normalized = normalize(text);
  const isFooter = target === "footer";
  const currentField = isFooter ? activeFooterStepField() : activeStepField();
  const dictatableFields = isFooter ? footerStepFields() : stepFields();

  if (/salvar linha|gravar linha|nova linha/.test(normalized)) {
    saveDraftAsRow();
    return {};
  }

  if (/limpar linha|apagar linha/.test(normalized)) {
    const rowIndex = activeEditRowIndex();
    if (!isFooter && rowIndex !== -1) activeRows().splice(rowIndex, 1);
    else state.draftsByModel[state.modelId] = {};
    delete state.editRowIndexByModel[state.modelId];
    state.stepIndexByModel[state.modelId] = 0;
    saveState();
    return {};
  }

  if (/^(pular|proximo|pr[oó]ximo|avancar|avançar)$/.test(normalized)) {
    skipCurrentField(target);
    return { _skipped: true };
  }

  if (currentField && !dictatableFields.some((field) => fieldAliases(field).some((alias) => normalized.includes(`${alias} `)))) {
    return applyDictatedValue(currentField, text, target);
  }

  const matches = [];

  for (const field of dictatableFields) {
    for (const alias of fieldAliases(field)) {
      const found = normalized.match(new RegExp(`(^|\\s)${escapeRegExp(alias)}\\s+`));
      if (found) {
        matches.push({ field, index: found.index, start: found.index + found[0].length });
        break;
      }
    }
  }

  matches.sort((a, b) => a.index - b.index);
  const updates = {};
  matches.forEach((match, idx) => {
    const end = idx + 1 < matches.length ? matches[idx + 1].index : normalized.length;
    const rawValue = normalized.slice(match.start, end).replace(/^[:,\s]+/, "").replace(/[,\s]+$/, "");
    if (rawValue) updates[match.field.key] = coerceValue(isFooter ? replaceDictatedSymbols(rawValue) : rawValue, match.field);
  });

  validateOptions(updates);
  Object.assign(isFooter ? activeDraft() : activeItemRow({ create: true }), updates);
  if (!state.pendingUnknowns.length && Object.keys(updates).length) {
    if (isFooter) advanceAfterFooterDictation();
    else advanceAfterDictation();
  }

  saveState();
  return updates;
}

function previewDictation(text, target = "item") {
  const normalized = normalize(text);
  if (!normalized || /^(pular|proximo|pr[oó]ximo|avancar|avançar)$/.test(normalized)) return false;
  if (/salvar linha|gravar linha|nova linha|limpar linha|apagar linha/.test(normalized)) return false;

  const isFooter = target === "footer";
  const currentField = isFooter ? activeFooterStepField() : activeStepField();
  const dictatableFields = isFooter ? footerStepFields() : stepFields();
  if (!currentField) return false;

  const mentionsAnyField = dictatableFields.some((field) => (
    field.key !== currentField.key
    && fieldAliases(field).some((alias) => normalized.includes(`${alias} `))
  ));
  if (mentionsAnyField) return false;

  const signature = `${target}:${currentField.key}:${normalized}`;
  if (state.speechLastPreviewText === signature) return false;
  state.speechLastPreviewText = signature;

  const value = coerceValue(target === "footer" ? replaceDictatedSymbols(text) : text, currentField);
  const updates = { [currentField.key]: value };
  validateOptions(updates);
  Object.assign(isFooter ? activeDraft() : activeItemRow({ create: true }), updates);
  saveState();
  return true;
}

function applyDictatedValue(field, text, target) {
  const value = coerceValue(target === "footer" ? replaceDictatedSymbols(text) : text, field);
  const updates = { [field.key]: value };
  validateOptions(updates);
  Object.assign(target === "footer" ? activeDraft() : activeItemRow({ create: true }), updates);
  if (!state.pendingUnknowns.length) {
    if (target === "footer") advanceAfterFooterDictation();
    else advanceAfterDictation();
  }
  saveState();
  return updates;
}

function advanceAfterDictation() {
  const nextIndex = activeStepIndex() + 1;
  if (nextIndex >= stepFields().length) {
    delete state.editRowIndexByModel[state.modelId];
    setStepIndex(0);
    saveState();
    renderAll();
    setStatus("Item concluído. Próximo ditado iniciará uma nova linha.");
  } else {
    setStepIndex(nextIndex);
  }
}

function advanceAfterFooterDictation() {
  setFooterStepIndex(activeFooterStepIndex() + 1);
}

function skipCurrentField(target) {
  if (target === "footer") setFooterStepIndex(activeFooterStepIndex() + 1);
  else advanceAfterDictation();
  renderAll();
}

function moveCurrentField(target, direction) {
  if (target === "footer") {
    setFooterStepIndex(activeFooterStepIndex() + direction);
  } else {
    if (direction > 0 && activeStepIndex() >= stepFields().length - 1) {
      delete state.editRowIndexByModel[state.modelId];
      setStepIndex(0);
      saveState();
      renderAll();
      setStatus("Item concluido. Proximo ditado iniciara uma nova linha.");
      return;
    }
    setStepIndex(activeStepIndex() + direction);
  }
  renderAll();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayValue(value, field) {
  if (value === undefined || value === null || value === "") return "";
  if (field.type === "boolean") return normalize(value) === "sim" || value === true || value === "✓" ? "✓" : "";
  if (field.type === "currency") {
    const number = Number(value);
    if (!Number.isNaN(number)) return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (field.type === "percent") {
    const number = Number(value);
    if (!Number.isNaN(number)) return formatPercent(Math.abs(number) > 1 ? number / 100 : number);
  }
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isNaN(number)) return formatNumber(number);
  }
  return value;
}

function displayPdfValue(value, field) {
  if (["_item", "fator_maximo", "fator_utilizado", "largura", "comprimento", "unidade"].includes(field.key)) {
    const number = Number(value);
    if (!Number.isNaN(number)) return number.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  return displayValue(value, field);
}

function numericValue(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = parseNumber(String(value));
  return typeof parsed === "number" && !Number.isNaN(parsed) ? parsed : 0;
}

function percentRate(value) {
  return numericValue(value) / 100;
}

function calculateRow(row) {
  const modelId = activeModel().id;
  const espessura = numericValue(row.espessura);
  const largura = numericValue(row.largura);
  const comprimento = numericValue(row.comprimento);
  const unidade = numericValue(row.unidade);
  const fatorUtilizado = numericValue(row.fator_utilizado);
  const precoFator100 = numericValue(row.preco_fator_100 ?? row.preco);
  const precoBobinaFator100 = numericValue(row.preco_bobina_fator_100);
  const precoServico = numericValue(row.preco_servico);
  const larguraBobina = numericValue(row.largura_bobina);
  const frete = percentRate(activeDraft().frete_percentual);
  const isCoilWeightModel = modelId === "bobinas" || modelId === "slitters_fitas";
  const pesoUnitario = isCoilWeightModel
    ? numericValue(row.peso_unitario)
    : 1 * 8 * espessura * (largura / 1000) * (comprimento / 1000);
  const pesoTotal = isCoilWeightModel
    ? unidade * pesoUnitario
    : unidade * 8 * espessura * (largura / 1000) * (comprimento / 1000);
  const precoFatorUtilizado = fatorUtilizado ? precoFator100 / (fatorUtilizado / 100) : 0;
  const precoBobinaFatorUtilizado = fatorUtilizado ? precoBobinaFator100 / (fatorUtilizado / 100) : 0;
  const quantidadeCortes = larguraBobina && largura ? Math.floor(larguraBobina / largura) : 0;
  const perdaMm = larguraBobina && largura ? larguraBobina - largura * quantidadeCortes : 0;
  const perdaPercentual = larguraBobina ? perdaMm / larguraBobina : 0;
  const pesoNecessario = pesoTotal + pesoTotal * perdaPercentual;
  const acrescimoPerdaPercentual = perdaMm < 100
    ? perdaPercentual
    : perdaMm < 300
      ? perdaPercentual * 0.3
      : perdaPercentual * 0.2;
  const acrescimoPerdaValor = precoBobinaFator100 * acrescimoPerdaPercentual;
  const basePrecoTotal = modelId === "chapas" || !precoBobinaFator100 ? precoFatorUtilizado : precoBobinaFatorUtilizado;
  const precoTotal = modelId === "slitters_fitas" || modelId === "blanks"
    ? basePrecoTotal + acrescimoPerdaValor + precoServico
    : basePrecoTotal + precoServico;
  const precoSemIpi = frete === 0 ? precoTotal : precoTotal + precoTotal * frete;
  const subtotal = pesoTotal && precoSemIpi ? pesoTotal * precoSemIpi : 0;
  return {
    pesoUnitario,
    pesoTotal,
    precoFator100,
    precoFatorUtilizado,
    precoBobinaFator100,
    precoBobinaFatorUtilizado,
    precoTotal,
    precoSemIpi,
    subtotal,
    pesoNecessario,
    quantidadeCortes,
    perdaMm,
    perdaPercentual,
    acrescimoPerdaPercentual,
    acrescimoPerdaValor
  };
}

function calculateSummary() {
  const totals = activeRows().reduce((acc, row) => {
    const calculated = calculateRow(row);
    acc.totalKg += calculated.precoSemIpi !== 0 ? calculated.pesoTotal : 0;
    acc.subtotal += calculated.subtotal;
    return acc;
  }, { totalKg: 0, subtotal: 0 });
  const ipi = totals.subtotal * 0.0325;
  const total = totals.subtotal + ipi;
  const frete = percentRate(activeDraft().frete_percentual);
  return { ...totals, ipi, total, frete };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDecimalInput(value) {
  if (value === undefined || value === null || value === "") return "";
  const number = numericValue(value);
  return number ? number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00";
}

function formatPercent(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderModelSelect() {
  els.modelSelect.innerHTML = "";
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    option.selected = model.id === state.modelId;
    els.modelSelect.appendChild(option);
  });
}

function renderClientFields() {
  if (!els.clientNameInput || !els.clientCnpjInput) return;
  els.clientNameInput.value = state.client.name || "";
  els.clientCnpjInput.value = state.client.cnpj || "";
}

function renderModelMeta() {
  els.modelMeta.textContent = "";
  els.modelMeta.hidden = true;
}

function renderModelNotice() {
  const model = activeModel();
  els.modelNotice.innerHTML = "";

  if (model.status === "pending") {
    els.modelNotice.hidden = false;
    els.modelNotice.textContent = `O modelo ${model.name} já está selecionável, mas ainda usa campos provisórios até você enviar o Excel exemplo.`;
    return;
  }

  if (!state.pendingUnknowns.length) {
    els.modelNotice.hidden = true;
    return;
  }

  els.modelNotice.hidden = false;
  const title = document.createElement("strong");
  title.textContent = "Confirmar opções novas";
  els.modelNotice.appendChild(title);

  state.pendingUnknowns.forEach(({ field, value }) => {
    const p = document.createElement("p");
    p.textContent = `${field.label}: "${value}" não existe nas opções atuais (${field.options.join(", ")}).`;
    els.modelNotice.appendChild(p);
  });
}

function renderDraft() {
}

function renderFooter() {
  els.footerGrid.innerHTML = "";
  const draft = activeDraft();
  footerFields().forEach((field, index) => {
    els.footerGrid.appendChild(renderFieldControl(field, draft, () => {
      setFooterStepIndex(index);
      renderFooterStepStatus();
    }));
  });
}

function renderSummary() {
  const summary = calculateSummary();
  const items = [
    ["Total (Kg)", `${formatNumber(summary.totalKg)} Kg`],
    ["Subtotal", formatCurrency(summary.subtotal)],
    ["IPI 3,25%", formatCurrency(summary.ipi)],
    ["Total", formatCurrency(summary.total)],
    ["Frete", formatPercent(summary.frete)]
  ];
  els.summaryGrid.innerHTML = "";
  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    els.summaryGrid.appendChild(item);
  });
}

function renderFieldControl(field, draft, onActivate = null) {
    const label = document.createElement("label");
    label.className = "field";
    label.textContent = field.label;

    const control = createFieldControl(field, draft[field.key] ?? field.default ?? "", (value) => {
      draft[field.key] = value;
      validateOptions({ [field.key]: value });
      saveState();
      renderModelNotice();
      if (field.key === "frete_percentual") updateAllCalculatedCells();
      renderSummary();
    });

    if (onActivate) {
      control.addEventListener("pointerdown", onActivate);
      control.addEventListener("focus", onActivate);
      control.addEventListener("click", onActivate);
    }

    label.appendChild(control);
    return label;
}

function renderStepStatus() {
  const field = activeStepField();
  if (!field) {
    els.stepStatus.textContent = "Sem campos para ditar";
    return;
  }
  els.stepStatus.textContent = field.label;
}

function renderFooterStepStatus() {
  const field = activeFooterStepField();
  if (!field) {
    els.footerStepStatus.textContent = "Sem campos para ditar";
    return;
  }
  els.footerStepStatus.textContent = field.label;
}

function createFieldControl(field, value, onChange) {
    if (field.type === "boolean") {
      const control = document.createElement("input");
      control.type = "checkbox";
      control.checked = value === true || normalize(value) === "sim" || normalize(value) === "true";
      control.className = "cell-control checkbox-control";
      control.addEventListener("change", () => {
        onChange(control.checked);
      });
      return control;
    }

    const control = field.options?.length ? document.createElement("select") : document.createElement("input");
    const rawValue = value;
    const currentValue = field.options?.length ? canonicalOption(rawValue, field).value : rawValue;

    if (field.options?.length) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Selecionar";
      control.appendChild(emptyOption);

      field.options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        control.appendChild(option);
      });

    } else {
      control.type = "text";
      if (field.type === "number" || field.type === "percent" || field.type === "currency") control.inputMode = "decimal";
    }

    control.value = field.type === "currency" ? formatDecimalInput(currentValue) : currentValue;
    control.readOnly = Boolean(field.locked);
    control.disabled = Boolean(field.locked && field.options?.length);
    control.className = "cell-control";
    control.addEventListener("input", () => {
      if (field.type === "number" || field.type === "percent" || field.type === "currency") {
        const sanitized = sanitizeNumericInput(control.value);
        if (sanitized !== control.value) control.value = sanitized;
      }
      onChange(control.value);
    });
    control.addEventListener("change", () => {
      if (field.type === "number" || field.type === "percent" || field.type === "currency") {
        const sanitized = sanitizeNumericInput(control.value);
        if (sanitized !== control.value) control.value = sanitized;
      }
      onChange(control.value);
    });
    if (field.type === "currency") {
      control.addEventListener("blur", () => {
        control.value = formatDecimalInput(control.value);
        onChange(control.value);
      });
    }
    return control;
}

function renderTable() {
  const headerRow = document.createElement("tr");
  registerFields().forEach((field) => {
    const th = document.createElement("th");
    th.innerHTML = labelHtml(field.label);
    if (field.action === "delete") th.className = "delete-column";
    if (field.type === "boolean") th.classList.add("boolean-column");
    headerRow.appendChild(th);
  });
  els.tableHead.replaceChildren(headerRow);

  els.tableBody.innerHTML = "";
  activeRows().forEach((row, index) => {
    const tr = document.createElement("tr");
    if (index === activeEditRowIndex()) tr.className = "editing-row";
    registerFields().forEach((field) => {
      const td = document.createElement("td");
      td.dataset.fieldKey = field.key;
      if (field.type === "boolean") td.classList.add("boolean-column");
      if (field.action === "delete") {
        td.className = "delete-column";
        const actions = document.createElement("div");
        actions.className = "row-actions";

        const editButton = document.createElement("button");
        editButton.className = "edit-row-button";
        editButton.type = "button";
        editButton.title = "Editar item por voz";
        editButton.setAttribute("aria-label", `Editar item ${index + 1} por voz`);
        editButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
        editButton.addEventListener("click", () => {
          setActiveEditRow(index, 0);
          renderAll();
          setStatus(`Editando item ${index + 1} por voz.`);
        });

        const button = document.createElement("button");
        button.className = "trash-button";
        button.type = "button";
        button.title = "Remover item";
        button.setAttribute("aria-label", `Remover item ${index + 1}`);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
        button.addEventListener("click", () => {
          activeRows().splice(index, 1);
          delete state.editRowIndexByModel[state.modelId];
          saveState();
          renderAll();
          setStatus(`Item ${index + 1} removido.`);
        });
        actions.append(editButton, button);
        td.appendChild(actions);
      } else if (field.virtual && field.key === "_item") {
        td.className = "item-number-cell";
        td.textContent = index + 1;
      } else if (field.calculated) {
        td.className = "calculated-cell";
        td.textContent = calculatedDisplayValue(field, row);
      } else if (field.locked) {
        td.textContent = displayValue(row[field.key] ?? field.default ?? "", field);
      } else {
        const initialValue = field.key === "preco_fator_100" ? row.preco_fator_100 ?? row.preco ?? "" : row[field.key] ?? "";
        const control = createFieldControl(field, initialValue, (value) => {
          row[field.key] = value;
          validateOptions({ [field.key]: value });
          saveState();
          renderModelNotice();
          updateCalculatedCells(index);
          renderSummary();
        });
        control.dataset.fieldKey = field.key;
        control.dataset.rowIndex = String(index);
        const activateField = () => {
          const nextStep = fieldStepIndex(field.key);
          setActiveEditRow(index, nextStep === -1 ? activeStepIndex() : nextStep);
          els.tableBody.querySelectorAll("tr").forEach((rowElement, rowIndex) => {
            rowElement.classList.toggle("editing-row", rowIndex === index);
          });
          renderStepStatus();
        };
        control.addEventListener("pointerdown", activateField);
        control.addEventListener("focus", activateField);
        control.addEventListener("click", activateField);
        td.appendChild(control);
      }
      tr.appendChild(td);
    });
    els.tableBody.appendChild(tr);
  });
}

function calculatedDisplayValue(field, row) {
  const calculated = calculateRow(row);
  if (field.calc && field.calc in calculated) return displayValue(calculated[field.calc], field);
  if (field.key === "_peso_unitario") return displayValue(calculated.pesoUnitario, field);
  if (field.key === "_peso_total") return displayValue(calculated.pesoTotal, field);
  if (field.key === "_preco_sem_ipi") return displayValue(calculated.precoSemIpi, field);
  if (field.key === "_subtotal") return displayValue(calculated.subtotal, field);
  if (field.key === "_preco_fator_utilizado") return displayValue(calculated.precoFatorUtilizado, field);
  if (field.key === "_preco_bobina_fator_utilizado") return displayValue(calculated.precoBobinaFatorUtilizado, field);
  if (field.key === "_peso_necessario") return displayValue(calculated.pesoNecessario, field);
  if (field.key === "_quantidade_cortes") return displayValue(calculated.quantidadeCortes, field);
  if (field.key === "_perda_mm") return displayValue(calculated.perdaMm, field);
  if (field.key === "_perda_percentual") return displayValue(calculated.perdaPercentual, field);
  if (field.key === "_acrescimo_perda_percentual") return displayValue(calculated.acrescimoPerdaPercentual, field);
  if (field.key === "_acrescimo_perda_valor") return displayValue(calculated.acrescimoPerdaValor, field);
  if (field.key === "_preco_total") return displayValue(calculated.precoTotal, field);
  return "";
}

function updateCalculatedCells(rowIndex) {
  const row = activeRows()[rowIndex];
  const rowElement = els.tableBody.querySelectorAll("tr")[rowIndex];
  if (!row || !rowElement) return;
  registerFields().forEach((field) => {
    if (!field.calculated) return;
    const cell = rowElement.querySelector(`[data-field-key="${field.key}"]`);
    if (cell) cell.textContent = calculatedDisplayValue(field, row);
  });
}

function updateAllCalculatedCells() {
  activeRows().forEach((_, index) => updateCalculatedCells(index));
}

function setStatus(message, isError = false) {
  els.statusLine.textContent = message;
  els.statusLine.classList.toggle("error", isError);
}

function saveDraftAsRowLegacy() {
  if (state.pendingUnknowns.length) {
    setStatus("Há opções novas pendentes de confirmação antes de salvar.", true);
    return;
  }

  const row = {};
  for (const field of itemFields()) {
    const value = activeDraft()[field.key] ?? field.default ?? "";
    if (String(value).trim()) row[field.key] = value;
  }

  if (!Object.keys(row).length) {
    setStatus("Linha vazia.", true);
    return;
  }

  activeRows().push(row);
  const footerDraft = {};
  for (const field of footerFields()) {
    if (activeDraft()[field.key] !== undefined) footerDraft[field.key] = activeDraft()[field.key];
  }
  state.draftsByModel[state.modelId] = footerDraft;
  state.stepIndexByModel[state.modelId] = 0;
  saveState();
  renderAll();
  setStatus(`Linha salva em ${activeModel().name}.`);
}

function saveDraftAsRow() {
  if (state.pendingUnknowns.length) {
    setStatus("Ha opcoes novas pendentes de confirmacao antes de salvar.", true);
    return;
  }

  const row = activeItemRow({ create: false });
  if (!row || !Object.keys(row).length) {
    setStatus("Linha vazia.", true);
    return;
  }

  delete state.editRowIndexByModel[state.modelId];
  state.stepIndexByModel[state.modelId] = 0;
  saveState();
  renderAll();
  setStatus(`Item concluido em ${activeModel().name}.`);
}

async function saveBudgetRecord() {
  const rows = activeRows();
  if (!rows.length) {
    setStatus("Adicione ao menos um item antes de salvar.", true);
    return;
  }

  const record = {
    id: `orcamento-${Date.now()}`,
    createdAt: new Date().toISOString(),
    modelId: state.modelId,
    modelName: activeModel().name,
    client: { ...state.client },
    rows,
    exportFields: exportFields().map((field) => ({ key: field.key, label: field.label, type: field.type || "" })),
    exportRows: rows.map((row, index) => {
      const output = {};
      exportFields().forEach((field) => {
        output[field.key] = valueForField(field, row, index);
      });
      return output;
    }),
    conditions: activeDraft(),
    summary: calculateSummary()
  };

  if (window.ORCAMENTO_LIGANER_API?.saveBudgetUrl) {
    try {
      const response = await fetch(window.ORCAMENTO_LIGANER_API.saveBudgetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": window.ORCAMENTO_LIGANER_API.nonce || ""
        },
        credentials: "same-origin",
        body: JSON.stringify(record)
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data?.number ? `Orçamento salvo: ${data.number}.` : "Orçamento salvo.");
        return;
      }
    } catch {
      // Local fallback keeps the standalone app usable outside WordPress.
    }
  }

  const saved = storageJson("voiceSheetSavedBudgets", []);
  saved.push(record);
  storageSet("voiceSheetSavedBudgets", JSON.stringify(saved));
  setStatus("Orçamento salvo.");
}

function renderAll() {
  ensureInitialItemRow();
  renderClientFields();
  renderModelSelect();
  renderModelMeta();
  renderModelNotice();
  renderTable();
  renderSummary();
  renderFooter();
  renderStepStatus();
  renderFooterStepStatus();
  updateSpeechLabels();
}

function updateSpeechLabels() {
  if (!els.micButton || !els.footerMicButton) return;
  els.micButton.classList.toggle("listening", state.autoListen && state.dictationTarget === "item");
  els.footerMicButton.classList.toggle("listening", state.autoListen && state.dictationTarget === "footer");
  els.micLabel.textContent = state.autoListen && state.dictationTarget === "item" ? "Ouvindo orçamento" : "Ditar orçamento";
  els.footerMicLabel.textContent = state.autoListen && state.dictationTarget === "footer" ? "Ouvindo condições" : "Ditar condições";
}

function startListening(target) {
  if (state.dictationTarget !== target) state.speechRetryCount = 0;
  if (!state.recognition) state.recognition = initContinuousSpeech();
  if (!state.recognition) {
    setStatus("Reconhecimento de voz indisponível neste navegador.", true);
    return;
  }
  state.dictationTarget = target;
  state.autoListen = true;
  state.speechHadResult = false;
  state.speechLastPreviewText = "";
  updateSpeechLabels();
  if (state.listening) return;
  try {
    state.recognition.start();
  } catch {
    state.listening = false;
    state.recognition = initContinuousSpeech();
    setStatus("Não consegui iniciar a escuta. Toque em Ditar novamente e confira a permissão do microfone.", true);
  }
}

function stopListening() {
  state.autoListen = false;
  state.speechRetryCount = 0;
  state.speechLastPreviewText = "";
  updateSpeechLabels();
  if (state.recognition && state.listening) {
    state.recognition.stop();
  }
}

function initContinuousSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Reconhecimento de voz indisponível neste navegador.", true);
    return null;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    state.listening = true;
    state.speechStartedAt = Date.now();
    state.speechHadResult = false;
    updateSpeechLabels();
    setStatus("Ouvindo...");
  };
  recognition.onend = () => {
    state.listening = false;
    updateSpeechLabels();
    const endedQuickly = Date.now() - state.speechStartedAt < 1800;
    if (state.autoListen && endedQuickly && !state.speechHadResult && state.speechRetryCount < 1) {
      state.speechRetryCount += 1;
      state.recognition = initContinuousSpeech();
      setTimeout(() => {
        if (state.autoListen && !state.listening) startListening(state.dictationTarget);
      }, 350);
      setStatus("Permissão recebida. Tentando ouvir novamente...");
      return;
    }
    if (state.autoListen) setStatus("Escuta pausada pelo navegador. Toque em Ditar para ouvir novamente.");
    state.autoListen = false;
    state.speechRetryCount = 0;
    state.speechLastPreviewText = "";
    updateSpeechLabels();
  };
  recognition.onerror = (event) => {
    if (event.error === "no-speech") {
      setStatus("Ouvindo...");
      return;
    }
    if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
      state.autoListen = false;
      state.listening = false;
      updateSpeechLabels();
      setStatus("Microfone indisponível ou bloqueado para este navegador. Libere a permissão e toque em Ditar novamente.", true);
      return;
    }
    setStatus(`Falha no áudio: ${event.error}`, true);
  };
  recognition.onresult = (event) => {
    state.speechHadResult = true;
    state.speechRetryCount = 0;
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript || "";
      if (result.isFinal) finalText += ` ${transcript}`;
      else interimText += ` ${transcript}`;
    }

    if (interimText.trim()) {
      const previewed = previewDictation(interimText.trim(), state.dictationTarget);
      if (previewed) {
        renderAll();
        setStatus("Reconhecendo...");
      }
    }

    if (finalText.trim()) {
      state.speechLastPreviewText = "";
      const updates = parseDictation(finalText.trim(), state.dictationTarget);
      renderAll();
      const changed = Object.keys(updates).length;
      setStatus(changed ? "Valor gravado. Pode ditar o pr�ximo campo." : "Nenhum campo reconhecido.", !changed);
    }
  };  return recognition;
}

function exportCsv() {
  const model = activeModel();
  const lines = [];
  const fields = exportFields();
  const client = state.client || {};
  lines.push(["Cliente", "CNPJ", ...fields.map((field) => field.label)].map((label) => `"${String(label).replaceAll('"', '""')}"`).join(";"));
  activeRows().forEach((row, index) => {
    lines.push([client.name || "", client.cnpj || "", ...fields.map((field) => {
      const value = valueForField(field, row, index);
      return value;
    })].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"));
  });
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${model.id}-ditado.csv`);
}

function pdfVisibleFields(kind) {
  const fields = exportFields();
  if (kind === "liganer") return fields;
  const hiddenFromClient = new Set([
    "fator_maximo",
    "fator_utilizado",
    "comissao",
    "preco_fator_100",
    "_preco_fator_utilizado",
    "preco_bobina_fator_100",
    "_preco_bobina_fator_utilizado",
    "preco_servico",
    "descricao_servico",
    "campanha",
    "acrescimo_perda_percentual",
    "_acrescimo_perda_percentual",
    "_acrescimo_perda_valor",
    "_preco_total"
  ]);
  return fields.filter((field) => !hiddenFromClient.has(field.key) && field.type !== "boolean");
}

function valueForField(field, row, index) {
  const calculated = calculateRow(row);
  if (field.virtual && field.key === "_item") return index + 1;
  if (field.calculated && field.calc && field.calc in calculated) return calculated[field.calc];
  if (field.calculated && field.key === "_peso_unitario") return calculated.pesoUnitario;
  if (field.calculated && field.key === "_peso_total") return calculated.pesoTotal;
  if (field.calculated && field.key === "_preco_sem_ipi") return calculated.precoSemIpi;
  if (field.calculated && field.key === "_subtotal") return calculated.subtotal;
  if (field.calculated && field.key === "_preco_fator_utilizado") return calculated.precoFatorUtilizado;
  if (field.calculated && field.key === "_preco_bobina_fator_utilizado") return calculated.precoBobinaFatorUtilizado;
  if (field.calculated && field.key === "_peso_necessario") return calculated.pesoNecessario;
  if (field.calculated && field.key === "_quantidade_cortes") return calculated.quantidadeCortes;
  if (field.calculated && field.key === "_perda_mm") return calculated.perdaMm;
  if (field.calculated && field.key === "_perda_percentual") return calculated.perdaPercentual;
  if (field.calculated && field.key === "_acrescimo_perda_percentual") return calculated.acrescimoPerdaPercentual;
  if (field.calculated && field.key === "_acrescimo_perda_valor") return calculated.acrescimoPerdaValor;
  if (field.calculated && field.key === "_preco_total") return calculated.precoTotal;
  if (field.key === "preco_fator_100") return row.preco_fator_100 ?? row.preco ?? "";
  if (field.type === "boolean") return row[field.key] === true || normalize(row[field.key]) === "sim";
  return row[field.key] ?? field.default ?? "";
}

function localDailyPrintFilename() {
  const now = new Date();
  const stamp = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const key = `voiceSheetPrintCounter:${stamp}`;
  const next = Number(storageGet(key, "0")) + 1;
  storageSet(key, String(next));
  return `${stamp}${String(next).padStart(2, "0")}`;
}

async function nextDailyPrintFilename() {
  if (window.ORCAMENTO_LIGANER_API?.printNumberUrl) {
    try {
      const response = await fetch(window.ORCAMENTO_LIGANER_API.printNumberUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": window.ORCAMENTO_LIGANER_API.nonce || ""
        },
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.number) return data.number;
      }
    } catch {
      // Local fallback keeps the standalone app usable outside WordPress.
    }
  }
  return localDailyPrintFilename();
}

async function exportPdf(kind) {
  const rows = activeRows();
  if (!rows.length) {
    setStatus("Adicione ao menos um registro antes de exportar o PDF.", true);
    return;
  }

  const model = activeModel();
  const fields = pdfVisibleFields(kind);
  const draft = activeDraft();
  const summary = calculateSummary();
  const client = state.client || {};
  const footer = footerFields().filter((field) => String(draft[field.key] ?? "").trim());
  const now = new Date().toLocaleDateString("pt-BR");
  const pdfTitle = kind === "liganer" ? "PDF Liganer" : "PDF cliente";
  const printFilename = await nextDailyPrintFilename();
  const pdfClass = kind === "liganer" ? "pdf-liganer" : "pdf-cliente";

  const itemRows = rows.map((row, index) => `
    <tr>
      ${fields.map((field) => {
        const value = valueForField(field, row, index);
        return `<td>${escapeHtml(displayPdfValue(value, field))}</td>`;
      }).join("")}
    </tr>
  `).join("");

  const footerHtml = footer.length
    ? `<section class="pdf-block footer">
        <h2>Condições</h2>
        <div class="pdf-list">
          ${footer.map((field) => `
            <div>
              <strong>${pdfLabelText(field.label)}</strong>
              <span>${escapeHtml(displayValue(draft[field.key], field))}</span>
            </div>
          `).join("")}
        </div>
      </section>`
    : "";

  const summaryRows = [
    ["Total (Kg)", `${formatNumber(summary.totalKg)} Kg`],
    ["Subtotal", formatCurrency(summary.subtotal)],
    ["IPI 3,25%", formatCurrency(summary.ipi)],
    ["Total", formatCurrency(summary.total)],
    ...(kind === "liganer" ? [["Frete", formatPercent(summary.frete)]] : [])
  ];

  const summaryHtml = `<section class="pdf-block summary">
    <h2>Totais</h2>
    <div class="pdf-list">
      ${summaryRows.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join("")}
    </div>
  </section>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(printFilename)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 10px; text-align: center; }
    body.pdf-liganer { font-size: 7px; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #C60000; padding-bottom: 8px; margin-bottom: 12px; text-align: center; }
    header > div { flex: 1; }
    h1 { margin: 0; font-size: 22px; color: #C60000; }
    .meta { color: #4b5563; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5d1; padding: 5px 6px; vertical-align: middle; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: clip; }
    th { background: #FCE8E8; color: #C60000; font-size: 8px; text-transform: uppercase; }
    .pdf-liganer th, .pdf-liganer td { padding: 3px 2px; font-size: 5.4px; line-height: 1.12; }
    .pdf-liganer th { font-size: 4.8px; }
    td { min-height: 20px; }
    .pdf-bottom { margin-top: 12px; break-inside: avoid; overflow: hidden; }
    .pdf-column { width: calc(50% - 7px); }
    .pdf-column.left { float: left; }
    .pdf-column.right { float: right; }
    .pdf-block { display: block; width: 100%; border: 1px solid #cbd5d1; height: auto; min-height: 0; }
    .pdf-block h2 { margin: 0; padding: 7px; border-bottom: 1px solid #cbd5d1; background: #FCE8E8; font-size: 13px; color: #C60000; }
    .pdf-list div { display: grid; grid-template-columns: 1fr 1fr; min-height: 30px; border-bottom: 1px solid #cbd5d1; }
    .pdf-list div:last-child { border-bottom: 0; }
    .pdf-list strong, .pdf-list span { display: grid; place-items: center; padding: 7px; white-space: nowrap; overflow: hidden; }
    .pdf-list strong { color: #4b5563; font-size: 8px; text-transform: uppercase; border-right: 1px solid #cbd5d1; }
    .pdf-list span { font-size: 11px; }
    .print-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 10px; }
    .print-actions button { border: 0; border-radius: 6px; background: #C60000; color: #fff; padding: 8px 12px; font-weight: 700; cursor: pointer; }
    @media print { .print-actions { display: none; } }
  </style>
</head>
<body class="${pdfClass}">
  <div class="print-actions">
    <button onclick="window.print()">Salvar em PDF</button>
  </div>
  <header>
    <div>
      <h1>${escapeHtml(model.name)}</h1>
      <div class="meta">Cliente: ${escapeHtml(client.name || "-")}</div>
      <div class="meta">CNPJ: ${escapeHtml(client.cnpj || "-")}</div>
    </div>
    <div class="meta">
      <div>Data: ${escapeHtml(now)}</div>
      <div>Itens: ${rows.length}</div>
    </div>
  </header>
  <table>
    <thead>
      <tr>${fields.map((field) => `<th>${pdfLabelText(field.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="pdf-bottom">
    <div class="pdf-column left">${summaryHtml}</div>
    <div class="pdf-column right">${footerHtml}</div>
  </div>
  <script>setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setStatus("O navegador bloqueou a janela de PDF. Permita pop-ups para exportar.", true);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  setStatus("");
}

function exportXlsx() {
  const model = activeModel();
  if (!window.XLSX) {
    exportExcelXml();
    setStatus("Arquivo Excel gerado em formato compatível.");
    return;
  }
  const fields = exportFields();
  const aoa = [fields.map((field) => field.label)];
  activeRows().forEach((row, index) => aoa.push(fields.map((field) => valueForField(field, row, index))));
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = fields.map((field) => ({ wch: Math.max(10, field.label.length + 4) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, model.name);
  XLSX.writeFile(workbook, `${model.id}-ditado.xlsx`);
  setStatus("Arquivo XLSX gerado.");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelHtml(label) {
  return escapeHtml(label).replaceAll("\n", "<br>");
}

function pdfLabelText(label) {
  return escapeHtml(String(label ?? "").replace(/\s*\n\s*/g, " "));
}

function excelCellType(value, field) {
  if (field.type === "number" || field.type === "currency") {
    const number = Number(value);
    return Number.isNaN(number) ? { type: "String", value } : { type: "Number", value: number };
  }
  return { type: "String", value };
}

function exportExcelXml() {
  const model = activeModel();
  const fields = exportFields();
  const client = state.client || {};
  const rowsXml = [`<Row>${["Cliente", "CNPJ", ...fields.map((field) => field.label)].map((label) => `<Cell><Data ss:Type="String">${escapeXml(label)}</Data></Cell>`).join("")}</Row>`];
  activeRows().forEach((row, index) => {
    const cells = [
      `<Cell><Data ss:Type="String">${escapeXml(client.name || "")}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(client.cnpj || "")}</Data></Cell>`,
      ...fields.map((field) => {
      const value = valueForField(field, row, index);
      const cell = excelCellType(value, field);
      return `<Cell><Data ss:Type="${cell.type}">${escapeXml(cell.value)}</Data></Cell>`;
    })];
    rowsXml.push(`<Row>${cells.join("")}</Row>`);
  });
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${escapeXml(model.name)}">
    <Table>${rowsXml.join("")}</Table>
  </Worksheet>
</Workbook>`;
  downloadBlob(new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }), `${model.id}-ditado.xls`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  els.clientNameInput?.addEventListener("input", () => {
    state.client.name = els.clientNameInput.value;
    saveState();
  });
  els.clientCnpjInput?.addEventListener("input", () => {
    state.client.cnpj = formatCnpj(els.clientCnpjInput.value);
    els.clientCnpjInput.value = state.client.cnpj;
    saveState();
  });

  els.modelSelect.addEventListener("change", () => {
    state.modelId = els.modelSelect.value;
    state.pendingUnknowns = [];
    saveState();
    renderAll();
    setStatus(`Modelo selecionado: ${activeModel().name}.`);
  });

  els.micButton.addEventListener("click", () => {
    state.autoListen && state.dictationTarget === "item" ? stopListening() : startListening("item");
  });

  els.applyTextButton.addEventListener("click", () => {
    const updates = parseDictation(els.transcriptInput.value);
    renderAll();
    setStatus(Object.keys(updates).length ? "Valor gravado e próximo campo selecionado." : "Nenhum campo reconhecido.", !Object.keys(updates).length);
  });

  els.saveRowButton.addEventListener("click", saveDraftAsRow);
  els.footerMicButton.addEventListener("click", () => {
    state.autoListen && state.dictationTarget === "footer" ? stopListening() : startListening("footer");
  });

  els.prevItemFieldButton.addEventListener("click", () => moveCurrentField("item", -1));
  els.nextItemFieldButton.addEventListener("click", () => moveCurrentField("item", 1));
  els.prevFooterFieldButton.addEventListener("click", () => moveCurrentField("footer", -1));
  els.nextFooterFieldButton.addEventListener("click", () => moveCurrentField("footer", 1));
  els.addItemButton.addEventListener("click", () => {
    const rows = activeRows();
    rows.push({});
    setActiveEditRow(rows.length - 1, 0);
    saveState();
    renderAll();
    setStatus(`Item ${rows.length} pronto para preenchimento.`);
  });
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.exportClientPdfButton.addEventListener("click", () => exportPdf("cliente"));
  els.exportLiganerPdfButton.addEventListener("click", () => exportPdf("liganer"));
  els.exportXlsxButton.addEventListener("click", exportXlsx);
  els.saveBudgetButton.addEventListener("click", saveBudgetRecord);

  els.settingsButton.addEventListener("click", () => {
    els.columnsConfig.value = JSON.stringify(activeModel(), null, 2);
    els.settingsDialog.showModal();
  });

  els.saveColumnsButton.addEventListener("click", () => {
    try {
      const edited = JSON.parse(els.columnsConfig.value);
      const index = models.findIndex((model) => model.id === activeModel().id);
      if (!edited.id || !edited.name || !Array.isArray(edited.fields)) throw new Error("Formato inválido");
      models[index] = edited;
      state.pendingUnknowns = [];
      saveState();
      renderAll();
      els.settingsDialog.close();
      setStatus("Modelo atualizado nesta sessão.");
    } catch {
      setStatus("JSON do modelo inválido.", true);
    }
  });

  els.resetColumnsButton.addEventListener("click", () => {
    els.columnsConfig.value = JSON.stringify(activeModel(), null, 2);
  });
}

function startApp() {
  collectElements();
  bindEvents();
  renderAll();
  window.__voiceSheetAppLoaded = true;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp, { once: true });
} else {
  startApp();
}
