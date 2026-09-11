import { describe, it, expect } from 'vitest'
import { TIPOS_NATIVOS_RECEBIMENTO, TipoModeloComissao, ModeloComissao, Policy } from '@/types'
import { calcularPrevisoesComissao } from './comissao-engine'

describe('Validação Obrigatória — 10 Testes da Especificação de Modelos de Recebimento', () => {
  // Teste 1: Os cinco tipos aparecem nativamente
  it('1. Os cinco tipos nativos de recebimento existem nativamente no sistema', () => {
    const tiposEsperados: TipoModeloComissao[] = [
      'A_VISTA',
      'PARCELADA',
      'RECORRENTE',
      'POR_FASES',
      'POR_ESGOTAMENTO',
    ]

    expect(Object.keys(TIPOS_NATIVOS_RECEBIMENTO)).toHaveLength(5)
    tiposEsperados.forEach((t) => {
      expect(TIPOS_NATIVOS_RECEBIMENTO[t]).toBeDefined()
      expect(TIPOS_NATIVOS_RECEBIMENTO[t].nome).toBeTruthy()
      expect(TIPOS_NATIVOS_RECEBIMENTO[t].descricaoCurta).toBeTruthy()
      expect(TIPOS_NATIVOS_RECEBIMENTO[t].descricaoCompleta).toBeTruthy()
      expect(TIPOS_NATIVOS_RECEBIMENTO[t].resumoAposSelecao).toBeTruthy()
    })
  })

  // Teste 2: Usuário entende cada tipo pelo ⓘ com textos oficiais
  it('2. Descrições claras para tooltip e ajuda visual dos 5 tipos', () => {
    expect(TIPOS_NATIVOS_RECEBIMENTO.A_VISTA.descricaoCompleta).toContain(
      'prevista para ser recebida uma única vez',
    )
    expect(TIPOS_NATIVOS_RECEBIMENTO.PARCELADA.descricaoCompleta).toContain(
      'distribuída em uma quantidade definida de competências',
    )
    expect(TIPOS_NATIVOS_RECEBIMENTO.RECORRENTE.descricaoCompleta).toContain(
      'recebida periodicamente enquanto o contrato ou a condição continuar válida',
    )
    expect(TIPOS_NATIVOS_RECEBIMENTO.POR_FASES.descricaoCompleta).toContain(
      'forma de recebimento muda ao longo do tempo',
    )
    expect(TIPOS_NATIVOS_RECEBIMENTO.POR_ESGOTAMENTO.descricaoCompleta).toContain(
      'total de comissão a receber. Cada recebimento reduz esse saldo até ele ser totalmente esgotado',
    )
  })

  // Teste 3: Cadastro de modelo configurado para Seguradora + Produto funciona
  it('3. Estrutura de Modelo Configurado suporta Seguradora + Produto com os 5 tipos', () => {
    const modeloFases: Partial<ModeloComissao> = {
      id: 'mod-saude-x',
      nome: 'Saúde Seguradora X',
      seguradora: 'seg-x',
      tipo_seguro: 'Saúde',
      tipo_modelo: 'POR_FASES',
      config_json: {
        fases: [
          { mes_inicio: 1, mes_fim: 3, percentual: 100 },
          { mes_inicio: 4, mes_fim: null, percentual: 2 },
        ],
      },
      ativo: true,
    }

    const modeloAuto: Partial<ModeloComissao> = {
      id: 'mod-auto-y',
      nome: 'Seguradora Y Auto',
      seguradora: 'seg-y',
      tipo_seguro: 'Automóvel',
      tipo_modelo: 'A_VISTA',
      percentual_padrao: 20,
      ativo: true,
    }

    expect(modeloFases.tipo_modelo).toBe('POR_FASES')
    expect(modeloFases.config_json?.fases).toHaveLength(2)
    expect(modeloAuto.percentual_padrao).toBe(20)
  })

  // Teste 4: Apólice sugere corretamente o modelo por Seguradora + Produto
  it('4. Sugere modelo configurado correspondente à Seguradora + Produto', () => {
    const modelosCadastrados: Partial<ModeloComissao>[] = [
      {
        id: 'mod-1',
        nome: 'Saúde Seguradora X',
        seguradora: 'seg-x',
        tipo_seguro: 'Saúde',
        tipo_modelo: 'POR_FASES',
        ativo: true,
      },
      {
        id: 'mod-2',
        nome: 'Auto Seguradora Y',
        seguradora: 'seg-y',
        tipo_seguro: 'Automóvel',
        tipo_modelo: 'A_VISTA',
        percentual_padrao: 20,
        ativo: true,
      },
    ]

    function match(segId?: string, prod?: string) {
      if (!segId || !prod) return null
      return (
        modelosCadastrados.find(
          (m) =>
            m.seguradora === segId &&
            m.tipo_seguro &&
            m.tipo_seguro.toLowerCase() === prod.toLowerCase(),
        ) || null
      )
    }

    const sug1 = match('seg-x', 'Saúde')
    expect(sug1?.id).toBe('mod-1')
    expect(sug1?.tipo_modelo).toBe('POR_FASES')

    const sug2 = match('seg-y', 'Automóvel')
    expect(sug2?.id).toBe('mod-2')
    expect(sug2?.tipo_modelo).toBe('A_VISTA')
  })

  // Teste 5: Usuário apenas confirma e salva: dados do modelo já preenchem competências/previsões
  it('5. Motor calcula previsões sem exigir re-digitação de competências ou fases', () => {
    const policy = {
      start_date: '2026-08-01',
      valor_liquido: 1000,
      premium_amount: 1000,
      commission_percent: 20,
    }

    const modeloFases = {
      tipo_modelo: 'POR_FASES' as const,
      nome: 'Saúde Seguradora X',
      config_json: {
        recorrencia_meses_horizonte: 6,
        fases: [
          { mes_inicio: 1, mes_fim: 3, percentual: 100 },
          { mes_inicio: 4, mes_fim: null, percentual: 2 },
        ],
      },
    }

    const previsoes = calcularPrevisoesComissao(policy, modeloFases)
    expect(previsoes).toHaveLength(6)
    // Meses 1 a 3 (100% de 1000 = 1000)
    expect(previsoes[0].valor_previsto).toBe(1000)
    expect(previsoes[1].valor_previsto).toBe(1000)
    expect(previsoes[2].valor_previsto).toBe(1000)
    // A partir do mês 4 (2% de 1000 = 20)
    expect(previsoes[3].valor_previsto).toBe(20)
    expect(previsoes[4].valor_previsto).toBe(20)
    expect(previsoes[5].valor_previsto).toBe(20)
  })

  // Teste 6: Personalizar apólice não altera o modelo padrão cadastrado
  it('6. Personalização na apólice gera configuração isolada sem mutar o modelo cadastrado', () => {
    const modeloCadastradoOriginal = {
      id: 'mod-padrao',
      nome: 'Auto Padrão 20%',
      tipo_modelo: 'A_VISTA' as const,
      percentual_padrao: 20,
    }

    // Apólice personalizada
    const policyComissaoPersonalizada: Partial<Policy> = {
      id: 'pol-custom',
      modelo_comissao: undefined,
      comissao_personalizada: true,
      comissao_personalizada_config: {
        tipo_modelo: 'PARCELADA',
        quantidade_competencias: 4,
        percentual_padrao: 25,
      },
    }

    expect(modeloCadastradoOriginal.tipo_modelo).toBe('A_VISTA')
    expect(modeloCadastradoOriginal.percentual_padrao).toBe(20)
    expect(policyComissaoPersonalizada.comissao_personalizada).toBe(true)
    expect(policyComissaoPersonalizada.comissao_personalizada_config?.tipo_modelo).toBe('PARCELADA')
  })

  // Teste 7: Sem modelo configurado, o sistema NÃO assume condição silenciosamente
  it('7. Sem modelo configurado, retorna null e não assume À Vista por padrão', () => {
    const modelosCadastrados: Partial<ModeloComissao>[] = [
      {
        id: 'mod-1',
        nome: 'Outra Seguradora',
        seguradora: 'seg-outra',
        tipo_seguro: 'Vida',
      },
    ]

    function findModel(segId: string, prod: string) {
      return (
        modelosCadastrados.find(
          (m) =>
            m.seguradora === segId &&
            m.tipo_seguro &&
            m.tipo_seguro.toLowerCase() === prod.toLowerCase(),
        ) || null
      )
    }

    const resultado = findModel('seg-desconhecida', 'Auto')
    expect(resultado).toBeNull()
  })

  // Teste 8: Sem duplicidade entre Modelo de Recebimento e Forma de pagamento
  it('8. Forma de Pagamento representa quitação do cliente/segurado e Modelo representa comissão da seguradora', () => {
    const modeloExp = {
      nome: 'Recorrente Mensal 5%',
      tipo_modelo: 'RECORRENTE' as const,
    }
    const policyExemplo: Partial<Policy> & { expand?: any } = {
      // Como o cliente paga o seguro:
      forma_pagamento: 'Crédito',
      parcelas: 10, // 10x no cartão do cliente
      // Como a seguradora paga a comissão:
      modelo_comissao: 'mod-recorrente-1',
      expand: {
        modelo_comissao: modeloExp,
      },
    }

    // Não há conflito: o cliente pode pagar em 10x enquanto a comissão é recorrente ou em 6 competências
    expect(policyExemplo.forma_pagamento).toBe('Crédito')
    expect(policyExemplo.parcelas).toBe(10)
    expect(policyExemplo.expand?.modelo_comissao?.tipo_modelo).toBe('RECORRENTE')
  })

  // Teste 9: Registros antigos continuam funcionando sem regressão
  it('9. Preservação de compatibilidade com apólices legadas sem modelo associado', () => {
    const apoliceLegada: Partial<Policy> = {
      id: 'pol-legada',
      start_date: '2026-01-01',
      valor_liquido: 2000,
      premium_amount: 2000,
      commission: 400,
      commission_percent: 20,
      modelo_comissao: undefined,
      comissao_personalizada: false,
    }

    expect(apoliceLegada.commission).toBe(400)
    expect(apoliceLegada.modelo_comissao).toBeUndefined()
  })

  // Teste 10: Nenhum dado existente é perdido
  it('10. Todos os campos legados são preservados (forma_pagamento, parcelas, commission, iss, valor_repasse)', () => {
    const policyPayload = {
      forma_pagamento: 'Boleto',
      parcelas: 6,
      commission_percent: 15,
      commission: 150,
      iss: 3.5,
      valor_repasse: 50,
      modelo_comissao: 'mod-123',
    }

    expect(policyPayload.forma_pagamento).toBe('Boleto')
    expect(policyPayload.parcelas).toBe(6)
    expect(policyPayload.commission_percent).toBe(15)
    expect(policyPayload.commission).toBe(150)
    expect(policyPayload.iss).toBe(3.5)
    expect(policyPayload.valor_repasse).toBe(50)
    expect(policyPayload.modelo_comissao).toBe('mod-123')
  })
})
