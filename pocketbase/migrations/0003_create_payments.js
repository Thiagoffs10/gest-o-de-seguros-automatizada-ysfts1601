migrate(
  (app) => {
    const policiesCol = app.findCollectionByNameOrId('policies')
    const collection = new Collection({
      name: 'payments',
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
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true },
        { name: 'due_date', type: 'date', required: true },
        { name: 'paid_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Pago', 'Atrasado'],
          maxSelect: 1,
        },
        {
          name: 'payment_method',
          type: 'select',
          values: ['Boleto', 'Cartão', 'Transferência', 'Dinheiro', 'Outros'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_payments_policy ON payments (policy)',
        'CREATE INDEX idx_payments_status ON payments (status)',
        'CREATE INDEX idx_payments_due_date ON payments (due_date)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('payments')
    app.delete(collection)
  },
)
