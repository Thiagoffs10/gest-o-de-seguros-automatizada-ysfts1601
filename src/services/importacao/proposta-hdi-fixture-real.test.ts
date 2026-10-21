import { describe, it, expect } from 'vitest'
import {
  detectarFormatoProposta,
  parsePropostaTexto,
  isNomePessoaValido,
  isTextoCabecalhoOuInvalido,
  extrairPropostaHDI,
} from './proposta-parsers'

// Texto bruto representativo extraído do PDF "Proposta 26.pdf" (HDI Auto Perfil)
// refletindo as tabelas GFM, o formato híbrido e rótulos órfãos exatamente como gerado pelo $documents.toMarkdown
export const TEXTO_REAL_HDI_JULIANA = `## HDI SEGUROS S.A.

## Hdi Auto Perfil-CAD NO-NE-RJ-ES

## Especificação da Proposta 01.145.431.1236385811

## Novo Negócio Versão: 09.97.06

|Nome Social Segurado|:|||
|---|---|---|---|
|Nome de Registro Segurado|: Juliana Soares de Oliveira Rego|CPF|: 050.905.424-22|
|RG|: 050.905.424-2 Órgão Emissor: SDS|Emissão do R.G.|: 05/04/2022|
|Endereço|: Avenida Boa Viagem 5212, 5212|Celular|: (0081)996032454|
|Bairro|: Boa Viagem|||
|Cidade Período de Vigência|: Recife-PE|CEP|: 51030-900|

## Período de Vigência ( 365 dias)
Das 24 h do dia 22/10/2026 às 24 h do dia 22/10/2027

## Informações do Seguro
Moeda: R$ Data Cotação: 20/10/2026 Cotação Base: 1,00000

## Dados de Cobrança
|Banco|: 901|Tipo de Cobrança|: Cartão de Crédito|
|Parcela|: 247,63|Forma de Pagamento|: 10 x|
|Juros parcelamento|: 0,00% a.m.|||
|Multa de Mora|: 2,00% sobre o valor da parcela em atraso.|||
|Juros de Mora|: 0,30% ao dia.|||

O dia de vencimento acima discriminado refere-se à data em que as parcelas do prêmio serão lançadas em sua fatura, não confundindo-se, portanto, com o vencimento desta. O vencimento de sua fatura continuará ocorrendo na data usual acordada com sua operadora de cartão.

## Corretor Inspetor Interno
C-00000202062795-CRED10MIX CORRETORA DE SEGUROS - 100%

## Cálculo do Prêmio
|Prêmio Líquido|:|2.306,13|
|---|---|---|
|Adicional de Parcelamento|:|0,00|
|Custo de Apólice|:|0,00|
|I.O.F.|:|170,19|
|Prêmio Total|:|2.476,32|

Na condição de PROPONENTE, declaro que são verdadeiras as informações ora prestadas, assumindo integral responsabilidade pela exatidão das mesmas.

A tabela de referência utilizada será a FIPE (www.fipe.org.br). Em caso de interrupção ou extinção da tabela de referência, será utilizada tabela substituta Molicar (www.molicar.com.br).

HDI SEGUROS S.A.
Hdi Auto Perfil - CAD NO-NE-RJ-ES
Especificação da Proposta 01.145.431.1236385811
Novo Negócio Versão: 09.97.06

## Dados do Veículo - Item 000001 - Ind.- Novos Negocios
|Proprietário|: Juliana Soares de Oliveira Rego|
|CPF|: 050.905.424/22|
|Beneficiário|:|
|Modelo|: 0005677 - Chery Tiggo 5x Txs 1.5 16v Turbo Flex Aut.|
|Código FIPE|: 073022-0|
|Ano Fabr./Modelo|: 2021/2022|Combustível|: 5-Bi-combustivel|
|---|---|---|
|: RZJ0E33 - PE|Chassi|: 95PBCK51DNB030915|
|: 22-Pick-ups Pesadas (pessoas) : 05-Compreensiva-Valor de Mercado|Passageiros|: 5|
|: 030-Recife I Franquia|: 04-Facultativa 50%|
|Placa/UF|Categoria|Cobertura|Região|CEP Pernoite : 51030900|CEP Circulação : 51030900|

## Dados Anteriores
Código CI :
Cia Anterior : 5886-PORTO SEGURO CIA DE SEGUROS GERAIS
Apólice Anterior : 0000000000000000
Fim Vigência Anterior : 22/10/2026 CI Documento Anterior : 58825491695209
Classe de Bônus : 10 - 30,00% Qtde Sinistros : 0
Solicitação de Vistoria : Sujeito a solicitação de Vistoria Prévia após confirmação dos dados da apólice anterior

## Coberturas Auto (Valores em R$) L.M.I. Prêmio Prêmio Anual Franquia
Casco 100,00% tab. FIPE 1.020,69 1.020,69 4.744,87
RCF-V Danos Materiais 100.000,00 562,64 562,64 0,00
RCF-V Danos Corporais 100.000,00 18,55 18,55
APP Morte 1.500,00 0,57 0,57
APP Invalidez Permanente 1.500,00 0,57 0,57
HDI Auto Vidros **(*1)** 0,00 102,80 102,80
Faróis, Lanternas, Retrov, Auxiliar**(*2)** 0,00 99,03 99,03
07 Dias Cr Manual**(*3)** 0,00 31,25 31,25
Teto Solar**(*4)** 0,00 33,10 33,10
Especial Auto - 600km**(*5)** 0,00 436,93 436,93
2.306,13

## Impressão dos Textos Explicativos
(*1)Vidros com franquia de R$ 740,00. Vidro Traseiro com franquia de R$ 670,00. Vidro Lateral com franquia de R$ 190,00. Maquina de Vidros com franquia de R$ 100,00.
(*2)Farol com franquia de R$ 395,00. Lanterna com franquia de R$ 335,00. Retrovisor com franquia de R$ 540,00. Lanterna Led com franquia de R$ 430,00. Farol Auxiliar com franquia de R$ 230,00. Farol Xenon ou Led com franquia de R$ 735,00. Retrovisor Led com franquia de R$ 865,00. Farol Matrix com franquia de R$ 735,00.
(*3)7 dias de Carro Reserva quando terceiro, 7 dias de Carro Reserva com Ar Condicionado
(*4)Teto Solar com franquia de R$ 3.455,00.
(*5)Assistencia 24h - Pacote de Servicos HDI (vide Condicoes Gerais), Guincho 600 KM para Sinistro, Taxi sem franquia.

## Cláusulas e Condições
53 0040 - Danos Morais nao Contratado.

## Nome Social do Condutor:
Condutor : Juliana Soares de Oliveira Rego CPF: 05090542422 Data de Nasc.: 11/10/1997
Faixa Etaria do Condutor : Idade entre 26 e 29 Anos
Sexo : Feminino
Estado Civil : Solteiro(a)

Outros dados
Guarda do Veiculo : Na Residência e Local de Trabalho
Utilizacao do Veiculo : Exclusivamente para Locomocao Diaria
Cob Demais Condutores Resid entre 18 Até 25 Anos : Nao

Cad No-ne-rj-es, 21 de outubro de 2026.
HDI SEGUROS S.A. - 6572
CNPJ 29.980.158/0102-09 Processo Susep Nº: 15414.001197/2004-41
Serviço de Atendimento ao Consumidor (SAC): 0800 722 7149
Ouvidoria Independente HDI SEGUROS S.A.
Canal de comunicação com a HDI SEGUROS S.A.: www.hdi.com.br
`

describe('Parser Proposta HDI Seguros Auto - Proposta 26 (Juliana Soares)', () => {
  it('detecta corretamente o formato como HDI', () => {
    const formato = detectarFormatoProposta(TEXTO_REAL_HDI_JULIANA, 'Proposta 26.pdf')
    expect(formato).toBe('HDI')
  })

  it('não deve confundir menção à seguradora anterior Porto Seguro como formato PORTO_SEGURO', () => {
    // Mesmo contendo "PORTO SEGURO CIA DE SEGUROS GERAIS" como seguradora anterior,
    // o cabeçalho HDI SEGUROS S.A. e produto Hdi Auto Perfil devem prevalecer
    const formato = detectarFormatoProposta(TEXTO_REAL_HDI_JULIANA, 'Proposta 26.pdf')
    expect(formato).toBe('HDI')
  })

  it('validações de proteção: nome, cidade e títulos inválidos', () => {
    // "de Registro Segurado" é pedaço quebrado de rótulo e NUNCA pode ser nome
    expect(isNomePessoaValido('de Registro Segurado')).toBe(false)
    expect(isNomePessoaValido('Registro Segurado')).toBe(false)
    expect(isNomePessoaValido('Hdi Auto Perfil')).toBe(false)
    expect(isNomePessoaValido('C-00000202062795-CRED10MIX')).toBe(false)
    expect(isNomePessoaValido('Juliana Soares de Oliveira Rego')).toBe(true)

    // "Período de Vigência" é cabeçalho de seção e NUNCA pode ser cidade
    expect(isTextoCabecalhoOuInvalido('Período de Vigência')).toBe(true)
    expect(isTextoCabecalhoOuInvalido('Recife')).toBe(false)
  })

  it('extrai todos os campos corretamente sem cair nas armadilhas de franquias e rótulos órfãos', () => {
    const resultado = parsePropostaTexto(TEXTO_REAL_HDI_JULIANA, 'Proposta 26.pdf')

    // 1. Seguradora e Formato
    expect(resultado.formato).toBe('HDI')
    expect(resultado.seguradoraNome).toBe('HDI Seguros')
    expect(resultado.tipoSeguro).toBe('Auto')

    // 2. Número da Proposta
    expect(resultado.numeroProposta).toBe('01.145.431.1236385811')
    expect(resultado.numeroApolice).toBe('')

    // 3. Vigência
    expect(resultado.vigenciaInicio).toBe('2026-10-22')
    expect(resultado.vigenciaFim).toBe('2027-10-22')

    // 4. Segurado
    expect(resultado.segurado.nome).toBe('Juliana Soares de Oliveira Rego')
    expect(resultado.segurado.cpfCnpj).toBe('05090542422')
    expect(resultado.segurado.tipoPessoa).toBe('PF')
    expect(resultado.segurado.dataNascimento).toBe('1997-10-11')
    expect(resultado.segurado.rua).toBe('Avenida Boa Viagem 5212')
    expect(resultado.segurado.numero).toBe('5212')
    expect(resultado.segurado.bairro).toBe('Boa Viagem')
    expect(resultado.segurado.cidade).toBe('Recife')
    expect(resultado.segurado.estado).toBe('PE')
    expect(resultado.segurado.cep).toBe('51030-900')

    // 5. Telefone: extrai celular e normaliza (0081)996032454
    expect(resultado.segurado.telefone).toBe('(81) 996032454')
    // Telefone preenchido não deixa campo faltante
    const faltaTelefone = resultado.camposFaltantes.some((f) => f.campo === 'phone')
    expect(faltaTelefone).toBe(false)

    // 6. Condutor Principal: campos separados
    expect(resultado.condutorPrincipal.nome).toBe('Juliana Soares de Oliveira Rego')
    expect(resultado.condutorPrincipal.cpf).toBe('05090542422')
    expect(resultado.condutorPrincipal.dataNascimento).toBe('1997-10-11')
    expect(resultado.condutorPrincipal.mesmoQueSegurado).toBe(true)

    // 7. Prêmios: Cálculo do Prêmio real (NUNCA 740 / 670 / 3455 das franquias de vidros/teto)
    expect(resultado.premioLiquido).toBe(2306.13)
    expect(resultado.iof).toBe(170.19)
    expect(resultado.premioTotal).toBe(2476.32)

    // 8. Forma de Pagamento e Parcelas
    expect(resultado.formaPagamento).toBe('Crédito')
    expect(resultado.quantidadeParcelas).toBe(10)
    expect(resultado.parcelamentoDescricao).toContain('10x de R$ 247,63')

    // 9. Veículo: descarte de prefixo numérico do catálogo "0005677 - ", não pegar "Recife I"
    expect(resultado.veiculo.marcaModelo).toBe('Chery Tiggo 5x Txs 1.5 16v Turbo Flex Aut.')
    expect(resultado.veiculo.placa).toBe('RZJ0E33')
    expect(resultado.veiculo.chassi).toBe('95PBCK51DNB030915')
    expect(resultado.veiculo.codigoFipe).toBe('073022-0')
    expect(resultado.veiculo.anoFabricacao).toBe(2021)
    expect(resultado.veiculo.anoModelo).toBe(2022)

    // 10. Renovação: Cia Anterior Porto Seguro, apólice anterior de zeros descartada
    expect(resultado.renovacao.isRenovacao).toBe(true)
    expect(resultado.renovacao.seguradoraAnterior).toContain('PORTO SEGURO')
    expect(resultado.renovacao.apoliceAnterior).toBeUndefined()
    expect(resultado.renovacao.classeBonus).toBe('10')
  })
})
