migrate(
  (app) => {
    const seguradorasCol = app.findCollectionByNameOrId('seguradoras')
    const policiesCol = app.findCollectionByNameOrId('policies')

    // 1. Criar collection modelos_comissao
    const collection = new Collection({
      name: 'modelos_comissao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo_modelo',
          type: 'select',
          required: true,
          values: ['A_VISTA', 'PARCELADA', 'RECORRENTE', 'POR_FASES', 'POR_ESGOTAMENTO'],
          maxSelect: 1,
        },
        {
          name: 'seguradora',
          type: 'relation',
          collectionId: seguradorasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'tipo_seguro', type: 'text' }, // Produto / tipo de seguro (ex: Auto, Saúde, Vida)
        { name: 'percentual_padrao', type: 'number' }, // % comissão base (ex: 20%, 5%)
        { name: 'config_json', type: 'json' }, // Config específica do modelo (parcelas, fases, saldo, etc.)
        { name: 'valido_a_partir_de', type: 'date' }, // Versionamento: Nova condição válida a partir de...
        { name: 'versao', type: 'number' }, // Contador interno de versão
        { name: 'ativo', type: 'bool' },
        { name: 'descricao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_mod_com_seguradora ON modelos_comissao (seguradora)',
        'CREATE INDEX idx_mod_com_tipo ON modelos_comissao (tipo_modelo)',
      ],
    })
    app.save(collection)

    // 2. Criar collection comissoes_previstas
    const previsaoCol = new Collection({
      name: 'comissoes_previstas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'policy',
          type: 'relation',
          required: true,
          collectionId: policiesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'competencia', type: 'text', required: true }, // Ex: "08/2026", "2026-08"
        { name: 'data_prevista', type: 'date', required: true },
        { name: 'valor_previsto', type: 'number', required: true },
        { name: 'parcela_numero', type: 'number' }, // Ex: 1, 2, 3...
        { name: 'origem_modelo', type: 'text' }, // Nome do modelo ou 'Personalizado'
        {
          name: 'status',
          type: 'select',
          values: ['Pendente', 'Parcial', 'Recebida', 'Cancelada'],
          maxSelect: 1,
        },
        { name: 'observacao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_prev_policy ON comissoes_previstas (policy)',
        'CREATE INDEX idx_com_prev_data ON comissoes_previstas (data_prevista)',
        'CREATE INDEX idx_com_prev_comp ON comissoes_previstas (competencia)',
      ],
    })
    app.save(previsaoCol)
  },
  (app) => {
    try {
      const col2 = app.findCollectionByNameOrId('comissoes_previstas')
      app.delete(col2)
    } catch (_) {}
    try {
      const col1 = app.findCollectionByNameOrId('modelos_comissao')
      app.delete(col1)
    } catch (_) {}
  },
)
