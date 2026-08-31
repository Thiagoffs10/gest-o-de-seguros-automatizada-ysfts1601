migrate(
  (app) => {
    const parceirosCol = app.findCollectionByNameOrId('parceiros')
    const usersCol = app.findCollectionByNameOrId('users')

    // 1. Coleção para histórico de fechamentos/pagamentos de parceiro
    const pagamentosCol = new Collection({
      name: 'parceiro_pagamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'parceiro',
          type: 'relation',
          required: true,
          collectionId: parceirosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data_pagamento', type: 'date', required: true },
        { name: 'total_comissoes', type: 'number' },
        { name: 'total_debitos', type: 'number' },
        { name: 'taxa_pix', type: 'number' },
        { name: 'valor_liquido', type: 'number' },
        { name: 'policies_ids', type: 'text' },
        { name: 'detalhes_debitos', type: 'text' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'usuario_id',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'usuario_nome', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_parceiro_pagamentos_parceiro ON parceiro_pagamentos (parceiro)',
        'CREATE INDEX idx_parceiro_pagamentos_data ON parceiro_pagamentos (data_pagamento)',
      ],
    })
    app.save(pagamentosCol)

    // 2. Coleção para débitos/ajustes de parceiro (atuais ou vinculados a pagamentos)
    const debitosCol = new Collection({
      name: 'parceiro_debitos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'parceiro',
          type: 'relation',
          required: true,
          collectionId: parceirosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        { name: 'data', type: 'date' },
        { name: 'status', type: 'select', values: ['Pendente', 'Pago', 'Cancelado'], maxSelect: 1 },
        {
          name: 'pagamento',
          type: 'relation',
          collectionId: pagamentosCol.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_parceiro_debitos_parceiro ON parceiro_debitos (parceiro)',
        'CREATE INDEX idx_parceiro_debitos_status ON parceiro_debitos (status)',
      ],
    })
    app.save(debitosCol)
  },
  (app) => {
    try {
      const debitosCol = app.findCollectionByNameOrId('parceiro_debitos')
      app.delete(debitosCol)
    } catch (_) {}
    try {
      const pagamentosCol = app.findCollectionByNameOrId('parceiro_pagamentos')
      app.delete(pagamentosCol)
    } catch (_) {}
  },
)
