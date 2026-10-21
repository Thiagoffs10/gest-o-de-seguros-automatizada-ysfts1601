import { describe, it, expect } from 'vitest'
import { extrairPropostaInlineAzul, parsePropostaTexto } from './proposta-parsers'

describe('Correção A & B — Linha Real Azul/Porto Inline (Endereço por Âncoras e Cartão 10x)', () => {
  // String real informada na especificação do PDF
  const LINHA_REAL_ENDERECO =
    '**Endereço residencial Complemento CEP Bairro Cidade UF** Av Norte Miguel Arraes de Alencar, AP207BL4 52051-000 Tamarineira Recife PE 3533 **E-mail Telefone Tipo de envio Enviar correspondência para** NATHANFIGUEIREDO04@GMAIL.CO Celular: (81) 99706-6092 DIGITAL SEGURADO M'

  it('extrai corretamente rua, CEP, bairro, cidade, UF, email e telefone via extrairPropostaInlineAzul', () => {
    const res = extrairPropostaInlineAzul(LINHA_REAL_ENDERECO)
    expect(res).not.toBeNull()
    expect(res?.segurado).toBeDefined()

    const seg = res!.segurado!
    // 1. Rua: tudo antes do CEP mantendo logradouro completo
    expect(seg.rua).toBe('Av Norte Miguel Arraes de Alencar, AP207BL4')
    // 1b. CEP formatado
    expect(seg.cep).toBe('52051-000')
    // 2. UF: token canônico PE
    expect(seg.estado).toBe('PE')
    // 3. Miolo entre CEP e UF: Tamarineira Recife separado em bairro e cidade
    expect(seg.bairro).toBe('Tamarineira')
    expect(seg.cidade).toBe('Recife')
    // Token residual numérico 3533 descartado
    expect(seg.cidade).not.toContain('3533')
    expect(seg.cidade).not.toContain('PE')
    expect(seg.bairro).not.toContain('Recife')
    // Contato
    expect(seg.email).toBe('NATHANFIGUEIREDO04@GMAIL.CO')
    expect(seg.telefone).toBe('(81) 99706-6092')
  })

  it('rejeita tokens não canônicos como UF (ex: AV nunca vira estado)', () => {
    const textoComUfInvalida =
      '**Endereço residencial Complemento CEP Bairro Cidade UF** Av Norte 123 52051-000 Tamarineira Recife AV 3533'
    const res = extrairPropostaInlineAzul(textoComUfInvalida)
    expect(res?.segurado?.estado).toBeUndefined()
    expect(res?.segurado?.cidade).toBe('Recife')
    expect(res?.segurado?.bairro).toBe('Tamarineira')
  })

  it('se não der para discernir miolo com certeza (1 token), atribui ao bairro e deixa cidade vazia', () => {
    const textoSemCidadeClara =
      '**Endereço residencial Complemento CEP Bairro Cidade UF** Rua Exemplo, 10 52051-000 BairroUnico PE'
    const res = extrairPropostaInlineAzul(textoSemCidadeClara)
    expect(res?.segurado?.bairro).toBe('BairroUnico')
    expect(res?.segurado?.cidade).toBeUndefined()
    expect(res?.segurado?.estado).toBe('PE')
  })

  it('parsePropostaTexto: extrai proposta completa com endereço real e parcelamento 10x Crédito', () => {
    const textoCompleto = `
Azul Seguros
Proposta de Seguro Automóvel
Proposta: 123456789
Vigência: 10/05/2026 a 10/05/2027
**Dados Gerais** **Segurado(a) Nascimento CPF** NATHAN FIGUEIREDO 12/03/1995 123.456.789-00
${LINHA_REAL_ENDERECO}
**Veículo** **Placa Chassi Veículo Ano Fabricação / Modelo** QSI2A04 9BGEB48A0LG219020 6140 - - ONIX HATCH LT 1.0 2020 / 2020
Prêmio Líquido: R$ 1.650,00
IOF: R$ 200,00
Prêmio Total: R$ 1.850,00
Valor parcelas R$ 185,00
10x Crédito-Demais Bandeiras
`

    const parsed = parsePropostaTexto(textoCompleto, 'proposta-azul-nathan.pdf')
    expect(parsed.segurado.nome).toBe('NATHAN FIGUEIREDO')
    expect(parsed.segurado.rua).toBe('Av Norte Miguel Arraes de Alencar, AP207BL4')
    expect(parsed.segurado.cep).toBe('52051-000')
    expect(parsed.segurado.bairro).toBe('Tamarineira')
    expect(parsed.segurado.cidade).toBe('Recife')
    expect(parsed.segurado.estado).toBe('PE')
    expect(parsed.segurado.email).toBe('NATHANFIGUEIREDO04@GMAIL.CO')
    expect(parsed.segurado.telefone).toBe('(81) 99706-6092')

    // Correção B: Parcelamento 10x Crédito
    expect(parsed.quantidadeParcelas).toBe(10)
    expect(parsed.formaPagamento).toBe('Crédito')
    expect(parsed.parcelamentoDescricao).toBe('10x de R$ 185,00 (Crédito)')
  })

  it('suporta débito no padrão cartão / conta', () => {
    const textoDebito = `
Prêmio Total: R$ 1.200,00
Valor parcelas R$ 200,00
6x Débito em Conta Corrente
`
    const parsed = parsePropostaTexto(textoDebito)
    expect(parsed.quantidadeParcelas).toBe(6)
    expect(parsed.formaPagamento).toBe('Débito em conta')
    expect(parsed.parcelamentoDescricao).toBe('6x de R$ 200,00 (Débito em conta)')
  })
})
