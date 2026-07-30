migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const collection = new Collection({
      name: 'policies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'client',
          type: 'relation',
          required: true,
          collectionId: clientsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'insurance_company', type: 'text' },
        { name: 'policy_number', type: 'text', required: true },
        {
          name: 'coverage_type',
          type: 'select',
          required: true,
          values: ['Auto', 'Vida', 'Residencial', 'Empresarial', 'Saúde', 'Outros'],
          maxSelect: 1,
        },
        { name: 'premium_amount', type: 'number', required: true },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'renewal_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Ativa', 'Expirada', 'Cancelada', 'Renovação Pendente'],
          maxSelect: 1,
        },
        { name: 'commission', type: 'number' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_policies_number ON policies (policy_number)',
        'CREATE INDEX idx_policies_client ON policies (client)',
        'CREATE INDEX idx_policies_status ON policies (status)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('policies')
    app.delete(collection)
  },
)
