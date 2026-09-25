migrate(
  (app) => {
    // 1. Coleção recebimentos_legados: lançamentos contábeis de comissões legadas sem vínculo a apólices
    if (!app.hasTable('recebimentos_legados')) {
      const col = new Collection({
        name: 'recebimentos_legados',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'seguradora_nome', type: 'text', required: true },
          { name: 'data_credito', type: 'date', required: true },
          { name: 'valor_liquido', type: 'number', required: true },
          { name: 'valor_bruto', type: 'number' },
          { name: 'impostos', type: 'number' },
          { name: 'numero_documento', type: 'text' },
          { name: 'numero_proposta', type: 'text' },
          { name: 'numero_apolice', type: 'text' },
          { name: 'parcela', type: 'number' },
          { name: 'segurado_nome', type: 'text' },
          { name: 'observacao', type: 'text' },
          { name: 'idempotency_hash', type: 'text' },
          { name: 'lote_id', type: 'text' },
          { name: 'lote_nome', type: 'text' },
          { name: 'usuario_id', type: 'text' },
          { name: 'usuario_nome', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_rec_legados_data ON recebimentos_legados (data_credito)',
          'CREATE INDEX idx_rec_legados_seguradora ON recebimentos_legados (seguradora_nome)',
          'CREATE UNIQUE INDEX idx_rec_legados_hash ON recebimentos_legados (idempotency_hash) WHERE idempotency_hash != ""',
        ],
      })
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('recebimentos_legados')
      app.delete(col)
    } catch (_) {}
  },
)
