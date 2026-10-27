import { describe, it, expect } from 'vitest'
import {
  detectarFormatoProposta,
  parsePropostaTexto,
  isNomePessoaValido,
  isTextoCabecalhoOuInvalido,
  extrairPropostaBradesco,
} from './proposta-parsers'

// Texto real representativo extraído do PDF "Proposta 26.pdf" (Bradesco Auto/RE)
// correspondente à proposta 867700708 do segurado LUCAS RUFINO DA SILVA
export const TEXTO_REAL_BRADESCO_LUCAS = `
Cálculo Online 00SvgTl | 0000CRB | 0000000 Chassi Decodificado Página 1 de 6
Esta proposta não pressupõe aceitação prévia da seguradora.
Proprietário: Para fins de aceitação deste seguro o proprietário declarado deve ser aquele que consta no registro do DENATRAN.

BRADESCO AUTO/RE COMPANHIA DE SEGUROS
CNPJ: 92.682.038/0001-00 - Código SUSEP: 0531-2
Proposta de Seguro Automóvel
Proposta: 867700708 Data de Emissão: 21/10/2026

DADOS DO PROPONENTE Nome: LUCAS RUFINO DA SILVA CPF/CNPJ: 114.772.254-47 Tipo Pessoa: Física Sexo: Masculino Data de Nascimento: 17/09/1996 Doc. Ident.: 9382299 Natureza do Doc.: RECIFE Órgão Exp.: SDS Data de Exp.: 11/10/2019 Estado Civil: Endereço de Pernoite: Rua Cabrobo 53 Bairro: Janga Cidade / UF: Paulista-Pe CEP: 53437-160 Endereço de Correspondência: Rua Cabrobo 53 Bairro: Janga Cidade / UF: Paulista-Pe CEP: 53437-160 Tel. Comercial: Tel. Residencial: Tel. Celular: 55 (81) 98576-1027 E-mail: lucas10rufino@hotmail.com Segurado é o proprietário do veículo ? Sim Segurado é o principal condutor ? Não

DADOS DO SEGURO Vigência: das 24h de 31/10/2026 às 24h de 31/10/2027 Tipo Seguro: Individual Renovação: Sim Cia: 544 Suc.: 867 Apólice.: 368553 Item: 0001 CI: 53125123673761 Bônus: 04 Sinistro? Não Quant.: 00

Cálculo Online 00SvgTl | 0000CRB | 0000000 Chassi Decodificado Página 2 de 6

OBJETO DO SEGURO |Tipo do Veículo: Argo Drive 1.0 6v Flex|||Chassi:|9BD358A4NKYJ07863||| |Marca:|FIAT||Placa:|PCW7629||Nº Eixos:|02|| |Ano Fab.:|2018|Ano Mod.:|Zero KM:|Não||Antifurto:|Não|| |Código FIPE: 0014940|

COBERTURAS E LIMITES MÁXIMOS DE INDENIZAÇÃO
Casco Compreensiva 100% FIPE Franquia: R$ 3.850,00
RCF-V Danos Materiais R$ 100.000,00
RCF-V Danos Corporais R$ 100.000,00

PRÊMIOS (R$) LÍQUIDO (Auto+RCF+APP): 2.198,15 |Prêmio Residencial:|0,00|Quant. Parcelas:|10| |Custo de Emissão:|0,00|Taxa de Juros:|0,00%| |Adic. Fracionamento:|0,00|1º Parcela:|236,10| |IOF:|162,22|Demais:|236,03| TOTAL: 2.360,37

Cálculo Online 00SvgTl | 0000CRB | 0000000 Chassi Decodificado Página 3 de 6

FORMAS DE COBRANÇA - (R$) 1ª Parcela: Ccb Debito Em Conta CCB Nº: 304210463 ... Demais Parcelas: Debito Em Conta Corrente Valor: 236,10 Banco: 237

QUESTIONÁRIO DE AVALIAÇÂO DE RISCO Características do principal condutor Características do proprietário Nome: AILTON CAVALCANTI DA SILVA Tipo Pessoa: Física CPF/CNPJ: 419.591.084-68 Nome: LUCAS RUFINO DA SILVA Data Nasc.: 18/11/1964 CPF/CNPJ: 114.772.254-47 Sexo: Masculino Estado Civil: Casado/uniao Estavel

Cálculo Online 00SvgTl | 0000CRB | 0000000 Chassi Decodificado Página 4 de 6
`

describe('Parser Proposta Bradesco Auto/RE - Proposta 26 (Lucas Rufino da Silva)', () => {
  it('detecta corretamente o formato como BRADESCO', () => {
    const formato = detectarFormatoProposta(TEXTO_REAL_BRADESCO_LUCAS, 'Proposta 26.pdf')
    expect(formato).toBe('BRADESCO')
  })

  it('validações de proteção e filtros de rodapé/cabeçalho', () => {
    // Rodapé repetido em todas as páginas NUNCA pode ser nome
    expect(
      isNomePessoaValido(
        'Cálculo Online 00SvgTl 0000CRB 0000000 Chassi Decodificado Página 1 de 6',
      ),
    ).toBe(false)
    expect(isNomePessoaValido('Cálculo Online')).toBe(false)
    expect(isNomePessoaValido('Chassi Decodificado')).toBe(false)
    expect(isNomePessoaValido('Página 1 de 6')).toBe(false)
    expect(isNomePessoaValido('Proprietário: Para fins')).toBe(false)
    expect(isNomePessoaValido('Esta proposta não pressupõe')).toBe(false)
    expect(isNomePessoaValido('0000000')).toBe(false)

    expect(isNomePessoaValido('LUCAS RUFINO DA SILVA')).toBe(true)
    expect(isNomePessoaValido('AILTON CAVALCANTI DA SILVA')).toBe(true)

    expect(isTextoCabecalhoOuInvalido('Cálculo Online')).toBe(true)
    expect(isTextoCabecalhoOuInvalido('Página')).toBe(true)
  })

  it('função direta extrairPropostaBradesco extrai todos os campos alvo corretamente', () => {
    const bData = extrairPropostaBradesco(TEXTO_REAL_BRADESCO_LUCAS)
    expect(bData).not.toBeNull()
    if (!bData) return

    expect(bData.numeroProposta).toBe('867700708')
    expect(bData.vigenciaInicio).toBe('2026-10-31')
    expect(bData.vigenciaFim).toBe('2027-10-31')

    // Segurado
    expect(bData.segurado?.nome).toBe('LUCAS RUFINO DA SILVA')
    expect(bData.segurado?.cpfCnpj).toBe('11477225447')
    expect(bData.segurado?.dataNascimento).toBe('1996-09-17')
    expect(bData.segurado?.rua).toBe('Rua Cabrobo 53')
    expect(bData.segurado?.bairro).toBe('Janga')
    expect(bData.segurado?.cidade).toBe('Paulista')
    expect(bData.segurado?.estado).toBe('PE')
    expect(bData.segurado?.cep).toBe('53437-160')
    expect(bData.segurado?.telefone).toBe('(81) 98576-1027')
    expect(bData.segurado?.email).toBe('lucas10rufino@hotmail.com')

    // Prêmios
    expect(bData.premioLiquido).toBe(2198.15)
    expect(bData.iof).toBe(162.22)
    expect(bData.premioTotal).toBe(2360.37)

    // Parcelamento
    expect(bData.quantidadeParcelas).toBe(10)
    expect(bData.formaPagamento).toBe('Débito em Conta')
    expect(bData.parcelamentoDescricao).toBe('10x (1ª R$ 236,10 + 9x R$ 236,03)')

    // Veículo
    expect(bData.veiculo?.marcaModelo).toBe('Argo Drive 1.0 6v Flex')
    expect(bData.veiculo?.placa).toBe('PCW7629')
    expect(bData.veiculo?.chassi).toBe('9BD358A4NKYJ07863')
    expect(bData.veiculo?.codigoFipe).toBe('0014940')
    expect(bData.veiculo?.anoFabricacao).toBe(2018)

    // Renovação
    expect(bData.renovacao?.isRenovacao).toBe(true)
    expect(bData.renovacao?.seguradoraAnterior).toBe('Bradesco')
    expect(bData.renovacao?.apoliceAnterior).toBe('368553')
    expect(bData.renovacao?.classeBonus).toBe('04')

    // Condutor principal
    expect(bData.condutorPrincipal?.nome).toBe('AILTON CAVALCANTI DA SILVA')
    expect(bData.condutorPrincipal?.cpf).toBe('41959108468')
    expect(bData.condutorPrincipal?.dataNascimento).toBe('1964-11-18')
    expect(bData.condutorPrincipal?.mesmoQueSegurado).toBe(false)
  })

  it('pipeline completo parsePropostaTexto gera PropostaExtraida idêntica aos valores-alvo', () => {
    const res = parsePropostaTexto(TEXTO_REAL_BRADESCO_LUCAS, 'Proposta 26.pdf')

    expect(res.formato).toBe('BRADESCO')
    expect(res.seguradoraNome).toBe('Bradesco')
    expect(res.tipoSeguro).toBe('Auto')
    expect(res.numeroProposta).toBe('867700708')
    expect(res.numeroApolice).toBe('')

    // Vigência
    expect(res.vigenciaInicio).toBe('2026-10-31')
    expect(res.vigenciaFim).toBe('2027-10-31')

    // Prêmios
    expect(res.premioLiquido).toBe(2198.15)
    expect(res.iof).toBe(162.22)
    expect(res.premioTotal).toBe(2360.37)

    // Parcelamento
    expect(res.formaPagamento).toBe('Débito em Conta')
    expect(res.quantidadeParcelas).toBe(10)
    expect(res.parcelamentoDescricao).toBe('10x (1ª R$ 236,10 + 9x R$ 236,03)')

    // Segurado (SEM rodapé no nome, SEM engolir telefone na rua)
    expect(res.segurado.nome).toBe('LUCAS RUFINO DA SILVA')
    expect(res.segurado.cpfCnpj).toBe('11477225447')
    expect(res.segurado.dataNascimento).toBe('1996-09-17')
    expect(res.segurado.rua).toBe('Rua Cabrobo 53')
    expect(res.segurado.bairro).toBe('Janga')
    expect(res.segurado.cidade).toBe('Paulista')
    expect(res.segurado.estado).toBe('PE')
    expect(res.segurado.cep).toBe('53437-160')
    expect(res.segurado.telefone).toBe('(81) 98576-1027')
    expect(res.segurado.email).toBe('lucas10rufino@hotmail.com')

    // Condutor principal (Ailton, distinto do segurado)
    expect(res.condutorPrincipal.nome).toBe('AILTON CAVALCANTI DA SILVA')
    expect(res.condutorPrincipal.cpf).toBe('41959108468')
    expect(res.condutorPrincipal.dataNascimento).toBe('1964-11-18')
    expect(res.condutorPrincipal.mesmoQueSegurado).toBe(false)

    // Veículo
    expect(res.veiculo.marcaModelo).toBe('Argo Drive 1.0 6v Flex')
    expect(res.veiculo.placa).toBe('PCW7629')
    expect(res.veiculo.chassi).toBe('9BD358A4NKYJ07863')
    expect(res.veiculo.codigoFipe).toBe('0014940')
    expect(res.veiculo.anoFabricacao).toBe(2018)

    // Renovação
    expect(res.renovacao.isRenovacao).toBe(true)
    expect(res.renovacao.seguradoraAnterior).toBe('Bradesco')
    expect(res.renovacao.apoliceAnterior).toBe('368553')
    expect(res.renovacao.classeBonus).toBe('04')
  })
})
