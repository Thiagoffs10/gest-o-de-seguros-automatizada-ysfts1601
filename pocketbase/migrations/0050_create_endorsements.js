migrate(
  (app) => {
    // 1. Criar collection "endorsements" (endossos)
    const policiesCol = app.findCollectionByNameOrId('policies')

    const endorsements = new Collection({
      name: 'endorsements',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente' || @request.auth.role = 'Operador'",
      updateRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente' || @request.auth.role = 'Operador'",
      deleteRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      fields: [
        {
          name: 'policy',
          type: 'relation',
          required: true,
          collectionId: policiesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'text',
          required: true,
        },
        {
          name: 'data_endosso',
          type: 'date',
          required: true,
        },
        {
          name: 'numero_proposta',
          type: 'text',
        },
        {
          name: 'placa',
          type: 'text',
        },
        {
          name: 'chassi',
          type: 'text',
        },
        {
          name: 'modelo_veiculo',
          type: 'text',
        },
        {
          name: 'valor_bruto',
          type: 'number',
        },
        {
          name: 'valor_liquido',
          type: 'number',
        },
        {
          name: 'comissao_percent',
          type: 'number',
        },
        {
          name: 'comissao_valor',
          type: 'number',
        },
        {
          name: 'observacao',
          type: 'text',
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_endorsements_policy ON endorsements (policy)',
        'CREATE INDEX idx_endorsements_data ON endorsements (data_endosso)',
      ],
    })

    app.save(endorsements)

    const endorsementsCol = app.findCollectionByNameOrId('endorsements')

    // 2. Adicionar campo 'endorsement' em comissoes_previstas
    const prevCol = app.findCollectionByNameOrId('comissoes_previstas')
    if (!prevCol.fields.getByName('endorsement')) {
      prevCol.fields.add(
        new RelationField({
          name: 'endorsement',
          collectionId: endorsementsCol.id,
          maxSelect: 1,
        }),
      )
      app.save(prevCol)
    }

    // 3. Adicionar campo 'endorsement' em comissao_recebimentos
    const recCol = app.findCollectionByNameOrId('comissao_recebimentos')
    if (!recCol.fields.getByName('endorsement')) {
      recCol.fields.add(
        new RelationField({
          name: 'endorsement',
          collectionId: endorsementsCol.id,
          maxSelect: 1,
        }),
      )
      app.save(recCol)
    }

    // Adicionar índices úteis
    try {
      prevCol.addIndex('idx_com_prev_endorsement', false, 'endorsement', '')
      app.save(prevCol)
    } catch (_) {}

    try {
      recCol.addIndex('idx_com_rec_endorsement', false, 'endorsement', '')
      app.save(recCol)
    } catch (_) {}
  },
  (app) => {
    try {
      const recCol = app.findCollectionByNameOrId('comissao_recebimentos')
      recCol.removeIndex('idx_com_rec_endorsement')
      const f1 = recCol.fields.getByName('endorsement')
      if (f1) recCol.fields.remove(f1)
      app.save(recCol)
    } catch (_) {}

    try {
      const prevCol = app.findCollectionByNameOrId('comissoes_previstas')
      prevCol.removeIndex('idx_com_prev_endorsement')
      const f2 = prevCol.fields.getByName('endorsement')
      if (f2) prevCol.fields.remove(f2)
      app.save(prevCol)
    } catch (_) {}

    try {
      const endorsements = app.findCollectionByNameOrId('endorsements')
      app.delete(endorsements)
    } catch (_) {}
  },
)
