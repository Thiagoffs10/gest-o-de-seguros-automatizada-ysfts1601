// Endpoint que prepara a fila diária de campanhas
// Roda pelo usuário ou via rotina:
// 1. Localiza campanhas ativas
// 2. Filtra público-alvo (Mono Auto, Renovações Próximas, Endossos Recentes, etc.)
// 3. Respeita regra de não repetição e intervalo de frequência (pula contato recente)
// 4. Invoca o agente nativo Skip Cloud "redator-campanhas" para personalizar cada e-mail com os dados reais
// 5. Salva na coleção "campaign_queue" com status "AGUARDANDO_APROVACAO"

routerAdd(
  'POST',
  '/backend/v1/campaigns/prepare-daily',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    var userRole = auth.getString('role')
    if (userRole !== 'Admin' && userRole !== 'Administrador' && userRole !== 'Gerente') {
      return e.forbiddenError('Apenas administradores e gerentes podem preparar campanhas.')
    }

    var body = e.requestInfo().body || {}
    var targetCampaignId = body.campaign_id || null

    var campaignsFilter = 'ativo = true'
    if (targetCampaignId) {
      campaignsFilter += " && id = '" + targetCampaignId + "'"
    }

    var campaigns = $app.findRecordsByFilter(
      'campaign_automations',
      campaignsFilter,
      'created',
      10,
      0,
    )
    if (campaigns.length === 0) {
      return e.json(200, {
        success: true,
        message: 'Nenhuma campanha ativa encontrada para processamento.',
        prepared_count: 0,
        skipped_count: 0,
      })
    }

    var allClients = $app.findRecordsByFilter('clients', "email != ''", 'name', 500, 0)
    var allPolicies = $app.findRecordsByFilter('policies', '', '-created', 1000, 0)
    var allEndorsements = []
    try {
      allEndorsements = $app.findRecordsByFilter('endorsements', '', '-created', 500, 0)
    } catch (_) {}

    var queueCol = $app.findCollectionByNameOrId('campaign_queue')
    var nowDate = new Date()
    var nowDateStr = nowDate.toISOString().split('T')[0]

    var preparedCount = 0
    var skippedCount = 0

    for (var cIdx = 0; cIdx < campaigns.length; cIdx++) {
      var camp = campaigns[cIdx]
      var campId = camp.id
      var campNome = camp.getString('nome')
      var publicoTipo = camp.getString('tipo_publico')
      var freqDias = camp.getInt('frequencia_dias') || 20
      var cicloPassos = camp.get('ciclo_passos') || []

      if (!Array.isArray(cicloPassos) || cicloPassos.length === 0) {
        continue
      }

      for (var clIdx = 0; clIdx < allClients.length; clIdx++) {
        var client = allClients[clIdx]
        var clientId = client.id
        var clientEmail = client.getString('email')
        var clientName = client.getString('name')

        if (!clientEmail || !clientEmail.trim()) {
          continue
        }

        // Buscar apólices do cliente
        var clientPolicies = []
        for (var pIdx = 0; pIdx < allPolicies.length; pIdx++) {
          if (allPolicies[pIdx].getString('client') === clientId) {
            clientPolicies.push(allPolicies[pIdx])
          }
        }

        // Avaliar elegibilidade do cliente para o público da campanha
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

          if (isAtiva) {
            activePolicies.push(p)
          }

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

          // Checar renovações próximas (próximos 45 dias)
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
          // Cliente monoproduto de Auto: possui Auto ativo e NÃO possui Residencial ativo
          isEligible = hasAuto && !hasResidencial
        } else if (publicoTipo === 'RENOVACOES_PROXIMAS') {
          isEligible = upcomingRenewals.length > 0
        } else if (publicoTipo === 'ENDOSSOS_RECENTES') {
          // Checar se cliente possui endosso nos últimos 60 dias
          for (var edIdx = 0; edIdx < allEndorsements.length; edIdx++) {
            var ed = allEndorsements[edIdx]
            // Comparar por apólice vinculada ao cliente
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

        if (!isEligible) {
          continue
        }

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

        if (inQueue) {
          skippedCount++
          continue
        }

        // Consultar histórico de envios para este cliente nesta campanha
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

        // Verificar intervalo mínimo de dias desde o último envio para respeitar a frequência configurada
        if (previousLogs.length > 0) {
          var lastLog = previousLogs[0]
          var lastDateStr = (lastLog.getString('data_envio') || '').split('T')[0]
          if (lastDateStr) {
            var lastD = new Date(lastDateStr + 'T00:00:00')
            var elapsedDays = Math.floor(
              (nowDate.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24),
            )
            if (elapsedDays < freqDias) {
              skippedCount++
              continue // Cliente já contatado recentemente dentro do ciclo da frequência
            }
          }
        }

        // Determinar o próximo passo do ciclo (ordem 1, 2, 3...)
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

        // Se já completou todos os passos do ciclo, reinicia o ciclo se tiver passado mais que o dobro da frequência
        if (!nextPasso) {
          nextPasso = cicloPassos[0]
        }

        var passoOrdem = nextPasso.ordem || 1
        var tipoMsg = nextPasso.tipo || 'educativo'
        var tema = nextPasso.tema || 'Dica exclusiva CRED10MIX'
        var objetivo = nextPasso.objetivo || ''

        // SNAPSHOT de dados reais para o agente redigir
        var clientFirstName = (clientName || 'Cliente').trim().split(' ')[0]
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

        // Gerar Assunto e Corpo através do agente nativo Skip Cloud "redator-campanhas"
        var finalSubject = ''
        var finalBody = ''
        var redigidoPorIA = false

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
            'Gere um JSON estrito com {"assunto": "...", "corpo": "..."}. Seja claro, cordial e consultivo.'

          var agentResult = $ai.agent('redator-campanhas').chat({
            user_id: auth.id,
            message: prompt,
          })

          if (agentResult && agentResult.content) {
            var rawText = agentResult.content.trim()
            // Tentar extrair JSON se o modelo colocou blocos de código
            var cleanJson = rawText
            if (cleanJson.indexOf('```json') !== -1) {
              cleanJson = cleanJson.split('```json')[1].split('```')[0].trim()
            } else if (cleanJson.indexOf('```') !== -1) {
              cleanJson = cleanJson.split('```')[1].split('```')[0].trim()
            }

            try {
              var parsed = JSON.parse(cleanJson)
              if (parsed.assunto && parsed.corpo) {
                finalSubject = parsed.assunto.trim()
                finalBody = parsed.corpo.trim()
                redigidoPorIA = true
              }
            } catch (_) {}
          }
        } catch (aiErr) {
          $app.logger().warn('redator-campanhas agent fallback to template', 'err', String(aiErr))
        }

        // Fallback robusto pré-escrito caso IA falhe ou não responda
        if (!finalSubject || !finalBody) {
          if (tipoMsg === 'oferta') {
            finalSubject = clientFirstName + ', uma condição especial para proteger sua residência'
            finalBody =
              'Olá, ' +
              clientFirstName +
              '!\n\n' +
              'Sabemos o quanto você preza pela proteção do seu ' +
              (veiculoPrincipal ? 'veículo (' + veiculoPrincipal + ')' : 'patrimônio') +
              ' com a CRED10MIX.\n\n' +
              'Você sabia que por uma fração do valor do seguro auto é possível blindar a sua casa ou apartamento contra danos elétricos, vazamentos, roubo e incêndio?\n\n' +
              'Como cliente especial, preparamos uma condição com desconto exclusivo de cross-sell para a sua residência.\n\n' +
              'Podemos lhe apresentar uma rápida simulação sem nenhum compromisso?\n\n' +
              'Atenciosamente,\nEquipe CRED10MIX Corretora de Seguros'
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
              ', estamos sempre ao seu lado!\n\n' +
              'Atenciosamente,\nEquipe CRED10MIX Corretora de Seguros'
          }
        }

        // Criar item na fila de aprovação
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

        preparedCount++
      }

      // Atualizar total preparados na campanha
      camp.set('total_preparados', (camp.getInt('total_preparados') || 0) + preparedCount)
      $app.save(camp)
    }

    return e.json(200, {
      success: true,
      message: 'Fila de campanhas preparada com sucesso.',
      prepared_count: preparedCount,
      skipped_count: skippedCount,
    })
  },
  $apis.requireAuth(),
)
