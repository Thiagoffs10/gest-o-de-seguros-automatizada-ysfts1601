import { describe, it, expect } from 'vitest'
import { detectarFormatoProposta, parsePropostaTexto, isNomePessoaValido } from './proposta-parsers'

// Texto real extraído do PDF "Renovação  JOSE CALIXTO DA SILVA NETO.pdf" (MAPFRE Auto)
const TEXTO_REAL_MAPFRE_CALIXTO = `
Proposta de Seguro MAPFRE Auto - 231
**CNPJ**.: 61.074.175/0001-38
Modalidade: 224 - Auto
Processo SUSEP Automóvel Nº 15414.100326/2004-83
Versão das Condições Gerais Nº: CGAUTO042 Vigente a partir: 02/09/2026

**Dados do Seguro Vigência: das 24 horas do dia** 22/10/2026 **até as 24 horas do dia** 22/10/2027
**Proposta:** 2310313139328 **Data Proposta-Hora** 20/10/2026 - 00:00:00 **Tipo Cálculo:** ANUAL
**Cotação nº:** 2610298351570 **KIT DIGITAL

**Dados do Segurado / Correspondência**
**Nome do Segurado:** JOSE CALIXTO DA SILVA NETO **Tipo Pessoa:** FISICA **CPF:** 082.831.014-98
**Data Nasc.:** 26/02/1994 **Sexo:** MASCULINO **Est.Civil:** CASADO
**E-mail:** JCALIXTOSN@GMAIL.COM **Atividade:** MEDICO
**Tel.Celular:** (83) 99177-6469 **Tel.Res.:** (83) 9177-6469
**Endereço:** RUA JURACY DE CARVALHO LUNA **Nº** 68 **Compl.:** -
**Bairro:** BRISAMAR **Cidade:** JOAO PESSOA **UF:** PB **CEP:** 58034-240

**Dados do Veículo e do Seguro**
**Veículo:** 68;159;1; PI400603 VOLKSWAGEN - TAOS COMFORTLINE 250 1.4 TSI TB AT6 (Flex) A/G 4p
|Ano Modelo: 2024|0Km: NÃO||
|Chassi: 8AWBJ6B29RA824716|Placa: SLE7G82||
|Tipo de Seguro: RENOVAÇÃO MAPFRE|Sinistro na Última Vigência: NÃO|Classe de Bônus: 10|
|Seguradora Anterior: 6238 - MAPFRE SEGUROS GERAIS S/A|Nr. da Apólice Anterior: 60519629931|Nro. Item: 1|
Modalidade**: VALOR DE MERCADO REFERENCIADO Fator de Ajuste: 100%
Tabela de Referência: FIPE (www.fipe.org.br)(005527-1) Tabela Substituta: Molicar - Revista do Carro
(**) Caso o segurado opte pela modalidade de indenização Valor de Mercado Referenciado, o valor da indenização será obtido mediante aplicação do fator de ajuste, contratado pelo Segurado sobre o valor que constar na tabela FIPE divulgada no site www.fipe.org.br a ser utilizada na data da ocorrência do sinistro.

Questionário de Avaliação de Risco
**- Nome do Principal Condutor:** JOSE CALIXTO DA SILVA NETO **CPF:** 082.831.014-98
**- Data de Nascimento Condutor:** 26/02/1994
- CEP de pernoite do veículo: 58034-240 Cidade: JOAO PESSOA UF: PB

## Coberturas
Casco - Colisão, Incêndio, Roubo e Furto 100% FIPE 1.028,14
RCFA - Danos Materiais 200.000,00 323,73
RCFA - Danos Corporais 100.000,00 56,44
RCFA - Danos Morais / Estéticos 5.000,00 16,86

## Prêmios
## Prêmio Líquido Encargos IOF Prêmio Total
1.992,41 0,00 147,04 2.139,45

Formas de Pagamento
|Condições de Pagamento: Código do Plano:|2310 - CR - 10 parc (Sem Juros)|Valor da Primeira:|213,94|
|Taxa de Juros pactuada:||Valor das demais:|213,99|
Cartão de Crédito: 0 Validade do Cartão: TID: 0
Gestor: 77770042 Dia de Vencimento:

**Prêmio Liquido da Apólice Anterior:** 2.182,23

Dados da Seguradora: MAPFRE SEGUROS GERAIS S/A CNPJ: 61.074.175/0001-38 Código SUSEP: 6238
Endereço completo: AV DAS NACOES UNIDAS, 14.261 - ALA A - VILA GERTRUDES - SAO PAULO - SP - 04794-000

Dados do Corretor: 5650 - CRED10MIX COR DE SEGS LTDA
CPF/CNPJ: 17.648.302/0001-73 Código SUSEP: 00000202062795 Telefone: (81) 3493-9966
`

describe('Parser Proposta MAPFRE Auto - Renovação José Calixto', () => {
  it('detecta corretamente o formato como MAPFRE', () => {
    const formato = detectarFormatoProposta(
      TEXTO_REAL_MAPFRE_CALIXTO,
      'Renovação  JOSE CALIXTO DA SILVA NETO.pdf',
    )
    expect(formato).toBe('MAPFRE')
  })

  it('valida que linhas de cotação e kit digital não são nomes de pessoa', () => {
    expect(isNomePessoaValido('Cotação nº: 2610298351570 KIT DIGITAL')).toBe(false)
    expect(isNomePessoaValido('KIT DIGITAL')).toBe(false)
    expect(isNomePessoaValido('2610298351570')).toBe(false)
    expect(isNomePessoaValido('JOSE CALIXTO DA SILVA NETO')).toBe(true)
  })

  it('extrai com perfeição todos os 12 campos apontados nos requisitos', () => {
    const resultado = parsePropostaTexto(
      TEXTO_REAL_MAPFRE_CALIXTO,
      'Renovação  JOSE CALIXTO DA SILVA NETO.pdf',
    )

    // 1. Segurado: Nome = JOSE CALIXTO DA SILVA NETO (NUNCA Cotação / KIT DIGITAL)
    expect(resultado.segurado.nome).toBe('JOSE CALIXTO DA SILVA NETO')
    expect(resultado.segurado.cpfCnpj).toBe('08283101498')
    expect(resultado.segurado.tipoPessoa).toBe('PF')
    expect(resultado.segurado.dataNascimento).toBe('1994-02-26')
    expect(resultado.segurado.email).toBe('JCALIXTOSN@GMAIL.COM')
    expect(resultado.segurado.telefone).toBe('(83) 99177-6469')
    expect(resultado.segurado.rua).toBe('RUA JURACY DE CARVALHO LUNA')
    expect(resultado.segurado.numero).toBe('68')
    expect(resultado.segurado.bairro).toBe('BRISAMAR')
    expect(resultado.segurado.cidade).toBe('JOAO PESSOA')
    expect(resultado.segurado.estado).toBe('PB')
    expect(resultado.segurado.cep).toBe('58034-240')

    // 2. Número da Proposta: 2310313139328
    expect(resultado.numeroProposta).toBe('2310313139328')

    // 3. Número da Apólice: vazio (proposta de renovação não emitiu nova apólice ainda, sem lixo)
    expect(resultado.numeroApolice).toBe('')

    // 4. Vigência: 2026-10-22 até 2027-10-22
    expect(resultado.vigenciaInicio).toBe('2026-10-22')
    expect(resultado.vigenciaFim).toBe('2027-10-22')

    // 5. Prêmio Líquido: 1992.41
    expect(resultado.premioLiquido).toBe(1992.41)

    // 6. IOF: 147.04
    expect(resultado.iof).toBe(147.04)

    // 7. Prêmio Total: 2139.45
    expect(resultado.premioTotal).toBe(2139.45)

    // 8. Quantidade de parcelas e descrição
    expect(resultado.quantidadeParcelas).toBe(10)
    expect(resultado.parcelamentoDescricao).toBe('10x sem juros (1ª R$ 213,94; demais R$ 213,99)')

    // 9. Veículo: marcaModelo limpo sem código grid de cabeçalho
    expect(resultado.veiculo.marcaModelo).toBe(
      'VOLKSWAGEN - TAOS COMFORTLINE 250 1.4 TSI TB AT6 (Flex) A/G 4p',
    )
    expect(resultado.veiculo.placa).toBe('SLE7G82')
    expect(resultado.veiculo.chassi).toBe('8AWBJ6B29RA824716')
    expect(resultado.veiculo.anoModelo).toBe(2024)
    expect(resultado.veiculo.anoFabricacao).toBe(2024)

    // 10. Código FIPE: vazio (não pega palavra 'divulgada')
    expect(resultado.veiculo.codigoFipe).toBe('')

    // 11. Condutor Principal: JOSE CALIXTO DA SILVA NETO
    expect(resultado.condutorPrincipal.nome).toBe('JOSE CALIXTO DA SILVA NETO')
    expect(resultado.condutorPrincipal.cpf).toBe('08283101498')
    expect(resultado.condutorPrincipal.dataNascimento).toBe('1994-02-26')
    expect(resultado.condutorPrincipal.mesmoQueSegurado).toBe(true)

    // 12. Forma de Pagamento
    expect(resultado.formaPagamento).toBe('Crédito')

    // Verificação de Renovação
    expect(resultado.renovacao.isRenovacao).toBe(true)
    expect(resultado.renovacao.apoliceAnterior).toBe('60519629931')
    expect(resultado.renovacao.seguradoraAnterior).toContain('MAPFRE')
    expect(resultado.renovacao.classeBonus).toBe('10')

    // Tipo de Seguro
    expect(resultado.tipoSeguro).toBe('Auto')
    expect(resultado.seguradoraNome).toBe('Mapfre')
  })
})
