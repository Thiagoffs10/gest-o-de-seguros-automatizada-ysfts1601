// 0066 — Drip de e-mails por ramo (Sequências)
// Coleções:
// - email_sequences: uma sequência por ramo (viagem, celular, notebook, auto, residencia, saude)
//   com passos educativo/oferta (json) e intervalo mínimo entre envios (intervalo_dias).
// - email_sequence_state: estado do cliente na sequência (passo atual, último envio, ativa).
// - email_sequence_logs: histórico de envio por cliente (data, ramo, passo, assunto, status).
// Idempotente: só cria/popula o que ainda não existe (no-op em banco vazio e em re-execução).

migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const orgsCol = app.findCollectionByNameOrId('organizations')

    // ---------- 1. email_sequences ----------
    let seqCol
    try {
      seqCol = app.findCollectionByNameOrId('email_sequences')
    } catch (_) {
      seqCol = new Collection({
        name: 'email_sequences',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: null,
        fields: [
          {
            name: 'ramo',
            type: 'select',
            values: ['viagem', 'celular', 'notebook', 'auto', 'residencia', 'saude'],
            maxSelect: 1,
            required: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'passos', type: 'json' }, // [{ ordem, tipo, assunto, corpo }]
          { name: 'intervalo_dias', type: 'number' }, // intervalo mínimo entre passos (padrão 7)
          { name: 'ativo', type: 'bool' },
          { name: 'organization', type: 'relation', collectionId: orgsCol.id, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_email_sequences_ramo_org ON email_sequences (ramo, organization)',
        ],
      })
      app.save(seqCol)
      seqCol = app.findCollectionByNameOrId('email_sequences')
    }

    // ---------- 2. email_sequence_state ----------
    let stateCol
    try {
      stateCol = app.findCollectionByNameOrId('email_sequence_state')
    } catch (_) {
      stateCol = new Collection({
        name: 'email_sequence_state',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'client',
            type: 'relation',
            collectionId: clientsCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'sequence',
            type: 'relation',
            collectionId: seqCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'passo_atual', type: 'number' }, // próximo passo a enviar (1-based)
          { name: 'ultimo_envio', type: 'date' },
          { name: 'ativo', type: 'bool' },
          { name: 'organization', type: 'relation', collectionId: orgsCol.id, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_email_seq_state_client_seq ON email_sequence_state (client, sequence)',
          'CREATE INDEX idx_email_seq_state_client ON email_sequence_state (client)',
        ],
      })
      app.save(stateCol)
    }

    // ---------- 3. email_sequence_logs ----------
    let logsCol
    try {
      logsCol = app.findCollectionByNameOrId('email_sequence_logs')
    } catch (_) {
      logsCol = new Collection({
        name: 'email_sequence_logs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'client',
            type: 'relation',
            collectionId: clientsCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'sequence',
            type: 'relation',
            collectionId: seqCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'passo_ordem', type: 'number' },
          { name: 'tipo_mensagem', type: 'select', values: ['educativo', 'oferta'], maxSelect: 1 },
          { name: 'ramo', type: 'text' },
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
          'CREATE INDEX idx_email_seq_logs_client ON email_sequence_logs (client)',
          'CREATE INDEX idx_email_seq_logs_seq ON email_sequence_logs (sequence)',
          'CREATE INDEX idx_email_seq_logs_data ON email_sequence_logs (data_envio)',
        ],
      })
      app.save(logsCol)
    }

    function autodateRef() {
      return { type: 'autodate', onCreate: true, onUpdate: true }
    }

    // ---------- 4. Seed das 6 sequências (idempotente) ----------
    const DEF = '7d'
    const ASSIST = 'Assistências 24h: vidro, farol, chaveiro e guincho inclusos.'
    const WHATS = 'Para contratar ou tirar dúvidas, chame no WhatsApp: 81 98865-3534 (Thiago).'
    const SIGN = 'Atenciosamente,\nEquipe CRED10MIX Corretora de Seguros'

    const sequencias = [
      {
        ramo: 'viagem',
        nome: 'Sequência Viagem',
        descricao:
          'Educativo e ofertas de Seguro Viagem: proteção médica, bagagem e imprevistos de viagem.',
        passos: [
          [
            'educativo',
            'Viajou com tranquilidade? Entenda seu Seguro Viagem',
            'Olá, {nome}!\n\nO Seguro Viagem cobre despesas médicas no exterior, extravio de bagagem e cancelamento de viagem — imprevistos que podem custar milhares de reais se você não estiver protegido.\n\n' +
              ASSIST +
              '\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Chefe, que tal proteger sua próxima viagem com a CRED10MIX?',
            'Olá, {nome}!\n\nSua próxima viagem merece proteção completa: cobertura médica internacional, bagagem e cancelamento.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            '5 imprevistos de viagem que o seguro resolve para você',
            'Olá, {nome}!\n\nCancelamento de voo, bagagem extraviada, emergência médica... O Seguro Viagem resolve tudo isso com atendimento 24h em português.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Cotação de Seguro Viagem em minutos — CRED10MIX',
            'Olá, {nome}!\n\nCotamos seu Seguro Viagem nas principais seguradoras do mercado, com a melhor relação custo-benefício.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Seguro Viagem X Cartão de crédito: a diferença que salva',
            'Olá, {nome}!\n\nA cobertura do cartão de crédito costuma ser limitada. O Seguro Viagem contratado tem limite amplo, atendimento em português e cobertura completa.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Proteção para viagem nacional também vale a pena, {nome}!',
            'Olá, {nome}!\n\nViajou dentro do Brasil? O Seguro Viagem nacional cobre bagagem, cancelamento e emergências médicas.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
        ],
      },
      {
        ramo: 'celular',
        nome: 'Sequência Aparelhos Celular',
        descricao: 'Educativo e ofertas de Seguro de Celular: quebra, roubo e furto qualificado.',
        passos: [
          [
            'educativo',
            'Seu celular caiu e a tela quebrou — e agora?',
            'Olá, {nome}!\n\nO Seguro de Celular cobre quebra acidental, roubo e furto qualificado. Reparo ou reposição rápida, sem pesar no bolso.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Proteja seu celular a partir de poucos reais por mês',
            'Olá, {nome}!\n\nPor um valor que cabe no bolso, você protege seu aparelho contra quebra acidental, roubo e furto qualificado.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Roubo de celular: o que fazer nos primeiros 30 minutos',
            'Olá, {nome}!\n\nBloqueie o IMEI, registre B.O. e acione seu seguro. Com o Seguro de Celular CRED10MIX você tem suporte para reposição do aparelho rapidamente.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Quanto custa repor seu celular hoje, {nome}?',
            'Olá, {nome}!\n\nCompare: a reposição de um aparelho novo pode custar milhares de reais. O seguro custa uma fração disso.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Quebra acidental X roubo: o que cada cobertura faz',
            'Olá, {nome}!\n\nQuebra acidental cobre danos por queda ou líquidos. Roubo/furto qualificado cobre perda do aparelho. Você pode ter as duas proteções.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Sua família toda merece aparelhos protegidos',
            'Olá, {nome}!\n\nProteja os celulares de toda a família com condição especial para múltiplos aparelhos.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
        ],
      },
      {
        ramo: 'notebook',
        nome: 'Sequência Notebook',
        descricao:
          'Educativo e ofertas de Seguro de Notebook: quebra, roubo, furto e dados de trabalho.',
        passos: [
          [
            'educativo',
            'Notebook no home office: o risco que ninguém calcula',
            'Olá, {nome}!\n\nQuedas, líquidos e roubo são os maiores riscos do notebook. O Seguro de Notebook cobre quebra acidental e roubo/furto qualificado.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Proteja seu notebook (e seu trabalho) com a CRED10MIX',
            'Olá, {nome}!\n\nSeu notebook é sua ferramenta de trabalho. Proteja-o contra quebra acidental, roubo e furto com condição especial.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Dano por líquido: o vilão silencioso do notebook',
            'Olá, {nome}!\n\nCafé, água ou suco derramados podem inutilizar o aparelho. O Seguro de Notebook cobre dano acidental, incluindo líquidos.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Notebook da empresa? Proteção para equipamentos de trabalho',
            'Olá, {nome}!\n\nSe você usa notebook para trabalhar, a proteção é ainda mais importante. Condições especiais para equipamentos de trabalho.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Roubo de notebook: prevenção e o que o seguro cobre',
            'Olá, {nome}!\n\nNunca deixe o aparelho à vista no carro. Se o roubo acontecer, o Seguro de Notebook cobre a reposição com agilidade.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Cotação rápida de Seguro Notebook — CRED10MIX',
            'Olá, {nome}!\n\nCotamos seu Seguro de Notebook nas principais seguradoras, com a melhor proteção pelo melhor preço.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
        ],
      },
      {
        ramo: 'auto',
        nome: 'Sequência Auto',
        descricao:
          'Educativo e ofertas de Seguro Auto: assistências, franquia, bônus e cotação comparativa.',
        passos: [
          [
            'educativo',
            'Como acionar o reboque 24h sem dor de cabeça',
            'Olá, {nome}!\n\nGuarde o número de socorro da seguradora no celular, informe local preciso e acompanhe o guincho até a oficina. A assistência 24h faz o resto.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Sua apólice atual ainda é a melhor opção? Compare com a gente',
            'Olá, {nome}!\n\nCotamos seu seguro auto em 10+ seguradoras de uma só vez, garantindo a melhor cobertura pelo menor preço.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Quando vale a pena acionar a franquia?',
            'Olá, {nome}!\n\nPequenos danos às vezes compensam reparo por fora. Danos maiores, third-party ou roubo: acione o seguro. A gente te orienta no processo.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Classe de bônus: seu desconto vale em qualquer seguradora',
            'Olá, {nome}!\n\nSeu bônus é seu e acompanha seu CPF em qualquer seguradora. Cotamos com esse desconto garantido.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Cobertura de vidros, faróis e retrovisores: como funciona',
            'Olá, {nome}!\n\nTrinca de para-brisa tem franquia reduzida e não afeta sua classe de bônus. Cobertura completa de vidros inclusa no plano.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Renovação antecipada com condição especial, {nome}',
            'Olá, {nome}!\n\nAntecipe sua renovação sem perder cobertura e com condição especial de cliente CRED10MIX.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
        ],
      },
      {
        ramo: 'residencia',
        nome: 'Sequência Residência',
        descricao:
          'Educativo e ofertas de Seguro Residencial: incêndio, roubo, danos elétricos e assistências 24h.',
        passos: [
          [
            'educativo',
            'Sua casa está protegida contra o imprevisível?',
            'Olá, {nome}!\n\nIncêndio, roubo, danos elétricos e vazamentos podem custar milhares. O Seguro Residencial protege tudo isso pelo preço de um cafezinho por dia.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Proteja sua casa com 10% de desconto exclusivo, {nome}',
            'Olá, {nome}!\n\nComo cliente CRED10MIX, você tem 10% de desconto no Seguro Residencial: incêndio, roubo, danos elétricos e assistências 24h (chaveiro, eletricista, encanador).\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Danos elétricos: a cobertura mais usada (e mais ignorada)',
            'Olá, {nome}!\n\nPicos de energia queimam geladeira, TV e computador. O Seguro Residencial cobre esses danos — a cobertura mais acionada do mercado.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Chaveiro, eletricista e encanador 24h inclusos no seguro',
            'Olá, {nome}!\n\nAlém das coberturas, o Seguro Residencial inclui assistências 24h: chaveiro, eletricista, encanador e conserto de eletrodomésticos.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Aluguel ou casa própria: por que o seguro cabe nos dois',
            'Olá, {nome}!\n\nMora de aluguel? O seguro protege seus móveis e melhora a relação com o locador. Casa própria? Protege o patrimônio da família.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Última chamada: condição especial Seguro Residencial',
            'Olá, {nome}!\n\nGaranta agora a proteção da sua casa com 10% de desconto de cliente CRED10MIX e assistências 24h inclusas.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
        ],
      },
      {
        ramo: 'saude',
        nome: 'Sequência Saúde',
        descricao:
          'Educativo e ofertas de Plano de Saúde: rede credenciada, carencia, telemedicina e cotação.',
        passos: [
          [
            'educativo',
            'Plano de saúde individual: o que ninguém te conta',
            'Olá, {nome}!\n\nPlanos individuais hoje têm rede ampla, telemedicina e preços acessíveis. A adaptação do mercado deixou de ser barreira.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Cotação de Plano de Saúde sob medida para você, {nome}',
            'Olá, {nome}!\n\nComparamos planos de saúde das principais operadoras: rede credenciada, carencia reduzida e preço que cabe no seu orçamento.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Telemedicina: consultas sem sair de casa',
            'Olá, {nome}!\n\nConsultas por videochamada, 24h, em diversas especialidades. Muitos planos já incluem telemedicina sem custo adicional.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Plano de saúde para toda a família com desconto',
            'Olá, {nome}!\n\nDependentes com desconto, cobertura obstétrica e pediatria: cotamos o plano ideal para a sua família.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'educativo',
            'Carência e Cobertura Parcial: entenda os termos',
            'Olá, {nome}!\n\nCarência é o tempo de espera para usar o plano. Alguns procedimentos têm Cobertura Parcial Temporária. A gente explica tudo antes de você contratar.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
          [
            'oferta',
            'Última chance de garantir seu plano de saúde com condição especial',
            'Olá, {nome}!\n\nGaranta agora sua cotação de Plano de Saúde com condição especial de cliente CRED10MIX.\n\n' +
              WHATS +
              '\n\n' +
              SIGN,
          ],
        ],
      },
    ]

    let seeded = 0
    sequencias.forEach((sq) => {
      // já existe sequência para este ramo (em qualquer organização ou sem org) → no-op
      let existing = null
      try {
        existing = app.findFirstRecordByFilter('email_sequences', "ramo = '" + sq.ramo + "'")
      } catch (_) {}
      if (existing) return

      const rec = new Record(seqCol)
      rec.set('ramo', sq.ramo)
      rec.set('nome', sq.nome)
      rec.set('descricao', sq.descricao)
      rec.set('intervalo_dias', 7)
      rec.set('ativo', true)
      rec.set(
        'passos',
        sq.passos.map((p, i) => ({
          ordem: i + 1,
          tipo: p[0],
          assunto: p[1],
          corpo: p[2],
        })),
      )
      app.save(rec)
      seeded++
    })

    console.log('[MIGRATION 0066] drip sequences seed done, seeded =', seeded)
  },
  (app) => {
    // rollback
  },
)
