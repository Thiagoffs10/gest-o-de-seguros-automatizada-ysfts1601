// Drip de e-mails por ramo (Sequências) — automação total
// - Cron diário: 'drip_sequences_daily' (09:10 UTC, logo após a fila de campanhas)
// - Endpoint manual: POST /backend/v1/drip/run-now (Admin/Administrador/Gerente)
// Regras:
// - Cada cliente ativo avança 1 passo da sequência por envio, com intervalo mínimo
//   entre envios (intervalo_dias da sequência, padrão 7).
// - Passos alternam educativo → oferta. Cliente com apólice ATIVA no ramo da
//   sequência NÃO recebe oferta desse ramo (a sequência inteira dele é pulada —
//   ele já tem o produto; educativos continuam pelas outras sequências ativas).
// - Educativos são sempre permitidos.
// - Respeita teto global de 100/dia e 3.000/mês (contando também a fila de campanhas)
//   e não repete cliente×sequência×passo (anti-repetição via email_sequence_logs).
// - Sem fila de aprovação: envia direto via Resend (domínio cred10mix.com.br) e
//   registra histórico em email_sequence_logs e communications.
// Variáveis suportadas no texto: {nome}, {primeiro_nome}, {email}
// NOTA: o JSVM do PocketBase executa callbacks em pools separados — toda a lógica
// vive DENTRO do corpo de cada callback (cron e rota), sem referências de topo.

// Cron diário — 09:10 UTC (06:10 BRT), logo após a preparação/fila de campanhas
cronAdd('drip_sequences_daily', '10 9 * * *', () => {
  // ---- lógica da rodada (inline) ----
  function dripParseSteps(raw) {
    var steps = []
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var s = raw[i] || {}
        if (!s.assunto && !s.corpo) continue
        steps.push({
          ordem: s.ordem || i + 1,
          tipo: s.tipo === 'oferta' ? 'oferta' : 'educativo',
          assunto: String(s.assunto || ''),
          corpo: String(s.corpo || ''),
        })
      }
    }
    steps.sort(function (a, b) {
      return a.ordem - b.ordem
    })
    return steps
  }

  function dripApplyVars(text, client) {
    var nome = (client.getString('name') || 'Cliente').trim()
    var primeiro = nome.split(' ')[0] || nome
    var email = (client.getString('email') || '').trim()
    return String(text || '')
      .split('{nome}')
      .join(nome)
      .split('{primeiro_nome}')
      .join(primeiro)
      .split('{email}')
      .join(email)
  }

  function dripRamoDaApolice(p) {
    var ramo = (p.getString('tipo_de_seguro') || p.getString('coverage_type') || '').toLowerCase()
    if (ramo.indexOf('viagem') !== -1) return 'viagem'
    if (ramo.indexOf('celular') !== -1 || ramo.indexOf('aparelho') !== -1) return 'celular'
    if (
      ramo.indexOf('notebook') !== -1 ||
      ramo.indexOf('computador') !== -1 ||
      ramo.indexOf('equipamento') !== -1
    )
      return 'notebook'
    if (
      ramo.indexOf('auto') !== -1 ||
      ramo.indexOf('carro') !== -1 ||
      ramo.indexOf('veic') !== -1 ||
      ramo.indexOf('automovel') !== -1
    )
      return 'auto'
    if (
      ramo.indexOf('residenc') !== -1 ||
      ramo.indexOf('casa') !== -1 ||
      ramo.indexOf('lar') !== -1
    )
      return 'residencia'
    if (ramo.indexOf('saude') !== -1) return 'saude'
    return ''
  }

  function dripDaysBetween(fromDateStr, nowDate) {
    if (!fromDateStr) return Infinity
    var raw = String(fromDateStr).split('T')[0].split(' ')[0]
    if (!raw) return Infinity
    var from = new Date(raw + 'T00:00:00')
    if (isNaN(from.getTime())) return Infinity
    return Math.floor((nowDate.getTime() - from.getTime()) / 86400000)
  }

  function dripEnviarEmail(apiKey, fromEmail, to, subject, textBody) {
    try {
      var res = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: subject,
          text: textBody,
        }),
        timeout: 30,
      })
      if (res.statusCode >= 200 && res.statusCode < 300) {
        var rid = ''
        try {
          if (res.json && res.json.id) rid = res.json.id
        } catch (_) {}
        return { ok: true, id: rid }
      }
      var msg = 'HTTP ' + res.statusCode
      try {
        if (res.json && res.json.message) msg = res.json.message
      } catch (_) {}
      return { ok: false, err: msg }
    } catch (e2) {
      return { ok: false, err: String(e2) }
    }
  }

  var resultado = {
    sequencias: 0,
    enviados: 0,
    falhas: 0,
    teto_atingido: false,
    erro: '',
  }

  try {
    var nowDate = new Date()
    var hoje = nowDate.toISOString().split('T')[0]
    var mesAtual = hoje.substring(0, 7) + '-01'

    var apiKey = $os.getenv('RESEND_API_KEY')
    if (!apiKey) {
      resultado.erro = 'Chave RESEND_API_KEY não configurada no backend.'
    } else {
      var verifiedEmailSecret = $os.getenv('VERIFIED_FROM_EMAIL') || $os.getenv('SENDER_EMAIL')
      var rawSender = verifiedEmailSecret || 'campanhas@cred10mix.com.br'
      var fromEmail = rawSender.indexOf('<') !== -1 ? rawSender : 'CRED10MIX <' + rawSender + '>'

      var mandatoryFooter =
        '\n\n---\n' +
        'Acesse nosso site: www.cred10mix.com.br\n' +
        'Siga-nos no Instagram: @cred10mix\n' +
        'Qualquer contato deve ser feito via WhatsApp: 81 98865-3534 (Thiago Souza) - https://wa.me/5581988653534\n' +
        'Este é um e-mail automático e não monitorado. Por favor, realize todo contato via WhatsApp.'

      // Tetos GLOBAIS: contar também o que a fila de campanhas já enviou hoje/mês
      var enviadosHoje = 0
      var enviadosMes = 0
      try {
        enviadosHoje = $app.findRecordsByFilter(
          'campaign_send_logs',
          "data_envio = '" + hoje + "' && status_envio = 'ENVIADO'",
          '',
          200,
          0,
        ).length
      } catch (_) {}
      try {
        enviadosMes = $app.findRecordsByFilter(
          'campaign_send_logs',
          "data_envio >= '" + mesAtual + "' && status_envio = 'ENVIADO'",
          '',
          3500,
          0,
        ).length
      } catch (_) {}

      var sequencias = $app.findRecordsByFilter('email_sequences', 'ativo = true', 'created', 50, 0)
      if (sequencias.length > 0) {
        var clients = $app.findRecordsByFilter('clients', "email != ''", 'name', 1000, 0)
        var policies = $app.findRecordsByFilter('policies', '', '-created', 2000, 0)

        // ramos com apólice ATIVA por cliente (mapa clientId → { ramo: true })
        var ramosAtivosPorCliente = {}
        for (var pIdx = 0; pIdx < policies.length; pIdx++) {
          var pol = policies[pIdx]
          if (pol.getString('status') !== 'Ativa') continue
          var cid = pol.getString('client')
          if (!cid) continue
          var ramo = dripRamoDaApolice(pol)
          if (!ramo) continue
          if (!ramosAtivosPorCliente[cid]) ramosAtivosPorCliente[cid] = {}
          ramosAtivosPorCliente[cid][ramo] = true
        }

        var stateCol = $app.findCollectionByNameOrId('email_sequence_state')
        var commsCol = $app.findCollectionByNameOrId('communications')

        for (var sIdx = 0; sIdx < sequencias.length; sIdx++) {
          var seq = sequencias[sIdx]
          var seqId = seq.id
          var ramoSeq = seq.getString('ramo')
          var intervaloDias = seq.getInt('intervalo_dias') || 7
          var passos = dripParseSteps(seq.get('passos'))
          if (passos.length === 0) continue
          resultado.sequencias++

          var enviadosNestaSeq = 0

          for (var cIdx = 0; cIdx < clients.length; cIdx++) {
            if (enviadosHoje >= 100 || enviadosMes >= 3000) {
              resultado.teto_atingido = true
              break
            }

            var client = clients[cIdx]
            var clientId = client.id
            var toEmail = (client.getString('email') || '').trim()
            if (!toEmail) continue

            // Regra de cross-sell: cliente com apólice ATIVA neste ramo não recebe
            // ofertas dele — sequência inteira pulada para esse cliente.
            var ramosAtivos = ramosAtivosPorCliente[clientId] || {}
            if (ramosAtivos[ramoSeq]) continue

            // Estado do cliente na sequência
            var state = null
            try {
              state = $app.findFirstRecordByFilter(
                'email_sequence_state',
                "client = '" + clientId + "' && sequence = '" + seqId + "'",
              )
            } catch (_) {}
            if (state && !state.getBool('ativo')) continue // pausado para este cliente
            var passoAtual = state ? state.getInt('passo_atual') || 1 : 1
            if (passoAtual > passos.length) continue // sequência concluída

            // Intervalo mínimo entre envios
            var ultimoEnvio = state ? state.getString('ultimo_envio') : ''
            if (ultimoEnvio && dripDaysBetween(ultimoEnvio, nowDate) < intervaloDias) continue

            // Anti-repetição: pular passos já ENVIADOS para este cliente
            var passo = null
            var guard = 0
            while (passoAtual <= passos.length && guard < passos.length + 2) {
              guard++
              var candidato = passos[passoAtual - 1]
              if (!candidato) break
              var jaEnviado = false
              try {
                jaEnviado = !!$app.findFirstRecordByFilter(
                  'email_sequence_logs',
                  "client = '" +
                    clientId +
                    "' && sequence = '" +
                    seqId +
                    "' && passo_ordem = " +
                    candidato.ordem +
                    " && status_envio = 'ENVIADO'",
                )
              } catch (_) {}
              if (jaEnviado) {
                passoAtual++
                continue
              }
              passo = candidato
              break
            }
            if (!passo) continue

            var assunto = dripApplyVars(passo.assunto, client)
            var corpo = dripApplyVars(passo.corpo, client)
            var envio = dripEnviarEmail(
              apiKey,
              fromEmail,
              toEmail,
              assunto,
              corpo + mandatoryFooter,
            )

            var logsCol = $app.findCollectionByNameOrId('email_sequence_logs')
            var logRec = new Record(logsCol)
            logRec.set('client', clientId)
            logRec.set('sequence', seqId)
            logRec.set('passo_ordem', passo.ordem)
            logRec.set('tipo_mensagem', passo.tipo)
            logRec.set('ramo', ramoSeq)
            logRec.set('assunto', assunto)
            logRec.set('recipient_email', toEmail)
            logRec.set('data_envio', hoje)
            logRec.set('status_envio', envio.ok ? 'ENVIADO' : 'FALHOU')
            if (!envio.ok) logRec.set('erro_log', envio.err)
            $app.save(logRec)

            if (envio.ok) {
              resultado.enviados++
              enviadosHoje++
              enviadosMes++
              enviadosNestaSeq++

              try {
                var comm = new Record(commsCol)
                comm.set('type', 'Email')
                comm.set('client', clientId)
                comm.set('subject', assunto)
                comm.set('body', corpo + mandatoryFooter)
                comm.set('recipient_email', toEmail)
                comm.set('status', 'Enviado')
                comm.set('sent_date', hoje)
                $app.save(comm)
              } catch (cErr) {
                $app.logger().error('drip: failed to save communication', 'err', String(cErr))
              }

              // avança estado
              try {
                if (!state) {
                  state = new Record(stateCol)
                  state.set('client', clientId)
                  state.set('sequence', seqId)
                  state.set('organization', seq.getString('organization'))
                }
                state.set('passo_atual', passoAtual + 1)
                state.set('ultimo_envio', hoje)
                state.set('ativo', true)
                $app.save(state)
              } catch (stErr) {
                $app.logger().error('drip: failed to save state', 'err', String(stErr))
              }
            } else {
              resultado.falhas++
              // falha NÃO avança o passo: tenta de novo na próxima rodada
            }
          }
        }
      }
    }
  } catch (err) {
    resultado.erro = String(err)
  }

  $app
    .logger()
    .info(
      'drip_sequences_daily finished',
      'enviados',
      resultado.enviados || 0,
      'falhas',
      resultado.falhas || 0,
      'sequencias',
      resultado.sequencias || 0,
      'teto_atingido',
      resultado.teto_atingido ? 'sim' : 'nao',
      'erro',
      resultado.erro || '-',
    )
})

// Endpoint manual — botão "Enviar agora" na tela de Sequências
routerAdd(
  'POST',
  '/backend/v1/drip/run-now',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    var userRole = auth.getString('role')
    if (userRole !== 'Admin' && userRole !== 'Administrador' && userRole !== 'Gerente') {
      return e.forbiddenError('Apenas administradores e gerentes podem disparar as sequências.')
    }

    // ---- lógica da rodada (inline, espelho do cron) ----
    function dripParseSteps(raw) {
      var steps = []
      if (Array.isArray(raw)) {
        for (var i = 0; i < raw.length; i++) {
          var s = raw[i] || {}
          if (!s.assunto && !s.corpo) continue
          steps.push({
            ordem: s.ordem || i + 1,
            tipo: s.tipo === 'oferta' ? 'oferta' : 'educativo',
            assunto: String(s.assunto || ''),
            corpo: String(s.corpo || ''),
          })
        }
      }
      steps.sort(function (a, b) {
        return a.ordem - b.ordem
      })
      return steps
    }

    function dripApplyVars(text, client) {
      var nome = (client.getString('name') || 'Cliente').trim()
      var primeiro = nome.split(' ')[0] || nome
      var email = (client.getString('email') || '').trim()
      return String(text || '')
        .split('{nome}')
        .join(nome)
        .split('{primeiro_nome}')
        .join(primeiro)
        .split('{email}')
        .join(email)
    }

    function dripRamoDaApolice(p) {
      var ramo = (p.getString('tipo_de_seguro') || p.getString('coverage_type') || '').toLowerCase()
      if (ramo.indexOf('viagem') !== -1) return 'viagem'
      if (ramo.indexOf('celular') !== -1 || ramo.indexOf('aparelho') !== -1) return 'celular'
      if (
        ramo.indexOf('notebook') !== -1 ||
        ramo.indexOf('computador') !== -1 ||
        ramo.indexOf('equipamento') !== -1
      )
        return 'notebook'
      if (
        ramo.indexOf('auto') !== -1 ||
        ramo.indexOf('carro') !== -1 ||
        ramo.indexOf('veic') !== -1 ||
        ramo.indexOf('automovel') !== -1
      )
        return 'auto'
      if (
        ramo.indexOf('residenc') !== -1 ||
        ramo.indexOf('casa') !== -1 ||
        ramo.indexOf('lar') !== -1
      )
        return 'residencia'
      if (ramo.indexOf('saude') !== -1) return 'saude'
      return ''
    }

    function dripDaysBetween(fromDateStr, nowDate) {
      if (!fromDateStr) return Infinity
      var raw = String(fromDateStr).split('T')[0].split(' ')[0]
      if (!raw) return Infinity
      var from = new Date(raw + 'T00:00:00')
      if (isNaN(from.getTime())) return Infinity
      return Math.floor((nowDate.getTime() - from.getTime()) / 86400000)
    }

    function dripEnviarEmail(apiKey, fromEmail, to, subject, textBody) {
      try {
        var res = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject: subject,
            text: textBody,
          }),
          timeout: 30,
        })
        if (res.statusCode >= 200 && res.statusCode < 300) {
          var rid = ''
          try {
            if (res.json && res.json.id) rid = res.json.id
          } catch (_) {}
          return { ok: true, id: rid }
        }
        var msg = 'HTTP ' + res.statusCode
        try {
          if (res.json && res.json.message) msg = res.json.message
        } catch (_) {}
        return { ok: false, err: msg }
      } catch (e2) {
        return { ok: false, err: String(e2) }
      }
    }

    var resultado = {
      sequencias: 0,
      enviados: 0,
      falhas: 0,
      teto_atingido: false,
      erro: '',
    }

    try {
      var nowDate = new Date()
      var hoje = nowDate.toISOString().split('T')[0]
      var mesAtual = hoje.substring(0, 7) + '-01'

      var apiKey = $os.getenv('RESEND_API_KEY')
      if (!apiKey) {
        resultado.erro = 'Chave RESEND_API_KEY não configurada no backend.'
      } else {
        var verifiedEmailSecret = $os.getenv('VERIFIED_FROM_EMAIL') || $os.getenv('SENDER_EMAIL')
        var rawSender = verifiedEmailSecret || 'campanhas@cred10mix.com.br'
        var fromEmail = rawSender.indexOf('<') !== -1 ? rawSender : 'CRED10MIX <' + rawSender + '>'

        var mandatoryFooter =
          '\n\n---\n' +
          'Acesse nosso site: www.cred10mix.com.br\n' +
          'Siga-nos no Instagram: @cred10mix\n' +
          'Qualquer contato deve ser feito via WhatsApp: 81 98865-3534 (Thiago Souza) - https://wa.me/5581988653534\n' +
          'Este é um e-mail automático e não monitorado. Por favor, realize todo contato via WhatsApp.'

        var enviadosHoje = 0
        var enviadosMes = 0
        try {
          enviadosHoje = $app.findRecordsByFilter(
            'campaign_send_logs',
            "data_envio = '" + hoje + "' && status_envio = 'ENVIADO'",
            '',
            200,
            0,
          ).length
        } catch (_) {}
        try {
          enviadosMes = $app.findRecordsByFilter(
            'campaign_send_logs',
            "data_envio >= '" + mesAtual + "' && status_envio = 'ENVIADO'",
            '',
            3500,
            0,
          ).length
        } catch (_) {}

        var sequencias = $app.findRecordsByFilter(
          'email_sequences',
          'ativo = true',
          'created',
          50,
          0,
        )
        if (sequencias.length > 0) {
          var clients = $app.findRecordsByFilter('clients', "email != ''", 'name', 1000, 0)
          var policies = $app.findRecordsByFilter('policies', '', '-created', 2000, 0)

          var ramosAtivosPorCliente = {}
          for (var pIdx = 0; pIdx < policies.length; pIdx++) {
            var pol = policies[pIdx]
            if (pol.getString('status') !== 'Ativa') continue
            var cid = pol.getString('client')
            if (!cid) continue
            var ramo = dripRamoDaApolice(pol)
            if (!ramo) continue
            if (!ramosAtivosPorCliente[cid]) ramosAtivosPorCliente[cid] = {}
            ramosAtivosPorCliente[cid][ramo] = true
          }

          var stateCol = $app.findCollectionByNameOrId('email_sequence_state')
          var commsCol = $app.findCollectionByNameOrId('communications')

          for (var sIdx = 0; sIdx < sequencias.length; sIdx++) {
            var seq = sequencias[sIdx]
            var seqId = seq.id
            var ramoSeq = seq.getString('ramo')
            var intervaloDias = seq.getInt('intervalo_dias') || 7
            var passos = dripParseSteps(seq.get('passos'))
            if (passos.length === 0) continue
            resultado.sequencias++

            var enviadosNestaSeq = 0

            for (var cIdx = 0; cIdx < clients.length; cIdx++) {
              if (enviadosHoje >= 100 || enviadosMes >= 3000) {
                resultado.teto_atingido = true
                break
              }

              var client = clients[cIdx]
              var clientId = client.id
              var toEmail = (client.getString('email') || '').trim()
              if (!toEmail) continue

              var ramosAtivos = ramosAtivosPorCliente[clientId] || {}
              if (ramosAtivos[ramoSeq]) continue

              var state = null
              try {
                state = $app.findFirstRecordByFilter(
                  'email_sequence_state',
                  "client = '" + clientId + "' && sequence = '" + seqId + "'",
                )
              } catch (_) {}
              if (state && !state.getBool('ativo')) continue
              var passoAtual = state ? state.getInt('passo_atual') || 1 : 1
              if (passoAtual > passos.length) continue

              var ultimoEnvio = state ? state.getString('ultimo_envio') : ''
              if (ultimoEnvio && dripDaysBetween(ultimoEnvio, nowDate) < intervaloDias) continue

              var passo = null
              var guard = 0
              while (passoAtual <= passos.length && guard < passos.length + 2) {
                guard++
                var candidato = passos[passoAtual - 1]
                if (!candidato) break
                var jaEnviado = false
                try {
                  jaEnviado = !!$app.findFirstRecordByFilter(
                    'email_sequence_logs',
                    "client = '" +
                      clientId +
                      "' && sequence = '" +
                      seqId +
                      "' && passo_ordem = " +
                      candidato.ordem +
                      " && status_envio = 'ENVIADO'",
                  )
                } catch (_) {}
                if (jaEnviado) {
                  passoAtual++
                  continue
                }
                passo = candidato
                break
              }
              if (!passo) continue

              var assunto = dripApplyVars(passo.assunto, client)
              var corpo = dripApplyVars(passo.corpo, client)
              var envio = dripEnviarEmail(
                apiKey,
                fromEmail,
                toEmail,
                assunto,
                corpo + mandatoryFooter,
              )

              var logsCol = $app.findCollectionByNameOrId('email_sequence_logs')
              var logRec = new Record(logsCol)
              logRec.set('client', clientId)
              logRec.set('sequence', seqId)
              logRec.set('passo_ordem', passo.ordem)
              logRec.set('tipo_mensagem', passo.tipo)
              logRec.set('ramo', ramoSeq)
              logRec.set('assunto', assunto)
              logRec.set('recipient_email', toEmail)
              logRec.set('data_envio', hoje)
              logRec.set('status_envio', envio.ok ? 'ENVIADO' : 'FALHOU')
              if (!envio.ok) logRec.set('erro_log', envio.err)
              $app.save(logRec)

              if (envio.ok) {
                resultado.enviados++
                enviadosHoje++
                enviadosMes++
                enviadosNestaSeq++

                try {
                  var comm = new Record(commsCol)
                  comm.set('type', 'Email')
                  comm.set('client', clientId)
                  comm.set('subject', assunto)
                  comm.set('body', corpo + mandatoryFooter)
                  comm.set('recipient_email', toEmail)
                  comm.set('status', 'Enviado')
                  comm.set('sent_date', hoje)
                  $app.save(comm)
                } catch (cErr) {
                  $app.logger().error('drip: failed to save communication', 'err', String(cErr))
                }

                try {
                  if (!state) {
                    state = new Record(stateCol)
                    state.set('client', clientId)
                    state.set('sequence', seqId)
                    state.set('organization', seq.getString('organization'))
                  }
                  state.set('passo_atual', passoAtual + 1)
                  state.set('ultimo_envio', hoje)
                  state.set('ativo', true)
                  $app.save(state)
                } catch (stErr) {
                  $app.logger().error('drip: failed to save state', 'err', String(stErr))
                }
              } else {
                resultado.falhas++
              }
            }

            resultado.detalhe = resultado.detalhe || []
            resultado.detalhe.push({
              sequencia: seq.getString('nome'),
              ramo: ramoSeq,
              enviados: enviadosNestaSeq,
            })
          }
        }
      }
    } catch (err) {
      resultado.erro = String(err)
    }

    return e.json(200, {
      success: !resultado.erro,
      enviados: resultado.enviados || 0,
      falhas: resultado.falhas || 0,
      teto_atingido: resultado.teto_atingido || false,
      detalhe: resultado.detalhe || [],
      message: resultado.erro
        ? resultado.erro
        : resultado.enviados +
          ' e-mail(s) de sequência enviado(s). ' +
          (resultado.teto_atingido
            ? 'Teto de envio atingido — o restante sai na próxima rodada.'
            : ''),
    })
  },
  $apis.requireAuth(),
)
