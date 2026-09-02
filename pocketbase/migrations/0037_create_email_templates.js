migrate(
  (app) => {
    // 1. Criar coleção email_templates
    const collection = new Collection({
      name: 'email_templates',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'key', type: 'text' },
        { name: 'subject', type: 'text', required: true },
        { name: 'body', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['Aniversário', 'Renovação', 'Comercial', 'Personalizado'],
          maxSelect: 1,
        },
        { name: 'is_system', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_email_templates_name ON email_templates (name)'],
    })
    app.save(collection)

    const templatesCol = app.findCollectionByNameOrId('email_templates')

    // Seed dos templates padrões do sistema
    const defaults = [
      {
        name: 'Feliz Aniversário',
        key: 'aniversario',
        subject: 'Feliz aniversário, ${nome_cliente}! 🎉',
        body: 'Olá, ${nome_cliente}!\n\nDesejamos a você um feliz aniversário com muita saúde, paz e conquistas!\n\nAgradecemos pela parceria e por confiar na CRED10MIX para cuidar da sua proteção.\n\nAtenciosamente,\nEquipe CRED10MIX',
        type: 'Aniversário',
        is_system: true,
      },
      {
        name: 'Lembrete de Renovação',
        key: 'renovacao',
        subject: 'Sua apólice nº ${numero_apolice} vence em breve',
        body: 'Olá, ${nome_cliente}!\n\nLembramos que a sua apólice nº ${numero_apolice} (${seguradora}) está próxima da data de renovação.\n\nFale conosco para garantir a continuidade da sua proteção com as melhores condições.\n\nAtenciosamente,\nEquipe CRED10MIX',
        type: 'Renovação',
        is_system: true,
      },
      {
        name: 'Boas-vindas CRED10MIX',
        key: 'boas_vindas',
        subject: 'Bem-vindo(a) à CRED10MIX, ${nome_cliente}!',
        body: 'Olá, ${nome_cliente}!\n\nÉ um prazer ter você como nosso cliente! Estamos sempre à disposição para cuidar da proteção da sua família e do seu patrimônio com agilidade e transparência.\n\nConte sempre conosco!\n\nAtenciosamente,\nEquipe CRED10MIX',
        type: 'Comercial',
        is_system: false,
      },
    ]

    for (let i = 0; i < defaults.length; i++) {
      const item = defaults[i]
      try {
        const rec = new Record(templatesCol)
        rec.set('name', item.name)
        rec.set('key', item.key)
        rec.set('subject', item.subject)
        rec.set('body', item.body)
        rec.set('type', item.type)
        rec.set('is_system', item.is_system)
        app.save(rec)
      } catch (_) {}
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('email_templates')
      app.delete(col)
    } catch (_) {}
  },
)
