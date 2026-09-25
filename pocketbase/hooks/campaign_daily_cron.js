// Cron diário para preparação contínua de campanhas de e-mail marketing
// Horário: 09:00 UTC (06:00 BRT) todos os dias
// 1. Localiza campanhas ativas
// 2. Filtra clientes elegíveis por público (Mono Auto, Renovações Próximas, Endossos Recentes, etc.)
// 3. Respeita regra de não repetição e intervalo de frequência
// 4. Redige e insere na fila de aprovação (AGUARDANDO_APROVACAO) de forma contínua para que o corretor não precise criar campanhas manuais todo dia.

cronAdd('campaign_daily_pipeline', '0 9 * * *', () => {
  try {
    var campaigns = $app.findRecordsByFilter(
      'campaign_automations',
      'ativo = true',
      'created',
      10,
      0,
    )
    if (campaigns.length === 0) return

    $app.logger().info('campaign_daily_pipeline started', 'campaigns_count', campaigns.length)

    // Obter um usuário administrador para contexto do agente
    var adminUser = null
    try {
      adminUser = $app.findFirstRecordByFilter('users', "role = 'Admin' || role = 'Administrador'")
    } catch (_) {}

    var allClients = $app.findRecordsByFilter('clients', "email != ''", 'name', 500, 0)
    var allPolicies = $app.findRecordsByFilter('policies', '', '-created', 1000, 0)
    var allEndorsements = []
    try {
      allEndorsements = $app.findRecordsByFilter('endorsements', '', '-created', 500, 0)
    } catch (_) {}

    var queueCol = $app.findCollectionByNameOrId('campaign_queue')
    var nowDate = new Date()
    var nowDateStr = nowDate.toISOString().split('T')[0]
    var totalPrepared = 0

    for (var cIdx = 0; cIdx < campaigns.length; cIdx++) {
      var camp = campaigns[cIdx]
      var campId = camp.id
      var campNome = camp.getString('nome')
      var publicoTipo = camp.getString('tipo_publico')
      var freqDias = camp.getInt('frequencia_dias') || 20
      var cicloPassos = camp.get('ciclo_passos') || []

      if (!Array.isArray(cicloPassos) || cicloPassos.length === 0) continue

      var campPreparedCount = 0

      for (var clIdx = 0; clIdx < allClients.length; clIdx++) {
        var client = allClients[clIdx]
        var clientId = client.id
        var clientEmail = (client.getString('email') || '').trim()
        var clientName = (client.getString('name') || '').trim()

        if (!clientEmail) continue

        // Buscar apólices do cliente
        var clientPolicies = []
        for (var pIdx = 0; pIdx < allPolicies.length; pIdx++) {
          if (allPolicies[pIdx].getString('client') === clientId) {
            clientPolicies.push(allPolicies[pIdx])
          }
        }

        var isEligible = false
        var activePolicies = []
        var hasAuto = false
        var hasResidencial = false
        var hasVida = false
        var autoVehicles = []
        var upcomingRenewals = []

        for (var apIdx = 0; apIdx < clientPolicies.length; apIdx++) {
          var p = clientPolicies[apIdx]
          var pStatus = p.getString('status')
          var ramo = (
            p.getString('tipo_de_seguro') ||
            p.getString('coverage_type') ||
            ''
          ).toLowerCase()
          var isAtiva = pStatus === 'Ativa'

          if (isAtiva) activePolicies.push(p)

          if (
            ramo.indexOf('auto') !== -1 ||
            ramo.indexOf('carro') !== -1 ||
            ramo.indexOf('veic') !== -1
          ) {
            if (isAtiva) {
              hasAuto = true
              var mod = p.getString('modelo_veiculo') || p.getString('placa') || 'veículo'
              autoVehicles.push(mod)
            }
          }
          if (
            ramo.indexOf('residenc') !== -1 ||
            ramo.indexOf('casa') !== -1 ||
            ramo.indexOf('lar') !== -1
          ) {
            if (isAtiva) hasResidencial = true
          }
          if (ramo.indexOf('vida') !== -1) {
            if (isAtiva) hasVida = true
          }

          var endDateStr = p.getString('end_date') || p.getString('renewal_date') || ''
          if (endDateStr) {
            var rawDate = endDateStr.split('T')[0].split(' ')[0]
            if (rawDate >= nowDateStr) {
              var endD = new Date(rawDate + 'T00:00:00')
              var diffDays = Math.ceil((endD.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
              if (diffDays <= 45 && diffDays >= 0) {
                upcomingRenewals.push({ policy: p, diffDays: diffDays })
              }
            }
          }
        }

        if (publicoTipo === 'MONO_AUTO') {
          isEligible = hasAuto && !hasResidencial
        } else if (publicoTipo === 'RENOVACOES_PROXIMAS') {
          isEligible = upcomingRenewals.length > 0
        } else if (publicoTipo === 'ENDOSSOS_RECENTES') {
          for (var edIdx = 0; edIdx < allEndorsements.length; edIdx++) {
            var ed = allEndorsements[edIdx]
            var edPolId = ed.getString('policy')
            for (var cpIdx = 0; cpIdx < clientPolicies.length; cpIdx++) {
              if (clientPolicies[cpIdx].id === edPolId) {
                isEligible = true
                break
              }
            }
            if (isEligible) break
          }
        } else if (publicoTipo === 'SEM_APOLICE_ATIVA') {
          isEligible = activePolicies.length === 0
        } else if (publicoTipo === 'GERAL_CARTEIRA') {
          isEligible = true
        }

        if (!isEligible) continue

        // Checar se já existe na fila (em aprovação, aprovado ou espera)
        var inQueue = null
        try {
          inQueue = $app.findFirstRecordByFilter(
            'campaign_queue',
            "campanha = '" +
              campId +
              "' && client = '" +
              clientId +
              "' && (status = 'AGUARDANDO_APROVACAO' || status = 'APROVADO' || status = 'ESGOTAMENTO_ESPERA')",
          )
        } catch (_) {}

        if (inQueue) continue

        // Histórico de envios anteriores
        var previousLogs = []
        try {
          previousLogs = $app.findRecordsByFilter(
            'campaign_send_logs',
            "campanha = '" +
              campId +
              "' && client = '" +
              clientId +
              "' && status_envio = 'ENVIADO'",
            '-data_envio',
            50,
            0,
          )
        } catch (_) {}

        if (previousLogs.length > 0) {
          var lastLog = previousLogs[0]
          var lastDateStr = (lastLog.getString('data_envio') || '').split('T')[0]
          if (lastDateStr) {
            var lastD = new Date(lastDateStr + 'T00:00:00')
            var elapsedDays = Math.floor(
              (nowDate.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24),
            )
            if (elapsedDays < freqDias) continue
          }
        }

        var sentPassos = []
        for (var plIdx = 0; plIdx < previousLogs.length; plIdx++) {
          sentPassos.push(previousLogs[plIdx].getInt('passo_ordem'))
        }

        var nextPasso = null
        for (var psIdx = 0; psIdx < cicloPassos.length; psIdx++) {
          var step = cicloPassos[psIdx]
          var stepOrder = step.ordem || psIdx + 1
          if (sentPassos.indexOf(stepOrder) === -1) {
            nextPasso = step
            break
          }
        }

        if (!nextPasso) nextPasso = cicloPassos[0]

        var passoOrdem = nextPasso.ordem || 1
        var tipoMsg = nextPasso.tipo || 'educativo'
        var tema = nextPasso.tema || 'Dica exclusiva CRED10MIX'
        var objetivo = nextPasso.objetivo || ''

        var clientFirstName = clientName.split(' ')[0] || 'Cliente'
        var veiculoPrincipal = autoVehicles.length > 0 ? autoVehicles[0] : ''
        var clientSnapshot = {
          nome: clientName,
          primeiro_nome: clientFirstName,
          email: clientEmail,
          possui_auto: hasAuto,
          veiculo: veiculoPrincipal,
          possui_residencial: hasResidencial,
          possui_vida: hasVida,
          total_apolices: clientPolicies.length,
          renovacoes_proximas: upcomingRenewals.length,
        }

        var finalSubject = ''
        var finalBody = ''
        var redigidoPorIA = false

        if (adminUser) {
          try {
            var prompt =
              'Redija um e-mail de seguros para o cliente:\n' +
              '- Nome: ' +
              clientName +
              ' (Primeiro nome: ' +
              clientFirstName +
              ')\n' +
              '- Veículo segurado: ' +
              (veiculoPrincipal || 'Não informado') +
              '\n' +
              '- Possui seguro auto: ' +
              (hasAuto ? 'Sim' : 'Não') +
              '\n' +
              '- Possui seguro residencial: ' +
              (hasResidencial ? 'Sim' : 'Não') +
              '\n' +
              '- Tipo de mensagem: ' +
              tipoMsg +
              ' (' +
              (tipoMsg === 'oferta' ? 'Cross-sell' : 'Conteúdo Educativo') +
              ')\n' +
              '- Tema: ' +
              tema +
              '\n' +
              '- Objetivo do e-mail: ' +
              objetivo +
              '\n' +
              '- Campanha: ' +
              campNome +
              '\n\n' +
              'IMPORTANTE: Se for oferta de Seguro Residencial, ofereça os benefícios (proteção da casa, coberturas de incêndio/roubo/assistências 24h), peça para garantir agora com 10% de desconto e peça expressamente para solicitar a cotação pelo WhatsApp 81 98865-3534 com Thiago.\n\n' +
              'Gere um JSON estrito com {"assunto": "...", "corpo": "..."}.'

            var agentResult = $ai.agent('redator-campanhas').chat({
              user_id: adminUser.id,
              message: prompt,
            })

            if (agentResult && agentResult.content) {
              var cleanJson = agentResult.content.trim()
              if (cleanJson.indexOf('```json') !== -1) {
                cleanJson = cleanJson.split('```json')[1].split('```')[0].trim()
              } else if (cleanJson.indexOf('```') !== -1) {
                cleanJson = cleanJson.split('```')[1].split('```')[0].trim()
              }
              var parsed = JSON.parse(cleanJson)
              if (parsed.assunto && parsed.corpo) {
                finalSubject = parsed.assunto.trim()
                finalBody = parsed.corpo.trim()
                redigidoPorIA = true
              }
            }
          } catch (_) {}
        }

        if (!finalSubject || !finalBody) {
          if (tipoMsg === 'oferta') {
            finalSubject =
              clientFirstName +
              ', garanta a proteção da sua residência com 10% de desconto exclusivo'
            finalBody =
              'Olá, ' +
              clientFirstName +
              '!\n\n' +
              'Sabemos o quanto você preza pela segurança do seu ' +
              (veiculoPrincipal ? 'veículo (' + veiculoPrincipal + ')' : 'patrimônio') +
              ' com a CRED10MIX.\n\n' +
              'Que tal estender essa tranquilidade para a proteção da sua casa? O Seguro Residencial CRED10MIX protege o seu lar com coberturas completas contra incêndio, roubo/furto e assistências 24h emergenciais (chaveiro, eletricista, encanador e conserto de eletrodomésticos).\n\n' +
              'Como você já é nosso cliente parceiro de seguro auto, você pode garantir a contratação agora com 10% de desconto especial exclusivo!\n\n' +
              'Para aproveitar a condição e solicitar a sua cotação rápida, chame diretamente no WhatsApp 81 98865-3534 com Thiago.\n\n' +
              'Atenciosamente,\nEquipe CRED10MIX Corretora de Seguros\nWhatsApp: 81 98865-3534 (Thiago)'
          } else {
            finalSubject = clientFirstName + ': ' + tema
            finalBody =
              'Olá, ' +
              clientFirstName +
              '!\n\n' +
              'Na CRED10MIX, nosso compromisso é garantir sua máxima tranquilidade. Por isso, preparamos uma orientação rápida e muito importante sobre o seu seguro:\n\n' +
              '📌 ' +
              tema +
              '\n\n' +
              (objetivo ||
                'Mantenha os canais de socorro salvos no seu telefone e conte sempre conosco em qualquer emergência.') +
              '\n\n' +
              'Qualquer dúvida sobre as coberturas do seu seguro ' +
              (veiculoPrincipal ? '(' + veiculoPrincipal + ')' : '') +
              ', estamos sempre ao seu lado! WhatsApp: 81 98865-3534 (Thiago)\n\n' +
              'Atenciosamente,\nEquipe CRED10MIX Corretora de Seguros'
          }
        }

        var queueItem = new Record(queueCol)
        queueItem.set('campanha', campId)
        queueItem.set('client', clientId)
        queueItem.set('passo_ordem', passoOrdem)
        queueItem.set('tipo_mensagem', tipoMsg)
        queueItem.set('tema', tema)
        queueItem.set('assunto', finalSubject)
        queueItem.set('corpo', finalBody)
        queueItem.set('status', 'AGUARDANDO_APROVACAO')
        queueItem.set('data_programada', nowDateStr)
        queueItem.set('prioridade', tipoMsg === 'oferta' ? 2 : 1)
        queueItem.set('tentativas', 0)
        queueItem.set('dados_cliente_snapshot', clientSnapshot)
        queueItem.set('redigido_por_ia', redigidoPorIA)
        $app.save(queueItem)

        campPreparedCount++
        totalPrepared++
      }

      if (campPreparedCount > 0) {
        camp.set('total_preparados', (camp.getInt('total_preparados') || 0) + campPreparedCount)
        $app.save(camp)
      }
    }

    $app.logger().info('campaign_daily_pipeline finished', 'total_prepared', totalPrepared)
  } catch (err) {
    $app.logger().error('campaign_daily_pipeline failed', 'err', String(err))
  }
})
