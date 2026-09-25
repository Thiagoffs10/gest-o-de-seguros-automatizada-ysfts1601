migrate(
  (app) => {
    // 1. Coleção import_lots: Lotes de importação de extratos / propostas com arquivo anexado para auditoria
    if (!app.hasTable('import_lots')) {
      const importLots = new Collection({
        name: 'import_lots',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'tipo',
            type: 'select',
            values: ['EXTRATO_COMISSAO', 'PROPOSTA_PDF'],
            maxSelect: 1,
            required: true,
          },
          { name: 'nome_arquivo', type: 'text', required: true },
          { name: 'formato_seguradora', type: 'text' },
          { name: 'seguradora_id', type: 'text' },
          { name: 'total_linhas', type: 'number' },
          { name: 'total_sucesso', type: 'number' },
          { name: 'total_divergencias', type: 'number' },
          { name: 'total_sem_previsao', type: 'number' },
          { name: 'total_bruto', type: 'number' },
          { name: 'total_liquido', type: 'number' },
          { name: 'checksum_esperado', type: 'number' },
          {
            name: 'checksum_status',
            type: 'select',
            values: ['OK', 'DIVERGENTE', 'NAO_APLICAVEL'],
            maxSelect: 1,
          },
          { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 25000000 },
          { name: 'detalhes_json', type: 'json' },
          { name: 'usuario_id', type: 'text' },
          { name: 'usuario_nome', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_import_lots_created ON import_lots (created DESC)',
          'CREATE INDEX idx_import_lots_tipo ON import_lots (tipo)',
        ],
      })
      app.save(importLots)
    }

    // 2. Coleção import_rows: Linhas canônicas importadas de extratos com status e vínculos
    if (!app.hasTable('import_rows')) {
      const importLotsCol = app.findCollectionByNameOrId('import_lots')
      const importRows = new Collection({
        name: 'import_rows',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'lote',
            type: 'relation',
            collectionId: importLotsCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'seguradora_nome', type: 'text' },
          { name: 'numero_extrato', type: 'text' },
          {
            name: 'tipo_referencia',
            type: 'select',
            values: ['APOLICE', 'PROPOSTA', 'DOCUMENTO', 'AMBOS'],
            maxSelect: 1,
          },
          { name: 'numero_apolice', type: 'text' },
          { name: 'numero_proposta', type: 'text' },
          { name: 'endosso', type: 'text' },
          { name: 'parcela', type: 'number' },
          { name: 'data_credito', type: 'date' },
          { name: 'premio_liquido', type: 'number' },
          { name: 'comissao_bruta', type: 'number' },
          { name: 'impostos', type: 'number' },
          { name: 'liquido_pago', type: 'number' },
          { name: 'percentual_comissao', type: 'number' },
          { name: 'segurado_nome', type: 'text' },
          { name: 'ramo', type: 'text' },
          { name: 'linha_bruta_json', type: 'json' },
          {
            name: 'fila',
            type: 'select',
            values: ['APROVADO', 'DIVERGENTE', 'SEM_PREVISAO', 'JA_BAIXADO', 'IGNORADO'],
            maxSelect: 1,
          },
          { name: 'motivo_fila', type: 'text' },
          { name: 'policy_id', type: 'text' },
          { name: 'comissao_prevista_id', type: 'text' },
          { name: 'recebimento_id', type: 'text' },
          { name: 'baixado', type: 'bool' },
          { name: 'idempotency_hash', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_import_rows_lote ON import_rows (lote)',
          'CREATE INDEX idx_import_rows_hash ON import_rows (idempotency_hash)',
          'CREATE INDEX idx_import_rows_fila ON import_rows (fila)',
        ],
      })
      app.save(importRows)
    }

    // 3. Coleção sistema_alertas: Alertas de duplicidade, divergência e inconsistências
    if (!app.hasTable('sistema_alertas')) {
      const sistemaAlertas = new Collection({
        name: 'sistema_alertas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'modulo',
            type: 'select',
            values: ['FINANCEIRO', 'APOLICES', 'CLIENTES', 'EXTRATO'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'tipo',
            type: 'select',
            values: [
              'COMISSAO_JA_BAIXADA',
              'SEM_PREVISAO',
              'VALOR_DIVERGENTE',
              'CHECKSUM_DIVERGENTE',
              'APOLICE_DUPLICADA',
              'CLIENTE_DUPLICADO',
              'OUTRO',
            ],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'nivel',
            type: 'select',
            values: ['INFO', 'ALERTA', 'CRITICO'],
            maxSelect: 1,
            required: true,
          },
          { name: 'titulo', type: 'text', required: true },
          { name: 'motivo', type: 'text', required: true },
          { name: 'acao_sugerida', type: 'text' },
          { name: 'resolvido', type: 'bool' },
          { name: 'data_resolucao', type: 'date' },
          { name: 'resolvido_por', type: 'text' },
          { name: 'referencia_id', type: 'text' },
          { name: 'detalhes_json', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sistema_alertas_resolvido ON sistema_alertas (resolvido, created DESC)',
          'CREATE INDEX idx_sistema_alertas_modulo ON sistema_alertas (modulo)',
          'CREATE INDEX idx_sistema_alertas_tipo ON sistema_alertas (tipo)',
        ],
      })
      app.save(sistemaAlertas)
    }
  },
  (app) => {
    try {
      const t3 = app.findCollectionByNameOrId('sistema_alertas')
      app.delete(t3)
    } catch (_) {}
    try {
      const t2 = app.findCollectionByNameOrId('import_rows')
      app.delete(t2)
    } catch (_) {}
    try {
      const t1 = app.findCollectionByNameOrId('import_lots')
      app.delete(t1)
    } catch (_) {}
  },
)
