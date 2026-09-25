migrate(
  (app) => {
    // Criar campanhas padrão iniciais para enriquecer a experiência do usuário imediatamente
    const campsCol = app.findCollectionByNameOrId('campaign_automations')

    // 1. Campanha Cross-sell Monoproduto Auto -> Residencial/Vida
    try {
      const c1 = new Record(campsCol)
      c1.set('nome', 'Jornada Proteção Completa (Mono Auto → Residencial)')
      c1.set(
        'descricao',
        'Nutrição educativa com dicas práticas de trânsito e socorro + ofertas sob medida de Seguro Residencial e Vida para clientes que possuem apenas seguro de automóvel.',
      )
      c1.set('tipo_publico', 'MONO_AUTO')
      c1.set('frequencia_dias', 20)
      c1.set('ativo', true)
      c1.set('total_preparados', 0)
      c1.set('total_enviados', 0)
      c1.set('ciclo_passos', [
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
          tema: 'Seguro Residencial: Seu lar protegido pelo preço de um cafezinho',
          titulo: 'Cross-sell Seguro Residencial Especial para Clientes Auto',
          objetivo:
            'Apresentar a vantagem de proteger a residência com até 15% de desconto de cliente cadastrado, cobrindo danos elétricos, vazamentos e roubo.',
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
      ])
      app.save(c1)
    } catch (e1) {
      console.log('Erro seed campanha 1:', e1)
    }

    // 2. Campanha Antecipação de Renovações
    try {
      const c2 = new Record(campsCol)
      c2.set('nome', 'Antecipação Tranquila de Renovações')
      c2.set(
        'descricao',
        'Educação sobre bônus da apólice, pesquisa em 10+ seguradoras e garantia do melhor preço antes do vencimento.',
      )
      c2.set('tipo_publico', 'RENOVACOES_PROXIMAS')
      c2.set('frequencia_dias', 30)
      c2.set('ativo', true)
      c2.set('total_preparados', 0)
      c2.set('total_enviados', 0)
      c2.set('ciclo_passos', [
        {
          ordem: 1,
          tipo: 'educativo',
          tema: 'O que é a Classe de Bônus e como ela garante desconto na sua renovação',
          titulo: 'Entendendo seu Bônus do Seguro',
          objetivo:
            'Explicar que o bônus pertence ao segurado (CPF) e acumula desconto a cada ano sem sinistro, valendo em qualquer seguradora.',
        },
        {
          ordem: 2,
          tipo: 'oferta',
          tema: 'Renovação Antecipada com Condições Exclusivas',
          titulo: 'Cotação Comparativa em 10 Seguradoras',
          objetivo:
            'Convidar o cliente a conferir o comparativo com a tranquilidade de não deixar a proteção expirar.',
        },
      ])
      app.save(c2)
    } catch (e2) {
      console.log('Erro seed campanha 2:', e2)
    }

    // 3. Campanha Pós-Endosso e Cobertura de Vidros
    try {
      const c3 = new Record(campsCol)
      c3.set('nome', 'Guia do Segurado: Cobertura de Vidros e Assistências Úteis')
      c3.set(
        'descricao',
        'Campanha de relacionamento e esclarecimento pós-endosso / alteração de apólice.',
      )
      c3.set('tipo_publico', 'ENDOSSOS_RECENTES')
      c3.set('frequencia_dias', 30)
      c3.set('ativo', true)
      c3.set('total_preparados', 0)
      c3.set('total_enviados', 0)
      c3.set('ciclo_passos', [
        {
          ordem: 1,
          tipo: 'educativo',
          tema: 'Como funciona a cobertura de vidros, faróis e retrovisores?',
          titulo: 'Guia de Reparo e Troca de Vidros',
          objetivo:
            'Explicar que trincas ou quebras de vidros têm franquia reduzida e não afetam a classe de bônus.',
        },
      ])
      app.save(c3)
    } catch (e3) {
      console.log('Erro seed campanha 3:', e3)
    }
  },
  (app) => {
    // rollback
  },
)
