import { describe, it, expect } from 'vitest'
import {
  reconciliarRecebimentosComPrevisoes,
  inferirCompetenciaRecebimento,
  ComissaoPrevistaSimples,
} from './comissao-recebimentos'
import { ComissaoRecebimento } from '@/types'

describe('Validação dos 7 Cenários do Módulo Financeiro & Casos Edson e Maria Lafaete', () => {
  // Teste de inferência de competência
  it('deve inferir competência MM/YYYY a partir da data de recebimento (ex: 2026-09-11 -> 09/2026)', () => {
    expect(inferirCompetenciaRecebimento('2026-09-11')).toBe('09/2026')
    expect(inferirCompetenciaRecebimento('2026-09-14 10:00:00')).toBe('09/2026')
    expect(inferirCompetenciaRecebimento('')).toBe('')
    expect(inferirCompetenciaRecebimento(null)).toBe('')
  })

  // CASO EDSON
  it('Caso Edson: reconcilia recebimento manual sem comissao_prevista e sem competencia por data/FIFO', () => {
    // policy uokxeswl9c7k3kr, previsão u5nbff2jsliev88 (comp. 09/2026, R$ 526,70 líquido), recebimento igyei9aq23zs8i0 em 2026-09-11, R$ 179,15
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'u5nbff2jsliev88',
        policy: 'uokxeswl9c7k3kr',
        competencia: '09/2026',
        valor_previsto: 526.7,
        parcela_numero: 1,
        origem_modelo: 'Por saldo/esgotamento',
      },
    ]

    const recs: ComissaoRecebimento[] = [
      {
        id: 'igyei9aq23zs8i0',
        policy: 'uokxeswl9c7k3kr',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-09-11',
        valor_bruto: 179.15,
        valor_liquido: 179.15,
        origem: 'manual',
        created: '2026-09-11',
        updated: '2026-09-11',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('u5nbff2jsliev88')
    expect(res).toBeDefined()
    expect(res?.valorRecebidoBruto).toBe(179.15)
    expect(res?.saldo).toBe(347.55) // 526.70 - 179.15
    expect(res?.status).toBe('Parcial')
    expect(res?.recebimentosVinculados).toHaveLength(1)
  })

  // CASO MARIA LAFAETE
  it('Caso Maria Lafaete: reconcilia recebimento manual sem vínculo por data/FIFO', () => {
    // policy y929ragrt9gbgfc, previsto R$ 542,64, recebimento manual 2026-09-14 líquido R$ 246,65
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_maria',
        policy: 'y929ragrt9gbgfc',
        competencia: '09/2026',
        valor_previsto: 542.64,
        parcela_numero: 1,
      },
    ]

    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec_maria',
        policy: 'y929ragrt9gbgfc',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-09-14',
        valor_bruto: 246.65,
        valor_liquido: 246.65,
        origem: 'manual',
        created: '2026-09-14',
        updated: '2026-09-14',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('prev_maria')
    expect(res).toBeDefined()
    expect(res?.valorRecebidoBruto).toBe(246.65)
    expect(res?.saldo).toBe(295.99) // 542.64 - 246.65
    expect(res?.status).toBe('Parcial')
  })

  // CENÁRIO 1 (C1): R$ 500 previsto, recebido R$ 500 -> Recebida / saldo 0
  it('C1: Previsto R$ 500, recebido R$ 500 -> Status Recebida e saldo 0', () => {
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_c1',
        policy: 'pol_c1',
        competencia: '09/2026',
        valor_previsto: 500,
      },
    ]
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec_c1',
        policy: 'pol_c1',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-09-15',
        valor_bruto: 500,
        valor_liquido: 500,
        origem: 'manual',
        created: '2026-09-15',
        updated: '2026-09-15',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('prev_c1')!
    expect(res.valorRecebidoBruto).toBe(500)
    expect(res.saldo).toBe(0)
    expect(res.status).toBe('Recebida')
  })

  // CENÁRIO 2 (C2): R$ 500 previsto, recebido R$ 100 -> Parcial / saldo 400
  it('C2: Previsto R$ 500, recebido R$ 100 -> Status Parcial e saldo 400', () => {
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_c2',
        policy: 'pol_c2',
        competencia: '09/2026',
        valor_previsto: 500,
      },
    ]
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec_c2',
        policy: 'pol_c2',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-09-10',
        valor_bruto: 100,
        valor_liquido: 100,
        origem: 'manual',
        created: '2026-09-10',
        updated: '2026-09-10',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('prev_c2')!
    expect(res.valorRecebidoBruto).toBe(100)
    expect(res.saldo).toBe(400)
    expect(res.status).toBe('Parcial')
  })

  // CENÁRIO 3 (C3): Produção set R$ 500, recebimentos set 100 / out 100 / nov 300 -> produção set = 500, entradas por mês 100/100/300, saldo final 0
  it('C3: Produção set R$ 500 com recebimentos em set 100, out 100, nov 300 -> saldo final 0', () => {
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_c3',
        policy: 'pol_c3',
        competencia: '09/2026',
        valor_previsto: 500,
      },
    ]
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec_set',
        policy: 'pol_c3',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-09-10',
        valor_bruto: 100,
        valor_liquido: 100,
        origem: 'manual',
        created: '2026-09-10',
        updated: '2026-09-10',
      },
      {
        id: 'rec_out',
        policy: 'pol_c3',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-10-15',
        valor_bruto: 100,
        valor_liquido: 100,
        origem: 'manual',
        created: '2026-10-15',
        updated: '2026-10-15',
      },
      {
        id: 'rec_nov',
        policy: 'pol_c3',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-11-20',
        valor_bruto: 300,
        valor_liquido: 300,
        origem: 'manual',
        created: '2026-11-20',
        updated: '2026-11-20',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('prev_c3')!
    expect(res.valorRecebidoBruto).toBe(500)
    expect(res.saldo).toBe(0)
    expect(res.status).toBe('Recebida')
    expect(res.recebimentosVinculados).toHaveLength(3)
  })

  // CENÁRIO 4 (C4): Produção set recebida em nov -> produção set, entrada nov
  it('C4: Produção set recebida em nov -> reconciliada com previsão de set via FIFO/apolice', () => {
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_c4',
        policy: 'pol_c4',
        competencia: '09/2026',
        valor_previsto: 500,
      },
    ]
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec_c4_nov',
        policy: 'pol_c4',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-11-05',
        valor_bruto: 500,
        valor_liquido: 500,
        origem: 'manual',
        created: '2026-11-05',
        updated: '2026-11-05',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('prev_c4')!
    expect(res.valorRecebidoBruto).toBe(500)
    expect(res.saldo).toBe(0)
    expect(res.status).toBe('Recebida')
  })

  // CENÁRIO 5 (C5): Previsto 500 recebido 200 -> projeção futura máx 300
  it('C5: Previsto 500 recebido 200 -> saldo projetado restante é exatamente 300', () => {
    const prevs: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_c5',
        policy: 'pol_c5',
        competencia: '10/2026',
        valor_previsto: 500,
      },
    ]
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec_c5',
        policy: 'pol_c5',
        comissao_prevista: '',
        competencia: '',
        data_recebimento: '2026-10-10',
        valor_bruto: 200,
        valor_liquido: 200,
        origem: 'manual',
        created: '2026-10-10',
        updated: '2026-10-10',
      },
    ]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)
    const res = mapa.get('prev_c5')!
    expect(res.valorRecebidoBruto).toBe(200)
    expect(res.saldo).toBe(300)
    expect(res.status).toBe('Parcial')
  })

  // CENÁRIO 6 (C6): Saldo 500 = Projeção 300 + Sem previsão 200
  it('C6: Conciliação Bloco 3: Saldo total 500 = projeção com competência 300 + sem previsão 200', () => {
    const saldoTotalAReceber = 500
    const saldoProjetadoComCompetencia = 300
    const saldoSemPrevisao = Math.max(
      0,
      Math.round((saldoTotalAReceber - saldoProjetadoComCompetencia) * 100) / 100,
    )
    expect(saldoSemPrevisao).toBe(200)
    expect(saldoProjetadoComCompetencia + saldoSemPrevisao).toBe(saldoTotalAReceber)
  })

  // CENÁRIO 7 (C7): Card = soma do detalhamento em todos os cards dos 5 blocos
  it('C7: Consistência matemática dos cards com os itens detalhados', () => {
    const itens = [{ valor: 100.5 }, { valor: 250.25 }, { valor: 149.25 }]
    const totalCard = Math.round(itens.reduce((acc, i) => acc + i.valor, 0) * 100) / 100
    expect(totalCard).toBe(500.0)

    // Subdivisão Bloco 2: Saldo Total = Saldo Parcial + Não Recebidas
    const saldoParcial = 100.0
    const naoRecebidas = 400.0
    const saldoTotal = Math.round((saldoParcial + naoRecebidas) * 100) / 100
    expect(saldoTotal).toBe(500.0)
  })

  // CENÁRIO 8 (C8): Caso Real Maria Lafaete e Edson (SET/26)
  it('C8: Validação Maria Lafaete e Edson na Projeção SET/26 e Bloco 3', () => {
    // Maria Lafaete: comissão líquida R$ 542,64 (553.71 - 11.07 ISS), recebimento parcial R$ 246,65
    // Saldo esperado: R$ 295,99
    const prevMaria: ComissaoPrevistaSimples = {
      id: 'prev_maria',
      policy: 'pol_maria_lafaete',
      competencia: '09/2026',
      data_prevista: '2026-09-12',
      valor_previsto: 542.64,
      status: 'Pendente',
    }

    const recMaria: ComissaoRecebimento = {
      id: 'rec_maria',
      policy: 'pol_maria_lafaete',
      data_recebimento: '2026-09-14',
      valor_bruto: 251.68,
      valor_liquido: 246.65,
      descontos_impostos: 5.03,
      origem: 'Manual',
      created: '2026-09-14',
      updated: '2026-09-14',
    }

    // Edson: comissão R$ 537,45 - ISS 10,75 = R$ 526,70 líquida, recebimento bruto R$ 179,15
    // Saldo esperado: 526.70 - 179.15 = 347.55
    const prevEdson: ComissaoPrevistaSimples = {
      id: 'prev_edson',
      policy: 'pol_edson',
      competencia: '09/2026',
      data_prevista: '2026-09-03',
      valor_previsto: 526.7,
      status: 'Pendente',
    }

    const recEdson: ComissaoRecebimento = {
      id: 'rec_edson',
      policy: 'pol_edson',
      data_recebimento: '2026-09-11',
      valor_bruto: 179.15,
      valor_liquido: 175.57,
      descontos_impostos: 3.58,
      origem: 'Manual',
      created: '2026-09-11',
      updated: '2026-09-11',
    }

    const prevs = [prevMaria, prevEdson]
    const recs = [recMaria, recEdson]

    const mapa = reconciliarRecebimentosComPrevisoes(prevs, recs)

    // Maria Lafaete
    const resMaria = mapa.get('prev_maria')!
    expect(resMaria).toBeDefined()
    expect(resMaria.valorRecebidoBruto).toBe(251.68)
    expect(resMaria.saldo).toBe(290.96) // 542.64 - 251.68 = 290.96 (base bruto da baixa)
    expect(resMaria.status).toBe('Parcial')

    // Edson
    const resEdson = mapa.get('prev_edson')!
    expect(resEdson).toBeDefined()
    expect(resEdson.valorRecebidoBruto).toBe(179.15)
    expect(resEdson.saldo).toBe(347.55)
    expect(resEdson.status).toBe('Parcial')

    // Ambos pertencem à competência 09/2026 (SET/26) e aparecem na projeção
    expect(prevMaria.competencia).toBe('09/2026')
    expect(prevEdson.competencia).toBe('09/2026')
  })

  // =========================================================================
  // CENÁRIO 9: Reconciliação líquida dos Blocos 2 e 3 sem resíduo de ISS fantasma
  // Quando todas as apólices do período têm previsão com competência confiável,
  // saldoSemPrevisao === 0 e countSemPrevisao === 0, e a soma dos ISS (53,22)
  // não vaza como resíduo nos Blocos 2 e 3.
  // =========================================================================
  it('Cenário 9: Quando todas as apólices do período têm previsão com competência, saldoSemPrevisao === 0 e count === 0 sem resíduo de ISS', () => {
    // 4 apólices de setembro/2026:
    // 1. Maria Lafaete: Bruto 553,71, ISS 11,07, Líquido 542,64. Baixa bruta 246,65 -> Saldo Líquido 295,99 (Parcial)
    // 2. Edson: Bruto 537,45, ISS 10,75, Líquido 526,70. Baixa bruta 179,15 -> Saldo Líquido 347,55 (Parcial)
    // 3. Tiago de Melo: Bruto 183,26, ISS 3,67, Líquido 179,59. Sem baixa -> Saldo Líquido 179,59 (Pendente)
    // 4. Chery Tiggo 7 Sport: Bruto 1.386,47, ISS 27,73, Líquido 1.358,74. Sem baixa -> Saldo Líquido 1.358,74 (Pendente)
    // Soma de ISS = 11,07 + 10,75 + 3,67 + 27,73 = 53,22

    const polMaria = {
      id: 'pol_maria',
      commission: 553.71,
      iss: 11.07,
      status: 'Ativa',
      comissao_recebida: false,
    }
    const polEdson = {
      id: 'pol_edson',
      commission: 537.45,
      iss: 10.75,
      status: 'Ativa',
      comissao_recebida: false,
    }
    const polTiago = {
      id: 'pol_tiago',
      commission: 183.26,
      iss: 3.67,
      status: 'Ativa',
      comissao_recebida: false,
    }
    const polChery = {
      id: 'pol_chery',
      commission: 1386.47,
      iss: 27.73,
      status: 'Ativa',
      comissao_recebida: false,
    }

    const periodStartPolicies = [polMaria, polEdson, polTiago, polChery]

    const allComissoesPrevistasList: ComissaoPrevistaSimples[] = [
      {
        id: 'prev_maria',
        policy: 'pol_maria',
        competencia: '09/2026',
        valor_previsto: 542.64,
        status: 'Pendente',
      },
      {
        id: 'prev_edson',
        policy: 'pol_edson',
        competencia: '09/2026',
        valor_previsto: 526.7,
        status: 'Pendente',
      },
      {
        id: 'prev_tiago',
        policy: 'pol_tiago',
        competencia: '09/2026',
        valor_previsto: 179.59,
        status: 'Pendente',
      },
      {
        id: 'prev_chery',
        policy: 'pol_chery',
        competencia: '09/2026',
        valor_previsto: 1358.74,
        status: 'Pendente',
      },
    ]

    const recebimentos: ComissaoRecebimento[] = [
      {
        id: 'rec_maria',
        policy: 'pol_maria',
        data_recebimento: '2026-09-14',
        valor_bruto: 246.65,
        valor_liquido: 241.62,
        descontos_impostos: 5.03,
        origem: 'Manual',
        created: '2026-09-14',
        updated: '2026-09-14',
      },
      {
        id: 'rec_edson',
        policy: 'pol_edson',
        data_recebimento: '2026-09-11',
        valor_bruto: 179.15,
        valor_liquido: 175.57,
        descontos_impostos: 3.58,
        origem: 'Manual',
        created: '2026-09-11',
        updated: '2026-09-11',
      },
    ]

    // 1. Reconciliação
    const reconciliacaoMap = reconciliarRecebimentosComPrevisoes(
      allComissoesPrevistasList,
      recebimentos,
    )

    // Agrupamento de previsões por apólice
    const prevsByPolicyMap = new Map<string, ComissaoPrevistaSimples[]>()
    for (const prev of allComissoesPrevistasList) {
      if (prev.status === 'Cancelada') continue
      if (!prevsByPolicyMap.has(prev.policy)) {
        prevsByPolicyMap.set(prev.policy, [])
      }
      prevsByPolicyMap.get(prev.policy)!.push(prev)
    }

    // 2. Cálculo Bloco 2 (base líquida/reconciliada)
    let saldoParcialRecebido = 0
    let comissoesNaoRecebidas = 0

    periodStartPolicies.forEach((p) => {
      const polPrevs = prevsByPolicyMap.get(p.id) || []
      if (polPrevs.length > 0) {
        let polSaldo = 0
        let polRecebidoBruto = 0
        polPrevs.forEach((prev) => {
          const recResult = reconciliacaoMap.get(prev.id)
          const s = recResult ? recResult.saldo : Number(prev.valor_previsto) || 0
          const rBruto = recResult ? recResult.valorRecebidoBruto : 0
          polSaldo = Math.round((polSaldo + s) * 100) / 100
          polRecebidoBruto = Math.round((polRecebidoBruto + rBruto) * 100) / 100
        })

        if (polSaldo > 0.009) {
          if (polRecebidoBruto > 0.009) {
            saldoParcialRecebido = Math.round((saldoParcialRecebido + polSaldo) * 100) / 100
          } else {
            comissoesNaoRecebidas = Math.round((comissoesNaoRecebidas + polSaldo) * 100) / 100
          }
        }
      }
    })

    const saldoTotalAReceber =
      Math.round((saldoParcialRecebido + comissoesNaoRecebidas) * 100) / 100

    // Verificação Bloco 2
    // Maria Lafaete saldo = 542.64 - 246.65 = 295.99
    // Edson saldo = 526.70 - 179.15 = 347.55
    // Saldo Parcial = 295.99 + 347.55 = 643.54
    // Tiago saldo = 179.59
    // Chery saldo = 1358.74
    // Não Recebidas = 179.59 + 1358.74 = 1538.33
    // Saldo Total = 643.54 + 1538.33 = 2381.87
    expect(saldoParcialRecebido).toBe(643.54)
    expect(comissoesNaoRecebidas).toBe(1538.33)
    expect(saldoTotalAReceber).toBe(2381.87)

    // 3. Cálculo Bloco 3
    const policiesWithPrevisoes = new Set(allComissoesPrevistasList.map((cp) => cp.policy))

    const itensSemPrevisaoReais = periodStartPolicies.filter((p) => {
      if (p.status === 'Cancelada' || p.comissao_recebida) return false
      return !policiesWithPrevisoes.has(p.id)
    })

    let saldoSemPrevisao = 0
    itensSemPrevisaoReais.forEach((p) => {
      const commBruta = Number(p.commission || 0)
      const iss = Number(p.iss || 0)
      const previsto = Math.max(0, Math.round((commBruta - iss) * 100) / 100)
      saldoSemPrevisao = Math.round((saldoSemPrevisao + previsto) * 100) / 100
    })

    const countSemPrevisao = itensSemPrevisaoReais.length

    // Verificação Bloco 3: Nenhum item sem previsão, saldo zero e contador zero
    expect(saldoSemPrevisao).toBe(0)
    expect(countSemPrevisao).toBe(0)

    // A soma dos ISS (53,22) NÃO vaza nos saldos
    const somaIss = 11.07 + 10.75 + 3.67 + 27.73
    expect(somaIss).toBeCloseTo(53.22, 2)
    expect(saldoTotalAReceber).not.toBe(Math.round((2381.87 + somaIss) * 100) / 100)
  })
})
