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

    it('(b) Allianz: NÃO traz data de nascimento e destaca campo faltante obrigatório (Variante Auto / PF)', () => {
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
      expect(res.tipoSeguro).toBe('Auto')
      expect(res.segurado.nome).toBe('BEATRIZ CARVALHO MENEZES')
      expect(res.segurado.tipoPessoa).toBe('PF')
      expect(res.segurado.cpfCnpj).toBe('22233344455')
      expect(res.segurado.dataNascimento).toBeUndefined()
      // Destaque explícito de campo faltante obrigatório para PF
      const faltaNasc = res.camposFaltantes.find((c) => c.campo === 'birth_date')
      expect(faltaNasc).toBeDefined()
      expect(faltaNasc?.motivo).toContain('Allianz não inclui a data de nascimento')
    })

    it('(b.1) Allianz AUTO PF Real (Caso IRIS NOVAES): extrai endereço desmembrado, ignora CNPJ da seguradora na pág 7 e nunca insere "DE DADOS PESSOAIS" na cidade', () => {
      // Texto idêntico à proposta de 7 páginas anexada pelo usuário
      const textAllianzAutoReal = `
Olá IRIS NOVAES BUDACH MACHADO, Agradecemos por escolher a Allianz para proteger o seu carro.
Confira todos os dados da sua proposta antes de contratar 
o seu seguro e consulte as Condições Gerais do Seguro Allianz 
Auto em allianz.com.br
Página 1 de 7 Nº Proposta: 141237745
AUTO
AUTOMÓVEL
ALLIANZ
PROPOSTA
06-10-2026 11:57:29 04116100840TF22CI39 2820088 141237745 OP
SEU CORRETOR
CRED10MIX CORRETORA DE SEGUROS LTDA
E-mail: thiago@cred10mix.com.br Telefone: 8134939966 Código: 2820088
SUSEP Nº: 202062795 FIilial: 2P
 SUAS INFORMAÇÕES
Nome: IRIS NOVAES BUDACH MACHADO
CPF/CNPJ: 009.171.474-56 Tel: 81998747908 E-mail: tiagomp@live.com
Endereço: AV DEZESSETE DE AGOSTO, 1070, AP 202 - CASA FORTE - RECIFE/PE - 52061540
INFORMAÇÕES DO CONDUTOR PRINCIPAL
Nome: IRIS NOVAES BUDACH MACHADO CPF: 009.171.474-56
Idade: 37 anos
Estado Civil: Casado[a] ou convive em união estável
Deseja ampliar a cobertura do seguro para condutores do veículo segurado com idade entre 18 a 25 anos: Não. Estou
ciente que não haverá cobertura para condutores entre 18 a 25 anos.
O principal condutor reside em: Apartamento
INFORMAÇÕES DO SEU SEGURO
Vigência: das 24H de 11/10/2026 às 24H de 11/10/2027 Nº da Proposta: 141237745
Tipo de Seguro: Renovação Allianz sem sinistro Ramo: 31 - Automóvel
Veículo: VOLKSWAGEN TAOS Highline 250 1.4 TSI TB AT6 Flex Aut. 4p Produto: Automoveis 1211
Cód. FIPE: 005528-0 Versão: 000160/160.19
Placa: RZH0J10 Condições Gerais: 08/2026
Chassi: 8AWBJ6B21NA812053 Classe Bônus: 03
Zero Km: Não Grupo: 01
Ano/Modelo: 2022 CEP Pernoite: 52061-540
Categoria de Risco: Automóvel - Particular Finalidade de Uso: Particular
Kit gás: Não
INFORMAÇÕES DA RENOVAÇÃO
Nº. Apólice Anterior: 2161578 Cód. CI: 51725201936840
Seguradora Anterior: 5177 Fim da vigência anterior: 11/10/2026
Veículo Igual ao Anterior: Sim 

OFERTA ESCOLHIDA 
BÁSICO
Preço Líquido R$ 2.107,93
Preço Total (IOF + Juros inclusos) R$ 2.263,48

INFORMAÇÕES DE PAGAMENTO
Forma de pagamento Nº. do Cartão: 4271********9465
Preço líquido: R$ 2.107,92 Taxa mensal juros: 0,00
Cartão de Crédito* em 10 parcelas Valor juros: R$ 0,00 IOF: R$ 155,56
Vencimento: Fatura Cartão Preço Total (impostos inclusos)
R$ 2.263,48 

Parcelas Valor da Parcela Parcelas Valor da Parcela
1 R$ 226,35 6 R$ 226,35
2 R$ 226,35 7 R$ 226,35
3 R$ 226,35 8 R$ 226,35
4 R$ 226,35 9 R$ 226,35
5 R$ 226,35 10 R$ 226,33

PRIVACIDADE DE DADOS PESSOAIS 
A Allianz realiza o tratamento de seus dados pessoais observando a legislação vigente...

Página 7 de 7 Nº Proposta: 141237745
Allianz Seguros S.A. Código: 5177 | CNPJ: 061.573.796/0001-66 IE: 108.063.509.113 | Rua Eugenio de Medeiros, nº 303, 1º andar-parte, 2º ao 9º andar,
15º e 16º andar, Pinheiros, São Paulo-SP
      `.trim()

      const res = parsePropostaTexto(textAllianzAutoReal, 'proposta-allianz-auto-141237745.pdf')

      // Formato e proposta
      expect(res.formato).toBe('ALLIANZ')
      expect(res.seguradoraNome).toBe('Allianz')
      expect(res.numeroProposta).toBe('141237745')
      expect(res.tipoSeguro).toBe('Auto')

      // Segurado: Pessoa Física, sem lixo e sem CNPJ da Allianz
      expect(res.segurado.tipoPessoa).toBe('PF')
      expect(res.segurado.nome).toBe('IRIS NOVAES BUDACH MACHADO')
      expect(res.segurado.nome.includes('**')).toBe(false)
      expect(res.segurado.nome.includes('/')).toBe(false)
      expect(res.segurado.cpfCnpj).toBe('00917147456')
      expect(res.segurado.cpfCnpj).not.toBe('06157379600016')
      expect(res.segurado.email).toBe('tiagomp@live.com')
      expect(res.segurado.telefone).toBe('(81) 99874-7908')

      // Endereço desmembrado sem lixo
      expect(res.segurado.rua).toBe('AV DEZESSETE DE AGOSTO')
      expect(res.segurado.numero).toBe('1070, AP 202')
      expect(res.segurado.bairro).toBe('CASA FORTE')
      expect(res.segurado.cidade).toBe('RECIFE')
      expect(res.segurado.cidade).not.toContain('DADOS PESSOAIS')
      expect(res.segurado.estado).toBe('PE')
      expect(res.segurado.cep).toBe('52061-540')

      // Condutor principal
      expect(res.condutorPrincipal.nome).toBe('IRIS NOVAES BUDACH MACHADO')
      expect(res.condutorPrincipal.cpf).toBe('00917147456')
      expect(res.condutorPrincipal.mesmoQueSegurado).toBe(true)

      // Veículo
      expect(res.veiculo.marcaModelo).toBe(
        'VOLKSWAGEN TAOS Highline 250 1.4 TSI TB AT6 Flex Aut. 4p',
      )
      expect(res.veiculo.placa).toBe('RZH0J10')
      expect(res.veiculo.chassi).toBe('8AWBJ6B21NA812053')
      expect(res.veiculo.codigoFipe).toBe('005528-0')
      expect(res.veiculo.anoModelo).toBe(2022)

      // Vigência
      expect(res.vigenciaInicio).toBe('2026-10-11')
      expect(res.vigenciaFim).toBe('2027-10-11')

      // Renovação
      expect(res.renovacao.isRenovacao).toBe(true)
      expect(res.renovacao.apoliceAnterior).toBe('2161578')
      expect(res.renovacao.seguradoraAnterior).toBe('5177')
      expect(res.renovacao.classeBonus).toBe('03')

      // Valores e parcelas (preço líquido das INFORMAÇÕES DE PAGAMENTO)
      expect(res.premioLiquido).toBe(2107.92)
      expect(res.iof).toBe(155.56)
      expect(res.premioTotal).toBe(2263.48)
      expect(res.quantidadeParcelas).toBe(10)
      expect(res.formaPagamento).toBe('Crédito')
    })

    it('(b.1-md) Allianz AUTO PF Real com Markdown GFM real de $documents.toMarkdown (tabelas, cabeçalhos # e bold **)', () => {
      // Amostra fiel ao log de produção:
      // "PROPOSTA # ALLIANZ Olá **IRIS NOVAES BUDACH MACHADO**, Agradecemos por escolher a Allianz para proteger o seu carro. # AUTO..."
      const markdownRealAllianz = `
PROPOSTA
# ALLIANZ
Olá **IRIS NOVAES BUDACH MACHADO**, Agradecemos por escolher a Allianz para proteger o seu carro.
# AUTO
Confira todos os dados da sua proposta antes de contratar o seu seguro e consulte as Condições Gerais do Seguro Allianz Auto em allianz.com.br

Página 1 de 7 | Nº Proposta: 141237745

## SEU CORRETOR
| CRED10MIX CORRETORA DE SEGUROS LTDA | | |
| --- | --- | --- |
| **E-mail:** thiago@cred10mix.com.br | **Telefone:** 8134939966 | **Código:** 2820088 |
| **SUSEP Nº:** 202062795 | **Filial:** 2P | |

## SUAS INFORMAÇÕES
| | | |
| --- | --- | --- |
| **Nome:** IRIS NOVAES BUDACH MACHADO | | |
| **CPF/CNPJ:** 009.171.474-56 | **Tel:** 81998747908 | **E-mail:** tiagomp@live.com |
| **Endereço:** AV DEZESSETE DE AGOSTO, 1070, AP 202 - CASA FORTE - RECIFE/PE - 52061540 | | |

## INFORMAÇÕES DO CONDUTOR PRINCIPAL
| **Nome:** IRIS NOVAES BUDACH MACHADO | **CPF:** 009.171.474-56 |
| **Idade:** 37 anos | |
| **Estado Civil:** Casado[a] ou convive em união estável | |

## INFORMAÇÕES DO SEU SEGURO
| **Vigência:** das 24H de 11/10/2026 às 24H de 11/10/2027 | **Nº da Proposta:** 141237745 |
| **Tipo de Seguro:** Renovação Allianz sem sinistro | **Ramo:** 31 - Automóvel |
| **Veículo:** VOLKSWAGEN TAOS Highline 250 1.4 TSI TB AT6 Flex Aut. 4p | **Produto:** Automoveis 1211 |
| **Cód. FIPE:** 005528-0 | **Versão:** 000160/160.19 |
| **Placa:** RZH0J10 | **Condições Gerais:** 08/2026 |
| **Chassi:** 8AWBJ6B21NA812053 | **Classe Bônus:** 03 |
| **Zero Km:** Não | **Grupo:** 01 |
| **Ano/Modelo:** 2022 | **CEP Pernoite:** 52061-540 |

## INFORMAÇÕES DA RENOVAÇÃO
| **Nº. Apólice Anterior:** 2161578 | **Cód. CI:** 51725201936840 |
| **Seguradora Anterior:** 5177 | **Fim da vigência anterior:** 11/10/2026 |
| **Veículo Igual ao Anterior:** Sim | |

## INFORMAÇÕES DE PAGAMENTO
| **Forma de pagamento** | **Nº. do Cartão:** 4271********9465 |
| **Preço líquido:** R$ 2.107,92 | **Taxa mensal juros:** 0,00 |
| **Cartão de Crédito*** em 10 parcelas | **Valor juros:** R$ 0,00 |
| **IOF:** R$ 155,56 | **Preço Total (impostos inclusos):** R$ 2.263,48 |

## PRIVACIDADE DE DADOS PESSOAIS
A Allianz realiza o tratamento de seus dados pessoais...

Página 7 de 7 | Nº Proposta: 141237745
Allianz Seguros S.A. Código: 5177 | CNPJ: 061.573.796/0001-66
      `.trim()

      const res = parsePropostaTexto(markdownRealAllianz, 'Proposta 26-600e7.pdf')

      // Verificações principais do bug reportado
      expect(res.segurado.nome).toBe('IRIS NOVAES BUDACH MACHADO')
      expect(res.segurado.cpfCnpj).toBe('00917147456')
      expect(res.segurado.telefone).toBe('(81) 99874-7908')
      expect(res.segurado.email).toBe('tiagomp@live.com')
      expect(res.segurado.tipoPessoa).toBe('PF')

      // Endereço
      expect(res.segurado.rua).toBe('AV DEZESSETE DE AGOSTO')
      expect(res.segurado.numero).toBe('1070, AP 202')
      expect(res.segurado.bairro).toBe('CASA FORTE')
      expect(res.segurado.cidade).toBe('RECIFE')
      expect(res.segurado.estado).toBe('PE')
      expect(res.segurado.cep).toBe('52061-540')

      // Condutor
      expect(res.condutorPrincipal.nome).toBe('IRIS NOVAES BUDACH MACHADO')
      expect(res.condutorPrincipal.cpf).toBe('00917147456')
      expect(res.condutorPrincipal.mesmoQueSegurado).toBe(true)

      // Veículo e vigência
      expect(res.veiculo.marcaModelo).toBe(
        'VOLKSWAGEN TAOS Highline 250 1.4 TSI TB AT6 Flex Aut. 4p',
      )
      expect(res.veiculo.placa).toBe('RZH0J10')
      expect(res.veiculo.chassi).toBe('8AWBJ6B21NA812053')
      expect(res.veiculo.codigoFipe).toBe('005528-0')
      expect(res.veiculo.anoModelo).toBe(2022)
      expect(res.vigenciaInicio).toBe('2026-10-11')
      expect(res.vigenciaFim).toBe('2027-10-11')
      expect(res.numeroProposta).toBe('141237745')

      // Renovação e Valores
      expect(res.renovacao.isRenovacao).toBe(true)
      expect(res.renovacao.apoliceAnterior).toBe('2161578')
      expect(res.renovacao.seguradoraAnterior).toBe('5177')
      expect(res.premioLiquido).toBe(2107.92)
      expect(res.iof).toBe(155.56)
      expect(res.premioTotal).toBe(2263.48)
      expect(res.formaPagamento).toBe('Crédito')
      expect(res.quantidadeParcelas).toBe(10)
    })

    it('(b.2) Allianz: detecta variante Condomínio (Pessoa Jurídica) com endereço enriquecido e parcelas', () => {
      // Simula documento real com artefatos "|" ou "||" gerados por quebras de tabela do conversor PDF
      const textCondominio = `
Condomínio
Allianz
Página 1 de 4 Nº Proposta: 141234945|
PROPOSTA CORRETORA
CRED10MIX CORRETORA DE SEGUROS LTDA
Tel: 8134939966 Cel: 81988653534
E-mail:thiago@cred10mix.com.br
SUSEP: 202062795 Código: 2820088 Filial: 2P
Nº. da Proposta: 141234945 Emissão: 14/10/2026

CONDOMINIO RESIDENCIAL DO EDIFICIO BOSQUE OURO PRETO|
Essa é a proposta do seu seguro Allianz Condomínio, confira:

SUAS INFORMAÇÕES
Nome: CONDOMINIO RESIDENCIAL DO EDIFICIO BOSQUE
OUR|
CNPJ: 62.806.783/0001-52
E-mail: administrativo@peradministradora.com.br Tel: 986708849
Endereço de correspondência: R. CAMOMILA||
Bairro: OURO PRETO|
Cidade/UF: OLINDA/PE CEP: 53370-450

INFORMAÇÕES DO SEGURO
Endereço do local segurado: RUA CAMOMILA, 55 - OURO PRETO - 53370-450 - OLINDA/PE
Categoria de Risco: Apenas Residencial Tipo de Seguro: Renovação Allianz
Produto | Ramo: 16 - Condomínio - Modalidade: Simples
Vigência: das 24H de 14/10/2026 às 24H de 14/10/2027

COBERTURAS
Básica Simples R$ 13.000.000,00 R$ 574,52
Danos Elétricos R$ 20.000,00 R$ 643,53
Prêmio Líquido R$ 1.950,65

INFORMAÇÕES DE PAGAMENTO
Forma de Pagamento: Boleto Bancário Vencimento: 10
Prêmio Líquido: R$ 1.950,65 IOF: R$ 160,47
Nº. de Parcelas: 10 Valor da Parcela: 233,50 Total a Pagar: R$ 2.334,89
      `

      const res = parsePropostaTexto(textCondominio, 'proposta-26-78a46.pdf')

      expect(res.formato).toBe('ALLIANZ')
      expect(res.tipoSeguro).toBe('Condomínio')
      expect(res.numeroProposta).toBe('141234945')
      expect(res.seguradoraNome).toBe('Allianz')

      // Segurado PJ e limpeza de pipes (|)
      expect(res.segurado.tipoPessoa).toBe('PJ')
      expect(res.segurado.cpfCnpj).toBe('62806783000152')
      expect(res.segurado.nome).toBe('CONDOMINIO RESIDENCIAL DO EDIFICIO BOSQUE OURO PRETO')
      expect(res.segurado.nome.includes('|')).toBe(false)
      expect(res.segurado.email).toBe('administrativo@peradministradora.com.br')
      expect(res.segurado.telefone).toBe('(81) 98670-8849')
      expect(res.segurado.cep).toBe('53370-450')
      expect(res.segurado.rua).toBe('RUA CAMOMILA')
      expect(res.segurado.rua?.includes('|')).toBe(false)
      expect(res.segurado.numero).toBe('55')
      expect(res.segurado.bairro).toBe('OURO PRETO')
      expect(res.segurado.cidade).toBe('OLINDA')
      expect(res.segurado.estado).toBe('PE')

      // PJ não deve ter birth_date nos campos faltantes
      const faltaNasc = res.camposFaltantes.find((c) => c.campo === 'birth_date')
      expect(faltaNasc).toBeUndefined()

      // Vigências
      expect(res.vigenciaInicio).toBe('2026-10-14')
      expect(res.vigenciaFim).toBe('2027-10-14')

      // Prêmios e Parcelas
      expect(res.premioLiquido).toBe(1950.65)
      expect(res.iof).toBe(160.47)
      expect(res.premioTotal).toBe(2334.89)
      expect(res.formaPagamento).toBe('Boleto')
      expect(res.quantidadeParcelas).toBe(10)
      expect(res.parcelamentoDescricao).toContain('10x de R$ 233,50')
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

    it('(a.2) Azul Seguros / Porto Seguro (Caso Real LIVIA LOURENCO): extrai PF, ignora CNPJ da Porto no rodapé, separa condutor Paula Gabriela, preenche endereço e prêmios', () => {
      // Texto exato gerado pelo conversor do servidor ($documents.toMarkdown com rótulos quebrados em linhas)
      const textAzulReal =
        'Segurado(a)\nLIVIA LOURENCO FERNANDES DA CUNHA BARROS\nNascimento\n02/08/1990 057.365.924-95\nCPF\nProfissãoSexo\n387-AdministradoresFeminino\nPaís de nascimento\nBrasil\nAzul\nTradicional\nSegmento Origem do bônus\n-\nTipo de Operação\nRenovação da Cia\nBônus\nClasse 1\nSeguradora\nAzul Seguros\nSucursal\n3\nApólice\n12806713\nItem\n1\nEndereço residencial\nR Doralice de Almeida Lyra, 55\nComplemento\n-\nCEP\n58037-335\nUF\nPB\nBairro\nJardim Oceania\nCidade\nJoão Pessoa\nE-mail\npaulagabrieladv@gmail.com\nTelefone Tipo de envio Enviar correspondência para\nCelular: (83) 99112-9729 DIGITAL SEGURADO\nVeículo\n6140 - - NOVO ONIX HATCH LT 1.0 12V FLEX\nVeículo\nQSI2A04\nPlaca\n9BGEB48A0LG219020\nChassi\n2020 / 2020\nAno Fabricação / Modelo\nZero km\nN45179\nFipe Câmbio\nManual\nBlindado\nNão\nKit Gás\nNão\nIsenção Fiscal\nSem Isenção 5\n10 - VEICULOS DE PASSEIO\nCategoria\nPessoa com deficiência\nNão\nCombustível\nGASOLINA/ALCOOL\nPortas\nQuestionário de avaliação de risco¹\nSeguro do corretor\nNão\nPAULA GABRIELA DE MORAIS NEGREIROS 088.181.234-08\n58037-335\nCondutor Nascimento\n15/10/1996\nCPF\nCEP de pernoite Dispositivos antifurto/anti-roubo\nOutros Dispositivos, Não\nTipo de uso\nParticular\nCoberturas e serviços automóvel\nDescrição LMI (indenização) Franquia Valor do Prêmio\nCompreensiva (Colisão, Incêndio, Roubo ou\nFurto) - Valor de mercado\n100.00% R$ 1.018,84R$ 3.804,00 (50% da\nObrigatória)\nRCF-V Danos Materiais R$ 50.000,00 R$ 380,53-\nRCF-V Danos Corporais R$ 50.000,00 R$ 23,47-\nCustos de defesa auto Não contratado --\nUso Interno da Cia\n20261105.24.0025C.0000A.0000G.ACP000000\nImpresso: 07/10/2026 14:23\nPag. 1 de 5\n' +
        'Proposta 12-31784355\n' +
        'Das 24h do dia 10/10/2026 até as 24h do dia 10/10/2027\n' +
        'Forma de pagamento\n97-Todas Cartão de Crédito Porto Bank (Existente)\nR$ 1.486,42 R$ 109,70 R$ 0,00 R$ 0,00 R$ 1.596,121x R$ 1.596,12\nBandeira\nVISA\n' +
        'Canais de atendimento\nPorto Seguro Cia de Seguros Gerais\nCNPJ: 61.198.164/0001-60'

      const res = parsePropostaTexto(textAzulReal, 'proposta-azul-tradicional-14696320.pdf')

      // 1. Identificação da Seguradora e Formato
      expect(res.formato).toBe('AZUL_SEGUROS')
      expect(res.seguradoraNome).toBe('Azul Seguros')
      expect(res.tipoSeguro).toBe('Auto')
      expect(res.numeroProposta).toBe('12-31784355')

      // 2. Segurado (PF) — LIVIA LOURENCO (NÃO "Nascimento" nem CNPJ institucional)
      expect(res.segurado.tipoPessoa).toBe('PF')
      expect(res.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
      expect(res.segurado.nome).not.toContain('Nascimento')
      expect(res.segurado.cpfCnpj).toBe('05736592495')
      expect(res.segurado.cpfCnpj).not.toBe('61198164000160') // Proteção contra CNPJ da Porto Seguro
      expect(res.segurado.dataNascimento).toBe('1990-08-02')
      expect(res.segurado.email).toBe('paulagabrieladv@gmail.com')
      expect(res.segurado.telefone).toBe('(83) 99112-9729') // Ignora telefones institucionais
      expect(res.segurado.telefone).not.toContain('3224-0174') // Telefone da corretora ignorado
      expect(res.segurado.telefone).not.toContain('0800')

      // Endereço desmembrado
      expect(res.segurado.rua).toBe('R Doralice de Almeida Lyra')
      expect(res.segurado.numero).toBe('55')
      expect(res.segurado.bairro).toBe('Jardim Oceania')
      expect(res.segurado.cidade).toBe('João Pessoa')
      expect(res.segurado.estado).toBe('PB')
      expect(res.segurado.cep).toBe('58037-335')

      // 3. Condutor Principal separado (PAULA GABRIELA)
      expect(res.condutorPrincipal.nome).toBe('PAULA GABRIELA DE MORAIS NEGREIROS')
      expect(res.condutorPrincipal.cpf).toBe('08818123408')
      expect(res.condutorPrincipal.mesmoQueSegurado).toBe(false)

      // 4. Veículo
      expect(res.veiculo.marcaModelo).toBe('NOVO ONIX HATCH LT 1.0 12V FLEX')
      expect(res.veiculo.placa).toBe('QSI2A04')
      expect(res.veiculo.chassi).toBe('9BGEB48A0LG219020')
      expect(res.veiculo.anoModelo).toBe(2020)
      expect(res.veiculo.anoFabricacao).toBe(2020)
      expect(res.veiculo.codigoFipe).toBe('N45179')

      // 5. Vigência e Prêmios
      expect(res.vigenciaInicio).toBe('2026-10-10')
      expect(res.vigenciaFim).toBe('2027-10-10')
      expect(res.premioLiquido).toBe(1486.42)
      expect(res.iof).toBe(109.7)
      expect(res.premioTotal).toBe(1596.12)
      expect(res.formaPagamento).toBe('Crédito')
      expect(res.quantidadeParcelas).toBe(1)
      expect(res.parcelamentoDescricao).toContain('1x')

      // 6. Renovação
      expect(res.renovacao.isRenovacao).toBe(true)
      expect(res.renovacao.apoliceAnterior).toBe('12806713')
      expect(res.renovacao.seguradoraAnterior).toBe('Azul Seguros')
      expect(res.renovacao.classeBonus).toBe('1')
    })

    it('(a.2-md) Azul Seguros com o MARKDOWN REAL retornado pelo pipeline $documents.toMarkdown a partir do PDF de evidência', () => {
      // Texto Markdown idêntico ao extraído pelo serviço $documents.toMarkdown em produção do arquivo
      // azulproposta6320779928-0-1-20261007142357535-f2c13.pdf
      const markdownRealAzul = `
# Proposta de Seguro Auto

# Azul Tradicional

**Dados da cotação**

| Orçamento | Versão | Oferta | Proposta | Apólice | Status |
| --- | --- | --- | --- | --- | --- |
| 6320779928 | 0 | 1 | 12-31784355 | 03 14696320 | Emitido |

## Vigência

Das 24h do dia 10/10/2026 até as 24h do dia 10/10/2027

**Corretor(a)**

| Corretor CRED10MIX CORRETORA DE SEGUROS LTDA | Participação | Líder | SUSEP | Telefone | E-mail |
| --- | --- | --- | --- | --- | --- |
| Corretor CRED10MIX CORRETORA DE SEGUROS LTDA | 100.00% | Sim | 1676SJ | (81) 3224-0174 | thiago@cred10mix.com.br |

## Dados Gerais

| Segurado(a) | Nascimento | CPF |
| --- | --- | --- |
| LIVIA LOURENCO FERNANDES DA CUNHA BARROS | 02/08/1990 | 057.365.924-95 |

| Sexo | Profissão | País de nascimento |
| --- | --- | --- |
| Feminino | 387-Administradores | Brasil |

| Tipo de Operação | Segmento | Bônus | Origem do bônus |
| --- | --- | --- | --- |
| Renovação da Cia | Azul | Classe 1 | - |
|  | Tradicional |  |  |

| Tradicional |  |  |  |
| --- | --- | --- | --- |
| Seguradora | Sucursal | Apólice | Item |
| Azul Seguros | 3 | 12806713 | 1 |

| Endereço residencial | Complemento | CEP | Bairro | Cidade | UF |
| --- | --- | --- | --- | --- | --- |
| R Doralice de Almeida Lyra, 55 | - | 58037-335 | Jardim Oceania | João Pessoa | PB |

| E-mail | Telefone | Tipo de envio | Enviar correspondência para |
| --- | --- | --- | --- |
| paulagabrieladv@gmail.com | Celular: (83) 99112-9729 | DIGITAL | SEGURADO |

**Veículo**

| Placa | Chassi | Veículo | Ano Fabricação / Modelo |
| --- | --- | --- | --- |
| QSI2A04 | 9BGEB48A0LG219020 | 6140 -- NOVO ONIX HATCH LT 1.0 12V FLEX | 2020 / 2020 |

| Fipe | Zero km | Câmbio | Blindado | Kit Gás | Pessoa com deficiência | Isenção Fiscal | Portas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 45179 | N | Manual | Não | Não | Não | Sem Isenção | 5 |
| Combustível |  | Categoria |  |  |  |  |  |
| GASOLINA/ALCOOL |  | 10 - VEICULOS DE PASSEIO |  |  |  |  |  |

## Questionário de avaliação de risco<sup>1</sup>

| Conductor |  |  | Nascimento | CPF |
| --- | --- | --- | --- | --- |
| PAULA GABRIELA DE MORAIS NEGREIROS |  |  | 15/10/1996 | 088.181.234-08 |
| Tipo de uso | CEP de pernoite | Dispositivos antifurto/anti-roubo |  |  |
| Particular | 58037-335 | Outros Dispositivos, Não |  |  |
| Seguro do corretor |  |  |  |  |
| Não |  |  |  |  |

## Coberturas e serviços automóvel

| Descrição | LMI (indenização) | Franquia | Valor do Prêmio |
| --- | --- | --- | --- |
| Compreensiva (Colisão, Incêndio, Roubo ou Furto) - Valor de mercado | 100.00% | R$ 3.804,00 (50% da Obrigatória) | R$ 1.018,84 |
| RCF-V Danos Materiais | R$ 50.000,00 | - | R$ 380,53 |
| RCF-V Danos Corporais | R$ 50.000,00 | - | R$ 23,47 |
| Custos de defesa auto | Não contratado | - | - |

**Pag. 1  de 5**

---

## Vidros

| Descrição | LMI (indenização) | Valor do Prêmio |
| --- | --- | --- |
| Danos aos Vidros e Retrovisores e Faróis e Lanternas - | limite por peça (para troca) | R$ 63,58 |
| Franquias: Vidros (Para-Brisa e Traseiro): R$ 285,00 / Vidros Laterais: R$ 205,00 / Faróis/Lanternas: R$ 640,00 / Retrovisores: R$ 295,00 / Faróis de Xenônio: R$ 1.210,00 / Lanternas de LED: R$ 595,00 |  |  |

## Assistências

| Descrição | Valor do Prêmio |
| --- | --- |
| Assistência Gratuita – 200 Km | Gratuita |
| Assistência 24h |  |
| Benefícios inclusos |  |
| • Extensão de Perímetro Básico |  |

## $ Descontos

| Descrição | Desconto |
| --- | --- |
| Desconto Cartão Porto Bank - Proponente | 10.00% |
| Desconto de Negociação | 7.24% |
| Desconto à vista - Segunda Compra Cartão Porto Bank | 5.00% |

## $ Forma de pagamento

| Forma de pagamento | Valor líquido | IOF | Juros | Encargos | Parcelas | Valor parcelas | Valor total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 97-Todas Cartão de Crédito Porto Bank (Existente) | R$ 1.486,42 | R$ 109,70 | R$ 0,00 | R$ 0,00 | 1x | R$ 1.596,12 | R$ 1.596,12 |
| Bandeira VISA |  |  |  |  |  |  |  |

## Canais de atendimento

**Porto Seguro Cia de Seguros Gerais**

**CNPJ:** 61.198.164/0001-60

**Código da Seguradora:** 05886

**Processo SUSEP:** 15414.610648/2024-80

**Versão Condições Gerais:** CG024

**Ramos:** Casco(531), RCF-A(553), APP(520),
Assistência(542)

## SAC

0800 727 2766 (informação, reclamação e
cancelamento)

## Central 24h

Grande São Paulo: (11) 3366 3333

Outras Regiões: 0300 33 76786

Ouvidoria: 0800 7271184

**Baixe o App Porto.**
      `.trim()

      const res = parsePropostaTexto(markdownRealAzul, 'proposta-azul.pdf')

      expect(res.formato).toBe('AZUL_SEGUROS')
      expect(res.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
      expect(res.segurado.cpfCnpj).toBe('05736592495')
      expect(res.segurado.tipoPessoa).toBe('PF')
      expect(res.segurado.dataNascimento).toBe('1990-08-02')
      expect(res.segurado.telefone).toBe('(83) 99112-9729')
      expect(res.segurado.email).toBe('paulagabrieladv@gmail.com')
      expect(res.segurado.rua).toBe('R Doralice de Almeida Lyra')
      expect(res.segurado.numero).toBe('55')
      expect(res.segurado.bairro).toBe('Jardim Oceania')
      expect(res.segurado.cidade).toBe('João Pessoa')
      expect(res.segurado.estado).toBe('PB')
      expect(res.segurado.cep).toBe('58037-335')

      // Validação do fluxo de montagem do objeto cliente para initialData do ClientFormDialog
      const tipoPessoa = res.segurado.tipoPessoa || 'PF'
      const clienteDraft = {
        name: res.segurado.nome || '',
        tipo_pessoa: tipoPessoa,
        cpf: tipoPessoa === 'PF' ? '057.365.924-95' : '',
        birth_date: res.segurado.dataNascimento || '',
        email: res.segurado.email || '',
        phone: res.segurado.telefone || '',
        cep: res.segurado.cep || '',
        rua: res.segurado.rua || '',
        numero: res.segurado.numero || '',
        bairro: res.segurado.bairro || '',
        cidade: res.segurado.cidade || '',
        estado: res.segurado.estado || '',
      }

      expect(clienteDraft.name).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
      expect(clienteDraft.birth_date).toBe('1990-08-02')
      expect(clienteDraft.cpf).toBe('057.365.924-95')
      expect(clienteDraft.email).toBe('paulagabrieladv@gmail.com')
      expect(clienteDraft.phone).toContain('(83) 99112-9729')
      expect(clienteDraft.cep).toBe('58037-335')
      expect(clienteDraft.rua).toBe('R Doralice de Almeida Lyra')
      expect(clienteDraft.numero).toBe('55')
      expect(clienteDraft.bairro).toBe('Jardim Oceania')
      expect(clienteDraft.cidade).toBe('João Pessoa')
      expect(clienteDraft.estado).toBe('PB')

      expect(res.condutorPrincipal.nome).toBe('PAULA GABRIELA DE MORAIS NEGREIROS')
      expect(res.condutorPrincipal.cpf).toBe('08818123408')
      expect(res.condutorPrincipal.mesmoQueSegurado).toBe(false)

      expect(res.veiculo.marcaModelo).toBe('NOVO ONIX HATCH LT 1.0 12V FLEX')
      expect(res.veiculo.placa).toBe('QSI2A04')
      expect(res.veiculo.chassi).toBe('9BGEB48A0LG219020')

      expect(res.premioLiquido).toBe(1486.42)
      expect(res.iof).toBe(109.7)
      expect(res.premioTotal).toBe(1596.12)
      expect(res.quantidadeParcelas).toBe(1)
    })

    it('(a.2-sequencial) Azul Seguros / Porto Seguro (Layout Real de Fluxo Sequencial de Colunas): rótulos empilhados seguidos de valores empilhados', () => {
      // Texto com o layout real descrito no diagnóstico da auditoria:
      // Rótulos empilhados primeiro, depois valores empilhados (sem pipes de tabela GFM)
      const textoSequencialReal = `
Proposta de Seguro Auto
Azul Seguros
Proposta 12-31784355

Dados Gerais
Segurado(a)
Nascimento
CPF
LIVIA LOURENCO FERNANDES DA CUNHA BARROS
02/08/1990
057.365.924-95

Endereço residencial
Complemento
CEP
UF
Bairro
Cidade
R Doralice de Almeida Lyra, 55
-
58037-335
PB
Jardim Oceania
João Pessoa

E-mail: paulagabrieladv@gmail.com
Telefone: (83) 99112-9729

Veículo
QSI2A04
9BGEB48A0LG219020
NOVO ONIX HATCH LT 1.0 12V FLEX
2020 / 2020

Vigência
Das 24h do dia 10/10/2026 até as 24h do dia 10/10/2027

Canais de atendimento
Porto Seguro Cia de Seguros Gerais
CNPJ: 61.198.164/0001-60
      `.trim()

      const res = parsePropostaTexto(textoSequencialReal, 'proposta-azul-sequencial.pdf')

      // Verificação campo a campo dos 11 valores-alvo obrigatórios:
      expect(res.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
      expect(res.segurado.dataNascimento).toBe('1990-08-02')
      expect(res.segurado.cpfCnpj).toBe('05736592495')
      expect(res.segurado.tipoPessoa).toBe('PF')
      expect(res.segurado.email).toBe('paulagabrieladv@gmail.com')
      expect(res.segurado.telefone).toBe('(83) 99112-9729')
      expect(res.segurado.cep).toBe('58037-335')
      expect(res.segurado.rua).toBe('R Doralice de Almeida Lyra')
      expect(res.segurado.numero).toBe('55')
      expect(res.segurado.bairro).toBe('Jardim Oceania')
      expect(res.segurado.cidade).toBe('João Pessoa')
      expect(res.segurado.estado).toBe('PB')

      // Simulação do preenchimento do modal (Conferir e Cadastrar Cliente da Proposta)
      const tipoPessoa = res.segurado.tipoPessoa || 'PF'
      const modalFormData = {
        name: res.segurado.nome || '',
        tipo_pessoa: tipoPessoa,
        cpf: tipoPessoa === 'PF' ? '057.365.924-95' : '',
        birth_date: res.segurado.dataNascimento || '',
        email: res.segurado.email || '',
        phone: res.segurado.telefone || '',
        cep: res.segurado.cep || '',
        rua: res.segurado.rua || '',
        numero: res.segurado.numero || '',
        bairro: res.segurado.bairro || '',
        cidade: res.segurado.cidade || '',
        estado: res.segurado.estado || '',
      }

      expect(modalFormData.name).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
      expect(modalFormData.birth_date).toBe('1990-08-02')
      expect(modalFormData.cpf).toBe('057.365.924-95')
      expect(modalFormData.email).toBe('paulagabrieladv@gmail.com')
      expect(modalFormData.phone).toBe('(83) 99112-9729')
      expect(modalFormData.cep).toBe('58037-335')
      expect(modalFormData.rua).toBe('R Doralice de Almeida Lyra')
      expect(modalFormData.numero).toBe('55')
      expect(modalFormData.bairro).toBe('Jardim Oceania')
      expect(modalFormData.cidade).toBe('João Pessoa')
      expect(modalFormData.estado).toBe('PB')
    })

    it('(a.2-sem-escopo) Resiliência Decisiva: Se regex de escopo "Dados Gerais" for danificado ou não casar, o fallback global extrai 100% dos campos de LIVIA LOURENCO sem falhas', () => {
      // Simula um markdown onde o título "Dados Gerais" foi completamente alterado/ausente
      // mas as tabelas GFM do segurado, endereço e contato continuam presentes no corpo do texto útil
      const markdownSemEscopo = `
# Proposta de Seguro Auto

# Azul Tradicional

**Dados da cotação**

| Orçamento | Versão | Oferta | Proposta | Apólice | Status |
| --- | --- | --- | --- | --- | --- |
| 6320779928 | 0 | 1 | 12-31784355 | 03 14696320 | Emitido |

## Vigência

Das 24h do dia 10/10/2026 até as 24h do dia 10/10/2027

**Corretor(a)**

| Corretor CRED10MIX CORRETORA DE SEGUROS LTDA | Participação | Líder | SUSEP | Telefone | E-mail |
| --- | --- | --- | --- | --- | --- |
| Corretor CRED10MIX CORRETORA DE SEGUROS LTDA | 100.00% | Sim | 1676SJ | (81) 3224-0174 | thiago@cred10mix.com.br |

| Segurado(a) | Nascimento | CPF |
| --- | --- | --- |
| LIVIA LOURENCO FERNANDES DA CUNHA BARROS | 02/08/1990 | 057.365.924-95 |

| Endereço residencial | Complemento | CEP | Bairro | Cidade | UF |
| --- | --- | --- | --- | --- | --- |
| R Doralice de Almeida Lyra, 55 | - | 58037-335 | Jardim Oceania | João Pessoa | PB |

| E-mail | Telefone | Tipo de envio | Enviar correspondência para |
| --- | --- | --- | --- |
| paulagabrieladv@gmail.com | Celular: (83) 99112-9729 | DIGITAL | SEGURADO |

**Veículo**

| Placa | Chassi | Veículo | Ano Fabricação / Modelo |
| --- | --- | --- | --- |
| QSI2A04 | 9BGEB48A0LG219020 | 6140 -- NOVO ONIX HATCH LT 1.0 12V FLEX | 2020 / 2020 |

## Canais de atendimento

**Porto Seguro Cia de Seguros Gerais**
CNPJ: 61.198.164/0001-60
      `.trim()

      const res = parsePropostaTexto(markdownSemEscopo, 'proposta-sem-escopo.pdf')

      // Assert campo a campo: resiliência global garantiu extração mesmo SEM o título "Dados Gerais"
      expect(res.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
      expect(res.segurado.dataNascimento).toBe('1990-08-02')
      expect(res.segurado.cpfCnpj).toBe('05736592495')
      expect(res.segurado.email).toBe('paulagabrieladv@gmail.com')
      expect(res.segurado.telefone).toBe('(83) 99112-9729')
      expect(res.segurado.cep).toBe('58037-335')
      expect(res.segurado.rua).toBe('R Doralice de Almeida Lyra')
      expect(res.segurado.numero).toBe('55')
      expect(res.segurado.bairro).toBe('Jardim Oceania')
      expect(res.segurado.cidade).toBe('João Pessoa')
      expect(res.segurado.estado).toBe('PB')
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
