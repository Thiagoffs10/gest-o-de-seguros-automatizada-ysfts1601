import { describe, it, expect } from 'vitest'
import { parsePropostaTexto, isPortoCelular, extrairPortoCelularProposta } from './proposta-parsers'

// Fixture verbatim baseada no texto bruto real extraído pelo servidor (Proposta 26.pdf)
// Conforme documentado no relatório do usuário e logs do backend
const FIXTURE_PORTO_CELULAR = `
NÚMERO DO ORÇAMENTO PROPOSTA DE SEGURO 117861487

||PORTO SEGURO CIA DE SEGUROS GERAIS|DATA DE CÁLCULO:|ORIGEM N. PROPOSTA COMPANHIA|
|---|---|---|---|
||AVENIDA RIO BRANCO, 1489 - CAMPOS ELÍSEOS - SÃO PAULO - SP - CEP: 01205-905 CNPJ: 61.198.164/0001-60|15/10/2026|117861487|

RAMO: 171 MODALIDADE: 434 - PORTO CELULAR

VIGÊNCIA DAS 00:01 DO DIA / ATE AS 23:59 DO DIA
## 15/10/2026 NOVO
## 15/10/2027

**DADOS GERAIS** PROPONENTE TIPO DE PESSOA CNPJ ALMERINDAS EMPREENDIMENTOS SOCIOAMBIENTAIS LTDA JURÍDICA 51364609/0001-80

TELEFONE COMERCIAL (11)924930875
ENVIAR APÓLICE FÍSICA PARA FINANCEIRO@ALMERINDAS.COM SIM

**ENDEREÇO DO PROPONENTE**
CEP CIDADE ESTADO ENDEREÇO 52050-310 RECIFE PE R. ABELARDO NÚMERO COMPLEMENTO BAIRRO 45 GRACAS

**ENDEREÇO EMPRESARIAL**
CEP CIDADE ESTADO ENDEREÇO 52050-310 RECIFE PE R. ABELARDO NÚMERO COMPLEMENTO BAIRRO 45 GRACAS

**ENDEREÇO DE COBRANÇA**
CEP CIDADE ESTADO ENDEREÇO 52050-310 RECIFE PE R. ABELARDO NÚMERO COMPLEMENTO BAIRRO 45 GRACAS

ITEM 1
LMI / VALOR DE MERCADO: R$ 7.360,59
EQUIPAMENTO: Samsung-GALAXY S25 ULTRA 256GB
IMEI: 357445726540186
DEMONSTRATIVO DE PRÊMIO DO ITEM
PRÊMIO LÍQUIDO COBERTURAS R$ 1.653,71
IOF R$ 122,05
PRÊMIO TOTAL DO ITEM R$ 1.775,76

ITEM 2
LMI / VALOR DE MERCADO: R$ 7.360,59
EQUIPAMENTO: Samsung-GALAXY S25 ULTRA 256GB
IMEI: 357445726548353
DEMONSTRATIVO DE PRÊMIO DO ITEM
PRÊMIO LÍQUIDO COBERTURAS R$ 1.653,71
IOF R$ 122,05
PRÊMIO TOTAL DO ITEM R$ 1.775,76

DEMONSTRATIVO DE PRÊMIO GERAL
PRÊMIO LÍQUIDO TOTAL R$ 3.307,42
CUSTO DE APÓLICE R$ 0,00
I.O.F. R$ 244,09
PRÊMIO TOTAL R$ 3.551,51

FORMA DE PAGAMENTO
21 - 1 x BOLETO BANCARIO
1ª PARCELA R$ 3.551,51
`

describe('Leitor Dedicado Porto Celular (Ramo 171 / Modalidade 434)', () => {
  it('deve detectar formato Porto Celular corretamente', () => {
    expect(isPortoCelular(FIXTURE_PORTO_CELULAR, 'Proposta 26.pdf')).toBe(true)
    expect(
      isPortoCelular('PORTO SEGURO CIA DE SEGUROS - RAMO: 171 MODALIDADE: 434 - PORTO CELULAR'),
    ).toBe(true)
    expect(isPortoCelular('Porto Seguro com aparelho IMEI 357445726540186')).toBe(true)
    expect(isPortoCelular('Proposta Auto Azul Seguros')).toBe(false)
  })

  it('deve extrair com perfeição todos os campos da fixture real de Porto Celular', () => {
    const res = parsePropostaTexto(FIXTURE_PORTO_CELULAR, 'Proposta 26.pdf')

    // Seguradora e Produto
    expect(res.seguradoraNome).toBe('Porto Seguro')
    expect(res.tipoSeguro).toBe('Porto Celular')

    // Número da proposta
    expect(res.numeroProposta).toBe('117861487')
    expect(res.numeroApolice).toBe('') // Proposta nova, sem apólice emitida ainda
    expect(res.renovacao.isRenovacao).toBe(false)

    // Segurado PJ
    expect(res.segurado.tipoPessoa).toBe('PJ')
    expect(res.segurado.nome).toBe('ALMERINDAS EMPREENDIMENTOS SOCIOAMBIENTAIS LTDA')
    expect(res.segurado.cpfCnpj).toBe('51364609000180')
    expect(res.segurado.email).toBe('FINANCEIRO@ALMERINDAS.COM')
    expect(res.segurado.telefone).toBe('(11)924930875')

    // Endereço completo
    expect(res.segurado.cep).toBe('52050-310')
    expect(res.segurado.cidade).toBe('RECIFE')
    expect(res.segurado.estado).toBe('PE')
    expect(res.segurado.rua).toBe('R. ABELARDO')
    expect(res.segurado.numero).toBe('45')
    expect(res.segurado.bairro).toBe('GRACAS')

    // Vigência (15/10/2026 a 15/10/2027)
    expect(res.vigenciaInicio).toBe('2026-10-15')
    expect(res.vigenciaFim).toBe('2027-10-15')

    // Pegadinha do Prêmio: DEVE USAR O DEMONSTRATIVO GERAL (não do item 1!)
    expect(res.premioLiquido).toBe(3307.42)
    expect(res.iof).toBe(244.09)
    expect(res.premioTotal).toBe(3551.51)

    // Parcelamento / Forma de pagamento
    expect(res.formaPagamento).toBe('Boleto')
    expect(res.quantidadeParcelas).toBe(1)
    expect(res.parcelamentoDescricao).toContain('1x de R$ 3.551,51')

    // NÃO deve preencher condutor nem veículo de Auto
    expect(res.condutorPrincipal.nome).toBe('')
    expect(res.condutorPrincipal.cpf).toBeUndefined()
    expect(res.veiculo.marcaModelo).toBe('')
    expect(res.veiculo.placa).toBe('')
    expect(res.veiculo.chassi).toBe('')

    // Observações com os IMEIs dos aparelhos
    expect(res.observacoesApolice).toContain('357445726540186')
    expect(res.observacoesApolice).toContain('357445726548353')
  })

  it('função direta extrairPortoCelularProposta deve manter paridade', () => {
    const res = extrairPortoCelularProposta(FIXTURE_PORTO_CELULAR)
    expect(res.numeroProposta).toBe('117861487')
    expect(res.premioTotal).toBe(3551.51)
    expect(res.premioLiquido).toBe(3307.42)
    expect(res.segurado.nome).toBe('ALMERINDAS EMPREENDIMENTOS SOCIOAMBIENTAIS LTDA')
  })
})
