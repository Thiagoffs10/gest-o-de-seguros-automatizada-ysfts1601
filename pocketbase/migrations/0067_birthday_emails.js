// 0067 — E-mail de Feliz Aniversário (automático, diário)
// - birthday_emails_config: assunto/corpo editáveis (1 registro, seed padrão; organização
//   vazia = global do sistema).
// - birthday_email_logs: log de envio por cliente, com ANO gravado — a rotina usa
//   (client, ano, ENVIADO) como trava de anti-repetição (1× por ano por cliente).
// Ambas com organization para isolamento multi-tenant. Idempotente.
// NOTA: clients.birth_date JÁ EXISTE — nada a criar no cadastro de clientes.

migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const orgsCol = app.findCollectionByNameOrId('organizations')

    // ---------- 1. birthday_emails_config ----------
    let cfgCol
    try {
      cfgCol = app.findCollectionByNameOrId('birthday_emails_config')
    } catch (_) {
      cfgCol = new Collection({
        name: 'birthday_emails_config',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
        updateRule:
          "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
        deleteRule: null,
        fields: [
          { name: 'assunto', type: 'text', required: true },
          { name: 'corpo', type: 'text', required: true },
          { name: 'ativo', type: 'bool' },
          { name: 'organization', type: 'relation', collectionId: orgsCol.id, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(cfgCol)
      cfgCol = app.findCollectionByNameOrId('birthday_emails_config')
    }

    // Seed padrão (só cria se não houver NENHUM registro — organização vazia = global)
    let cfgCount = 0
    try {
      cfgCount = $app.findRecordsByFilter('birthday_emails_config', '', '', 1, 0).length
    } catch (_) {}
    if (cfgCount === 0) {
      const seed = new Record(cfgCol)
      seed.set('assunto', 'Feliz aniversário, {primeiro_nome}! 🎉')
      seed.set(
        'corpo',
        'Olá, {primeiro_nome}!\n\n' +
          'A equipe da CRED10MIX Seguros deseja a você um aniversário cheio de saúde, alegria e conquistas! 🎂\n\n' +
          'É uma alegria ter você com a gente. E se precisar de qualquer seguro — auto, residência, viagem ou saúde — é só chamar que nós cuidamos de tudo para você.\n\n' +
          'Atenciosamente,\n' +
          'Equipe CRED10MIX Seguros',
      )
      seed.set('ativo', true)
      seed.set('organization', '')
      app.save(seed)
    }

    // ---------- 2. birthday_email_logs ----------
    try {
      app.findCollectionByNameOrId('birthday_email_logs')
    } catch (_) {
      const logsCol = new Collection({
        name: 'birthday_email_logs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'client',
            type: 'relation',
            collectionId: clientsCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'ano', type: 'number', onlyInt: true, required: true },
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
          { name: 'erro_log', type: 'text' },
          { name: 'organization', type: 'relation', collectionId: orgsCol.id, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          // anti-repetição: um envio com sucesso por cliente por ano
          'CREATE INDEX idx_bday_logs_client_ano ON birthday_email_logs (client, ano)',
          'CREATE INDEX idx_bday_logs_data ON birthday_email_logs (data_envio)',
        ],
      })
      app.save(logsCol)
    }
  },
  (app) => {
    // rollback
    try {
      app.delete(app.findCollectionByNameOrId('birthday_email_logs'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('birthday_emails_config'))
    } catch (_) {}
  },
)
