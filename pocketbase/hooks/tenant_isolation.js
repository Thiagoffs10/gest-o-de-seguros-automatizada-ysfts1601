// Isolamento multi-tenant (piloto com uma corretora parceira).
// Regra central: usuário SEM organization = vê tudo (admin CRED10MIX, como hoje).
// Usuário COM organization = só vê/altera dados da própria organização, no servidor.
// Nota: callbacks do JSVM rodam em pool separado — a lista de coleções e a lógica
// ficam INLINE em cada callback (nenhuma variável de topo referenciada dentro deles).

function buildTenantHooks() {
  var TENANT_COLLECTIONS =
    'clients,policies,payments,reminders,communications,seguradoras,parceiros,custos_fixos,' +
    'tipos_seguro,conciliacoes,parceiro_pagamentos,parceiro_debitos,modelos_comissao,' +
    'comissoes_previstas,comissao_recebimentos,produtos,endorsements,import_lots,import_rows,' +
    'sistema_alertas,recebimentos_legados,campaign_automations,campaign_queue,campaign_send_logs,' +
    'email_templates'

  onRecordsListRequest(function (e) {
    var auth = e.auth
    if (!auth) {
      e.next()
      return
    }
    var org = auth.getString('organization') || ''
    if (!org) {
      e.next()
      return
    }
    var col = e.collection.name
    if (TENANT_COLLECTIONS.indexOf(col) < 0) {
      e.next()
      return
    }
    // Parceiro vê ESTRITAMENTE os dados da própria organização (nada da CRED10MIX,
    // que são os registros sem organization — visíveis apenas ao admin).
    var params = e.requestInfo().query
    var clientFilter = params['filter'] || ''
    var orgClause = 'organization = "' + org + '"'
    params['filter'] = clientFilter ? '(' + clientFilter + ') && ' + orgClause : orgClause
    e.next()
  }, TENANT_COLLECTIONS)

  onRecordViewRequest(function (e) {
    var auth = e.auth
    if (!auth) {
      e.next()
      return
    }
    var org = auth.getString('organization') || ''
    if (!org) {
      e.next()
      return
    }
    var col = e.collection.name
    if (TENANT_COLLECTIONS.indexOf(col) < 0) {
      e.next()
      return
    }
    var recOrg = e.record.getString('organization') || ''
    if (recOrg !== org) {
      throw new NotFoundError('Registro não encontrado.')
    }
    e.next()
  }, TENANT_COLLECTIONS)

  onRecordCreateRequest(function (e) {
    var auth = e.auth
    if (!auth) {
      e.next()
      return
    }
    var col = e.collection.name
    if (TENANT_COLLECTIONS.indexOf(col) < 0) {
      e.next()
      return
    }
    var org = auth.getString('organization') || ''
    if (org) {
      e.record.set('organization', org)
    }
    e.next()
  }, TENANT_COLLECTIONS)

  onRecordUpdateRequest(function (e) {
    var auth = e.auth
    if (!auth) {
      e.next()
      return
    }
    var col = e.collection.name
    if (TENANT_COLLECTIONS.indexOf(col) < 0) {
      e.next()
      return
    }
    var org = auth.getString('organization') || ''
    if (!org) {
      e.next()
      return
    }
    var recOrg = e.record.original().getString('organization') || ''
    if (recOrg !== org) {
      throw new ForbiddenError('Registro pertence a outra organização.')
    }
    e.record.set('organization', org)
    e.next()
  }, TENANT_COLLECTIONS)
}

buildTenantHooks()

routerAdd(
  'GET',
  '/backend/v1/organizations',
  function (e) {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    var isAdmin = false
    var role = auth.getString('role')
    if (role === 'Admin' || role === 'Administrador') isAdmin = true
    var filterStr = ''
    var params = {}
    if (!isAdmin) {
      filterStr = 'id = {:org}'
      params['org'] = auth.getString('organization') || ''
    }
    var records = $app.findRecordsByFilter('organizations', filterStr, 'nome', 200, 0, params)
    var result = records.map(function (r) {
      return {
        id: r.id,
        nome: r.getString('nome'),
        ativa: r.getBool('ativa'),
        created: r.getString('created'),
      }
    })
    return e.json(200, result)
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/organizations',
  function (e) {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    var role = auth.getString('role')
    if (role !== 'Admin' && role !== 'Administrador') {
      return e.forbiddenError('Apenas administradores.')
    }
    var body = e.requestInfo().body || {}
    var nome = String(body.nome || '').trim()
    if (!nome) return e.badRequestError('Nome da organização é obrigatório.')
    var col = $app.findCollectionByNameOrId('organizations')
    var rec = new Record(col)
    rec.set('nome', nome)
    rec.set('ativa', body.ativa === undefined ? true : !!body.ativa)
    try {
      $app.save(rec)
    } catch (err) {
      return e.json(400, { error: 'Erro ao salvar organização: ' + String(err) })
    }
    return e.json(201, {
      id: rec.id,
      nome: rec.getString('nome'),
      ativa: rec.getBool('ativa'),
      created: rec.getString('created'),
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'PATCH',
  '/backend/v1/organizations/{id}',
  function (e) {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    var role = auth.getString('role')
    if (role !== 'Admin' && role !== 'Administrador') {
      return e.forbiddenError('Apenas administradores.')
    }
    var id = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    var rec
    try {
      rec = $app.findRecordById('organizations', id)
    } catch (_) {
      return e.notFoundError('Organização não encontrada.')
    }
    var actorOrg = auth.getString('organization') || ''
    if (actorOrg && rec.id !== actorOrg) {
      return e.forbiddenError('Organização de outro parceiro.')
    }
    if (body.nome !== undefined && body.nome !== null && String(body.nome).trim() !== '') {
      rec.set('nome', String(body.nome).trim())
    }
    if (body.ativa !== undefined && body.ativa !== null) {
      rec.set('ativa', !!body.ativa)
    }
    try {
      $app.save(rec)
    } catch (err) {
      return e.json(400, { error: 'Erro ao atualizar organização: ' + String(err) })
    }
    return e.json(200, {
      id: rec.id,
      nome: rec.getString('nome'),
      ativa: rec.getBool('ativa'),
    })
  },
  $apis.requireAuth(),
)
