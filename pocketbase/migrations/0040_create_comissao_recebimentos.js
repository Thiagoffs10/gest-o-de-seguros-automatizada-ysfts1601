migrate(
  (app) => {
    const policiesCol = app.findCollectionByNameOrId('policies')

    // 1. Criar collection comissao_recebimentos
    const collection = new Collection({
      name: 'comissao_recebimentos',
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
        { name: 'data_recebimento', type: 'date', required: true },
        { name: 'valor_bruto', type: 'number', required: true },
        { name: 'descontos_impostos', type: 'number' },
        { name: 'valor_liquido', type: 'number', required: true },
        { name: 'aliquota_imposto', type: 'number' },
        { name: 'origem', type: 'text', required: true },
        { name: 'observacao', type: 'text' },
        { name: 'parcela', type: 'number' },
        { name: 'competencia', type: 'text' },
        { name: 'idempotency_key', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_comissao_rec_policy ON comissao_recebimentos (policy)',
        'CREATE INDEX idx_comissao_rec_data ON comissao_recebimentos (data_recebimento)',
        'CREATE UNIQUE INDEX idx_comissao_rec_idempotency ON comissao_recebimentos (idempotency_key) WHERE idempotency_key != ""',
      ],
    })
    app.save(collection)

    // 2. Migrar apólices legadas já marcadas como comissao_recebida = true
    // Migração IDEMPOTENTE: busca apólices onde comissao_recebida = true
    // e cria o recebimento com idempotency_key = "legacy_policy_" + policy.id se não existir
    try {
      const records = app.findRecordsByFilter('policies', 'comissao_recebida = true', '', 0, 0)
      for (let i = 0; i < records.length; i++) {
        const policyRec = records[i]
        const policyId = policyRec.getString('id')
        const legacyKey = 'legacy_policy_' + policyId

        // Verificar se já existe recebimento para essa idempotency_key
        try {
          const existing = app.findRecordsByFilter(
            'comissao_recebimentos',
            'idempotency_key = {:key}',
            '',
            1,
            0,
            { key: legacyKey },
          )
          if (existing && existing.length > 0) {
            continue // Já migrado anteriormente, pular
          }
        } catch (_) {}

        const commVal = policyRec.getFloat('commission') || 0
        const issVal = policyRec.getFloat('iss') || 0
        let dataRecebimento = policyRec.getString('data_recebimento_comissao')
        if (!dataRecebimento || dataRecebimento.trim() === '') {
          dataRecebimento = policyRec.getString('start_date') || policyRec.getString('created')
        }

        // Se comissao > 0 ou tiver data de recebimento, criar recebimento legado
        if (commVal > 0 || (dataRecebimento && dataRecebimento.trim() !== '')) {
          const rec = new Record(collection)
          rec.set('policy', policyId)
          rec.set('data_recebimento', dataRecebimento)
          rec.set('valor_bruto', commVal)
          rec.set('descontos_impostos', issVal)
          rec.set('valor_liquido', commVal)
          rec.set('origem', 'Legado')
          rec.set('observacao', 'Legado — valor derivado do cadastro anterior')
          rec.set('idempotency_key', legacyKey)
          app.save(rec)
        }
      }
    } catch (migErr) {
      app.logger().error('Erro ao migrar recebimentos legados de comissao', 'error', String(migErr))
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('comissao_recebimentos')
      app.delete(col)
    } catch (_) {}
  },
)
