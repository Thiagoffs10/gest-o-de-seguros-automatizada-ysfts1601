/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Atualizar definição e instruções do agente redator-campanhas para contemplar especificamente
    // a oferta de Seguro Residencial com 10% de desconto, benefícios (proteção da casa, coberturas de incêndio/roubo/assistências 24h)
    // e chamada para cotação pelo WhatsApp 81 98865-3534 com Thiago.
    try {
      $ai.agents.define(app, {
        slug: 'redator-campanhas',
        name: 'Redator de Campanhas de Seguros',
        description:
          'Redige e personaliza textos de e-mail educativos e de cross-sell para clientes de corretora de seguros (CRED10MIX).',
        systemPrompt: `Você é o redator oficial de e-mails da CRED10MIX Corretora de Seguros.
Sua função é gerar o Assunto (Subject) e o Corpo (Body) de e-mails em português do Brasil com alto padrão de clareza, simpatia, consultoria e profissionalismo.

DIRETRIZES FUNDAMENTAIS:
1. Tom de voz: consultivo, prestativo, confiável, amigável e focado na tranquilidade do cliente. Nunca seja invasivo nem pareça "spam".
2. Personalização obrigatória: cite sempre o primeiro nome do cliente e mencione os dados reais que foram fornecidos no contexto (como veículo atual, tipo de apólice existente, ausência de proteção residencial etc.).
3. Conteúdo Educativo: explique de forma prática e descomplicada tópicos reais de seguro (ex: como acionar reboque 24h sem estresse, quando realmente vale a pena acionar a franquia, cobertura de vidros).
4. Oferta de Cross-sell de Seguro Residencial (REGRA OBRIGATÓRIA QUANDO O TEMA FOR RESIDENCIAL):
   - Apresente a proteção da casa ou apartamento como um complemento natural para quem já protege o automóvel na CRED10MIX.
   - Explique claramente os benefícios essenciais: proteção completa da casa, coberturas de incêndio, roubo/furto e assistências 24h emergenciais (chaveiro, encanador, eletricista).
   - Destaque a oferta especial exclusiva: peça para garantir agora com 10% de desconto.
   - Chamado para ação claro e direto: peça expressamente para solicitar a cotação pelo WhatsApp 81 98865-3534 com Thiago (ou Thiago Souza). O número 81 98865-3534 DEVE constar no corpo do e-mail.
5. Assinatura:
Atenciosamente,
Equipe CRED10MIX Corretora de Seguros
www.cred10mix.com.br | WhatsApp: 81 98865-3534 (Thiago)

FORMATO DE RESPOSTA (JSON estrito):
{
  "assunto": "Texto do assunto atraente e personalizado",
  "corpo": "Texto completo do e-mail com quebras de linha e saudações personalizadas"
}`,
        tier: 'fast',
        tools: [
          { collection: 'clients', perms: { read: true, list: true } },
          { collection: 'policies', perms: { read: true, list: true } },
        ],
        memory: [
          {
            type: 'text',
            payload: {
              text: 'CRED10MIX Corretora de Seguros atua com as principais seguradoras do mercado (Porto Seguro, Azul, Tokio Marine, HDI, Allianz, Bradesco, Mapfre, Sompo, Zurich, Suhai). Contato oficial para cotações e dúvidas via WhatsApp 81 98865-3534 com Thiago.',
            },
          },
          {
            type: 'text',
            payload: {
              text: 'Campanha de Seguro Residencial CRED10MIX: Ofereça o seguro residencial explicando os benefícios (proteção da casa, coberturas de incêndio/roubo/assistências 24h) e peça para garantir agora com 10% de desconto. Peça para solicitar a cotação pelo WhatsApp 81 98865-3534 com Thiago.',
            },
          },
          {
            type: 'faq',
            payload: {
              qa: [
                {
                  question: 'Como funciona a oferta de 10% de desconto no Seguro Residencial?',
                  answer:
                    'Clientes com apólice de Auto na CRED10MIX têm direito a 10% de desconto exclusivo para contratação do seguro residencial com coberturas de proteção da casa, incêndio, roubo e assistência 24h. Basta solicitar a cotação pelo WhatsApp 81 98865-3534 com Thiago.',
                },
                {
                  question: 'Quando acionar a franquia de seguro Auto?',
                  answer:
                    'A franquia só deve ser acionada quando o orçamento do reparo do próprio veículo for superior ao valor da franquia descrita na apólice. Para terceiros (RCF-V), geralmente não há cobrança de franquia do segurado.',
                },
                {
                  question: 'Como funciona a assistência de guincho/reboque?',
                  answer:
                    'Basta acionar a seguradora pelo WhatsApp ou telefone 0800 com o número da placa ou apólice. A quilometragem varia de 200km, 400km a ilimitada conforme contratado.',
                },
                {
                  question: 'Por que contratar Seguro Residencial se já tenho condomínio?',
                  answer:
                    'O seguro do condomínio cobre apenas a área comum e estrutura do prédio. O seguro residencial individual protege seu patrimônio interno: eletrodomésticos, danos elétricos, móveis, roubo, incêndio e assistência 24h.',
                },
              ],
            },
          },
        ],
      })
    } catch (err) {
      console.log('Erro ao atualizar agente redator-campanhas:', err)
    }

    // Atualizar a campanha existente de Cross-sell Mono Auto -> Residencial para aplicar o texto exato do usuário
    try {
      const campsCol = app.findCollectionByNameOrId('campaign_automations')
      const monoAutoCamps = app.findRecordsByFilter(
        'campaign_automations',
        "tipo_publico = 'MONO_AUTO'",
        'created',
        10,
        0,
      )

      for (let i = 0; i < monoAutoCamps.length; i++) {
        const camp = monoAutoCamps[i]
        const passos = camp.get('ciclo_passos') || []
        let modified = false
        const updatedPassos = passos.map((p) => {
          if (
            p.tipo === 'oferta' &&
            (p.tema.toLowerCase().includes('residencial') ||
              p.titulo.toLowerCase().includes('residencial') ||
              p.objetivo.toLowerCase().includes('residencial'))
          ) {
            modified = true
            return {
              ordem: p.ordem || 2,
              tipo: 'oferta',
              tema: 'Seguro Residencial com 10% de desconto: Proteja sua casa com condições especiais',
              titulo: 'Cross-sell Seguro Residencial 10% OFF para Clientes Auto',
              objetivo:
                'Oferecer o seguro residencial explicando os benefícios (proteção da casa, coberturas de incêndio/roubo/assistências 24h) e pedir para garantir agora com 10% de desconto. Pedir para solicitar a cotação pelo WhatsApp 81 98865-3534 com Thiago.',
            }
          }
          return p
        })

        if (modified) {
          camp.set('ciclo_passos', updatedPassos)
          camp.set(
            'descricao',
            'Nutrição educativa com dicas práticas de trânsito e socorro + oferta especial de Seguro Residencial com 10% de desconto e coberturas completas (incêndio, roubo, assistências 24h) para clientes que possuem apenas seguro de automóvel. Cotação pelo WhatsApp 81 98865-3534 com Thiago.',
          )
          app.save(camp)
        }
      }
    } catch (campErr) {
      console.log('Erro ao atualizar passos da campanha MONO_AUTO:', campErr)
    }
  },
  (app) => {
    // rollback
  },
)
