migrate(
  (app) => {
    // 1. Coleção: campaign_automations
    // Define a campanha educativa / cross-sell com seus filtros de público, ciclo de passos e frequência
    const clientsCol = app.findCollectionByNameOrId('clients')

    const campaigns = new Collection({
      name: 'campaign_automations',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'tipo_publico',
          type: 'select',
          values: [
            'MONO_AUTO',
            'RENOVACOES_PROXIMAS',
            'ENDOSSOS_RECENTES',
            'SEM_APOLICE_ATIVA',
            'GERAL_CARTEIRA',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'filtros_config', type: 'json' },
        { name: 'frequencia_dias', type: 'number', min: 1, max: 90 }, // ex: 20 dias ou 30 dias (mensal)
        { name: 'ciclo_passos', type: 'json' }, // array de { ordem: 1, tipo: 'educativo'|'oferta', tema: string, titulo: string, objetivo: string }
        { name: 'ativo', type: 'bool' },
        { name: 'total_preparados', type: 'number' },
        { name: 'total_enviados', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campaign_automations_ativo ON campaign_automations (ativo)',
        'CREATE INDEX idx_campaign_automations_tipo ON campaign_automations (tipo_publico)',
      ],
    })
    app.save(campaigns)

    // 2. Coleção: campaign_queue (Fila de Aprovação / Esgotamento)
    const campaignQueue = new Collection({
      name: 'campaign_queue',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campanha',
          type: 'relation',
          collectionId: campaigns.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'passo_ordem', type: 'number', min: 1 },
        { name: 'tipo_mensagem', type: 'select', values: ['educativo', 'oferta'], maxSelect: 1 },
        { name: 'tema', type: 'text' },
        { name: 'assunto', type: 'text', required: true },
        { name: 'corpo', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: [
            'AGUARDANDO_APROVACAO',
            'APROVADO',
            'REJEITADO',
            'ENVIADO',
            'FALHOU',
            'ESGOTAMENTO_ESPERA',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'data_programada', type: 'date' },
        { name: 'data_envio', type: 'date' },
        { name: 'prioridade', type: 'number' }, // quanto menor ou maior, define ordem na fila de esgotamento
        { name: 'tentativas', type: 'number' },
        { name: 'erro_log', type: 'text' },
        { name: 'dados_cliente_snapshot', type: 'json' },
        { name: 'redigido_por_ia', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campaign_queue_status ON campaign_queue (status)',
        'CREATE INDEX idx_campaign_queue_client ON campaign_queue (client)',
        'CREATE INDEX idx_campaign_queue_campanha ON campaign_queue (campanha)',
        'CREATE INDEX idx_campaign_queue_data_prog ON campaign_queue (data_programada)',
      ],
    })
    app.save(campaignQueue)

    // 3. Coleção: campaign_send_logs (Registro de cada envio cliente × campanha × data para não repetir no ciclo e pular recente)
    const campaignSendLogs = new Collection({
      name: 'campaign_send_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campanha',
          type: 'relation',
          collectionId: campaigns.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'passo_ordem', type: 'number' },
        { name: 'tipo_mensagem', type: 'select', values: ['educativo', 'oferta'], maxSelect: 1 },
        { name: 'tema', type: 'text' },
        { name: 'assunto', type: 'text' },
        { name: 'recipient_email', type: 'email', required: true },
        { name: 'data_envio', type: 'date', required: true },
        {
          name: 'status_envio',
          type: 'select',
          values: ['ENVIADO', 'FALHOU'],
          maxSelect: 1,
          required: true,
        },
        { name: 'resend_id', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campaign_send_logs_client ON campaign_send_logs (client)',
        'CREATE INDEX idx_campaign_send_logs_campanha ON campaign_send_logs (campanha)',
        'CREATE INDEX idx_campaign_send_logs_data ON campaign_send_logs (data_envio)',
      ],
    })
    app.save(campaignSendLogs)
  },
  (app) => {
    try {
      const logs = app.findCollectionByNameOrId('campaign_send_logs')
      app.delete(logs)
    } catch (_) {}
    try {
      const queue = app.findCollectionByNameOrId('campaign_queue')
      app.delete(queue)
    } catch (_) {}
    try {
      const camps = app.findCollectionByNameOrId('campaign_automations')
      app.delete(camps)
    } catch (_) {}
  },
)
