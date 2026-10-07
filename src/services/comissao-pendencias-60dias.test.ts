import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import {
  computePendenciasComissao60,
  getFirstDayFromCompetencia,
  calculateElapsedDays,
} from '@/lib/financial-calcs'
import { dispensarAlertaComissao60, dispensarAlertaComissao60Batch } from './policies'
import pb from '@/lib/pocketbase/client'
import { Policy, ComissaoPrevista, ComissaoRecebimento } from '@/types'

describe('Comissão sem baixa há mais de 60 dias (computePendenciasComissao60)', () => {
  const todaySimulado = '2026-06-01'

  it('normaliza competência MM/AAAA para o 1º dia do mês', () => {
    expect(getFirstDayFromCompetencia('03/2026')).toBe('2026-03-01')
    expect(getFirstDayFromCompetencia('1/2026')).toBe('2026-01-01')
    expect(getFirstDayFromCompetencia('12/2025')).toBe('2025-12-01')
    expect(getFirstDayFromCompetencia('invalido')).toBeNull()
    expect(getFirstDayFromCompetencia(undefined)).toBeNull()
  })

  it('calcula dias corridos corretamente', () => {
    // 2026-06-01 - 2026-04-02: abril tem 30 dias -> do dia 2/4 até 1/6 são 28 + 31 + 1 = 60 dias
    expect(calculateElapsedDays('2026-04-02', todaySimulado)).toBe(60)
    // 2026-04-01 -> 61 dias
    expect(calculateElapsedDays('2026-04-01', todaySimulado)).toBe(61)
  })

  it('edge case de dias: exatamente 60 dias NÃO alerta; 61 alerta', () => {
    // Referência em 2026-04-02 -> exatamente 60 dias em 2026-06-01
    const pol60: Policy = {
      id: 'p-60',
      policy_code: 101,
      start_date: '2026-04-02',
      commission: 500,
      status: 'Ativa',
    } as any

    // Referência em 2026-04-01 -> 61 dias em 2026-06-01
    const pol61: Policy = {
      id: 'p-61',
      policy_code: 102,
      start_date: '2026-04-01',
      commission: 600,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([pol60, pol61], [], [], todaySimulado)
    expect(res.countApolices).toBe(1)
    expect(res.itens[0].policy.id).toBe('p-61')
    expect(res.itens[0].diasParados).toBe(61)
    expect(res.itens[0].saldoPendente).toBe(600)
    expect(res.totalValorPendente).toBe(600)
  })

  it('apólice com competência MM/AAAA usa o 1º dia do mês como referência', () => {
    // Competência 03/2026 -> 1º dia é 2026-03-01. Em 2026-06-01 decorreram 92 dias.
    const pol: Policy = {
      id: 'p-comp',
      policy_code: 200,
      start_date: '2026-05-15', // start_date recente (17 dias), mas parcela é de 03/2026
      status: 'Ativa',
    } as any

    const prev: ComissaoPrevista = {
      id: 'prev-1',
      policy: 'p-comp',
      competencia: '03/2026',
      valor_previsto: 1200,
      status: 'Pendente',
    } as any

    const res = computePendenciasComissao60([pol], [], [prev], todaySimulado)
    expect(res.countApolices).toBe(1)
    expect(res.itens[0].origemReferencia).toBe('competencia')
    expect(res.itens[0].dataReferencia).toBe('2026-03-01')
    expect(res.itens[0].diasParados).toBe(92)
    expect(res.itens[0].saldoPendente).toBe(1200)
  })

  it('Cenário 1: Apólice legada/marcada com comissao_recebida=true NÃO entra no alerta (mesmo com atraso de mais de 60 dias)', () => {
    const polLegadaRecebida: Policy = {
      id: 'p-legada-recebida',
      policy_code: 400,
      start_date: '2025-01-01', // >500 dias
      commission: 1500,
      comissao_recebida: true,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([polLegadaRecebida], [], [], todaySimulado)
    expect(res.countApolices).toBe(0)
    expect(res.itens).toHaveLength(0)
    expect(res.totalValorPendente).toBe(0)

    // Com previsões em aberto mas comissao_recebida=true na apólice, continua fora
    const prevPendente: ComissaoPrevista = {
      id: 'prev-p400',
      policy: 'p-legada-recebida',
      competencia: '01/2025',
      valor_previsto: 1500,
      status: 'Pendente',
    } as any

    const resComPrev = computePendenciasComissao60(
      [polLegadaRecebida],
      [],
      [prevPendente],
      todaySimulado,
    )
    expect(resComPrev.countApolices).toBe(0)
  })

  it('Cenário 2: Apólice com status "Cancelada" NÃO entra no alerta', () => {
    const polCancelada: Policy = {
      id: 'p-canc',
      policy_code: 300,
      start_date: '2025-01-01', // mais de 500 dias
      commission: 2000,
      status: 'Cancelada',
    } as any

    const prevCancelada: ComissaoPrevista = {
      id: 'prev-canc',
      policy: 'p-canc',
      competencia: '01/2025',
      valor_previsto: 2000,
      status: 'Pendente',
    } as any

    const res = computePendenciasComissao60([polCancelada], [], [prevCancelada], todaySimulado)
    expect(res.countApolices).toBe(0)
    expect(res.itens).toHaveLength(0)
    expect(res.totalValorPendente).toBe(0)
  })

  it('Cenário 3: Apólice com comissao_alerta_60d_ignorado=true NÃO entra no alerta — e volta a entrar se o flag for removido (false)', () => {
    const polIgnorada: Policy = {
      id: 'p-ign',
      policy_code: 350,
      start_date: '2026-01-01', // ~150 dias
      commission: 1000,
      status: 'Ativa',
      comissao_alerta_60d_ignorado: true,
      comissao_alerta_60d_ignorado_data: '2026-05-10',
      comissao_alerta_60d_ignorado_motivo: 'Dispensado manualmente pelo usuário',
    } as any

    // 1. Enquanto ignorado=true -> NÃO deve entrar
    const resIgnorada = computePendenciasComissao60([polIgnorada], [], [], todaySimulado)
    expect(resIgnorada.countApolices).toBe(0)
    expect(resIgnorada.itens).toHaveLength(0)
    expect(resIgnorada.totalValorPendente).toBe(0)

    // 2. Se o flag for removido (false ou undefined), volta a entrar no alerta imediatamente
    const polReativada: Policy = {
      ...polIgnorada,
      comissao_alerta_60d_ignorado: false,
    }
    const resReativada = computePendenciasComissao60([polReativada], [], [], todaySimulado)
    expect(resReativada.countApolices).toBe(1)
    expect(resReativada.itens[0].policy.id).toBe('p-ign')
    expect(resReativada.itens[0].saldoPendente).toBe(1000)
    expect(resReativada.itens[0].diasParados).toBe(151)
    expect(resReativada.totalValorPendente).toBe(1000)
  })

  it('Cenário 4: Previsões quitadas vs em aberto, dias parados por competência/vigência e borda 60 vs 61 dias', () => {
    // 4.a: Apólice com todas as previsões 'Recebida' NÃO entra
    const polQuitadaPrevs: Policy = {
      id: 'p-todas-rec',
      policy_code: 401,
      start_date: '2026-01-01',
      commission: 1000,
      status: 'Ativa',
    } as any

    const prevsRecebidas: ComissaoPrevista[] = [
      {
        id: 'pr-1',
        policy: 'p-todas-rec',
        competencia: '01/2026',
        valor_previsto: 500,
        status: 'Recebida',
      } as any,
      {
        id: 'pr-2',
        policy: 'p-todas-rec',
        competencia: '02/2026',
        valor_previsto: 500,
        status: 'Recebida',
      } as any,
    ]

    const resTodasRec = computePendenciasComissao60(
      [polQuitadaPrevs],
      [],
      prevsRecebidas,
      todaySimulado,
    )
    expect(resTodasRec.countApolices).toBe(0)

    // 4.b: Apólice com pelo menos uma previsão em aberto e competência > 60 dias entra
    // Dias calculados a partir da competência (1º dia do mês)
    const polComAberta: Policy = {
      id: 'p-parc-aberta',
      policy_code: 402,
      start_date: '2026-05-10', // vigência recente (22 dias)
      commission: 1000,
      status: 'Ativa',
    } as any

    const prevsMistas: ComissaoPrevista[] = [
      {
        id: 'pr-m1',
        policy: 'p-parc-aberta',
        competencia: '03/2026', // 1º dia: 2026-03-01 -> 92 dias até 2026-06-01
        valor_previsto: 500,
        status: 'Pendente',
      } as any,
      {
        id: 'pr-m2',
        policy: 'p-parc-aberta',
        competencia: '04/2026',
        valor_previsto: 500,
        status: 'Recebida',
      } as any,
    ]

    const resMistas = computePendenciasComissao60([polComAberta], [], prevsMistas, todaySimulado)
    expect(resMistas.countApolices).toBe(1)
    expect(resMistas.itens[0].policy.id).toBe('p-parc-aberta')
    expect(resMistas.itens[0].origemReferencia).toBe('competencia')
    expect(resMistas.itens[0].dataReferencia).toBe('2026-03-01')
    expect(resMistas.itens[0].diasParados).toBe(92)
    expect(resMistas.itens[0].saldoPendente).toBe(500)
    expect(resMistas.itens[0].competenciaSugerida).toBe('03/2026')

    // 4.c: Quando não há competência, usa vigência (start_date)
    const polSemComp: Policy = {
      id: 'p-sem-comp',
      policy_code: 403,
      start_date: '2026-03-10', // 2026-03-10 até 2026-06-01 = 83 dias
      commission: 750,
      status: 'Ativa',
    } as any

    const resSemComp = computePendenciasComissao60([polSemComp], [], [], todaySimulado)
    expect(resSemComp.countApolices).toBe(1)
    expect(resSemComp.itens[0].origemReferencia).toBe('start_date')
    expect(resSemComp.itens[0].dataReferencia).toBe('2026-03-10')
    expect(resSemComp.itens[0].diasParados).toBe(83)
    expect(resSemComp.itens[0].saldoPendente).toBe(750)

    // 4.d: Exatamente 60 dias NÃO alerta; 61 dias alerta
    const polExatos60: Policy = {
      id: 'p-exatos-60',
      policy_code: 404,
      start_date: '2026-04-02', // 2026-04-02 a 2026-06-01: 28 (abr) + 31 (mai) + 1 (jun) = exatamente 60 dias
      commission: 600,
      status: 'Ativa',
    } as any

    const polExatos61: Policy = {
      id: 'p-exatos-61',
      policy_code: 405,
      start_date: '2026-04-01', // 2026-04-01 a 2026-06-01: 29 (abr) + 31 (mai) + 1 (jun) = 61 dias
      commission: 610,
      status: 'Ativa',
    } as any

    const resBorda = computePendenciasComissao60([polExatos60, polExatos61], [], [], todaySimulado)
    expect(resBorda.countApolices).toBe(1)
    expect(resBorda.itens[0].policy.id).toBe('p-exatos-61')
    expect(resBorda.itens[0].diasParados).toBe(61)
    expect(resBorda.itens[0].saldoPendente).toBe(610)
  })

  it('Cenário 5: FIFO de recebimentos — recebimento sem vínculo abate saldo em sequência e apólice totalmente coberta sai do alerta', () => {
    // Apólice com 3 previsões de R$ 300 cada (total R$ 900)
    // Parcela 1: 01/2026 (>60 dias)
    // Parcela 2: 02/2026 (>60 dias)
    // Parcela 3: 03/2026 (>60 dias)
    const pol: Policy = {
      id: 'p-fifo',
      policy_code: 501,
      start_date: '2026-01-01',
      commission: 900,
      status: 'Ativa',
    } as any

    const prev1: ComissaoPrevista = {
      id: 'prev-fifo-1',
      policy: 'p-fifo',
      competencia: '01/2026',
      valor_previsto: 300,
      status: 'Pendente',
    } as any

    const prev2: ComissaoPrevista = {
      id: 'prev-fifo-2',
      policy: 'p-fifo',
      competencia: '02/2026',
      valor_previsto: 300,
      status: 'Pendente',
    } as any

    const prev3: ComissaoPrevista = {
      id: 'prev-fifo-3',
      policy: 'p-fifo',
      competencia: '03/2026',
      valor_previsto: 300,
      status: 'Pendente',
    } as any

    const prevs = [prev1, prev2, prev3]

    // 5.a: Sem nenhum recebimento -> alerta total de R$ 900 apontando para a competência mais antiga (01/2026)
    const resSemRec = computePendenciasComissao60([pol], [], prevs, todaySimulado)
    expect(resSemRec.countApolices).toBe(1)
    expect(resSemRec.itens[0].saldoPendente).toBe(900)
    expect(resSemRec.itens[0].competenciaSugerida).toBe('01/2026')
    expect(resSemRec.itens[0].dataReferencia).toBe('2026-01-01')

    // 5.b: Recebimento global sem vínculo de R$ 300 -> abate FIFO a prev1 (01/2026),
    // restando prev2 (02/2026) e prev3 (03/2026). Competência sugerida agora deve ser 02/2026!
    const recGlobal300: ComissaoRecebimento = {
      id: 'rec-glob-1',
      policy: 'p-fifo',
      comissao_prevista: '', // SEM vínculo direto
      valor_bruto: 300,
      valor_liquido: 300,
      data_recebimento: '2026-01-20',
    } as any

    const resParcial300 = computePendenciasComissao60([pol], [recGlobal300], prevs, todaySimulado)
    expect(resParcial300.countApolices).toBe(1)
    expect(resParcial300.itens[0].saldoPendente).toBe(600)
    expect(resParcial300.itens[0].competenciaSugerida).toBe('02/2026')
    expect(resParcial300.itens[0].dataReferencia).toBe('2026-02-01')

    // 5.c: Recebimento global adicional de R$ 400 (total recebido R$ 700):
    // prev1 (300) quitada, prev2 (300) quitada, prev3 sobra saldo de R$ 200.
    // Competência sugerida passa a ser 03/2026!
    const recGlobal400: ComissaoRecebimento = {
      id: 'rec-glob-2',
      policy: 'p-fifo',
      comissao_prevista: '',
      valor_bruto: 400,
      valor_liquido: 400,
      data_recebimento: '2026-02-15',
    } as any

    const resParcial700 = computePendenciasComissao60(
      [pol],
      [recGlobal300, recGlobal400],
      prevs,
      todaySimulado,
    )
    expect(resParcial700.countApolices).toBe(1)
    expect(resParcial700.itens[0].saldoPendente).toBe(200)
    expect(resParcial700.itens[0].competenciaSugerida).toBe('03/2026')
    expect(resParcial700.itens[0].dataReferencia).toBe('2026-03-01')

    // 5.d: Apólice totalmente coberta por recebimentos globais (mais R$ 200, total R$ 900)
    // SAI completamente do alerta!
    const recGlobal200: ComissaoRecebimento = {
      id: 'rec-glob-3',
      policy: 'p-fifo',
      comissao_prevista: '',
      valor_bruto: 200,
      valor_liquido: 200,
      data_recebimento: '2026-03-10',
    } as any

    const resTotal900 = computePendenciasComissao60(
      [pol],
      [recGlobal300, recGlobal400, recGlobal200],
      prevs,
      todaySimulado,
    )
    expect(resTotal900.countApolices).toBe(0)
    expect(resTotal900.itens).toHaveLength(0)
    expect(resTotal900.totalValorPendente).toBe(0)
  })

  it('ordena as pendências da mais antiga para a mais recente', () => {
    const pol1: Policy = {
      id: 'p-1',
      policy_code: 1,
      start_date: '2026-02-01', // ~120 dias
      commission: 100,
      status: 'Ativa',
    } as any

    const pol2: Policy = {
      id: 'p-2',
      policy_code: 2,
      start_date: '2026-01-01', // ~151 dias (mais antiga)
      commission: 200,
      status: 'Ativa',
    } as any

    const pol3: Policy = {
      id: 'p-3',
      policy_code: 3,
      start_date: '2026-03-15', // ~78 dias
      commission: 300,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([pol1, pol2, pol3], [], [], todaySimulado)
    expect(res.countApolices).toBe(3)
    expect(res.itens[0].policy.id).toBe('p-2') // 151 dias
    expect(res.itens[1].policy.id).toBe('p-1') // 120 dias
    expect(res.itens[2].policy.id).toBe('p-3') // 78 dias
    expect(res.totalValorPendente).toBe(600)
  })

  it('fallback para created quando start_date e competência estão ausentes', () => {
    const polCreated: Policy = {
      id: 'p-created',
      policy_code: 500,
      created: '2026-01-15T10:00:00Z',
      commission: 450,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([polCreated], [], [], todaySimulado)
    expect(res.countApolices).toBe(1)
    expect(res.itens[0].origemReferencia).toBe('created')
    expect(res.itens[0].dataReferencia).toBe('2026-01-15')
    expect(res.itens[0].diasParados).toBe(137)
  })

  describe('Funções de dispensa de alerta (dispensarAlertaComissao60 / Batch)', () => {
    it('dispensarAlertaComissao60 atualiza campos comissao_alerta_60d_ignorado na coleção policies', async () => {
      const updateSpy = vi.spyOn(pb.collection('policies'), 'update').mockResolvedValueOnce({
        id: 'p-123',
        comissao_alerta_60d_ignorado: true,
      } as any)

      await dispensarAlertaComissao60('p-123', 'Motivo customizado')

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith(
        'p-123',
        expect.objectContaining({
          comissao_alerta_60d_ignorado: true,
          comissao_alerta_60d_ignorado_motivo: 'Motivo customizado',
        }),
      )
      updateSpy.mockRestore()
    })

    it('dispensarAlertaComissao60Batch atualiza múltiplas apólices e retorna a contagem de sucessos', async () => {
      const updateSpy = vi
        .spyOn(pb.collection('policies'), 'update')
        .mockResolvedValueOnce({ id: 'p-1' } as any)
        .mockResolvedValueOnce({ id: 'p-2' } as any)
        .mockRejectedValueOnce(new Error('Falha no banco'))

      const count = await dispensarAlertaComissao60Batch(['p-1', 'p-2', 'p-3'])

      expect(updateSpy).toHaveBeenCalledTimes(3)
      expect(count).toBe(2)
      updateSpy.mockRestore()
    })
  })
})
