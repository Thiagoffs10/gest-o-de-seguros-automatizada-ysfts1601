/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Atualizar especificamente o registro da campanha MONO_AUTO com o ciclo de passos e descrição exatos
    try {
      const record = app.findFirstRecordByData('campaign_automations', 'id', 'j21j9l12hiwebge')
      if (record) {
        const passos = [
          {
            ordem: 1,
            tipo: 'educativo',
            tema: 'Como acionar o reboque 24h sem dor de cabeça',
            titulo: 'Dicas de Assistência e Reboque 24h',
            objetivo:
              'Explicar o passo a passo para solicitar guincho rápido, como passar referências precisas e checar limite de km.',
          },
          {
            ordem: 2,
            tipo: 'oferta',
            tema: 'Seguro Residencial com 10% de desconto: Proteja seu lar com assistência 24h',
            titulo: 'Cross-sell Seguro Residencial 10% OFF para Clientes Auto',
            objetivo:
              'Oferecer o seguro residencial explicando os benefícios (proteção da casa, coberturas de incêndio/roubo/assistências 24h) e pedir para garantir agora com 10% de desconto. Pedir para solicitar a cotação pelo WhatsApp 81 98865-3534 com Thiago.',
          },
          {
            ordem: 3,
            tipo: 'educativo',
            tema: 'Quando realmente vale a pena acionar a franquia?',
            titulo: 'Descomplicando a Franquia do Seguro',
            objetivo:
              'Orientar quando compensa pagar a franquia e como funciona o conserto de pequenos arranhões ou reparos em terceiros.',
          },
          {
            ordem: 4,
            tipo: 'oferta',
            tema: 'Seguro de Vida e Acidentes Pessoais: Segurança financeira para quem você ama',
            titulo: 'Cross-sell Seguro de Vida e Proteção Financeira Familiar',
            objetivo:
              'Destacar cobertura de invalidez temporária, telemedicina e assistência familiar.',
          },
        ]

        record.set('ciclo_passos', passos)
        record.set(
          'descricao',
          'Nutrição educativa com dicas práticas de trânsito e socorro + ofertas sob medida de Seguro Residencial (com 10% de desconto e benefícios completos) e Vida para clientes que possuem apenas seguro de automóvel. WhatsApp 81 98865-3534 com Thiago.',
        )
        app.save(record)
      }
    } catch (err) {
      console.log('Erro ao atualizar registro j21j9l12hiwebge:', err)
    }
  },
  (app) => {
    // rollback
  },
)
