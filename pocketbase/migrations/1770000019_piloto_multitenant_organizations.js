migrate(
  (app) => {
    // 1. Coleção organizations: corretoras parceiras do piloto multi-tenant
    if (!app.hasTable('organizations')) {
      const orgs = new Collection({
        name: 'organizations',
        type: 'base',
        listRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
        viewRule:
          "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || id = @request.auth.organization",
        createRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
        updateRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
        deleteRule: null,
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'ativa', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_organizations_nome ON organizations (nome)'],
      })
      app.save(orgs)
    }

    // 2. Campo organization nos usuários (vazio = vê tudo, como hoje)
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('organization')) {
      const orgsCol = app.findCollectionByNameOrId('organizations')
      users.fields.add(
        new Field({
          name: 'organization',
          type: 'relation',
          collectionId: orgsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(users)
    }

    // 3. Campo organization nas coleções de dados do piloto
    const orgsCol2 = app.findCollectionByNameOrId('organizations')
    const dataCols = [
      'clients',
      'policies',
      'payments',
      'reminders',
      'communications',
      'seguradoras',
      'parceiros',
      'custos_fixos',
      'tipos_seguro',
      'conciliacoes',
      'parceiro_pagamentos',
      'parceiro_debitos',
      'modelos_comissao',
      'comissoes_previstas',
      'comissao_recebimentos',
      'produtos',
      'endorsements',
      'import_lots',
      'import_rows',
      'sistema_alertas',
      'recebimentos_legados',
      'campaign_automations',
      'campaign_queue',
      'campaign_send_logs',
      'email_templates',
    ]
    dataCols.forEach((colName) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        if (!col.fields.getByName('organization')) {
          col.fields.add(
            new Field({
              name: 'organization',
              type: 'relation',
              collectionId: orgsCol2.id,
              maxSelect: 1,
              required: false,
            }),
          )
          app.save(col)
        }
      } catch (err) {
        $app
          .logger()
          .warn('migracao organizations: falha ao tocar coleção ' + colName, 'err', String(err))
      }
    })
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users')
      const f = users.fields.getByName('organization')
      if (f) {
        users.fields.removeByName('organization')
        app.save(users)
      }
    } catch (_) {}
    const cols = [
      'clients',
      'policies',
      'payments',
      'reminders',
      'communications',
      'seguradoras',
      'parceiros',
      'custos_fixos',
      'tipos_seguro',
      'conciliacoes',
      'parceiro_pagamentos',
      'parceiro_debitos',
      'modelos_comissao',
      'comissoes_previstas',
      'comissao_recebimentos',
      'produtos',
      'endorsements',
      'import_lots',
      'import_rows',
      'sistema_alertas',
      'recebimentos_legados',
      'campaign_automations',
      'campaign_queue',
      'campaign_send_logs',
      'email_templates',
    ]
    cols.forEach((colName) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        const f = col.fields.getByName('organization')
        if (f) {
          col.fields.removeByName('organization')
          app.save(col)
        }
      } catch (_) {}
    })
    try {
      const t = app.findCollectionByNameOrId('organizations')
      app.delete(t)
    } catch (_) {}
  },
)
