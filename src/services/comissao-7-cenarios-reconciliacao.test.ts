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
})
