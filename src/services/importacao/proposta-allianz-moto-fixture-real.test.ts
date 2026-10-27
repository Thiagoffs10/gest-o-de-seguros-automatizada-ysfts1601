import { describe, it, expect } from 'vitest'
import { detectarFormatoProposta, parsePropostaTexto } from './proposta-parsers'

export const TEXTO_REAL_ALLIANZ_MOTO_EDNALDO = `PROPOSTA

# ALLIANZ

Olá **EDNALDO JOSE DOS SANTOS**, Agradecemos por escolher a Allianz para proteger a sua moto.

# AUTO

Confira todos os dados da sua proposta antes de contratar

## MOTO o seu seguro e consulte as Condições Gerais do Seguro Allianz

Auto em allianz.com.br

### SEU CORRETOR

CRED10MIX CORRETORA DE SEGUROS LTDA **E-mail:** thiago@cred10mix.com.br **Telefone:** 8134939966 **Código:** 2820088 **SUSEP Nº:** 202062795 **FIilial:** 2P

### SUAS INFORMAÇÕES

**Nome:** EDNALDO JOSE DOS SANTOS **CPF/CNPJ:** 624.691.004-10 **Tel:** 81981906190 **E-mail:** igorsantoscontador@icloud.com **Endereço:** R. CANELA, 23, QB 11 - OURO PRETO-OLINDA/PE - 53370440

### INFORMAÇÕES DO CONDUTOR PRINCIPAL

**Nome:** EDNALDO IGOR ROMAO DOS SANTOS **CPF:** 119.127.044-04 **Idade:** 27 anos **Estado Civil:** Casado[a] ou convive em união estável

### INFORMAÇÕES DO SEU SEGURO

|Vigência: das 24H de 27/10/2026 às 24H de 27/10/2027|Nº da Proposta: 141568886|
|---|---|
|Tipo de Seguro: Renovação de outra seguradora sem sinistro|Ramo: 31 - Moto|
|Veículo: YAMAHA XTZ 150 CROSSER S|Produto: Moto 1212|
|Cód. FIPE: 827108-9|Versão: 000161/161.00|
|Placa: SLE3E09|Condições Gerais: 10/2026|
|Chassi: 9C6DG25D0R0022075|Classe Bônus: 03|
|Zero Km: Não|Grupo: 00 Seguradora Anterior: 5886 - PORTO SEGURO|

OP

141568886

2820088

0TF22CI39 **Ano/Modelo:** 2024 610084CIA DE SEGUROS GERAIS 11 04 **Categoria de Risco:** Moto-Particular **CEP Pernoite:** 53370-440 11:16:59

27-10-2026**INFORMAÇÕES DA RENOVAÇÃO**

**Nº. Apólice Anterior:** 12844437 **Cód. CI:** 58825492569657 **Seguradora Anterior: Fim da vigência anterior:** 27/10/2026

Página 1 de 6 Nº Proposta: 141568886

### Veículo Igual ao Anterior: Sim

|OFERTA ESCOLHIDA||||
|---|---|---|---|
||BÁSICO|||
|Coberturas||Limite Máximo de Indenização|Preço por Cobertura|
|Casco-Básica Compreensiva-Colisão, Incêndio, Roubo e Furto||100% FIPE *|R$ 378,07|
|RCF* - Danos Materiais||R$ 50.000,00|R$ 75,92|
|RCF* - Danos Corporais||R$ 50.000,00|R$ 39,64|
|RCF* - Danos Morais e Estéticos||R$ 10.000,00|R$ 7,51|
|RCF* - Gastos com Defesa||R$ 5.000,00|R$ 9,88|
|Assistência 24 hs||Plano 1|R$ 130,92|
|Preço Líquido|||R$ 641,94|
|Preço Total (IOF + Juros inclusos)|||R$ 689,31|

### FRANQUIA-PARTICIPAÇÃO OBRIGATÓRIA

### 50% da Normal 1.412,60

### INFORMAÇÕES DE PAGAMENTO

### Forma de pagamento

**Preço líquido:** R$ 641,94 **Taxa mensal juros:** 0,00

### Boleto Bancário

**Valor juros:** R$ 0,00 **IOF:** R$ 47,37 **em 1 parcela** **Preço Total (impostos inclusos)** **Vencimento:** 1 **R$ 689,31**

### Parcelas Valor da Parcela

### <u>1 R$ 689,31</u>

Declaro, como Intermediário nesta contratação, que na forma da legislação vigente, dei cumprimento integral às disposições contidas na Resolução CNSP 382/2020.

Página 4 de 6 Nº Proposta: 141568886

### DECLARAÇÃO DO PROPONENTE (texto legal omitido no fixture, presente no real)

### RECIFE ,27 de Outubro de 2026

**Eduard Folch Rue** **Presidente Allianz Seguros S.A.**

**Allianz Seguros S.A.** Código: 5177 | CNPJ: 061.573.796/0001-66`

describe('Leitor de Proposta Allianz - Caso Real Moto EDNALDO JOSE DOS SANTOS', () => {
  it('1. Detecta formato ALLIANZ mesmo contendo menção a "Seguradora Anterior: 5886 - PORTO SEGURO"', () => {
    const formato = detectarFormatoProposta(
      TEXTO_REAL_ALLIANZ_MOTO_EDNALDO,
      'proposta-26-50b0e.pdf',
    )
    expect(formato).toBe('ALLIANZ')
  })

  it('2. Extrai com fidelidade total ao gabarito do caso real de Moto', () => {
    const res = parsePropostaTexto(TEXTO_REAL_ALLIANZ_MOTO_EDNALDO, 'proposta-26-50b0e.pdf')

    // Identificação básica
    expect(res.formato).toBe('ALLIANZ')
    expect(res.seguradoraNome).toBe('Allianz')
    expect(res.numeroProposta).toBe('141568886')
    expect(res.tipoSeguro).toBe('Moto')

    // Segurado
    expect(res.segurado.nome).toBe('EDNALDO JOSE DOS SANTOS')
    expect(res.segurado.cpfCnpj).toBe('62469100410')
    expect(res.segurado.email).toBe('igorsantoscontador@icloud.com')
    expect(res.segurado.telefone).toBe('(81) 98190-6190')
    expect(res.segurado.rua).toBe('R. CANELA')
    expect(res.segurado.numero).toBe('23, QB 11')
    expect(res.segurado.bairro).toBe('OURO PRETO')
    expect(res.segurado.cidade).toBe('OLINDA')
    expect(res.segurado.estado).toBe('PE')
    expect(res.segurado.cep).toBe('53370-440')
    // Não usar CEP Pernoite para o segurado
    expect(res.segurado.rua).not.toContain('CEP Pernoite')

    // Condutor Principal (diferente do segurado)
    expect(res.condutorPrincipal.nome).toBe('EDNALDO IGOR ROMAO DOS SANTOS')
    expect(res.condutorPrincipal.nome).not.toBe('PRINCIPAL')
    expect(res.condutorPrincipal.cpf).toBe('11912704404')
    expect(res.condutorPrincipal.mesmoQueSegurado).toBe(false)
    expect(res.condutorPrincipal.dataNascimento).toBeUndefined()

    // Campo faltante obrigatório de birth_date
    const faltaNasc = res.camposFaltantes.find((c) => c.campo === 'birth_date')
    expect(faltaNasc).toBeDefined()
    expect(faltaNasc?.motivo).toContain('Allianz não inclui a data de nascimento')

    // Veículo
    expect(res.veiculo.marcaModelo).toBe('YAMAHA XTZ 150 CROSSER S')
    expect(res.veiculo.placa).toBe('SLE3E09')
    expect(res.veiculo.chassi).toBe('9C6DG25D0R0022075')
    expect(res.veiculo.codigoFipe).toBe('827108-9')
    expect(res.veiculo.anoModelo).toBe(2024)

    // Vigência
    expect(res.vigenciaInicio).toBe('2026-10-27')
    expect(res.vigenciaFim).toBe('2027-10-27')

    // Prêmios
    expect(res.premioLiquido).toBe(641.94)
    expect(res.premioTotal).toBe(689.31)
    expect(res.iof).toBe(47.37)
    // Proteção: não usar preços de coberturas individuais nem franquia (1.412,60)
    expect(res.premioLiquido).not.toBe(378.07)
    expect(res.premioTotal).not.toBe(1412.6)

    // Pagamento
    expect(res.formaPagamento).toBe('Boleto')
    expect(res.quantidadeParcelas).toBe(1)
    expect(res.parcelamentoDescricao).toBe('1x de R$ 689,31')

    // Renovação
    expect(res.renovacao.isRenovacao).toBe(true)
    expect(res.renovacao.seguradoraAnterior).toBe('PORTO SEGURO')
    expect(res.renovacao.apoliceAnterior).toBe('12844437')
    expect(res.renovacao.classeBonus).toBe('03')
  })
})
