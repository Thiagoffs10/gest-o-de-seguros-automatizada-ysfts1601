import { describe, it, expect } from 'vitest'
import { parsePropostaTexto, extrairPropostaInlineAzul } from './proposta-parsers'

// FIXTURE REAL VERBATIM do clique do usuário (sequência exata, sem adulteração):
const FIXTURE_REAL_VERBATIM =
  '# Proposta de Seguro Auto\n\n' +
  'Azul Tradicional\n\n' +
  '**Dados da cotação**\n\n' +
  '**Orçamento Versão Oferta Proposta Apólice Status** 6320779928 12-31784355 03 14696320 Emitido **Vigência** Das 24h do dia 10/10/2026 até as 24h do dia 10/10/2027\n\n' +
  '**Corretor(a)** **Corretor Participação Líder SUSEP Telefone E-mail** CRED10MIX CORRETORA DE 100.00% Sim 1676SJ (81) 3224-0174 thiago@cred10mix.com.br SEGUROS LTDA\n\n' +
  '**Dados Gerais** **Segurado(a) Nascimento CPF** LIVIA LOURENCO FERNANDES DA CUNHA BARROS 02/08/1990 057.365.924-95 **Sexo Profissão País de nascimento** Feminino 387-Administradores Brasil\n\n' +
  '**Tipo de Operação Segmento Bônus Origem do bônus** Renovação da Cia Azul Classe 1- Tradicional **Seguradora Sucursal Apólice Item** Azul Seguros 3 12806713 1\n\n' +
  '**Endereço residencial Complemento CEP Bairro Cidade UF** R Doralice de Almeida Lyra, 55-58037-335 Jardim Oceania João Pessoa PB **E-mail Telefone Tipo de envio Enviar correspondência para** paulagabrieladv@gmail.com Celular: (83) 99112-9729 DIGITAL SEGURADO\n\n' +
  '**Veículo** **Placa Chassi Veículo Ano Fabricação / Modelo** QSI2A04 9BGEB48A0LG219020 6140 - - NOVO ONIX HATCH LT 1.0 12V FLEX 2020 / 2020 **Fipe Zero km Câmbio Blindado Kit Gás Pessoa com deficiência Isenção Fiscal Portas** 45179 N Manual Não Não Não Sem Isenção 5 **Combustível Categoria** GASOLINA/ALCOOL 10 - VEICULOS DE PASSEIO\n\n' +
  '**Questionário de avaliação de risco¹** **Condutor Nascimento CPF** PAULA GABRIELA DE MORAIS NEGREIROS 15/10/1996 088.181.234-08\n\n' +
  '**Tipo de uso CEP de pernoite Dispositivos antifurto/anti-roubo** Particular 58037-335 Outros Dispositivos, Não **Seguro do corretor** Não\n\n' +
  '**Coberturas e serviços automóvel**\n\n' +
  '|Descrição|LMI (indenização)|Franquia|Valor do Prêmio|\n' +
  '|---|---|---|---|\n' +
  '|Compreensiva (Colisão, Incêndio, Roubo ou|100.00%|R$ 3.804,00 (50% da|R$ 1.018,84|\n' +
  '|Furto) - Valor de mercado||Obrigatória)||\n' +
  '|RCF-V Danos Materiais|R$ 50.000,00|-|R$ 380,53|\n' +
  '|RCF-V Danos Corporais|R$ 50.000,00|-|R$ 23,47|\n' +
  '|Custos de defesa auto|Não contratado|-|-|\n\n' +
  '## Forma de pagamento\n\n' +
  '|Forma de pagamento|Valor líquido|IOF|Juros|Encargos|Parcelas|Valor parcelas|Valor total|\n' +
  '|---|---|---|---|---|---|---|---|\n' +
  '|97-Todas Cartão de Crédito Porto Bank (Existente)|R$ 1.486,42|R$ 109,70|R$ 0,00|R$ 0,00|1x|R$ 1.596,12|R$ 1.596,12|\n' +
  '|Bandeira VISA|||||||\n\n' +
  '## Canais de atendimento\n\n' +
  '**Porto Seguro Cia de Seguros Gerais**\n\n' +
  '**CNPJ:** 61.198.164/0001-60\n\n' +
  '**Código da Seguradora:** 05886\n\n' +
  '**Processo SUSEP:** 15414.610648/2024-80\n\n' +
  '## SAC\n\n' +
  '0800 727 2766\n\n' +
  '## Termos e condições\n\n' +
  'Uso Interno da Cia'

// Versão estrita exatamente conforme o snippet da descrição da tarefa (sem páginas adicionais):
const FIXTURE_EXATA_SNIPPET =
  '# Proposta de Seguro Auto\n\nAzul Tradicional\n\n**Dados da cotação**\n\n**Orçamento Versão Oferta Proposta Apólice Status** 6320779928 12-31784355 03 14696320 Emitido **Vigência** Das 24h do dia 10/10/2026 até as 24h do dia 10/10/2027\n\n**Corretor(a)** **Corretor Participação Líder SUSEP Telefone E-mail** CRED10MIX CORRETORA DE 100.00% Sim 1676SJ (81) 3224-0174 thiago@cred10mix.com.br SEGUROS LTDA\n\n**Dados Gerais** **Segurado(a) Nascimento CPF** LIVIA LOURENCO FERNANDES DA CUNHA BARROS 02/08/1990 057.365.924-95 **Sexo Profissão País de nascimento** Feminino 387-Administradores Brasil\n\n**Tipo de Operação Segmento Bônus Origem do bônus** Renovação da Cia Azul Classe 1- Tradicional **Seguradora Sucursal Apólice Item** Azul Seguros 3 12806713 1\n\n**Endereço residencial Complemento CEP Bairro Cidade UF** R Doralice de Almeida Lyra, 55-58037-335 Jardim Oceania João Pessoa PB **E-mail Telefone Tipo de envio Enviar correspondência para** paulagabrieladv@gmail.com Celular: (83) 99112-9729 DIGITAL SEGURADO\n\n**Veículo** **Placa Chassi Veículo Ano Fabricação / Modelo** QSI2A04 9BGEB48A0LG219020 6140 - - NOVO ONIX HATCH LT 1.0 12V FLEX 2020 / 2020 **Fipe Zero km Câmbio Blindado Kit Gás Pessoa com deficiência Isenção Fiscal Portas** 45179 N Manual Não Não Não Sem Isenção 5 **Combustível Categoria** GASOLINA/ALCOOL 10 - VEICULOS DE PASSEIO\n\n**Questionário de avaliação de risco¹** **Condutor Nascimento CPF** PAULA GABRIELA DE MORAIS NEGREIROS 15/10/1996 088.181.234-08\n\n**Tipo de uso CEP de pernoite Dispositivos antifurto/anti-roubo** Particular 58037-335 Outros Dispositivos, Não **Seguro do corretor** Não\n\n**Coberturas e serviços automóvel**\n\n|Descrição|LMI (indenização)|Franquia|Valor do Prêmio|\n|---|---|---|---|\n|Compreensiva (Colisão, Incêndio, Roubo ou|100.00%|R$ 3.804,00 (50% da|R$ 1.018,84|\n|Furto) - Valor de mercado||Obrigatória)||\n|RCF-V Danos Materiais|R$ 50.000,00|-|R$ 380,53|\n|RCF-V Danos Corporais|R$ 50.000,00|-|R$ 23,47|\n|Custos de defesa auto|Não contratado|-|-|'

describe('Validação Rigorosa da Fixture Real Verbatim Azul/Porto', () => {
  it('extrai os dados da fixture exata do snippet com o leitor inline extrairPropostaInlineAzul', () => {
    const inline = extrairPropostaInlineAzul(FIXTURE_EXATA_SNIPPET)
    expect(inline).not.toBeNull()
    expect(inline?.segurado?.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
    expect(inline?.segurado?.dataNascimento).toBe('1990-08-02')
    expect(inline?.segurado?.cpfCnpj).toBe('05736592495')
    expect(inline?.segurado?.tipoPessoa).toBe('PF')
    expect(inline?.segurado?.email).toBe('paulagabrieladv@gmail.com')
    expect(inline?.segurado?.telefone).toBe('(83) 99112-9729')
    expect(inline?.segurado?.cep).toBe('58037-335')
    expect(inline?.segurado?.rua).toBe('R Doralice de Almeida Lyra')
    expect(inline?.segurado?.numero).toBe('55')
    expect(inline?.segurado?.bairro).toBe('Jardim Oceania')
    expect(inline?.segurado?.cidade).toBe('João Pessoa')
    expect(inline?.segurado?.estado).toBe('PB')

    expect(inline?.condutor?.nome).toBe('PAULA GABRIELA DE MORAIS NEGREIROS')
    expect(inline?.condutor?.mesmoQueSegurado).toBe(false)

    expect(inline?.veiculo?.marcaModelo).toBe('NOVO ONIX HATCH LT 1.0 12V FLEX')
    expect(inline?.veiculo?.placa).toBe('QSI2A04')
    expect(inline?.veiculo?.chassi).toBe('9BGEB48A0LG219020')
    expect(inline?.veiculo?.codigoFipe).toBe('45179')
    expect(inline?.veiculo?.anoFabricacao).toBe(2020)
    expect(inline?.veiculo?.anoModelo).toBe(2020)

    expect(inline?.renovacao?.isRenovacao).toBe(true)
    expect(inline?.renovacao?.seguradoraAnterior).toBe('Azul Seguros')
    expect(inline?.renovacao?.apoliceAnterior).toBe('12806713')
  })

  it('valida o objeto parseado final campo a campo com a fixture integral do usuário (incluindo prêmio total e vigências)', () => {
    const proposta = parsePropostaTexto(FIXTURE_REAL_VERBATIM, 'proposta-azul-real-verbatim.pdf')

    // 1. Formato e Seguradora
    expect(proposta.formato).toBe('AZUL_SEGUROS')
    expect(proposta.seguradoraNome).toBe('Azul Seguros')

    // 2. Segurado
    expect(proposta.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
    expect(proposta.segurado.nome).not.toBe('Azul Tradicional')
    expect(proposta.segurado.nome).not.toBe('')
    expect(proposta.segurado.dataNascimento).toBe('1990-08-02')
    expect(proposta.segurado.cpfCnpj).toBe('05736592495')
    expect(proposta.segurado.tipoPessoa).toBe('PF')
    expect(proposta.segurado.email).toBe('paulagabrieladv@gmail.com')
    expect(proposta.segurado.telefone).toBe('(83) 99112-9729')

    // 3. Endereço residencial (NÃO do "CEP de pernoite")
    expect(proposta.segurado.cep).toBe('58037-335')
    expect(proposta.segurado.rua).toBe('R Doralice de Almeida Lyra')
    expect(proposta.segurado.numero).toBe('55')
    expect(proposta.segurado.bairro).toBe('Jardim Oceania')
    expect(proposta.segurado.cidade).toBe('João Pessoa')
    expect(proposta.segurado.estado).toBe('PB')

    // 4. Condutor Principal
    expect(proposta.condutorPrincipal.nome).toBe('PAULA GABRIELA DE MORAIS NEGREIROS')
    expect(proposta.condutorPrincipal.mesmoQueSegurado).toBe(false)

    // 5. Veículo
    expect(proposta.veiculo.marcaModelo).toBe('NOVO ONIX HATCH LT 1.0 12V FLEX')
    expect(proposta.veiculo.marcaModelo).not.toContain('Administradores Brasil')
    expect(proposta.veiculo.marcaModelo).not.toContain('Picasa')
    expect(proposta.veiculo.placa).toBe('QSI2A04')
    expect(proposta.veiculo.chassi).toBe('9BGEB48A0LG219020')
    expect(proposta.veiculo.codigoFipe).toBe('45179')
    expect(proposta.veiculo.anoFabricacao).toBe(2020)
    expect(proposta.veiculo.anoModelo).toBe(2020)

    // 6. Renovação
    expect(proposta.renovacao.isRenovacao).toBe(true)
    expect(proposta.renovacao.seguradoraAnterior).toBe('Azul Seguros')
    expect(proposta.renovacao.seguradoraAnterior).not.toBe('Sucursal')
    expect(proposta.renovacao.apoliceAnterior).toBe('12806713')

    // 7. Vigência e Prêmios
    expect(proposta.vigenciaInicio).toBe('2026-10-10')
    expect(proposta.vigenciaFim).toBe('2027-10-10')
    expect(proposta.premioTotal).toBe(1596.12)
  })

  it('valida o objeto parseado final a partir da fixture exata do snippet (coberturas GFM parciais)', () => {
    // Mesma validação no snippet exato enviado na instrução do usuário
    const proposta = parsePropostaTexto(FIXTURE_EXATA_SNIPPET, 'proposta-azul-snippet.pdf')

    expect(proposta.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
    expect(proposta.segurado.nome).not.toBe('Azul Tradicional')
    expect(proposta.segurado.dataNascimento).toBe('1990-08-02')
    expect(proposta.segurado.cpfCnpj).toBe('05736592495')
    expect(proposta.segurado.tipoPessoa).toBe('PF')
    expect(proposta.segurado.email).toBe('paulagabrieladv@gmail.com')
    expect(proposta.segurado.telefone).toBe('(83) 99112-9729')

    expect(proposta.segurado.cep).toBe('58037-335')
    expect(proposta.segurado.rua).toBe('R Doralice de Almeida Lyra')
    expect(proposta.segurado.numero).toBe('55')
    expect(proposta.segurado.bairro).toBe('Jardim Oceania')
    expect(proposta.segurado.cidade).toBe('João Pessoa')
    expect(proposta.segurado.estado).toBe('PB')

    expect(proposta.condutorPrincipal.nome).toBe('PAULA GABRIELA DE MORAIS NEGREIROS')
    expect(proposta.condutorPrincipal.mesmoQueSegurado).toBe(false)

    expect(proposta.veiculo.marcaModelo).toBe('NOVO ONIX HATCH LT 1.0 12V FLEX')
    expect(proposta.veiculo.placa).toBe('QSI2A04')
    expect(proposta.veiculo.chassi).toBe('9BGEB48A0LG219020')
    expect(proposta.veiculo.codigoFipe).toBe('45179')
    expect(proposta.veiculo.anoFabricacao).toBe(2020)
    expect(proposta.veiculo.anoModelo).toBe(2020)

    expect(proposta.renovacao.isRenovacao).toBe(true)
    expect(proposta.renovacao.seguradoraAnterior).toBe('Azul Seguros')
    expect(proposta.renovacao.apoliceAnterior).toBe('12806713')

    expect(proposta.vigenciaInicio).toBe('2026-10-10')
    expect(proposta.vigenciaFim).toBe('2027-10-10')
  })
})
