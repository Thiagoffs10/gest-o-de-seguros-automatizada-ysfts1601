import { describe, it, expect } from 'vitest'
import { parseExtratoSeguradora, detectarFormatoExtrato } from './extrato-parsers'
import { parseCsvText } from './spreadsheet-reader'
import { parsePropostaTexto, detectarFormatoProposta } from './proposta-parsers'
import { registrarRecebimentoLegado, registrarLinhasComoLegadoEmLote } from './recebimentos-legados'
import { gerarIdempotencyHash, LinhaConferida } from './extrato-service'
import pb from '@/lib/pocketbase/client'

describe('Fluxo de Automação de Entrada - Extratos e Propostas', () => {
  // =========================================================================
  // PARTE 1: TESTES DOS FORMATOS DE EXTRATO DE COMISSÃO
  // =========================================================================
  describe('Extratos de Comissões (Parsers Determinísticos)', () => {
    it('(a) Porto Seguro: detecta formato, lê linhas por proposta/apólice e extrai totais do rodapé', () => {
      const csvPorto = `
PORTO SEGURO CIA DE SEGUROS
ORDEM DE PAGAMENTO: OP-882319-2026
DATA DO PAGAMENTO: 25/09/2026
PROPOSTA;PARCELA;DATA;PREMIO LIQUIDO;TAXA;COMISSAO BRUTA;IMPOSTOS;LIQUIDO A PAGAR
6313942213;1/4;25/09/2026;2.450,00;15,00;367,50;18,37;349,13
6313942214;2/4;25/09/2026;1.800,00;15,00;270,00;13,50;256,50
TOTAL BRUTO: 637,50
TOTAL LIQUIDO A PAGAR: 605,63
      `.trim()

      const rows = parseCsvText(csvPorto)
      const res = parseExtratoSeguradora(rows, 'porto-939e3.xlsx')

      expect(res.formato).toBe('PORTO_SEGURO')
      expect(res.seguradoraNomeSugerida).toBe('Porto Seguro')
      expect(res.linhasValidasParaBaixa.length).toBe(2)
      expect(res.linhasValidasParaBaixa[0].numeroProposta).toBe('6313942213')
      expect(res.linhasValidasParaBaixa[0].parcela).toBe(1)
      expect(res.linhasValidasParaBaixa[0].liquidoPago).toBe(349.13)
      expect(res.checksumEsperado?.ordemPagamento).toBe('OP-882319-2026')
      expect(res.checksumEsperado?.totalLiquido).toBe(605.63)
    })

    it('(b) Bradesco: regra de ouro ignora R$ 0,00, COM.PG e SALDO DEMONSTRATIVO ANTERIOR', () => {
      const csvBradesco = `
BRADESCO SEGUROS S.A.
FATURA: 9948210
LANCAMENTO;PROPOSTA;APOLICE;ENDOSSO;RAMO;SEGURADO;PARCELA;PREMIO;COMISSAO
SALDO DEMONSTRATIVO ANTERIOR;000000;000000;00000;00;SALDO;0;0,00;0,00
1;987654321;55443322;00000;AUTO;ANA DELIA SILVA;1/6;3.200,00;480,00
2;987654322;55443323;00000;AUTO;CARLOS EDUARDO;2/6;2.100,00;0,00
3;987654323;55443324;00000;AUTO;COM.PG DEMO;1/1;1.500,00;225,00
      `.trim()

      const rows = parseCsvText(csvBradesco)
      const res = parseExtratoSeguradora(rows, 'bra1-b6364.xlsx')

      expect(res.formato).toBe('BRADESCO')
      // Apenas a linha válida (1) com comissão > 0 e sem flag informativa é aceita para baixa
      expect(res.linhasValidasParaBaixa.length).toBe(1)
      expect(res.linhasValidasParaBaixa[0].numeroProposta).toBe('987654321')
      expect(res.linhasValidasParaBaixa[0].numeroApolice).toBe('55443322')
      expect(res.linhasValidasParaBaixa[0].comissaoBruta).toBe(480)

      // As outras 3 linhas devem estar em ignoradas/informativas
      expect(res.linhasInformativasIgnoradas.length).toBe(3)
      expect(
        res.linhasInformativasIgnoradas.some((l) => l.motivoInformativo?.includes('SALDO')),
      ).toBe(true)
      expect(
        res.linhasInformativasIgnoradas.some((l) => l.motivoInformativo?.includes('COM.PG')),
      ).toBe(true)
    })

    it('(c) Tokio Marine: extrai apólice e parcela embutida no documento "...439.000000 - 1/10"', () => {
      const csvTokio = `
TOKIO MARINE SEGURADORA
EXTRATO;DATA;DOCUMENTO;CLIENTE;PREMIO;VALOR
09/2026;15/09/2026;0554.439.000000 - 1/10;MARIA APARECIDA;2.000,00;300,00
09/2026;15/09/2026;0554.440.000000 - 3/12;JOAO PEREIRA;1.500,00;225,00
      `.trim()

      const rows = parseCsvText(csvTokio)
      const res = parseExtratoSeguradora(rows, 'comissao_mensal_09_2026-ff0de.xlsx')

      expect(res.formato).toBe('TOKIO_MARINE')
      expect(res.linhasValidasParaBaixa.length).toBe(2)
      expect(res.linhasValidasParaBaixa[0].numeroApolice).toBe('0554.439')
      expect(res.linhasValidasParaBaixa[0].parcela).toBe(1)
      expect(res.linhasValidasParaBaixa[0].liquidoPago).toBe(300)
      expect(res.linhasValidasParaBaixa[1].parcela).toBe(3)
    })

    it('(d) MAPFRE: extrai comissões, datas de crédito e débitos por linha', () => {
      const csvMapfre = `
MAPFRE COMMISSIONPAYMENTS
EXTRATO;APOLICE;ENDOSSO;PARCELA;DATA BAIXA;DATA CREDITO;PREMIO;COMISSAO;DESCONTOS;LIQUIDO
EXT-991;987123456789;0;2;10/09/2026;12/09/2026;3.500,00;525,00;26,25;498,75
      `.trim()

      const rows = parseCsvText(csvMapfre)
      const res = parseExtratoSeguradora(rows, 'c500099665comissao1790184608797-9cbc0.xlsx')

      expect(res.formato).toBe('MAPFRE')
      expect(res.linhasValidasParaBaixa.length).toBe(1)
      expect(res.linhasValidasParaBaixa[0].numeroApolice).toBe('987123456789')
      expect(res.linhasValidasParaBaixa[0].parcela).toBe(2)
      expect(res.linhasValidasParaBaixa[0].dataCredito).toBe('2026-09-12')
      expect(res.linhasValidasParaBaixa[0].comissaoBruta).toBe(525)
      expect(res.linhasValidasParaBaixa[0].liquidoPago).toBe(498.75)
    })

    it('(e) SUSEP Detalhado: apólice, recibo, parcela n/m, flag antecipada', () => {
      const csvSusep = `
RELATORIO SUSEP - COMISSAO PAGA DETALHADA
APOLICE;ENDOSSO;RECIBO;PARCELA;DATA;PREMIO LIQUIDO;COMISSAO;COMISSAO ANTECIPADA
1122334455;0;8899;1/5;20/09/2026;4.000,00;600,00;SIM
      `.trim()

      const rows = parseCsvText(csvSusep)
      const res = parseExtratoSeguradora(rows, 'comissao-paga-detalhada-fc670.xlsx')

      expect(res.formato).toBe('SUSEP_DETALHADO')
      expect(res.linhasValidasParaBaixa.length).toBe(1)
      expect(res.linhasValidasParaBaixa[0].numeroApolice).toBe('1122334455')
      expect(res.linhasValidasParaBaixa[0].parcela).toBe(1)
      expect(res.linhasValidasParaBaixa[0].isComissaoAntecipada).toBe(true)
    })

    it('(f) Demonstrativo Sintético Consolidado: atua exclusivamente como CHECKSUM mensal e gera 0 baixas analíticas', () => {
      const csvSintetico = `
DEMONSTRATIVO DE PAGAMENTO CONSOLIDADO
DATA: 25/09/2026
TOTAL DE COMISSOES: 15.450,80
IRRF RETIDO: 772,54
TOTAL LIQUIDO A PAGAR: 14.678,26
      `.trim()

      const rows = parseCsvText(csvSintetico)
      const res = parseExtratoSeguradora(
        rows,
        'ExtratoComissoes_Consolidado_25092026121419-cc378.xlsx',
      )

      expect(res.formato).toBe('SINTETICO_CONSOLIDADO')
      expect(res.linhasValidasParaBaixa.length).toBe(0) // Não gera linhas analíticas de baixa
      expect(res.checksumEsperado?.totalBruto).toBe(15450.8)
      expect(res.checksumEsperado?.totalLiquido).toBe(14678.26)
    })

    it('(g) Idempotência por linha: gera hash estável e imutável para prevenir duplicidades', () => {
      const l1 = {
        id: '1',
        seguradoraNome: 'Porto Seguro',
        numeroExtrato: 'OP123',
        tipoReferencia: 'PROPOSTA' as const,
        numeroApolice: '',
        numeroProposta: 'PROP-7788',
        endosso: '0',
        parcela: 1,
        dataCredito: '2026-09-25',
        premioLiquido: 2000,
        comissaoBruta: 300,
        impostos: 0,
        liquidoPago: 300,
        isLinhaInformativa: false,
      }

      const h1 = gerarIdempotencyHash(l1)
      const h2 = gerarIdempotencyHash(l1)
      expect(h1).toBe(h2)
      expect(h1).toContain('Porto_Seguro')
      expect(h1).toContain('PROP-7788')
      expect(h1).toContain('p1')
    })
  })

  // =========================================================================
  // PARTE 2: TESTES DOS FORMATOS DE PROPOSTA EM PDF
  // =========================================================================
  describe('Propostas em PDF (Parsers Determinísticos)', () => {
    it('(a) Porto Seguro: extrai dados do segurado, condutor e dados do veículo', () => {
      const text = `
PORTO SEGURO CIA DE SEGUROS
Proposta nº: 6313942213
Segurado: RENATO DOS SANTOS
CPF: 123.456.789-00
Data de nascimento: 14/05/1985
Veículo: VOLKSWAGEN T-CROSS HIGHLINE 1.4 TSI
Placa: ABC-1D23
Chassi: 9BWZZZ377VT004253
Código FIPE: 005512-3
Ano Fab/Mod: 2023/2024
Vigência: das 24h do dia 24/09/2026 até 24/09/2027
Prêmio Líquido: R$ 3.200,00
IOF: R$ 236,80
Prêmio Total: R$ 3.436,80
Parcelas: 4x de R$ 859,20
      `
      const res = parsePropostaTexto(text, 'portoproposta6313942213.pdf')

      expect(res.formato).toBe('PORTO_SEGURO')
      expect(res.numeroProposta).toBe('6313942213')
      expect(res.numeroApolice).toBe('') // aguardando emissão
      expect(res.segurado.nome).toBe('RENATO DOS SANTOS')
      expect(res.segurado.cpfCnpj).toBe('12345678900')
      expect(res.segurado.dataNascimento).toBe('1985-05-14')
      expect(res.veiculo.placa).toBe('ABC1D23')
      expect(res.veiculo.chassi).toBe('9BWZZZ377VT004253')
      expect(res.premioLiquido).toBe(3200)
      expect(res.premioTotal).toBe(3436.8)
      expect(res.quantidadeParcelas).toBe(4)
      expect(res.camposFaltantes.some((c) => c.campo === 'birth_date')).toBe(false)
    })

    it('(b) Allianz: NÃO traz data de nascimento e destaca campo faltante obrigatório', () => {
      const text = `
ALLIANZ SEGUROS
Número da Proposta: 26-130288
Segurado: BEATRIZ CARVALHO MENEZES
CPF: 222.333.444-55
Veículo: HYUNDAI CRETA PLATINUM 1.0 TURBO
Placa: BRA-2E44
Chassi: 9BHAA81BBKP123456
Vigência: 20/09/2026 até 20/09/2027
Prêmio Líquido: R$ 2.800,00
Prêmio Total: R$ 2.990,00
10 parcelas
      `
      const res = parsePropostaTexto(text, 'proposta-26-e1302.pdf')

      expect(res.formato).toBe('ALLIANZ')
      expect(res.segurado.nome).toBe('BEATRIZ CARVALHO MENEZES')
      expect(res.segurado.dataNascimento).toBeUndefined()
      // Destaque explícito de campo faltante obrigatório
      const faltaNasc = res.camposFaltantes.find((c) => c.campo === 'birth_date')
      expect(faltaNasc).toBeDefined()
      expect(faltaNasc?.motivo).toContain('Allianz não inclui a data de nascimento')
    })

    it('(c) Bradesco: separa Segurado de Condutor Principal diferente', () => {
      const text = `
BRADESCO AUTO
Proposta nº: 25-6A3A0-99
Segurado: ANA DELIA SILVA
CPF: 333.444.555-66
Condutor Principal: JOSE ALBERTO SILVA
CPF: 777.888.999-00
Veículo: TOYOTA COROLLA CROSS XRE 2.0
Placa: RIO-9A88
Chassi: 9BRBL3HEXKP987654
Vigência: 10/10/2026 a 10/10/2027
Prêmio Líquido: R$ 4.100,00
Prêmio Total: R$ 4.380,00
      `
      const res = parsePropostaTexto(text, 'proposta-25-6a3a0.pdf')

      expect(res.formato).toBe('BRADESCO')
      expect(res.segurado.nome).toBe('ANA DELIA SILVA')
      expect(res.segurado.cpfCnpj).toBe('33344455566')
      expect(res.condutorPrincipal.nome).toBe('JOSE ALBERTO SILVA')
      expect(res.condutorPrincipal.cpf).toBe('77788899900')
      expect(res.condutorPrincipal.mesmoQueSegurado).toBe(false)
    })

    it('(d) Yelum: decodifica notação de parcelamento especial "1+11" (12x)', () => {
      const text = `
YELUM SEGURADORA
Código da Proposta: 26-5607D-01
Segurado: MARCOS VINICIUS ALMEIDA
CPF: 444.555.666-77
Veículo: JEEP COMPASS LONGITUDE T270
Placa: BRA-3B12
Chassi: 98865321478521456
Vigência: 01/10/2026 até 01/10/2027
Forma de pagamento: Débito em conta 1+11
Prêmio Líquido: R$ 5.200,00
Prêmio Total: R$ 5.560,00
      `
      const res = parsePropostaTexto(text, 'proposta-26-5607d.pdf')

      expect(res.formato).toBe('YELUM')
      expect(res.quantidadeParcelas).toBe(12) // 1 entrada + 11 parcelas = 12x
      expect(res.parcelamentoDescricao).toContain('1+11 (12x)')
      expect(res.formaPagamento).toBe('Débito em conta')
    })

    it('(e) HDI e MAPFRE: detecta renovação com apólice e seguradora anterior', () => {
      const textHDI = `
HDI SEGUROS
Proposta: 26-B74F6-HDI
Segurado: CARLOS AUGUSTO
CPF: 555.666.777-88
Veículo: CHEVROLET TRACKER PREMIER 1.2 TURBO
Placa: SAO-1A99
Chassi: 9BGKL54E0MB123456
Renovação de Apólice Anterior: 5544332211
Seguradora Anterior: Porto Seguro
Classe de Bônus: 8
Vigência: 15/09/2026 a 15/09/2027
Prêmio Líquido: R$ 3.000,00
Prêmio Total: R$ 3.210,00
      `
      const res = parsePropostaTexto(textHDI, 'proposta-26-b74f6.pdf')

      expect(res.formato).toBe('HDI')
      expect(res.renovacao.isRenovacao).toBe(true)
      expect(res.renovacao.apoliceAnterior).toBe('5544332211')
      expect(res.renovacao.seguradoraAnterior).toBe('Porto Seguro')
      expect(res.renovacao.classeBonus).toBe('8')
    })
  })

  // =========================================================================
  // PARTE 3: FLUXO DE RECEBIMENTOS LEGADOS (IDEMPOTÊNCIA E SOMA DOS TOTAIS)
  // =========================================================================
  describe('Recebimentos Legados (Idempotência e Soma de Totais)', () => {
    it('Registra comissão como legado garantindo idempotência e soma exata', async () => {
      // Simula banco em memória para recebimentos_legados e import_rows
      const legadosStore: any[] = []
      const importRowsStore: any[] = []

      // Mock PocketBase collection para recebimentos_legados e import_rows
      const origCollection = pb.collection.bind(pb)
      pb.collection = ((name: string) => {
        if (name === 'recebimentos_legados') {
          return {
            getFirstListItem: async (filter: string) => {
              const hashMatch = filter.match(/idempotency_hash = "([^"]+)"/)
              if (hashMatch) {
                const targetHash = hashMatch[1]
                const found = legadosStore.find((item) => item.idempotency_hash === targetHash)
                if (found) return found
              }
              throw new Error('Not found')
            },
            create: async (data: any) => {
              const record = {
                id: `leg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                ...data,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
              }
              legadosStore.push(record)
              return record
            },
            getFullList: async () => [...legadosStore],
          } as any
        }
        if (name === 'import_rows') {
          return {
            create: async (data: any) => {
              importRowsStore.push(data)
              return { id: `row_${Date.now()}`, ...data }
            },
          } as any
        }
        return origCollection(name)
      }) as any

      try {
        const hashLinha1 = 'ext_Porto_Seguro_PROP-1122_p1_d2026-09-25_v35000'
        const hashLinha2 = 'ext_Porto_Seguro_PROP-3344_p1_d2026-09-25_v20000'

        const linhasParaRegistrar: LinhaConferida[] = [
          {
            linha: {
              id: 'l1',
              seguradoraNome: 'Porto Seguro',
              numeroExtrato: 'OP-100',
              tipoReferencia: 'PROPOSTA',
              numeroProposta: 'PROP-1122',
              numeroApolice: '',
              endosso: '0',
              parcela: 1,
              dataCredito: '2026-09-25',
              premioLiquido: 2333.33,
              comissaoBruta: 350.0,
              impostos: 0,
              liquidoPago: 350.0,
              isLinhaInformativa: false,
            },
            fila: 'SEM_PREVISAO',
            motivoFila: 'Sem apólice no sistema',
            idempotencyHash: hashLinha1,
            selecionadoParaBaixa: true,
          },
          {
            linha: {
              id: 'l2',
              seguradoraNome: 'Porto Seguro',
              numeroExtrato: 'OP-100',
              tipoReferencia: 'PROPOSTA',
              numeroProposta: 'PROP-3344',
              numeroApolice: '',
              endosso: '0',
              parcela: 1,
              dataCredito: '2026-09-25',
              premioLiquido: 1333.33,
              comissaoBruta: 200.0,
              impostos: 0,
              liquidoPago: 200.0,
              isLinhaInformativa: false,
            },
            fila: 'SEM_PREVISAO',
            motivoFila: 'Sem apólice no sistema',
            idempotencyHash: hashLinha2,
            selecionadoParaBaixa: true,
          },
        ]

        // 1. Primeira importação em lote
        const res1 = await registrarLinhasComoLegadoEmLote(linhasParaRegistrar, {
          loteId: 'lote_teste_01',
          loteNome: 'extrato_porto_set26.xlsx',
          seguradoraNome: 'Porto Seguro',
        })

        expect(res1.sucessos).toBe(2)
        expect(res1.falhas.length).toBe(0)
        expect(res1.totalValor).toBe(550.0) // 350 + 200 = 550
        expect(legadosStore.length).toBe(2)
        expect(importRowsStore.length).toBe(2)

        // Conferir a soma líquida dos registros gravados
        const somaGravada = legadosStore.reduce(
          (acc, item) => acc + Number(item.valor_liquido || 0),
          0,
        )
        expect(somaGravada).toBe(550.0)

        // 2. Idempotência: reimportar o mesmo lote NÃO deve duplicar
        const resReimport = await registrarLinhasComoLegadoEmLote(linhasParaRegistrar, {
          loteId: 'lote_teste_02',
          loteNome: 'extrato_porto_set26_copia.xlsx',
          seguradoraNome: 'Porto Seguro',
        })

        // Retorna sucesso mantendo os registros já existentes (sem duplicar na collection)
        expect(resReimport.sucessos).toBe(2)
        expect(resReimport.totalValor).toBe(550.0)
        // Store não deve ter 4 registros; continua tendo apenas 2
        expect(legadosStore.length).toBe(2)

        // 3. Teste unitário de chamada avulsa de registrarRecebimentoLegado com mesmo hash
        const recExistente = await registrarRecebimentoLegado({
          seguradora_nome: 'Porto Seguro',
          data_credito: '2026-09-25',
          valor_liquido: 350.0,
          idempotency_hash: hashLinha1,
        })
        expect(recExistente.id).toBe(legadosStore[0].id)
        expect(legadosStore.length).toBe(2)
      } finally {
        // Restaurar coleção original
        pb.collection = origCollection
      }
    })
  })
})
