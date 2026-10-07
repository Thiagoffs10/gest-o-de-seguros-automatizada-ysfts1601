/**
 * Parsers Determinísticos dos 6 formatos de Proposta em PDF:
 * 1. Porto Seguro ("portoproposta...")
 * 2. Allianz ("proposta-26-e1302.pdf") -> NÃO traz nascimento
 * 3. HDI ("proposta-26-b74f6.pdf")
 * 4. Yelum ("proposta-26-5607d.pdf") -> Atenção para parcelamento "1+11" (12x)
 * 5. MAPFRE ("proposta-26-4fc05.pdf")
 * 6. Bradesco ("proposta-25-6a3a0.pdf") -> Segurado vs Condutor (ex: Ana Delia segurado, José Alberto condutor)
 *
 * Todos trazem: nº proposta, segurado, condutor separado, veículo, vigências, prêmios,
 * renovação com apólice/seguradora anterior e apólice vazia ("-").
 */

import {
  PropostaClienteExtraido,
  PropostaCondutorExtraido,
  PropostaExtraida,
  PropostaRenovacaoExtraida,
  PropostaVeiculoExtraido,
  SeguradoraPropostaFormato,
} from './proposta-types'
import { parseDataFlexivel, parseMoeda } from './extrato-types'
import { isValidCpf } from '@/lib/document-validators'

/**
 * Sanitiza valores de texto extraídos de PDFs (remove artefatos como '|', barras repetidas,
 * colapsa quebras de linha e múltiplos espaços, e executa trim).
 */
// Cabeçalhos de seções, rótulos de campos, textos de privacidade ou ruídos conhecidos que NUNCA devem ser aceitos como valores (ex: em cidade/bairro/rua/nome)
const VALORES_INVALIDOS_OU_CABECALHOS = [
  'de dados pessoais',
  'dados pessoais',
  'privacidade de dados pessoais',
  'privacidade de dados',
  'processo susep',
  'assinatura do proponente',
  'assinatura do corretor',
  'declaração do proponente',
  'declaração do corretor',
  'informações complementares',
  'informações de pagamento',
  'informações do seguro',
  'informações da renovação',
  'oficinas referenciadas',
  'coberturas',
  'assistência 24h',
  'assistência residencial',
  'oferta escolhida',
  'nascimento',
  'data de nascimento',
  'cpf',
  'cnpj',
  'dados gerais',
  'dados da cotação',
  'canais de atendimento',
  'questionário de avaliação de risco',
  'coberturas e serviços automóvel',
  'segurado(a)',
  'segurado',
  'proponente',
  'condutor(a)',
  'condutor',
  'endereço residencial',
  'endereço',
  'complemento',
  'veículo',
  'cidade',
  'bairro',
  'uf',
  'estado',
  'cep',
  'sexo',
  'profissão',
  'país de nascimento',
  'tipo de operação',
  'segmento',
  'bônus',
  'origem do bônus',
  'sucursal',
  'apólice',
  'item',
  'tipo de envio',
  'enviar correspondência para',
]

export function isTextoCabecalhoOuInvalido(val?: string | null): boolean {
  if (!val) return true
  const v = val
    .trim()
    .toLowerCase()
    .replace(/[*_#:|-]/g, '')
    .trim()
  if (v.length < 2) return true
  return VALORES_INVALIDOS_OU_CABECALHOS.some((termo) => v === termo || v.startsWith(termo))
}

/**
 * Sanitiza valores de texto extraídos de PDFs:
 * - Remove artefatos como '|', barras repetidas, asteriscos duplos ou triplos ('**', '***')
 * - Remove pontuação espúria no início/fim (/,\,-,*)
 * - Colapsa quebras de linha, tabs e múltiplos espaços
 */
export function sanitizarTextoExtraido(val?: string | null): string {
  if (!val) return ''
  return (
    val
      // Colapsar quebras de linha e tabs em espaço
      .replace(/[\r\n\t]+/g, ' ')
      // Remover barras verticais e barras repetidas
      .replace(/\|+/g, ' ')
      // Remover asteriscos (ex: '** IRIS...', 'Cartão de Crédito*')
      .replace(/\*+/g, ' ')
      // Colapsar múltiplos espaços
      .replace(/\s+/g, ' ')
      // Limpeza de pontuação solta, barras, asteriscos, vírgulas residuais nas extremidades
      .replace(/^[\s|/\\,*_~-]+|[\s|/\\,*_~-]+$/g, '')
      .trim()
  )
}

/**
 * Detecta a seguradora a partir do texto extraído
 */
export function detectarFormatoProposta(
  text: string,
  nomeArquivo: string,
): SeguradoraPropostaFormato {
  const t = text.toLowerCase()
  const n = (nomeArquivo || '').toLowerCase()

  // Azul Seguros tem prioridade (mesmo quando emitida via Porto Seguro ou contendo menção a Porto)
  if (
    n.includes('azul') ||
    t.includes('azul tradicional') ||
    t.includes('azul seguros') ||
    t.includes('proposta de seguro auto / azul') ||
    t.includes('proposta de seguro auto\nazul tradicional') ||
    (t.includes('azul') && t.includes('porto seguro'))
  ) {
    return 'AZUL_SEGUROS'
  }

  if (
    n.includes('porto') ||
    t.includes('porto seguro') ||
    t.includes('porto seguro cia de seguros')
  ) {
    return 'PORTO_SEGURO'
  }
  if (n.includes('allianz') || t.includes('allianz seguros') || t.includes('allianz')) {
    return 'ALLIANZ'
  }
  if (n.includes('hdi') || t.includes('hdi seguros') || t.includes('hdi')) {
    return 'HDI'
  }
  if (
    n.includes('yelum') ||
    t.includes('yelum seguradora') ||
    t.includes('yelum') ||
    t.includes('liberty')
  ) {
    return 'YELUM'
  }
  if (n.includes('mapfre') || t.includes('mapfre seguros') || t.includes('mapfre')) {
    return 'MAPFRE'
  }
  if (n.includes('bradesco') || t.includes('bradesco seguros') || t.includes('bradesco auto')) {
    return 'BRADESCO'
  }

  return 'GENERICA'
}

/**
 * Extrai proposta do texto estruturado
 */
export function parsePropostaTexto(text: string, nomeArquivo: string = ''): PropostaExtraida {
  const formato = detectarFormatoProposta(text, nomeArquivo)

  // Mapeamento de nome oficial da seguradora
  const nomesMap: Record<SeguradoraPropostaFormato, string> = {
    PORTO_SEGURO: 'Porto Seguro',
    AZUL_SEGUROS: 'Azul Seguros',
    ALLIANZ: 'Allianz',
    HDI: 'HDI',
    YELUM: 'Yelum',
    MAPFRE: 'Mapfre',
    BRADESCO: 'Bradesco',
    GENERICA: 'Seguradora',
  }

  const seguradoraNome = nomesMap[formato]

  // Extrações comuns por Regex
  const numeroProposta = extrairNumeroProposta(text, formato)
  const vigencias = extrairVigencias(text)
  const premios = extrairPremios(text)
  const parcelamento = extrairParcelamento(text, formato)
  const veiculo = extrairVeiculo(text)
  const segurado = extrairSegurado(text, formato)
  const condutor = extrairCondutor(text, segurado.nome, segurado.cpfCnpj)
  const renovacao = extrairRenovacao(text)

  // Lista de campos faltantes obrigatórios para destaque no formulário
  const camposFaltantes: Array<{ campo: string; label: string; motivo: string }> = []

  if (!segurado.dataNascimento && segurado.tipoPessoa === 'PF') {
    camposFaltantes.push({
      campo: 'birth_date',
      label: 'Data de Nascimento',
      motivo:
        formato === 'ALLIANZ'
          ? 'A Allianz não inclui a data de nascimento no PDF da proposta.'
          : 'Não identificada no documento da proposta.',
    })
  }

  if (!segurado.cpfCnpj) {
    camposFaltantes.push({
      campo: 'cpf',
      label: 'CPF / CNPJ do Segurado',
      motivo: 'Documento do segurado não localizado no PDF.',
    })
  }

  if (!segurado.telefone && !segurado.email) {
    camposFaltantes.push({
      campo: 'phone',
      label: 'Telefone ou Contato',
      motivo: 'Nenhum contato identificado no documento da proposta.',
    })
  }

  const tipoSeguro = extrairTipoSeguro(text)

  // Sanitizar todos os campos textuais do segurado
  const seguradoSanitizado: PropostaClienteExtraido = {
    ...segurado,
    nome: sanitizarTextoExtraido(segurado.nome)
      .replace(/^Nome[:\s]*/i, '')
      .replace(/^Segurado[:\s]*/i, '')
      .trim(),
    rua: sanitizarTextoExtraido(segurado.rua) || undefined,
    numero: sanitizarTextoExtraido(segurado.numero) || undefined,
    bairro: sanitizarTextoExtraido(segurado.bairro) || undefined,
    cidade: sanitizarTextoExtraido(segurado.cidade) || undefined,
    estado: sanitizarTextoExtraido(segurado.estado)?.toUpperCase() || undefined,
    cep: sanitizarTextoExtraido(segurado.cep) || undefined,
    email: sanitizarTextoExtraido(segurado.email) || undefined,
    telefone: sanitizarTextoExtraido(segurado.telefone) || undefined,
  }

  // Sanitizar condutor
  const condutorSanitizado: PropostaCondutorExtraido = {
    ...condutor,
    nome: sanitizarTextoExtraido(condutor.nome)
      .replace(/^Nome[:\s]*/i, '')
      .replace(/^Condutor[:\s]*/i, '')
      .trim(),
    parentesco: sanitizarTextoExtraido(condutor.parentesco) || undefined,
  }

  // Sanitizar veículo
  const veiculoSanitizado: PropostaVeiculoExtraido = {
    ...veiculo,
    marcaModelo: sanitizarTextoExtraido(veiculo.marcaModelo),
    placa: sanitizarTextoExtraido(veiculo.placa).toUpperCase(),
    chassi: sanitizarTextoExtraido(veiculo.chassi).toUpperCase(),
    codigoFipe: sanitizarTextoExtraido(veiculo.codigoFipe),
  }

  // Sanitizar renovação
  const renovacaoSanitizada: PropostaRenovacaoExtraida = {
    ...renovacao,
    apoliceAnterior: sanitizarTextoExtraido(renovacao.apoliceAnterior) || undefined,
    seguradoraAnterior: sanitizarTextoExtraido(renovacao.seguradoraAnterior) || undefined,
    classeBonus: sanitizarTextoExtraido(renovacao.classeBonus) || undefined,
  }

  return {
    formato,
    seguradoraNome,
    numeroProposta: sanitizarTextoExtraido(numeroProposta),
    numeroApolice: '', // No momento da proposta fica vazia aguardando emissão
    tipoSeguro,
    vigenciaInicio: vigencias.inicio,
    vigenciaFim: vigencias.fim,
    premioLiquido: premios.liquido,
    iof: premios.iof,
    premioTotal: premios.total,
    formaPagamento: parcelamento.forma,
    quantidadeParcelas: parcelamento.parcelas,
    parcelamentoDescricao: sanitizarTextoExtraido(parcelamento.descricao),
    segurado: seguradoSanitizado,
    condutorPrincipal: condutorSanitizado,
    veiculo: veiculoSanitizado,
    renovacao: renovacaoSanitizada,
    camposFaltantes,
    textoBrutoOriginal: text.substring(0, 5000),
  }
}

// =========================================================================
// Funções Auxiliares Determinísticas de Extração
// =========================================================================

function extrairNumeroProposta(text: string, formato: SeguradoraPropostaFormato): string {
  // Caso específico Azul Seguros / Porto Seguro:
  // "Proposta / 03 14696320" ou "Proposta Apólice / 03 14696320" ou "Proposta\n12-31784355" / "Proposta 12-31784355"
  // Na Azul Tradicional:
  // "Orçamento 6320779928 Versão 0 Oferta 1 Proposta 12-31784355 Apólice 03 14696320"
  // Ou "Proposta Apólice / 03 14696320"
  if (formato === 'AZUL_SEGUROS' || formato === 'PORTO_SEGURO') {
    // 1. Procura se tem rótulo "Proposta" seguido diretamente de número (com ou sem hífen)
    // Cuidado com "Proposta de Seguro Auto" - não é o número
    // Padrão específico: "12-31784355" ou "Proposta\n12-31784355" ou "Proposta 12-31784355" ou "Versão 0 12-31784355 Proposta"
    const azulNumHifenMatch = /\b([0-9]{2}-[0-9]{6,10})\b/.exec(text)
    if (azulNumHifenMatch) {
      return azulNumHifenMatch[1]
    }

    const azulPropMatch =
      /(?:^|[|\n\s])proposta\s*(?:ap[oó]lice)?\s*[|:\s/]+([0-9]{2}[\s-]?[0-9]{6,10}|[0-9]{4,12})/i.exec(
        text,
      )
    if (azulPropMatch) {
      const clean = azulPropMatch[1].trim()
      if (clean.replace(/\D/g, '').length >= 6) {
        return clean
      }
    }
  }

  // Padrões comuns: "Proposta: 123456", "Nº da Proposta: 123456", "Proposta nº: 123456"
  const patterns = [
    /n[ºo.]?\s+da\s+proposta[*\s|:]+([0-9\-./\s]{4,20})/i,
    /n[ºo.]?\s+proposta[*\s|:]+([0-9\-./\s]{4,20})/i,
    /c[oó]digo\s+da\s+proposta[*\s|:]+([0-9\-./\s]{4,20})/i,
    // Proposta com número explícito, evitando casar com "Proposta de Seguro"
    /(?:^|[|\n])\s*proposta(?:\s+n[ºo.]|\s+número)?[*\s|:]+([0-9\-./\s]{4,20})/i,
  ]

  for (const regex of patterns) {
    const match = regex.exec(text)
    if (match) {
      const num = match[1].trim()
      const digits = num.replace(/\D/g, '')
      if (digits.length >= 4) return num
    }
  }

  // Fallback por formato específico
  if (formato === 'PORTO_SEGURO') {
    const p = /porto\s+proposta\s+([0-9]+)/i.exec(text)
    if (p) return p[1]
  }

  return ''
}

function extrairVigencias(text: string): { inicio: string; fim: string } {
  let inicio = ''
  let fim = ''

  // Padrão: "Vigência: de 24/09/2026 até 24/09/2027" ou "às 24:00 de ..."
  const vigMatch =
    /vig[êe]ncia[:\s]+(?:das?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+do?\s+dia\s+)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})(?:\s+at[ée]|\s+[aà]\s+|\s+ao?\s+dia\s+)(?:das?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+do?\s+dia\s+)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    )

  if (vigMatch) {
    inicio = parseDataFlexivel(vigMatch[1])
    fim = parseDataFlexivel(vigMatch[2])
  } else {
    // Procura por "Início de vigência" e "Fim de vigência"
    const iniMatch =
      /(?:in[íi]cio\s+da?\s+vig[êe]ncia|vig[êe]ncia\s+in[íi]cio)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    const fimMatch =
      /(?:t[ée]rmino\s+da?\s+vig[êe]ncia|fim\s+da?\s+vig[êe]ncia|vig[êe]ncia\s+fim)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    if (iniMatch) inicio = parseDataFlexivel(iniMatch[1])
    if (fimMatch) fim = parseDataFlexivel(fimMatch[1])
  }

  // Fallback se faltar fim (+1 ano)
  if (inicio && !fim) {
    const parts = inicio.split('-')
    const y = parseInt(parts[0], 10) + 1
    fim = `${y}-${parts[1]}-${parts[2]}`
  }

  return { inicio, fim }
}

function extrairPremios(text: string): { liquido: number; iof: number; total: number } {
  let liquido = 0
  let iof = 0
  let total = 0

  // 1. Procura na seção "Forma de pagamento" (Azul Seguros / Porto Seguro / Allianz)
  const infoPagSection =
    /(?:#+\s*|\*{0,2})(?:INFORMA[ÇC][ÕO]ES\s+DE\s+PAGAMENTO|Forma\s+de\s+pagamento)\*{0,2}[\s\S]*?(?=(?:DECLARA[ÇC][ÃA]O|OFICINAS|CL[ÁA]USULAS|QUESTION[ÁA]RIO|P[áa]gina|\n{3,}|$))/i.exec(
      text,
    )
  const pagText = infoPagSection ? infoPagSection[0] : ''

  if (pagText) {
    // Caso tabela da Azul / Porto Seguro:
    // "Forma de pagamento Valor líquido IOF Juros Encargos Parcelas Valor parcelas Valor total"
    // "97-Todas Cartão de Crédito Porto Bank (Existente)"
    // "R$ 1.486,42 R$ 109,70 R$ 0,00 R$ 0,00 R$ 1.596,121x R$ 1.596,12" (ou separado por quebras de linha)
    // Extraímos todos os valores monetários na seção
    const regexMoedas = /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g
    const matchesMoeda: number[] = []
    let m: RegExpExecArray | null
    while ((m = regexMoedas.exec(pagText)) !== null) {
      matchesMoeda.push(parseMoeda(m[1]))
    }

    if (matchesMoeda.length >= 3) {
      // Normalmente: [valorLiquido, iof, juros, encargos, ..., valorTotal]
      // Ex: [1486.42, 109.70, 0, 0, 1596.12, 1596.12]
      liquido = matchesMoeda[0]
      iof = matchesMoeda[1]
      total = matchesMoeda[matchesMoeda.length - 1]
    }

    if (!liquido) {
      const pagLiq =
        /(?:pre[çc]o\s+l[íi]quido|pr[êe]mio\s+l[íi]quido|valor\s+l[íi]quido)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
          pagText,
        )
      if (pagLiq) liquido = parseMoeda(pagLiq[1])
    }

    if (!iof) {
      const pagIof = /iof[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(pagText)
      if (pagIof) iof = parseMoeda(pagIof[1])
    }

    if (!total) {
      const pagTot =
        /(?:pre[çc]o\s+total|pr[êe]mio\s+total|total\s+a\s+pagar|valor\s+total)(?:\s*\([^)]*\))?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
          pagText,
        )
      if (pagTot) total = parseMoeda(pagTot[1])
    }
  }

  // 2. Se não encontrou na seção de pagamento, procura no texto global
  if (liquido === 0) {
    const liqMatch =
      /(?:pr[êe]mio|pre[çc]o)\s+l[íi]quido(?:\s+total)?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)
    if (liqMatch) liquido = parseMoeda(liqMatch[1])
  }

  if (iof === 0) {
    const iofMatch = /iof[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)
    if (iofMatch) iof = parseMoeda(iofMatch[1])
  }

  if (total === 0) {
    const totMatch =
      /(?:pr[êe]mio\s+total|pre[çc]o\s+total|valor\s+total\s+do\s+seguro|total\s+a\s+pagar)(?:\s*\([^)]*\))?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
        text,
      )
    if (totMatch) total = parseMoeda(totMatch[1])
  }

  // Se tem líquido e iof mas não tem total
  if (liquido > 0 && total === 0) {
    total = Math.round((liquido + iof) * 100) / 100
  }
  // Se tem total e líquido mas faltou iof
  if (total > 0 && liquido > 0 && iof === 0) {
    iof = Math.max(0, Math.round((total - liquido) * 100) / 100)
  }

  return { liquido, iof, total }
}

function extrairTipoSeguro(text: string): string {
  // 1. Procura por menção explícita de Ramo / Produto na proposta
  // Ex: "Produto | Ramo: 16 - Condomínio - Modalidade: Simples" ou "Ramo: 16 - Condomínio"
  const ramoMatch =
    /(?:produto\s*\|\s*)?ramo[:\s]+(?:[0-9]{1,4}\s*-\s*)?([A-Za-zÀ-ÿ\s]+?)(?:\s*-\s*modalidade|\s*\n|$)/i.exec(
      text,
    )
  if (ramoMatch) {
    const rawRamo = ramoMatch[1].trim().toLowerCase()
    if (rawRamo.includes('condom')) return 'Condomínio'
    if (rawRamo.includes('auto') || rawRamo.includes('ve[íi]cul')) return 'Auto'
    if (rawRamo.includes('residenc')) return 'Residencial'
    if (rawRamo.includes('vida')) return 'Vida'
    if (rawRamo.includes('empres')) return 'Empresarial'
    if (rawRamo.includes('sa[úu]de')) return 'Saúde'
    if (rawRamo.includes('viagem')) return 'Viagem'
  }

  // 2. Procura cabeçalhos como "Allianz Condomínio", "Seguro Condomínio"
  if (/allianz\s+condom[íi]nio|seguro\s+condom[íi]nio|\bcondom[íi]nio\b/i.test(text)) {
    // Só assume Condomínio se não for algo secundário (ex: "RC Condomínio" em coberturas)
    if (
      /allianz\s+condom[íi]nio|essa\s+[ée]\s+a\s+proposta\s+do\s+seu\s+seguro\s+allianz\s+condom[íi]nio|proposta\s+condom[íi]nio|ramo.*?condom[íi]nio/i.test(
        text,
      )
    ) {
      return 'Condomínio'
    }
  }

  if (/residencial|allianz\s+residencial/i.test(text) && !/condom[íi]nio/i.test(text)) {
    return 'Residencial'
  }
  if (/vida|allianz\s+vida/i.test(text)) {
    return 'Vida'
  }
  if (/empresarial|allianz\s+empresa/i.test(text)) {
    return 'Empresarial'
  }

  // Padrão default continua sendo Auto
  return 'Auto'
}

function extrairParcelamento(
  text: string,
  formato: SeguradoraPropostaFormato,
): { forma: string; parcelas: number; descricao: string } {
  let forma = 'Boleto'
  let parcelas = 1
  let descricao = ''

  const textLower = text.toLowerCase()
  // Identificação de Boleto explícita antes de outros
  if (textLower.includes('boleto bancário') || textLower.includes('boleto')) {
    forma = 'Boleto'
  } else if (
    textLower.includes('cartão de crédito') ||
    textLower.includes('cartao de credito') ||
    textLower.includes('cartão') ||
    textLower.includes('cartao') ||
    textLower.includes('crédito')
  ) {
    forma = 'Crédito'
  } else if (
    textLower.includes('débito em conta') ||
    textLower.includes('debito em conta') ||
    textLower.includes('débito automático')
  ) {
    forma = 'Débito em conta'
  }

  // ATENÇÃO ESPECÍFICA: Yelum usa notação "1+11" (1 entrada + 11 parcelas = 12 parcelas)
  const yelumMatch = /(\d{1,2})\s*\+\s*(\d{1,2})/i.exec(text)
  if (yelumMatch) {
    const p1 = parseInt(yelumMatch[1], 10)
    const p2 = parseInt(yelumMatch[2], 10)
    parcelas = p1 + p2
    descricao = `${p1}+${p2} (${parcelas}x)`
  } else {
    // Procura "Nº. de Parcelas: 10" ou "Valor da Parcela: 233,50" ou "10 parcelas" ou "10x de R$ ..." ou "1x R$ 1.596,12"
    const numParcMatch = /n[ºo.]?\s+de\s+parcelas[*\s|:]+(\d{1,2})/i.exec(text)
    const parcMatch =
      numParcMatch ||
      /(\d{1,2})\s*x\s+R?\$?\s*([0-9.,]+)/i.exec(text) ||
      /(?:parcelas?|parcelamento)[*\s|:]+(\d{1,2})x?/i.exec(text) ||
      /(\d{1,2})\s*(?:x|vezes)\s+de\s+R?\$?/i.exec(text) ||
      /(\d{1,2})\s+parcelas\b/i.exec(text)

    const vlrParcMatch =
      /(?:valor\s+da\s+parcela|valor\s+parcelas|vlr\s+parcela)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
        text,
      )

    if (parcMatch) {
      parcelas = parseInt(parcMatch[1], 10)
      const vlr = parcMatch[2] || (vlrParcMatch ? vlrParcMatch[1].trim() : '')
      if (vlr) {
        descricao = `${parcelas}x de R$ ${vlr.trim()}`
      } else {
        descricao = `${parcelas}x`
      }
    }
  }

  return { forma, parcelas: parcelas || 1, descricao }
}

function extrairVeiculo(text: string): PropostaVeiculoExtraido {
  let marcaModelo = ''
  let placa = ''
  let chassi = ''
  let codigoFipe = ''
  let anoFab = 0
  let anoMod = 0

  // Placa: 3 letras + 4 números ou padrão Mercosul (3 letras + 1 num + 1 letra + 2 num)
  // Pode vir como "QSI2A04 Placa" ou "Placa: QSI2A04" ou "Placa | QSI2A04" ou "Placa\nQSI2A04"
  const placaMatch =
    /(?:placa[*\s|:/]+)?\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b(?:\s*placa)?/i.exec(text) ||
    /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\s+placa\b/i.exec(text)
  if (placaMatch) {
    placa = placaMatch[1].replace(/[-\s]/g, '').toUpperCase()
  }

  // Chassi: 17 caracteres alfanuméricos (excluindo I, O, Q)
  // Pode vir como "9BGEB48A0LG219020 Chassi" ou "Chassi: 9BGEB48A0LG219020"
  const chassiMatch =
    /(?:chassi[*\s|:/]+)?\b([A-HJ-NPR-Z0-9]{17})\b(?:\s*chassi)?/i.exec(text) ||
    /\b([A-HJ-NPR-Z0-9]{17})\s+chassi\b/i.exec(text)
  if (chassiMatch) {
    chassi = chassiMatch[1].toUpperCase()
  }

  // FIPE: 000000-0 ou código alfanumérico como "N45179 Fipe" ou "45179 N Fipe" ou "Fipe 45179" ou "Cód. FIPE: 005528-0"
  const fipeMatch =
    /(?:fipe|c[oó]digo\s+fipe|c[oó]d\.\s*fipe)[*\s|:]+([A-Za-z0-9-]{5,9})/i.exec(text) ||
    /\b([A-Za-z0-9-]{5,9})\s*(?:[A-Z]\s*)?fipe\b/i.exec(text) ||
    /\b([A-Za-z0-9-]{5,9})\s+fipe\b/i.exec(text)
  if (fipeMatch) {
    codigoFipe = fipeMatch[1].trim()
  }

  // Ano Fabricação / Modelo (ex: 2020 / 2020 Ano Fabricação / Modelo ou Ano/Modelo: 2022)
  const anoDuploMatch =
    /(?:ano(?:\s+fab(?:\.|\/mod)?)?[:\s]+)?\b(19\d{2}|20\d{2})\s*\/\s*(19\d{2}|20\d{2})\b/i.exec(
      text,
    )
  if (anoDuploMatch) {
    anoFab = parseInt(anoDuploMatch[1], 10)
    anoMod = parseInt(anoDuploMatch[2], 10)
  } else {
    const anoUnicoMatch = /(?:ano\/modelo|ano\s+modelo|ano)[:\s]+(19\d{2}|20\d{2})\b/i.exec(text)
    if (anoUnicoMatch) {
      anoMod = parseInt(anoUnicoMatch[1], 10)
      anoFab = anoMod
    }
  }

  // Marca / Modelo:
  // 1. Caso Azul Seguros: "6140 - - NOVO ONIX HATCH LT 1.0 12V FLEX" ou "Veículo / 6140 - - NOVO ONIX..."
  const azulVeicMatch =
    /(?:ve[íi]culo[*\s|:/]+)?(?:\d{3,5}\s*-\s*-?\s*)?([A-Z0-9\s.\-/+]{6,60}?\b(?:ONIX|GOL|POLO|COROLLA|CIVIC|COMPASS|RENEGADE|CRETA|TRACKER|HB20|ARGO|MOBI|T-CROSS|NIVUS|KICKS|DUSTER|KWID|STRADA|TORO|HILUX|S10|RANGER|FIESTA|FOCUS|CRUZE|FIT|CITY|HR-V|WR-V|YARIS|ETIOS|SANDERO|LOGAN|CLIO|208|2008|C3|C4|TAOS|TIGUAN|SW4|BMW|AUDI|MERCEDES)[A-Z0-9\s.\-/+]*?)(?=(?:\s*[|*]?\s*(?:ve[íi]culo|produto|ano|placa|chassi|c[oó]d|vers[ãa]o|fipe)|\n|\||$))/i.exec(
      text,
    )

  if (azulVeicMatch) {
    let clean = sanitizarTextoExtraido(azulVeicMatch[1])
    clean = clean.replace(/^\d{3,5}\s*-\s*-?\s*/, '').trim()
    if (clean.length > 3 && clean.length < 80 && !isTextoCabecalhoOuInvalido(clean)) {
      marcaModelo = clean
    }
  }

  // Fallback padrão Marca / Modelo
  if (!marcaModelo) {
    const modMatch =
      /(?:ve[íi]culo|modelo|marca\/modelo)[*\s|:]+([A-Za-z0-9\s.\-/+]+?)(?=(?:\s*[|*]?\s*(?:produto|ano|placa|chassi|c[oó]d|vers[ãa]o|fipe)|\n|\||$))/i.exec(
        text,
      )
    if (modMatch) {
      const rawMod = sanitizarTextoExtraido(modMatch[1]).replace(/^\d{3,5}\s*-\s*-?\s*/, '')
      if (rawMod.length > 3 && rawMod.length < 80 && !isTextoCabecalhoOuInvalido(rawMod)) {
        marcaModelo = rawMod
      }
    }
  }

  return {
    marcaModelo,
    placa,
    chassi,
    codigoFipe,
    anoFabricacao: anoFab || undefined,
    anoModelo: anoMod || undefined,
  }
}

function parseTabelaGfmLinhas(
  headerRegex: RegExp,
  sourceText: string,
  callback: (headers: string[], values: string[]) => void,
) {
  const lines = sourceText.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine.includes('|')) continue
    if (!headerRegex.test(rawLine)) continue

    // Localizou cabeçalho. Próximas linhas: procurar divisor | --- | e depois primeira linha de dados
    let dividerFound = false
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim()
      if (!nextLine) {
        if (dividerFound) break
        continue
      }
      if (!nextLine.includes('|')) break

      // Linha de divisor: composta por |, -, :, e espaços (ex: | --- | :---: | --- |)
      if (!dividerFound && /^\|?(\s*[-:]+\s*\|?)+$/.test(nextLine)) {
        dividerFound = true
        continue
      }

      if (dividerFound) {
        // Linha de dados encontrada
        const rawHeaders = rawLine.split('|')
        if (rawHeaders.length > 2 && rawLine.startsWith('|') && rawLine.endsWith('|')) {
          rawHeaders.shift()
          rawHeaders.pop()
        }
        const cleanedHeaders = rawHeaders.map((h) => sanitizarTextoExtraido(h).toLowerCase())

        const rawValues = nextLine.split('|')
        if (rawValues.length > 2 && nextLine.startsWith('|') && nextLine.endsWith('|')) {
          rawValues.shift()
          rawValues.pop()
        }
        const cleanedValues = rawValues.map((v) => sanitizarTextoExtraido(v))

        callback(cleanedHeaders, cleanedValues)
        break
      }
    }
  }
}

function extrairSegurado(
  text: string,
  formato: SeguradoraPropostaFormato,
): PropostaClienteExtraido {
  let nome = ''
  let cpfCnpj = ''
  let tipoPessoa: 'PF' | 'PJ' = 'PF'
  let dataNasc = ''
  let email = ''
  let telefone = ''
  let cep = ''
  let rua = ''
  let numero = ''
  let bairro = ''
  let cidade = ''
  let estado = ''

  // Isolar o bloco delimitado "SUAS INFORMAÇÕES" do cliente, quando presente.
  // Suporta marcações markdown como "#", "##", "**", tabelas markdown (|) e espaços.
  const suasInfoSectionMatch =
    /(?:#+\s*|\*{0,2})SUAS\s+INFORMA[ÇC][ÕO]ES\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|$))/i.exec(
      text,
    )
  const suasInfoText = suasInfoSectionMatch ? suasInfoSectionMatch[0] : ''

  // Isolar a seção do Condutor Principal para fallback de documento/nome quando mesmo condutor
  const condPrincipalSectionMatch =
    /(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO\s+CONDUTOR(?:\s+PRINCIPAL)?\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|$))/i.exec(
      text,
    )
  const condPrincipalText = condPrincipalSectionMatch ? condPrincipalSectionMatch[0] : ''

  // CNPJs conhecidos de seguradoras / entidades que NUNCA devem ser atribuídos ao cliente
  const isCnpjSeguradoraOuInvalido = (docLimpo: string): boolean => {
    // Allianz: 06.157.796/0001-66 ou 06157379... ou qualquer 06.157...
    if (docLimpo.startsWith('06157')) return true
    // Porto Seguro Cia de Seguros Gerais / Azul Seguros: 61.198.164/0001-60
    if (docLimpo.startsWith('61198164')) return true
    // Azul Companhia de Seguros Gerais: 33.448.150/0001-11
    if (docLimpo.startsWith('33448150')) return true
    // Porto Seguro Vida e Previdência: 61.884.227/0001-38
    if (docLimpo.startsWith('61884227')) return true
    // Bradesco Auto/RE: 92.682.038/0001-00 ou 92.682...
    if (docLimpo.startsWith('92682038')) return true
    // HDI Seguros: 29.980.149/0001-81
    if (docLimpo.startsWith('29980149')) return true
    // Yelum Seguradora / Liberty Seguros: 61.550.141/0001-72
    if (docLimpo.startsWith('61550141')) return true
    // MAPFRE Seguros Gerais: 61.074.175/0001-38
    if (docLimpo.startsWith('61074175')) return true
    // Tokio Marine: 33.164.021/0001-00
    if (docLimpo.startsWith('33164021')) return true
    // Sompo Seguros: 61.383.493/0001-80
    if (docLimpo.startsWith('61383493')) return true
    // Matrícula SUSEP / Corretora Cred10mix (ex: 202062795...)
    if (docLimpo.startsWith('202062795')) return true
    return false
  }

  // 1. EXTRAÇÃO DE DOCUMENTO (CPF ou CNPJ) E DETECÇÃO PF vs PJ
  // Truncar o texto no início das declarações/termos contratuais e rodapés ("Canais de atendimento",
  // "Declaração do proponente", "Termos e condições", "Porto Seguro Cia de Seguros", etc.)
  // para evitar que CNPJs institucionais da seguradora cheguem na extração do cliente!
  const idxCorteInstitucional = text.search(
    /(?:declara[çc][ãa]o\s+do\s+proponente|termos\s+e\s+condi[çc][õo]es|canais\s+de\s+atendimento|tratamento\s+de\s+dados\s+pessoais|uso\s+interno\s+da\s+cia)/i,
  )
  const textoUtilCliente =
    idxCorteInstitucional > 0 ? text.substring(0, idxCorteInstitucional) : text

  // Isolar o bloco "Dados Gerais" (Azul Tradicional / Porto Seguro) se presente.
  // Tolerante a qualquer formatação markdown (#, ##, **, negrito, espaços) e delimitação
  // por cabeçalhos conhecidos (Veículo, Questionário, Coberturas, Vigência, Corretor, etc.)
  // ou próxima seção (#/##)
  const dadosGeraisSectionMatch =
    /(?:^|\n)\s*(?:#+\s*)?\*{0,2}\s*Dados\s+Gerais\s*\*{0,2}[\s\S]*?(?=(?:(?:\n\s*#+\s*|\n\s*\*{1,2}\s*)(?:Ve[íi]culo|Question[áa]rio|Coberturas|Vidros|Assist[êe]ncias|Descontos|Forma\s+de\s+pagamento|Declara[çc][ãa]o|Termos|Canais|SAC|Uso\s+interno)|$))/i.exec(
      textoUtilCliente,
    )
  const dadosGeraisText = dadosGeraisSectionMatch ? dadosGeraisSectionMatch[0] : ''

  // =========================================================================
  // PARSER DE BLOCO DO SEGURADO SEQUENCIAL (Azul Seguros / Porto Seguro)
  // Trata layout de fluxo sequencial de colunas:
  // Variante 1 (rótulos empilhados primeiro, depois valores empilhados):
  // Segurado(a)
  // Nascimento
  // CPF
  // LIVIA LOURENCO FERNANDES DA CUNHA BARROS
  // 02/08/1990
  // 057.365.924-95
  //
  // Variante 2 (intercalado):
  // Segurado(a)
  // [NOME]
  // Nascimento
  // [DATA] [CPF]
  // CPF
  // =========================================================================
  const extrairSeguradoSequencial = (fonteTexto: string) => {
    const rawLines = fonteTexto.split(/\r?\n/).map((l) => l.trim())
    const lines = rawLines.filter((l) => l.length > 0)

    const normalizarRotulo = (s: string) =>
      s
        .toLowerCase()
        .replace(/[*_#:|-]/g, '')
        .trim()

    // 1. Procurar Variante 1: Rótulos empilhados "Segurado(a)" -> "Nascimento" -> "CPF"
    for (let i = 0; i < lines.length - 2; i++) {
      const l1 = normalizarRotulo(lines[i])
      const l2 = normalizarRotulo(lines[i + 1])
      const l3 = normalizarRotulo(lines[i + 2])

      const isSegurado = l1 === 'segurado(a)' || l1 === 'segurado' || l1 === 'proponente'
      const isNasc = l2 === 'nascimento' || l2 === 'data de nascimento' || l2.includes('nasc')
      const isCpf = l3 === 'cpf' || l3 === 'cpf/cnpj'

      if (isSegurado && isNasc && isCpf) {
        // Encontrou a pilha de rótulos de 3 campos!
        // As próximas 3 linhas de dados devem ser [NOME], [DATA], [CPF]
        let valCursor = i + 3
        const vals: string[] = []
        while (valCursor < lines.length && vals.length < 3) {
          const lVal = lines[valCursor]
          if (!/^\|?(\s*[-:]+\s*\|?)+$/.test(lVal)) {
            vals.push(lVal)
          }
          valCursor++
        }

        if (vals.length >= 3) {
          const candNome = sanitizarTextoExtraido(vals[0])
          const candData = parseDataFlexivel(vals[1])
          const candCpfClean = vals[2].replace(/\D/g, '')

          if (
            candNome.length > 3 &&
            !isTextoCabecalhoOuInvalido(candNome) &&
            !candNome.toLowerCase().includes('corretor')
          ) {
            if (!nome) nome = candNome
          }

          if (candData && !dataNasc) {
            dataNasc = candData
          }

          if (candCpfClean.length === 11 && isValidCpf(candCpfClean)) {
            if (!cpfCnpj) {
              cpfCnpj = candCpfClean
              tipoPessoa = 'PF'
            }
          }
          if (nome && dataNasc && cpfCnpj) return
        }
      }
    }

    // 2. Procurar Variante 2 (Intercalado):
    // Segurado(a)
    // [NOME]
    // Nascimento
    // [DATA] [CPF] (ou apenas [DATA] e na linha seguinte ou posterior o CPF)
    // CPF
    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = normalizarRotulo(lines[i])
      if (l1 === 'segurado(a)' || l1 === 'segurado' || l1 === 'proponente') {
        const candLinhaNome = lines[i + 1]
        if (candLinhaNome && !isTextoCabecalhoOuInvalido(candLinhaNome)) {
          const candNome = sanitizarTextoExtraido(candLinhaNome)
          if (
            candNome.length > 3 &&
            !candNome.toLowerCase().includes('corretor') &&
            !candNome.toLowerCase().includes('seguradora')
          ) {
            if (!nome) nome = candNome
          }
        }

        // Olhar as próximas 8 linhas para Nascimento e CPF intercalados
        const janela = lines.slice(i + 1, Math.min(lines.length, i + 10))
        for (const jl of janela) {
          // Procurar data e CPF juntos na mesma linha: "02/08/1990 057.365.924-95"
          const dataCpfMatch =
            /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i.exec(jl)
          if (dataCpfMatch) {
            if (!dataNasc) dataNasc = parseDataFlexivel(dataCpfMatch[1])
            const limpo = dataCpfMatch[2].replace(/\D/g, '')
            if (limpo.length === 11 && isValidCpf(limpo)) {
              if (!cpfCnpj) {
                cpfCnpj = limpo
                tipoPessoa = 'PF'
              }
            }
          } else {
            // Data avulsa se ainda faltar
            if (!dataNasc) {
              const dtM = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})$/.exec(jl.trim())
              if (dtM) {
                dataNasc = parseDataFlexivel(dtM[1])
              }
            }
            // CPF avulso se ainda faltar
            if (!cpfCnpj) {
              const cpfM = /^([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$/.exec(jl.trim())
              if (cpfM) {
                const limpo = cpfM[1].replace(/\D/g, '')
                if (limpo.length === 11 && isValidCpf(limpo)) {
                  cpfCnpj = limpo
                  tipoPessoa = 'PF'
                }
              }
            }
          }
        }
        if (nome && (cpfCnpj || dataNasc)) return
      }
    }
  }

  // Executar prioritariamente o parser sequencial do segurado
  if (dadosGeraisText) {
    extrairSeguradoSequencial(dadosGeraisText)
  }
  if (!nome || !cpfCnpj || !dataNasc) {
    extrairSeguradoSequencial(textoUtilCliente)
  }

  // REGRA DE OURO 1: Buscar primeiro dentro do bloco SUAS INFORMAÇÕES (Allianz)
  if (suasInfoText) {
    const docSuasInfo = /(?:CPF\/CNPJ|CPF|CNPJ)[*\s|:]+([0-9.\-/]{11,18})/i.exec(suasInfoText)
    if (docSuasInfo) {
      const docLimpo = docSuasInfo[1].replace(/\D/g, '')
      if (docLimpo.length === 11) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PF'
      } else if (docLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(docLimpo)) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PJ'
      }
    }
  }

  // REGRA DE OURO 2: Buscar dentro de DADOS GERAIS (Azul Seguros / Porto Seguro)
  // No layout Azul Tradicional:
  // "Nascimento 02/08/1990 057.365.924-95 CPF" ou "057.365.924-95 CPF" ou "CPF 057.365.924-95"
  // E também via tabela GFM (| Segurado(a) | Nascimento | CPF |)
  const extrairCpfCnpjDeTabelaSegurado = (fonteTexto: string) => {
    parseTabelaGfmLinhas(/segurado\s*(?:\(a\))?/i, fonteTexto, (headers, values) => {
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

        if (h.includes('cpf')) {
          const limpo = val.replace(/\D/g, '')
          if (limpo.length === 11 && isValidCpf(limpo)) {
            cpfCnpj = limpo
            tipoPessoa = 'PF'
          }
        } else if (h.includes('cnpj')) {
          const limpo = val.replace(/\D/g, '')
          if (limpo.length === 14 && !isCnpjSeguradoraOuInvalido(limpo)) {
            cpfCnpj = limpo
            tipoPessoa = 'PJ'
          }
        }
      })
    })

    if (!cpfCnpj) {
      const cpfNaLinha =
        /(?:cpf[*\s|:]+([0-9.\-/]{11,14})|([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\s*(?:[|*]*\s*cpf)?)/i.exec(
          fonteTexto,
        )
      if (cpfNaLinha) {
        const docRaw = cpfNaLinha[1] || cpfNaLinha[2]
        const docLimpo = docRaw.replace(/\D/g, '')
        if (docLimpo.length === 11 && isValidCpf(docLimpo)) {
          cpfCnpj = docLimpo
          tipoPessoa = 'PF'
        }
      }
    }
    if (!cpfCnpj) {
      const cnpjNaLinha = /(?:cnpj)[*\s|:]+([0-9.\-/]{14,18})/i.exec(fonteTexto)
      if (cnpjNaLinha) {
        const docLimpo = cnpjNaLinha[1].replace(/\D/g, '')
        if (docLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(docLimpo)) {
          cpfCnpj = docLimpo
          tipoPessoa = 'PJ'
        }
      }
    }
  }

  // 1ª prioridade: no escopo isolado dadosGeraisText
  if (!cpfCnpj && dadosGeraisText) {
    extrairCpfCnpjDeTabelaSegurado(dadosGeraisText)
  }
  // 2ª prioridade (Redundância Decisiva): busca global no texto útil inteiro
  if (!cpfCnpj) {
    extrairCpfCnpjDeTabelaSegurado(textoUtilCliente)
  }

  // Fallback 1: Buscar no bloco INFORMAÇÕES DO CONDUTOR PRINCIPAL
  if (!cpfCnpj && condPrincipalText) {
    const docCond = /(?:CPF\/CNPJ|CPF|CNPJ)[*\s|:]+([0-9.\-/]{11,18})/i.exec(condPrincipalText)
    if (docCond) {
      const docLimpo = docCond[1].replace(/\D/g, '')
      if (docLimpo.length === 11) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PF'
      } else if (docLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(docLimpo)) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PJ'
      }
    }
  }

  // Fallback 2: Buscar em cabeçalhos específicos no textoUtilCliente (antes do corte institucional)
  if (!cpfCnpj) {
    // Atenção: Procura CPF primeiro ou CNPJ apenas se for explicitamente identificado
    const cpfMatch =
      /(?:cpf|c\.p\.f\.?)[*\s|:]+([0-9.\-/]{11,14})/i.exec(textoUtilCliente) ||
      /([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\s*(?:[|*]*\s*cpf)/i.exec(textoUtilCliente)

    if (cpfMatch) {
      const numLimpo = cpfMatch[1].replace(/\D/g, '')
      if (numLimpo.length === 11 && isValidCpf(numLimpo)) {
        cpfCnpj = numLimpo
        tipoPessoa = 'PF'
      }
    }

    if (!cpfCnpj) {
      const cnpjMatch = /(?:cnpj|c\.n\.p\.j\.?)[*\s|:]+([0-9.\-/]{14,18})/i.exec(textoUtilCliente)
      if (cnpjMatch) {
        const numLimpo = cnpjMatch[1].replace(/\D/g, '')
        if (numLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(numLimpo)) {
          cpfCnpj = numLimpo
          tipoPessoa = 'PJ'
        }
      }
    }

    if (!cpfCnpj) {
      const docMatch = /(?:documento)[*\s|:]+([0-9.\-/]{11,18})/i.exec(textoUtilCliente)
      if (docMatch) {
        const numLimpo = docMatch[1].replace(/\D/g, '')
        if (numLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(numLimpo)) {
          cpfCnpj = numLimpo
          tipoPessoa = 'PJ'
        } else if (numLimpo.length === 11) {
          cpfCnpj = numLimpo
          tipoPessoa = 'PF'
        }
      }
    }
  }

  // Fallback 3: Buscar qualquer CPF válido formatado no texto da página 1 (antes de termos contratuais/rodapés)
  if (!cpfCnpj) {
    const cpfsEncontrados = textoUtilCliente.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)
    if (cpfsEncontrados) {
      for (const rawCpf of cpfsEncontrados) {
        const limpo = rawCpf.replace(/\D/g, '')
        if (limpo.length === 11 && isValidCpf(limpo)) {
          cpfCnpj = limpo
          tipoPessoa = 'PF'
          break
        }
      }
    }
  }

  // Caso especial: Condomínio sem CNPJ explícito no label
  if (!cpfCnpj && /condom[íi]nio|residencia[l]?\s+do\s+edif[íi]cio/i.test(textoUtilCliente)) {
    const cnpjsEncontrados = textoUtilCliente.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)
    if (cnpjsEncontrados) {
      for (const rawCnpj of cnpjsEncontrados) {
        const limpo = rawCnpj.replace(/\D/g, '')
        if (!isCnpjSeguradoraOuInvalido(limpo)) {
          cpfCnpj = limpo
          tipoPessoa = 'PJ'
          break
        }
      }
    }
  }

  // 2. NOME DO SEGURADO / RAZÃO SOCIAL
  // (a) Caso Azul Seguros / Porto Seguro (bloco "Dados Gerais"):
  // Em tabelas Markdown (Gfm):
  // | Segurado(a) | Nascimento | CPF |
  // | --- | --- | --- |
  // | LIVIA LOURENCO FERNANDES DA CUNHA BARROS | 02/08/1990 | 057.365.924-95 |
  const extrairNomeDeTabelaSegurado = (fonteTexto: string) => {
    parseTabelaGfmLinhas(/segurado\s*(?:\(a\))?/i, fonteTexto, (headers, values) => {
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

        if (h.includes('segurado')) {
          const raw = sanitizarTextoExtraido(val)
          if (
            raw.length > 3 &&
            !isTextoCabecalhoOuInvalido(raw) &&
            !raw.toLowerCase().includes('corretor')
          ) {
            nome = raw
          }
        }
      })
    })

    // 1. Linha imediatamente seguinte a "Segurado(a)" ou na mesma linha
    if (!nome) {
      const linhaSeguradoMatch =
        /(?:^|\n)[|* ]*segurado\s*(?:\(a\))?[|* :]*\n+([A-Za-zÀ-ÿ\s.'-]{4,80})(?=\n|$)/i.exec(
          fonteTexto,
        )
      if (linhaSeguradoMatch) {
        const raw = sanitizarTextoExtraido(linhaSeguradoMatch[1])
        if (
          raw.length > 3 &&
          !isTextoCabecalhoOuInvalido(raw) &&
          !raw.toLowerCase().includes('corretor')
        ) {
          nome = raw
        }
      }
    }

    if (!nome) {
      const nomeAzulMatch =
        /segurado\s*(?:\(a\))?[*\s|:]*\n*([A-Za-zÀ-ÿ\s.'-]{4,80}?)(?=(?:\s*[|*]?\s*(?:nascimento|cpf|cnpj|sexo|profiss[ãa]o|endere[çc]o|pa[íi]s)|\n\s*\n|\||$))/i.exec(
          fonteTexto,
        )
      if (nomeAzulMatch) {
        const raw = sanitizarTextoExtraido(nomeAzulMatch[1])
        if (
          raw.length > 3 &&
          !isTextoCabecalhoOuInvalido(raw) &&
          !raw.toLowerCase().includes('corretor')
        ) {
          nome = raw
        }
      }
    }
  }

  // 1ª prioridade: no escopo isolado dadosGeraisText
  if (!nome && dadosGeraisText) {
    extrairNomeDeTabelaSegurado(dadosGeraisText)
  }
  // 2ª prioridade (Redundância Decisiva): busca global no texto útil inteiro
  if (!nome) {
    extrairNomeDeTabelaSegurado(textoUtilCliente)
  }

  // (b) Se for proposta Condomínio (PJ) da Allianz, pode ter razão social completa antes de "Essa é a proposta..."
  if (!nome) {
    const allianzCabecalhoMatch =
      /(?:^|\n)\s*([A-Z0-9\s.,'/-]{10,80})\s*\n\s*Essa\s+[ée]\s+a\s+proposta\s+do\s+seu\s+seguro\s+Allianz\s+Condom[íi]nio/i.exec(
        text,
      )
    if (allianzCabecalhoMatch) {
      const cab = allianzCabecalhoMatch[1].trim()
      if (cab.length > 5 && !cab.toLowerCase().includes('corretora')) {
        nome = cab
      }
    }
  }

  // (c) Bloco "SUAS INFORMAÇÕES" (Allianz)
  if (!nome && suasInfoText) {
    const nomeSuasInfo =
      /(?:Nome|Segurado)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)(?=(?:\s*[|*]?\s*(?:CPF|CNPJ|Tel|E-mail|Endere[çc]o|Idade|Estado|Telefone)|\||\n|$))/i.exec(
        suasInfoText,
      )
    if (nomeSuasInfo) {
      const rawNome = sanitizarTextoExtraido(nomeSuasInfo[1])
      if (rawNome.length > 3 && rawNome.length < 120 && !isTextoCabecalhoOuInvalido(rawNome)) {
        nome = rawNome
      }
    }
  }

  // (d) Saudação da Allianz ("Olá IRIS NOVAES BUDACH MACHADO,")
  if (!nome) {
    const olaMatch =
      /Ol[áa]\s+\*{0,2}([A-ZÀ-ÿ\s]{4,80}?)\*{0,2},\s*(?:Agradecemos|Confira|Essa)/i.exec(text)
    if (olaMatch) {
      const n = sanitizarTextoExtraido(olaMatch[1])
      if (n.length > 3 && !n.toLowerCase().includes('corretora')) {
        nome = n
      }
    }
  }

  // Fallback 1: Buscar no bloco INFORMAÇÕES DO CONDUTOR PRINCIPAL (apenas se não houver condutor separado)
  if (!nome && condPrincipalText) {
    const nomeCondSec =
      /(?:Nome|Condutor)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)(?=(?:\s*[|*]?\s*(?:CPF|Idade|Estado|Parentesco)|\||\n|$))/i.exec(
        condPrincipalText,
      )
    if (nomeCondSec) {
      const n = sanitizarTextoExtraido(nomeCondSec[1])
      if (n.length > 3 && n.length < 100 && !isTextoCabecalhoOuInvalido(n)) {
        nome = n
      }
    }
  }

  // Fallback 2: Fallback genérico de nome
  if (!nome) {
    const nomeMatch =
      /(?:nome\s+do\s+segurado|segurado(?:\s*\(a\))?|proponente|raz[ãa]o\s+social)[*\s|:]*\n*([A-Za-zÀ-ÿ0-9\s.-]+?)(?=\s*[|*]?\s*(?:cpf|cnpj|nasc|data|endere[çc]o|telefone|email)|\n|\||$)/i.exec(
        textoUtilCliente,
      )
    if (nomeMatch) {
      const n = sanitizarTextoExtraido(nomeMatch[1])
      if (n.length > 3 && n.length < 100 && !isTextoCabecalhoOuInvalido(n)) {
        nome = n
      }
    }
  }

  // 3. DATA DE NASCIMENTO (Allianz NÃO traz e PJ não possui)
  if (formato !== 'ALLIANZ' && tipoPessoa === 'PF') {
    // Procura primeiro no bloco Dados Gerais / texto útil antes do questionário de risco/condutor
    const extrairNascimentoDeTabela = (fonteTexto: string) => {
      parseTabelaGfmLinhas(/segurado\s*(?:\(a\))?/i, fonteTexto, (headers, values) => {
        headers.forEach((h, idx) => {
          const val = values[idx] || ''
          if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

          if (h.includes('nascimento') || h.includes('nasc')) {
            const dt = parseDataFlexivel(val)
            if (dt) dataNasc = dt
          }
        })
      })
    }

    // 1ª prioridade: tabela GFM em dadosGeraisText
    if (!dataNasc && dadosGeraisText) {
      extrairNascimentoDeTabela(dadosGeraisText)
    }
    // 2ª prioridade: tabela GFM no texto útil global
    if (!dataNasc) {
      extrairNascimentoDeTabela(textoUtilCliente)
    }

    const escopoNasc = dadosGeraisText || textoUtilCliente

    // Fallback regex de tabela de nascimento
    if (!dataNasc) {
      const nascTabelaMatch =
        /\|\s*[^|\n]*\b(?:data\s+de\s+nascimento|nascimento|nasc\.?)\b[^|\n]*\|[^\n]*\n\|(?:\s*[-:]+\s*\|)+\s*\n\|[^|\n]*\|\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*\|/i.exec(
          escopoNasc,
        )
      if (nascTabelaMatch) {
        dataNasc = parseDataFlexivel(nascTabelaMatch[1])
      }
    }

    // 2. Célula markdown em qualquer tabela ou linha: "| 02/08/1990 |" dentro de Dados Gerais ou texto útil
    if (!dataNasc && dadosGeraisText) {
      const dateInDadosGeraisMatch = /\|\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*\|/.exec(
        dadosGeraisText,
      )
      if (dateInDadosGeraisMatch) {
        dataNasc = parseDataFlexivel(dateInDadosGeraisMatch[1])
      }
    }

    // 3. Linhas quebradas ou com dois pontos
    if (!dataNasc) {
      const nascLinhaQuebradaMatch =
        /(?:data\s+de\s+nascimento|nascimento|nasc\.?)[*\s|:]*\n+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
          escopoNasc,
        )
      if (nascLinhaQuebradaMatch) {
        dataNasc = parseDataFlexivel(nascLinhaQuebradaMatch[1])
      } else {
        const nascMatch =
          /(?:data\s+de\s+nascimento|nascimento|nasc\.?)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
            escopoNasc,
          )
        if (nascMatch) {
          dataNasc = parseDataFlexivel(nascMatch[1])
        }
      }
    }
  }

  // 4. E-MAIL
  // Priorizar busca no bloco "SUAS INFORMAÇÕES" se houver
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g
  const searchForEmail = (sourceText: string): string => {
    const matches = sourceText.match(emailRegex)
    if (matches) {
      for (const em of matches) {
        const emLower = em.toLowerCase()
        if (
          !emLower.includes('allianz') &&
          !emLower.includes('seguradora') &&
          !emLower.includes('corret') &&
          !emLower.includes('cred10mix')
        ) {
          return em.trim()
        }
      }
    }
    return ''
  }

  // Busca em tabelas GFM contendo "E-mail"
  parseTabelaGfmLinhas(/\be-?mail\b/i, textoUtilCliente, (headers, values) => {
    headers.forEach((h, idx) => {
      const val = values[idx] || ''
      if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

      if (h.includes('e-mail') || h.includes('email')) {
        const em = searchForEmail(val)
        if (em) email = em
      }
    })
  })

  if (!email && suasInfoText) {
    email = searchForEmail(suasInfoText)
  }
  if (!email) {
    email = searchForEmail(text)
  }

  // 5. TELEFONE / CELULAR
  const normalizarTelefoneComDDD = (rawTel: string): string => {
    let clean = rawTel.trim()
    const digitsOnly = clean.replace(/\D/g, '')
    // Se veio no formato "Celular: (83) 99112-9729" já tem DDD
    if (digitsOnly.length === 8 || digitsOnly.length === 9) {
      if (/OLINDA|RECIFE|\bPE\b/i.test(text)) {
        clean = `81${digitsOnly}`
      } else if (/JO[ÃA]O\s+PESSOA|\bPB\b/i.test(text)) {
        clean = `83${digitsOnly}`
      }
    }
    const d = clean.replace(/\D/g, '')
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    }
    return clean
  }

  const isTelefoneInstitucionalOuInvalido = (digits: string): boolean => {
    // 0800 (SACs e Ouvidorias de seguradoras)
    if (
      digits.startsWith('0800') ||
      digits.includes('08007272766') ||
      digits.includes('08007271184')
    )
      return true
    // 0300 (Centrais de atendimento outras regiões)
    if (digits.startsWith('0300') || digits.includes('03003376786')) return true
    // Central 24h Grande São Paulo Porto Seguro: 1133663333 / 33663333
    if (digits.includes('33663333')) return true
    // Matrícula SUSEP / Corretora Cred10mix: telefone 8134939966, 8132240174, 32240174
    if (digits.includes('34939966') || digits.includes('32240174')) return true
    // Linha Direta Allianz: 40901110 / 08007777243
    if (digits.includes('40901110') || digits.includes('08007777243')) return true
    return false
  }

  // Busca prioritária em tabela GFM contendo "Telefone" ou "Celular" (ex: Azul Seguros | E-mail | Telefone | Tipo de envio |)
  parseTabelaGfmLinhas(/\b(?:telefone|celular)\b/i, textoUtilCliente, (headers, values) => {
    headers.forEach((h, idx) => {
      const val = values[idx] || ''
      if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

      if (h.includes('telefone') || h.includes('celular') || h.includes('tel')) {
        const cleanDigits = val.replace(/\D/g, '')
        if (!isTelefoneInstitucionalOuInvalido(cleanDigits) && cleanDigits.length >= 8) {
          telefone = normalizarTelefoneComDDD(val)
        }
      }
    })
  })

  if (!telefone && suasInfoText) {
    // "Tel: 81998747908" ou "**Tel:** 81998747908" ou "| Tel | 81998747908 |"
    const telSuas =
      /(?:Tel|Telefone|Celular)[*\s|:]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/i.exec(
        suasInfoText,
      )
    if (telSuas) {
      const cleanDigits = telSuas[1].replace(/\D/g, '')
      if (!isTelefoneInstitucionalOuInvalido(cleanDigits)) {
        telefone = normalizarTelefoneComDDD(telSuas[1])
      }
    }
  }

  // Busca em Dados Gerais (Azul / Porto)
  if (!telefone && dadosGeraisText) {
    const telAzul =
      /(?:celular|telefone|tel)[*\s|:/]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/i.exec(
        dadosGeraisText,
      )
    if (telAzul) {
      const cleanDigits = telAzul[1].replace(/\D/g, '')
      if (!isTelefoneInstitucionalOuInvalido(cleanDigits)) {
        telefone = normalizarTelefoneComDDD(telAzul[1])
      }
    }
  }

  if (!telefone) {
    // Busca no texto útil do cliente com label (evitando pegar SAC da pág 5)
    const telMatches = textoUtilCliente.matchAll(
      /(?:telefone|celular|tel|fone)[*\s|:/]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/gi,
    )
    for (const match of telMatches) {
      const cleanDigits = match[1].replace(/\D/g, '')
      if (!isTelefoneInstitucionalOuInvalido(cleanDigits) && cleanDigits.length >= 8) {
        telefone = normalizarTelefoneComDDD(match[1])
        break
      }
    }
  }

  // 6. ENDEREÇO COMPLETO E CEP
  // (0) PARSER DE BLOCO DE ENDEREÇO SEQUENCIAL (Azul Seguros / Porto Seguro)
  // Layout real onde a conversão gera fluxo de colunas empilhadas (rótulos em sequência seguidos de valores na mesma ordem):
  // Endereço residencial
  // Complemento
  // CEP
  // UF
  // Bairro
  // Cidade
  // R Doralice de Almeida Lyra, 55
  // -
  // 58037-335
  // PB
  // Jardim Oceania
  // João Pessoa
  const extrairEnderecoSequencial = (fonteTexto: string) => {
    const rawLines = fonteTexto.split(/\r?\n/).map((l) => l.trim())
    const lines = rawLines.filter((l) => l.length > 0)

    const normalizarRotulo = (s: string) =>
      s
        .toLowerCase()
        .replace(/[*_#:|-]/g, '')
        .trim()

    // 1. Detecção baseada na sequência de rótulos seguida por valores
    for (let i = 0; i < lines.length; i++) {
      const lNorm = normalizarRotulo(lines[i])
      if (lNorm === 'endereço residencial' || lNorm === 'endereco residencial') {
        let idxComplemento = -1
        let idxCep = -1
        let idxUf = -1
        let idxBairro = -1
        let idxCidade = -1

        for (let k = i + 1; k < Math.min(lines.length, i + 12); k++) {
          const kNorm = normalizarRotulo(lines[k])
          if (kNorm === 'complemento' && idxComplemento === -1) idxComplemento = k
          else if (kNorm === 'cep' && idxCep === -1) idxCep = k
          else if (kNorm === 'uf' && idxUf === -1) idxUf = k
          else if (kNorm === 'bairro' && idxBairro === -1) idxBairro = k
          else if (kNorm === 'cidade' && idxCidade === -1) {
            idxCidade = k
            break
          }
        }

        if (idxCidade > i) {
          // Os valores começam após idxCidade!
          // 1ª valor = rua e número (ex: "R Doralice de Almeida Lyra, 55")
          // 2ª valor = complemento (ex: "-")
          // 3ª valor = CEP ("58037-335")
          // 4ª valor = UF ("PB")
          // 5ª valor = Bairro ("Jardim Oceania")
          // 6ª valor = Cidade ("João Pessoa")
          const valoresPost = lines
            .slice(idxCidade + 1, idxCidade + 10)
            .filter(
              (v) =>
                !/^\|?(\s*[-:]+\s*\|?)+$/.test(v) && (!isTextoCabecalhoOuInvalido(v) || v === '-'),
            )

          if (valoresPost.length >= 5) {
            const valRua = valoresPost[0]
            let offsetVal = 0
            if (valoresPost[1] === '-' || (valoresPost[1] && valoresPost[1].length < 5)) {
              offsetVal = 1
            }
            const valCep = valoresPost[offsetVal + 1]
            const valUf = valoresPost[offsetVal + 2]
            const valBairro = valoresPost[offsetVal + 3]
            const valCidade = valoresPost[offsetVal + 4]

            if (valRua && valRua !== '-' && !rua) {
              const pedacos = valRua.split(',').map((p) => p.trim())
              rua = pedacos[0] || valRua
              if (pedacos.length >= 2 && !numero) {
                numero = pedacos.slice(1).join(', ')
              }
            }
            if (valCep && /^\d{5}-?\d{3}$/.test(valCep.trim()) && !cep) {
              const cClean = valCep.replace(/\D/g, '')
              cep = `${cClean.slice(0, 5)}-${cClean.slice(5)}`
            }
            if (valUf && /^[A-Za-z]{2}$/.test(valUf.trim()) && !estado) {
              estado = valUf.trim().toUpperCase()
            }
            if (valBairro && valBairro !== '-' && !bairro) {
              bairro = sanitizarTextoExtraido(valBairro)
            }
            if (valCidade && valCidade !== '-' && !cidade) {
              cidade = sanitizarTextoExtraido(valCidade)
            }

            if (rua && cep && cidade) return
          }
        }
      }
    }

    // 2. Detecção resiliente baseada no CEP e UF no fluxo de linhas:
    // R Doralice de Almeida Lyra, 55
    // -
    // 58037-335
    // PB
    // Jardim Oceania
    // João Pessoa
    for (let j = 0; j < lines.length - 3; j++) {
      const lineCep = lines[j].trim()
      const cepMatch = /^([0-9]{5}-[0-9]{3})$/.exec(lineCep)
      if (cepMatch) {
        const candUf = lines[j + 1]?.trim().toUpperCase()
        if (candUf && /^[A-Z]{2}$/.test(candUf)) {
          if (!cep) cep = cepMatch[1]
          if (!estado) estado = candUf
          const candBairro = lines[j + 2]?.trim()
          const candCidade = lines[j + 3]?.trim()
          if (candBairro && !isTextoCabecalhoOuInvalido(candBairro) && !bairro) {
            bairro = sanitizarTextoExtraido(candBairro)
          }
          if (candCidade && !isTextoCabecalhoOuInvalido(candCidade) && !cidade) {
            cidade = sanitizarTextoExtraido(candCidade)
          }
          if (!rua) {
            for (let k = j - 1; k >= Math.max(0, j - 3); k--) {
              const candRua = lines[k].trim()
              if (candRua === '-' || isTextoCabecalhoOuInvalido(candRua)) continue
              if (candRua.length > 5 && !candRua.toLowerCase().includes('endereço')) {
                const pedacos = candRua.split(',').map((p) => p.trim())
                rua = pedacos[0] || candRua
                if (pedacos.length >= 2 && !numero) {
                  numero = pedacos.slice(1).join(', ')
                }
                break
              }
            }
          }
          if (rua && cep && cidade) return
        }
      }
    }
  }

  // Executar prioritariamente o parser sequencial de endereço
  if (dadosGeraisText) {
    extrairEnderecoSequencial(dadosGeraisText)
  }
  if (!rua || !cep || !bairro || !cidade || !estado) {
    extrairEnderecoSequencial(textoUtilCliente)
  }

  // (a) Caso Azul Seguros / Porto Seguro (bloco "Endereço residencial"):
  // Em tabelas Markdown (Gfm) como gerado pelo $documents.toMarkdown:
  // | Endereço residencial | Complemento | CEP | Bairro | Cidade | UF |
  // | --- | --- | --- | --- | --- | --- |
  // | R Doralice de Almeida Lyra, 55 | - | 58037-335 | Jardim Oceania | João Pessoa | PB |
  const extrairEnderecoDeTabela = (fonteTexto: string) => {
    parseTabelaGfmLinhas(/endere[çc]o\s+residencial/i, fonteTexto, (headers, values) => {
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

        if (h.includes('endereço') || h.includes('endereco')) {
          const pedacos = val.split(',').map((p) => p.trim())
          rua = pedacos[0] || val
          if (pedacos.length >= 2 && !numero) {
            numero = pedacos.slice(1).join(', ')
          }
        } else if (h.includes('complemento')) {
          // Mantém complemento se necessário
        } else if (h.includes('cep')) {
          const cClean = val.replace(/\D/g, '')
          if (cClean.length === 8) {
            cep = `${cClean.slice(0, 5)}-${cClean.slice(5)}`
          }
        } else if (h.includes('bairro')) {
          bairro = val
        } else if (h.includes('cidade')) {
          cidade = val
        } else if (h === 'uf' || h.includes('estado')) {
          const u = val.replace(/[^A-Za-z]/g, '').toUpperCase()
          if (u.length === 2) estado = u
        }
      })
    })
  }

  // 1ª prioridade: se dadosGeraisText estiver isolado
  if (dadosGeraisText) {
    extrairEnderecoDeTabela(dadosGeraisText)
  }
  // 2ª prioridade: busca global no texto útil inteiro
  if (!rua || !cep || !bairro || !cidade || !estado) {
    extrairEnderecoDeTabela(textoUtilCliente)
  }

  const parseCampoRotuloValor = (rotulo: string): string => {
    // 1. Procura rótulo em linha própria e valor na linha seguinte
    const regexLinhaSeguinte = new RegExp(
      `(?:^|\\n)[|* ]*${rotulo}[|* :]*\\n+([^\\n|]+?)(?=\\n|$)`,
      'i',
    )
    const matchLinha = regexLinhaSeguinte.exec(textoUtilCliente)
    if (matchLinha) {
      const val = sanitizarTextoExtraido(matchLinha[1])
      if (val && !isTextoCabecalhoOuInvalido(val) && val !== '-') {
        return val
      }
    }
    // 2. Procura rótulo na mesma linha
    const regexMesmaLinha = new RegExp(
      `(?:^|\\n|[|/])[|* ]*${rotulo}[|* :]+([^\\n|/]+?)(?=(?:[|*/]?\\s*(?:complemento|cep|uf|bairro|cidade|e-mail|telefone|ve[íi]culo)|\\n|\\||\\/|$))`,
      'i',
    )
    const matchMesma = regexMesmaLinha.exec(textoUtilCliente)
    if (matchMesma) {
      const val = sanitizarTextoExtraido(matchMesma[1])
      if (val && !isTextoCabecalhoOuInvalido(val) && val !== '-') {
        return val
      }
    }
    return ''
  }

  // Tentar capturar campos estruturados (Azul / Porto) se ainda não capturados via tabela
  if (!rua) {
    const azulRua = parseCampoRotuloValor('endere[çc]o(?:\\s+residencial)?')
    if (azulRua) rua = azulRua
  }
  if (!cep) {
    const azulCep = parseCampoRotuloValor('cep')
    if (azulCep) {
      const cepClean = azulCep.replace(/\D/g, '')
      if (cepClean.length === 8) {
        cep = `${cepClean.slice(0, 5)}-${cepClean.slice(5)}`
      }
    }
  }
  if (!bairro) {
    const azulBairro = parseCampoRotuloValor('bairro')
    if (azulBairro) bairro = azulBairro
  }
  if (!cidade) {
    const azulCidade = parseCampoRotuloValor('cidade')
    if (azulCidade) cidade = azulCidade
  }
  if (!estado) {
    const azulUf = parseCampoRotuloValor('uf')
    if (azulUf && azulUf.length === 2) {
      estado = azulUf.toUpperCase()
    }
  }

  if (!rua) {
    const endResidencialMatch =
      /endere[çc]o\s+residencial[*\s|:/]+\n*([^\n|/]+?)(?=(?:\s*[|*/]?\s*(?:complemento|cep|uf|bairro|cidade|e-mail|telefone)|\n|\||\/|$))/i.exec(
        textoUtilCliente,
      )
    if (endResidencialMatch) {
      const rawEnd = sanitizarTextoExtraido(endResidencialMatch[1])
      if (rawEnd.length > 3 && !isTextoCabecalhoOuInvalido(rawEnd)) {
        rua = rawEnd
      }
    }
  }

  // (b) Caso Auto / Allianz PF: linha única completa no bloco "SUAS INFORMAÇÕES":
  let enderecoLinhaUnica = ''
  if (!rua && suasInfoText) {
    const endSuasMatch = /Endere[çc]o[*\s|:]+([^\n|]+)/i.exec(suasInfoText)
    if (endSuasMatch) {
      enderecoLinhaUnica = endSuasMatch[1].trim()
    }
  }

  if (enderecoLinhaUnica) {
    const partes = enderecoLinhaUnica.split('-').map((p) => p.trim())
    if (partes.length >= 2) {
      const logradouroComp = partes[0]
      const pedacosLogr = logradouroComp.split(',').map((p) => p.trim())
      rua = pedacosLogr[0] || ''
      if (pedacosLogr.length >= 2) {
        numero = pedacosLogr[1]
      }
      if (pedacosLogr.length >= 3) {
        const comp = pedacosLogr.slice(2).join(', ')
        if (numero) {
          numero = `${numero}, ${comp}`
        } else {
          numero = comp
        }
      }

      for (let i = 1; i < partes.length; i++) {
        const parte = partes[i]
        const cepM = /\b([0-9]{5}-?[0-9]{3})\b/.exec(parte)
        if (cepM && !cep) {
          const cRaw = cepM[1].replace(/\D/g, '')
          cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
          continue
        }

        const cidUfM = /([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})\b/.exec(parte)
        if (cidUfM) {
          const candidataCidade = cidUfM[1].trim()
          if (!isTextoCabecalhoOuInvalido(candidataCidade)) {
            cidade = candidataCidade
            estado = cidUfM[2].trim().toUpperCase()
          }
          continue
        }

        if (!bairro && !isTextoCabecalhoOuInvalido(parte)) {
          bairro = parte
        }
      }
    } else {
      rua = enderecoLinhaUnica
    }
  }

  // Se não extraiu endereço em linha única, tentar os campos individuais de Allianz Condomínio
  if (!rua) {
    const endCorrespMatch = /endere[çc]o\s+de\s+correspond[êe]ncia[:\s]+([^\n|]+)/i.exec(
      textoUtilCliente,
    )
    if (endCorrespMatch) {
      rua = endCorrespMatch[1].trim()
    }
  }

  if (!bairro) {
    const bairroMatch =
      /(?:bairro)[*\s|:/]+([A-Za-zÀ-ÿ0-9\s.-]+?)(?=(?:\s*[|*/]?\s*(?:cidade|uf|cep|e-mail|telefone|ve[íi]culo)|\n|\||\/|$))/i.exec(
        textoUtilCliente,
      )
    if (bairroMatch) {
      const b = sanitizarTextoExtraido(bairroMatch[1])
      if (!isTextoCabecalhoOuInvalido(b) && b !== '-') bairro = b
    }
  }

  if (!cidade || !estado) {
    const cidadeUfMatch = /cidade\/uf[:\s/]+([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})/i.exec(textoUtilCliente)
    if (cidadeUfMatch) {
      const candidata = sanitizarTextoExtraido(cidadeUfMatch[1])
      if (!isTextoCabecalhoOuInvalido(candidata)) {
        cidade = candidata
        estado = cidadeUfMatch[2].trim().toUpperCase()
      }
    } else {
      if (!cidade) {
        const cidMatch =
          /(?:cidade)[*\s|:/]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*/]?\s*(?:uf|estado|e-mail|telefone|ve[íi]culo)|\n|\||\/|$))/i.exec(
            textoUtilCliente,
          )
        if (cidMatch) {
          const c = sanitizarTextoExtraido(cidMatch[1])
          if (!isTextoCabecalhoOuInvalido(c) && c !== '-') cidade = c
        }
      }
      if (!estado) {
        const ufMatch = /(?:uf|estado)[*\s|:/]+([A-Z]{2})\b/i.exec(textoUtilCliente)
        if (ufMatch) estado = ufMatch[1].trim().toUpperCase()
      }
    }
  }

  // CEP no texto se ainda faltar: "CEP 58037-335" ou "CEP: 52061-540"
  if (!cep) {
    const cepMatch =
      /(?:cep)[*\s|:]+([0-9]{5}-?[0-9]{3})/i.exec(textoUtilCliente) ||
      /(?:cep\s+pernoite)[*\s|:]+([0-9]{5}-?[0-9]{3})/i.exec(text)
    if (cepMatch) {
      const cRaw = cepMatch[1].replace(/\D/g, '')
      cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
    }
  }

  // Bloco "Endereço do local segurado" (usado em condomínio / residencial)
  if (!numero || !rua) {
    const localSeguradoMatch = /endere[çc]o\s+do\s+local\s+segurado[:\s]+([^\n]+)/i.exec(text)
    if (localSeguradoMatch) {
      const rawLocal = localSeguradoMatch[1].trim()
      const partes = rawLocal.split('-').map((p) => p.trim())
      if (partes.length >= 2) {
        const ruaNum = partes[0]
        const numMatch = /,\s*(\d+[A-Za-z0-9\s/]*)$/.exec(ruaNum)
        if (numMatch) {
          if (!numero) numero = numMatch[1].trim()
          const ruaExtraida = ruaNum.substring(0, numMatch.index).trim()
          if (!rua || rua.length < ruaExtraida.length) {
            rua = ruaExtraida
          }
        } else if (!rua) {
          rua = ruaNum
        }

        if (!bairro && partes[1] && !isTextoCabecalhoOuInvalido(partes[1])) {
          bairro = partes[1]
        }

        for (let i = 1; i < partes.length; i++) {
          const p = partes[i]
          const cMatch = /([0-9]{5}-?[0-9]{3})/.exec(p)
          if (cMatch && !cep) {
            const cRaw = cMatch[1].replace(/\D/g, '')
            cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
          }
          const cidUf = /([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})/.exec(p)
          if (cidUf) {
            const c = cidUf[1].trim()
            if (!cidade && !isTextoCabecalhoOuInvalido(c)) cidade = c
            if (!estado) estado = cidUf[2].trim().toUpperCase()
          }
        }
      }
    }
  }

  // Se a rua tem número embutido tipo "Rua ..., 55"
  if (rua && !numero) {
    const rNumMatch = /,\s*(\d+[A-Za-z0-9\s/]*)$/.exec(rua)
    if (rNumMatch) {
      numero = rNumMatch[1].trim()
      rua = rua.substring(0, rNumMatch.index).trim()
    }
  }

  // Validação final de sanitização contra títulos conhecidos de privacidade/LGPD
  if (isTextoCabecalhoOuInvalido(cidade)) cidade = ''
  if (isTextoCabecalhoOuInvalido(bairro)) bairro = ''
  if (isTextoCabecalhoOuInvalido(rua)) rua = ''

  return {
    nome,
    cpfCnpj,
    tipoPessoa,
    dataNascimento: dataNasc || undefined,
    email: email || undefined,
    telefone: telefone || undefined,
    cep: cep || undefined,
    rua: rua || undefined,
    numero: numero || undefined,
    bairro: bairro || undefined,
    cidade: cidade || undefined,
    estado: estado || undefined,
  }
}

function extrairCondutor(
  text: string,
  nomeSegurado: string,
  cpfSegurado: string,
): PropostaCondutorExtraido {
  let nomeCondutor = ''
  let cpfCondutor = ''
  let dataNasc = ''
  let parentesco = ''
  let mesmo = true

  // 1. Caso Azul Seguros / Porto Seguro ("Questionário de avaliação de risco"):
  // No layout Azul Tradicional:
  // "PAULA GABRIELA DE MORAIS NEGREIROS 088.181.234-08"
  // "58037-335"
  // "Condutor Nascimento"
  // "15/10/1996"
  // "CPF"
  const questionarioSecMatch =
    /(?:Question[áa]rio\s+de\s+avalia[çc][ãa]o\s+de\s+risco|Perfil\s+do\s+condutor)[\s\S]*?(?=(?:Coberturas|Assist[êe]ncias|Declara[çc][ãa]o|Termos|Uso\s+Interno|\n{3,}|$))/i.exec(
      text,
    )
  const questSec = questionarioSecMatch ? questionarioSecMatch[0] : ''

  if (questSec) {
    // Procura por nome maiúsculo seguido por CPF na mesma linha ou linhas próximas
    const condLinhaMatch = /([A-ZÀ-ÿ\s]{4,80})\s+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i.exec(
      questSec,
    )
    if (condLinhaMatch) {
      const candNome = sanitizarTextoExtraido(condLinhaMatch[1])
      if (
        candNome.length > 3 &&
        !isTextoCabecalhoOuInvalido(candNome) &&
        !candNome.toLowerCase().includes('corretor') &&
        !candNome.toLowerCase().includes('seguro')
      ) {
        nomeCondutor = candNome
        cpfCondutor = condLinhaMatch[2].replace(/\D/g, '')
      }
    }

    // Se achou o bloco mas não por linha direta, procura o nascimento do condutor
    const nascCondQuebradoMatch =
      /(?:condutor\s+nascimento|nascimento\s+condutor|condutor[^\n]*\nnascimento)[*\s|:]*\n+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        questSec,
      )
    if (nascCondQuebradoMatch) {
      dataNasc = parseDataFlexivel(nascCondQuebradoMatch[1])
    } else {
      const nascCondMatch =
        /(?:condutor\s+nascimento|nascimento\s+condutor|nascimento)[*\s|:]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
          questSec,
        )
      if (nascCondMatch) {
        dataNasc = parseDataFlexivel(nascCondMatch[1])
      }
    }
  }

  // 2. Isolar seção "INFORMAÇÕES DO CONDUTOR PRINCIPAL" (Allianz) se houver
  if (!nomeCondutor) {
    const condSectionMatch =
      /INFORMA[ÇC][ÕO]ES\s+DO\s+CONDUTOR(?:\s+PRINCIPAL)?[\s\S]*?(?=(?:INFORMA[ÇC][ÕO]ES\s+DO|INFORMA[ÇC][ÕO]ES\s+DE|INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|\n\n\n|$))/i.exec(
        text,
      )

    if (condSectionMatch) {
      const condSec = condSectionMatch[0]
      const nomeCondSec =
        /(?:Nome|Condutor)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)(?=(?:\s*[|*]?\s*(?:CPF|Idade|Estado|Parentesco)|\||\n|$))/i.exec(
          condSec,
        )
      if (nomeCondSec) {
        const raw = sanitizarTextoExtraido(nomeCondSec[1])
        if (raw.length > 3 && raw.length < 80 && !isTextoCabecalhoOuInvalido(raw)) {
          nomeCondutor = raw
        }
      }
      const cpfCondSec = /(?:CPF)[*\s|:]+([0-9.\-/]{11,14})/i.exec(condSec)
      if (cpfCondSec) {
        cpfCondutor = cpfCondSec[1].replace(/\D/g, '')
      }
    }
  }

  if (!nomeCondutor) {
    // Procurar por bloco "Condutor Principal", "Principal Condutor", "Condutor habitual"
    const condMatch =
      /(?:condutor\s+principal|principal\s+condutor|condutor\s+habitual|perfil\s+do\s+condutor)[*\s|:]+([A-Za-zÀ-ÿ\s.-]+?)(?=\s*[|*]?\s*(?:cpf|nasc|parentesco|sexo)|\n|\||$)/i.exec(
        text,
      )

    if (condMatch) {
      const cNome = sanitizarTextoExtraido(condMatch[1])
      if (cNome.length > 3 && cNome.length < 80 && !isTextoCabecalhoOuInvalido(cNome)) {
        nomeCondutor = cNome
      }
    }
  }

  // CPF do condutor global se não achou na seção
  if (!cpfCondutor) {
    const cpfCondMatch = /condutor.*?(?:cpf)[*\s|:]+([0-9.\-/]{11,14})/i.exec(text)
    if (cpfCondMatch) {
      cpfCondutor = cpfCondMatch[1].replace(/\D/g, '')
    }
  }

  if (nomeCondutor && nomeSegurado) {
    const n1 = nomeCondutor.trim().toLowerCase()
    const n2 = nomeSegurado.trim().toLowerCase()
    if (n1 !== n2 && !n1.includes(n2) && !n2.includes(n1)) {
      mesmo = false
    }
  }

  if (!nomeCondutor && nomeSegurado) {
    nomeCondutor = nomeSegurado
    cpfCondutor = cpfSegurado
    mesmo = true
  }

  return {
    nome: nomeCondutor || nomeSegurado,
    cpf: cpfCondutor || undefined,
    dataNascimento: dataNasc || undefined,
    parentesco: parentesco || undefined,
    mesmoQueSegurado: mesmo,
  }
}

function extrairRenovacao(text: string): PropostaRenovacaoExtraida {
  const t = text.toLowerCase()
  const isRenovacao =
    t.includes('renovação') ||
    t.includes('renovacao') ||
    t.includes('apólice anterior') ||
    t.includes('apolice anterior') ||
    t.includes('seguradora anterior')

  let apoliceAnt = ''
  let seguradoraAnt = ''
  let classeBonus = ''

  // 1. Procura na linha da Azul / Porto: "Apólice 12806713" ou "Apólice: 12806713"
  // Na Azul, sob "Tipo de Operação: Renovação da Cia", há "Seguradora: Azul Seguros", "Sucursal 3", "Apólice 12806713", "Bônus Classe 1"
  if (isRenovacao) {
    const azulRenovMatch =
      /(?:ap[oó]lice|ap[oó]lice\s+anterior|n[ºo.]?\s+anterior)[*\s|:]+([0-9]{6,20})\b/i.exec(text)
    if (azulRenovMatch) {
      apoliceAnt = azulRenovMatch[1].trim()
    }
  }

  const antMatch = /(?:ap[oó]lice\s+anterior|n[ºo.]?\s+anterior)[*\s|:]+([0-9.\-/]{4,20})/i.exec(
    text,
  )
  if (antMatch && !apoliceAnt) {
    apoliceAnt = antMatch[1].trim()
  }

  // Seguradora anterior:
  // Se for "Renovação da Cia" e tiver "Seguradora: Azul Seguros" ou "Seguradora Anterior: ..."
  if (t.includes('renovação da cia') || t.includes('renovacao da cia')) {
    const segCiaMatch =
      /(?:seguradora)[:\s]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*]?\s*(?:sucursal|ap[oó]lice|item|b[oó]nus)|\n|\||$))/i.exec(
        text,
      )
    if (segCiaMatch) {
      seguradoraAnt = sanitizarTextoExtraido(segCiaMatch[1])
    }
  }

  if (!seguradoraAnt) {
    const segAntMatch =
      /(?:seguradora\s+anterior|cia\s+anterior)[*\s|:]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*]?\s*(?:ap[oó]lice|b[oó]nus|fim)|\n|\||$))/i.exec(
        text,
      )
    if (segAntMatch) {
      seguradoraAnt = sanitizarTextoExtraido(segAntMatch[1])
    }
  }

  const bonusMatch =
    /(?:classe\s+de\s+b[oó]nus|classe\s+b[oó]nus|b[oó]nus\s+classe|b[oó]nus)[*\s|:]+([0-9]{1,2})/i.exec(
      text,
    )
  if (bonusMatch) {
    classeBonus = bonusMatch[1].trim()
  }

  return {
    isRenovacao,
    apoliceAnterior: apoliceAnt || undefined,
    seguradoraAnterior: seguradoraAnt || undefined,
    classeBonus: classeBonus || undefined,
  }
}
