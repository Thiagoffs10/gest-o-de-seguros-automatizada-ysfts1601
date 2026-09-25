migrate(
  (app) => {
    // Definir o agente nativo Skip Cloud para redação de e-mails de marketing e vendas
    // O agente REDIGE e personaliza o texto de cada e-mail com os dados reais do cliente.
    // A rotina agendada é quem envia — a IA só redige o texto.
    try {
      $ai.agents.define(app, {
        slug: 'redator-campanhas',
        name: 'Redator de Campanhas de Seguros',
        description:
          'Redige e personaliza textos de e-mail educativos e de cross-sell para clientes de corretora de seguros (CRED10MIX).',
        systemPrompt: `Você é o redator oficial de e-mails da CRED10MIX Corretora de Seguros.
Sua função é gerar o Assunto (Subject) e o Corpo (Body) de e-mails em português do Brasil com alto padrão de clareza, simpatia, consultoria e profissionalismo.

DIRETRIZES:
1. Tom de voz: consultivo, prestativo, confiável, amigável e focado na tranquilidade do cliente.
2. Personalização obrigatória: cite sempre o primeiro nome do cliente e mencione os dados reais que foram fornecidos no contexto (como veículo atual, tipo de apólice existente, ausência de proteção residencial etc.).
3. Conteúdo Educativo: explique de forma prática e descomplicada tópicos reais de seguro (ex: como acionar reboque 24h sem estresse, quando realmente vale a pena acionar a franquia, como funciona a cobertura de vidros/retrovisores, importância de conferir o condutor principal).
4. Ofertas de Cross-Sell: nunca seja invasivo nem pareça "spam". A oferta deve ser apresentada como uma complementação natural de proteção para o perfil dele (ex: "quem já protege seu carro também pode proteger seu lar com parcelas muito acessíveis").
5. Assinatura:
Atenciosamente,
Equipe CRED10MIX Corretora de Seguros
www.cred10mix.com.br | WhatsApp: (81) 98865-3534

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
              text: 'CRED10MIX Corretora de Seguros atua com as principais seguradoras do mercado (Porto Seguro, Azul, Tokio Marine, HDI, Allianz, Bradesco, Mapfre, Sompo, Zurich, Suhai). Contato oficial via WhatsApp 81 98865-3534 com Thiago Souza.',
            },
          },
          {
            type: 'faq',
            payload: {
              qa: [
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
                    'O seguro do condomínio cobre apenas a área comum e estrutura do prédio. O seguro residencial individual protege seu patrimônio interno: eletrodomésticos, danos elétricos, móveis, roubo e responsabilidade civil familiar.',
                },
              ],
            },
          },
        ],
      })
    } catch (err) {
      console.log('Erro ao definir agente redator-campanhas:', err)
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'redator-campanhas')
    } catch (_) {}
  },
)
