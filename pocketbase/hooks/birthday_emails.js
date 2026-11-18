// birthday_emails.js — E-mail automático de Feliz Aniversário
// Roda ANTES da fase de drip dentro do mesmo fluxo diário, consumindo o MESMO teto
// de 100 envios/dia (aniversários primeiro, depois drip — o drip enxerga o restante).
// - Acha clientes com aniversário HOJE (dia+mês de birth_date, qualquer ano).
// - Anti-repetição: 1 envio com sucesso por cliente por ANO (birthday_email_logs).
// - Texto editável em birthday_emails_config (fallback: seed padrão).
// - Log grava organization (isolamento multi-tenant). Erros de um cliente não travam os demais.
//
// O arquivo drip_sequences.js importa a FASE de aniversário deste módulo (o cron e o
// endpoint run-now chamam executarFaseAniversarios(app, opts) com { budgetGetter,
// budgetSpend, fromEmail, apiKey, mandatoryFooter }).

/**
 * Normaliza birth_date para o par (MM-DD) ou devolve '' se ausente/inválida.
 */
function bdayNormalize(birthDate) {
  var raw = String(birthDate || '').trim()
  if (!raw) return ''
  var datePart = raw.split('T')[0].split(' ')[0]
  var parts = datePart.split('-')
  if (parts.length < 3) return ''
  var mm = String(parseInt(parts[1], 10) || 0)
  var dd = String(parseInt(parts[2], 10) || 0)
  if (mm.length < 2) mm = '0' + mm
  if (dd.length < 2) dd = '0' + dd
  if (mm === '00' || dd === '00' || mm === 'NaN' || dd === 'NaN') return ''
  return mm + '-' + dd
}

/**
 * Aplica {nome}/{primeiro_nome}/{email} no texto (mesmo padrão do dripApplyVars).
 */
function bdayApplyVars(text, client) {
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

/**
 * Busca (ou resolve) a configuração de texto de aniversário para a organização.
 * Ordem: config da org → config global (organization vazia) → seed padrão.
 */
function bdayGetConfig(app, orgId) {
  var subject = 'Feliz aniversário, {primeiro_nome}! 🎉'
  var body =
    'Olá, {primeiro_nome}!\n\n' +
    'A equipe da CRED10MIX Seguros deseja a você um aniversário cheio de saúde, alegria e conquistas! 🎂\n\n' +
    'É uma alegria ter você com a gente. E se precisar de qualquer seguro — auto, residência, viagem ou saúde — é só chamar que nós cuidamos de tudo para você.\n\n' +
    'Atenciosamente,\n' +
    'Equipe CRED10MIX Seguros'

  var configs = []
  try {
    configs = app.findRecordsByFilter(
      'birthday_emails_config',
      orgId ? "organization = '" + orgId + "' || organization = ''" : "organization = ''",
      '',
      2,
      0,
    )
  } catch (_) {}

  var chosen = null
  for (var i = 0; i < configs.length; i++) {
    if (configs[i].getBool('ativo') === false) continue
    var cfgOrg = ''
    try {
      cfgOrg = configs[i].getString('organization') || ''
    } catch (_) {}
    if (orgId && cfgOrg === orgId) {
      chosen = configs[i]
      break
    }
    if (!chosen && !cfgOrg) chosen = configs[i] // fallback global
  }
  if (chosen) {
    var a = String(chosen.getString('assunto') || '').trim()
    var c = String(chosen.getString('corpo') || '').trim()
    if (a) subject = a
    if (c) body = c
  }
  return { assunto: subject, corpo: body }
}

/**
 * Envia o e-mail via Resend. Mesmo contrato do dripEnviarEmail do drip_sequences.js.
 */
function bdayEnviarEmail(apiKey, fromEmail, to, subject, textBody) {
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

/**
 * FASE DE ANIVERSÁRIOS — chamada pelo drip_sequences.js (cron diário e run-now),
 * ANTES da fase de drip, consumindo o mesmo teto diário (budgetGetter/budgetSpend).
 */
function executarFaseAniversarios(app, opts) {
  opts = opts || {}
  var budgetGetter =
    opts.budgetGetter ||
    function () {
      return 0
    }
  var budgetSpend = opts.budgetSpend || function () {}
  var apiKey = opts.apiKey || ''
  var fromEmail = opts.fromEmail || ''
  var mandatoryFooter = opts.mandatoryFooter || ''

  var resultado = {
    aniversariantes: 0,
    enviados: 0,
    falhas: 0,
    ja_enviados_ano: 0,
    sem_email: 0,
    teto_atingido: false,
    ativo: false,
    erro: '',
  }

  try {
    if (!apiKey || !fromEmail) {
      resultado.erro = 'Resend não configurado (RESEND_API_KEY/VERIFIED_FROM_EMAIL).'
      return resultado
    }

    var now = new Date()
    var hojeStr = now.toISOString().split('T')[0]
    var ano = now.getUTCFullYear()
    var mmddHoje = bdayNormalize(hojeStr)
    if (!mmddHoje) return resultado

    // ---- 1. Clientes aniversariantes de hoje (dia+mês, qualquer ano) ----
    // Busca por prefixo de birth_date no mês atual (YYYY-MM) e filtra pelo dia exato
    // localmente.
    var aniversariantes = []
    var seen = {}
    try {
      var page = 1
      while (true) {
        var batch = app.findRecordsByFilter(
          'clients',
          "email != '' && birth_date >= '" +
            mmAtual() +
            "-01 00:00:00' && birth_date <= '" +
            mmAtual() +
            "-31 23:59:59'",
          '',
          500,
          (page - 1) * 500,
        )
        for (var i = 0; i < batch.length; i++) {
          var md = bdayNormalize(batch[i].getString('birth_date'))
          if (md !== mmddHoje) continue
          var cid = batch[i].id
          if (seen[cid]) continue
          seen[cid] = true
          aniversariantes.push(batch[i])
        }
        if (batch.length < 500) break
        page++
      }
    } catch (qErr) {
      resultado.erro = 'Busca de aniversariantes falhou: ' + String(qErr)
      return resultado
    }

    resultado.aniversariantes = aniversariantes.length

    // ---- 2. Agrupa por organização (cada org dispara só para os SEUS clientes) ----
    var porOrg = {}
    for (var j = 0; j < aniversariantes.length; j++) {
      var c = aniversariantes[j]
      var org = ''
      try {
        org = c.getString('organization') || ''
      } catch (_) {}
      if (!porOrg[org]) porOrg[org] = []
      porOrg[org].push(c)
    }

    // ---- 3. Config por organização (texto editável; fallback global) ----
    var cfgCache = {}
    var cfgFor = function (orgId) {
      if (!cfgCache[orgId]) cfgCache[orgId] = bdayGetConfig(app, orgId)
      return cfgCache[orgId]
    }

    // ---- 4. Envio com anti-repetição (client + ano) e teto compartilhado ----
    Object.keys(porOrg).forEach(function (orgId) {
      var cfg = cfgFor(orgId)
      var lista = porOrg[orgId]

      for (var k = 0; k < lista.length; k++) {
        var client = lista[k]
        // ---- anti-repetição: já enviado com sucesso neste ano? ----
        var jaEnviado = false
        try {
          var prior = app.findFirstRecordByFilter(
            'birthday_email_logs',
            "client = '" + client.id + "' && ano = " + ano + " && status_envio = 'ENVIADO'",
          )
          jaEnviado = !!prior
        } catch (_) {}
        if (jaEnviado) {
          resultado.ja_enviados_ano++
          continue
        }

        // ---- sem e-mail válido → pula (não grava log de falha) ----
        var email = (client.getString('email') || '').trim()
        if (!email) {
          resultado.sem_email++
          continue
        }

        // ---- teto diário compartilhado (aniversário antes do drip) ----
        if (budgetGetter() <= 0) {
          resultado.teto_atingido = true
          break
        }

        var subject = bdayApplyVars(cfg.assunto, client)
        var body = bdayApplyVars(cfg.corpo, client)
        var fullBody = body + mandatoryFooter

        var sendRes = bdayEnviarEmail(apiKey, fromEmail, email, subject, fullBody)
        budgetSpend(1)

        // ---- log (com organization) — grava sucesso E falha ----
        var logRec = new Record(app.findCollectionByNameOrId('birthday_email_logs'))
        logRec.set('client', client.id)
        logRec.set('ano', ano)
        logRec.set('assunto', subject)
        logRec.set('recipient_email', email)
        logRec.set('data_envio', hojeStr)
        logRec.set('status_envio', sendRes.ok ? 'ENVIADO' : 'FALHOU')
        if (!sendRes.ok) logRec.set('erro_log', sendRes.err)
        logRec.set('organization', orgId)
        try {
          app.save(logRec)
        } catch (logErr) {
          app.logger().error('birthday: falha ao gravar log', 'err', String(logErr))
        }

        if (sendRes.ok) {
          resultado.enviados++
        } else {
          resultado.falhas++
          app.logger().warn('birthday: falha de envio', 'to', email, 'err', sendRes.err)
        }
      }
    })

    resultado.ativo = true
  } catch (err) {
    resultado.erro = String(err)
  }
  return resultado
}

function mmAtual() {
  return new Date().toISOString().substring(0, 7)
}
