import { describe, it, expect } from 'vitest'
import { calcularPrevisoesComissao } from './comissao-engine'

describe('Motor de Cálculo de Previsões de Comissão (5 Modelos)', () => {
  const basePolicy = {
    start_date: '2026-08-01',
    valor_liquido: 1000,
    premium_amount: 1000,
    commission_percent: 20,
    commission: 200,
  }

  // MODELO 1: À VISTA
  // Exemplo da spec: Prêmio líquido R$ 1.000, comissão 20% → previsão R$ 200 em 1 competência.
  it('1. À VISTA: gera 1 única previsão de R$ 200 (20% de R$ 1.000)', () => {
    const res = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'A_VISTA',
      percentual_padrao: 20,
      nome: 'À Vista Padrão',
    })

    expect(res).toHaveLength(1)
    expect(res[0].valor_previsto).toBe(200)
    expect(res[0].competencia).toBe('08/2026')
    expect(res[0].parcela_numero).toBe(1)
  })

  // MODELO 2: PARCELADA
  // Exemplo da spec: 7 competências. Deve permitir informar percentuais/valores ou distribuir sem assumir mesmo %
  it('2. PARCELADA: gera 7 competências distribuídas corretamente', () => {
    const res = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'PARCELADA',
      percentual_padrao: 20,
      nome: 'Parcelada 7x',
      config_json: {
        quantidade_competencias: 7,
      },
    })

    expect(res).toHaveLength(7)
    const soma = res.reduce((acc, p) => acc + p.valor_previsto, 0)
    expect(Math.round(soma * 100) / 100).toBe(200)
    expect(res[0].competencia).toBe('08/2026')
    expect(res[6].competencia).toBe('02/2027')
  })

  // MODELO 2b: PARCELADA com percentuais customizados por competência
  it('2b. PARCELADA com percentuais diferentes por competência', () => {
    const res = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'PARCELADA',
      nome: 'Parcelada Custom',
      config_json: {
        quantidade_competencias: 3,
        parcelas: [
          { numero: 1, percentual: 10 }, // R$ 100
          { numero: 2, percentual: 6 }, // R$ 60
          { numero: 3, percentual: 4 }, // R$ 40
        ],
      },
    })

    expect(res).toHaveLength(3)
    expect(res[0].valor_previsto).toBe(100)
    expect(res[1].valor_previsto).toBe(60)
    expect(res[2].valor_previsto).toBe(40)
  })

  // MODELO 3: RECORRENTE
  // Exemplo da spec: 5% mensal. Gera horizonte razoável (12 meses), não infinito.
  it('3. RECORRENTE: gera horizonte de 12 meses com 5% mensal (R$ 50)', () => {
    const res = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'RECORRENTE',
      nome: 'Saúde Recorrente',
      config_json: {
        recorrencia_meses_horizonte: 12,
        percentual_recorrente: 5,
      },
    })

    expect(res).toHaveLength(12)
    expect(res[0].valor_previsto).toBe(50)
    expect(res[11].valor_previsto).toBe(50)
    expect(res[0].competencia).toBe('08/2026')
    expect(res[11].competencia).toBe('07/2027')
  })

  // MODELO 4: POR FASES
  // Exemplo da spec: 1º ao 3º mês 100%; a partir do 4º mês 2%.
  it('4. POR FASES: Mês 1 a 3: 100% (R$ 1.000); Mês 4 em diante: 2% (R$ 20)', () => {
    const res = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'POR_FASES',
      nome: 'Vida Fases',
      config_json: {
        fases: [
          { mes_inicio: 1, mes_fim: 3, percentual: 100 },
          { mes_inicio: 4, mes_fim: null, percentual: 2 },
        ],
        recorrencia_meses_horizonte: 6,
      },
    })

    expect(res).toHaveLength(6)
    // Mês 1 a 3: 100%
    expect(res[0].valor_previsto).toBe(1000)
    expect(res[1].valor_previsto).toBe(1000)
    expect(res[2].valor_previsto).toBe(1000)
    // Mês 4 a 6: 2%
    expect(res[3].valor_previsto).toBe(20)
    expect(res[4].valor_previsto).toBe(20)
    expect(res[5].valor_previsto).toBe(20)
  })

  // MODELO 5: POR SALDO / ESGOTAMENTO
  // Exemplo da spec: Total R$ 1.000, parcelas de consumo até esgotar o saldo
  it('5. POR SALDO / ESGOTAMENTO: R$ 1.000 com parcelas de R$ 300 consome até zerar o saldo', () => {
    const res = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'POR_ESGOTAMENTO',
      nome: 'Consórcio Esgotamento',
      config_json: {
        saldo_total: 1000,
        valor_estimado_parcela: 300,
      },
    })

    // 1000 = 300 + 300 + 300 + 100 = 4 parcelas
    expect(res).toHaveLength(4)
    expect(res[0].valor_previsto).toBe(300)
    expect(res[1].valor_previsto).toBe(300)
    expect(res[2].valor_previsto).toBe(300)
    expect(res[3].valor_previsto).toBe(100)

    const soma = res.reduce((acc, p) => acc + p.valor_previsto, 0)
    expect(soma).toBe(1000)
  })
})
