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
// Cabeçalhos de seções, textos de privacidade ou ruídos conhecidos que NUNCA devem ser aceitos como valores (ex: em cidade/bairro/rua/nome)
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
]

export function isTextoCabecalhoOuInvalido(val?: string | null): boolean {
  if (!val) return true
  const v = val.trim().toLowerCase()
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
  // Padrões comuns: "Proposta: 123456", "Nº da Proposta: 123456", "Proposta nº: 123456"
  const patterns = [
    /proposta(?:\s+n[ºo.]|\s+número)?[*\s|:]+([0-9\-./]{4,20})/i,
    /n[ºo.]?\s+da\s+proposta[*\s|:]+([0-9\-./]{4,20})/i,
    /n[ºo.]?\s+proposta[*\s|:]+([0-9\-./]{4,20})/i,
    /proposta\s+de\s+seguro[*\s|:]+([0-9\-./]{4,20})/i,
    /c[oó]digo\s+da\s+proposta[*\s|:]+([0-9\-./]{4,20})/i,
  ]

  for (const regex of patterns) {
    const match = regex.exec(text)
    if (match) {
      const num = match[1].replace(/[^\d]/g, '')
      if (num.length >= 4) return num
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

  // 1. Procura primeiro na seção específica "INFORMAÇÕES DE PAGAMENTO" (Allianz) onde o Preço líquido
  // reflete exatamente as condições finais de pagamento.
  const infoPagSection =
    /(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE\s+PAGAMENTO\*{0,2}[\s\S]*?(?=(?:DECLARA[ÇC][ÃA]O|OFICINAS|CL[ÁA]USULAS|P[áa]gina|\n{3,}|$))/i.exec(
      text,
    )
  const pagText = infoPagSection ? infoPagSection[0] : ''

  if (pagText) {
    const pagLiq =
      /(?:pre[çc]o\s+l[íi]quido|pr[êe]mio\s+l[íi]quido)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(pagText)
    if (pagLiq) liquido = parseMoeda(pagLiq[1])

    const pagIof = /iof[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(pagText)
    if (pagIof) iof = parseMoeda(pagIof[1])

    const pagTot =
      /(?:pre[çc]o\s+total|pr[êe]mio\s+total|total\s+a\s+pagar)(?:\s*\([^)]*\))?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
        pagText,
      )
    if (pagTot) total = parseMoeda(pagTot[1])
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
    // Procura "Nº. de Parcelas: 10" ou "Valor da Parcela: 233,50" ou "10 parcelas" ou "10x de R$ ..."
    const numParcMatch = /n[ºo.]?\s+de\s+parcelas[*\s|:]+(\d{1,2})/i.exec(text)
    const parcMatch =
      numParcMatch ||
      /(?:parcelas?|parcelamento)[*\s|:]+(\d{1,2})x?/i.exec(text) ||
      /(\d{1,2})\s*(?:x|vezes)\s+de\s+R?\$?/i.exec(text) ||
      /(\d{1,2})\s+parcelas\b/i.exec(text)

    const vlrParcMatch = /(?:valor\s+da\s+parcela|vlr\s+parcela)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
      text,
    )

    if (parcMatch) {
      parcelas = parseInt(parcMatch[1], 10)
      if (vlrParcMatch) {
        descricao = `${parcelas}x de R$ ${vlrParcMatch[1].trim()}`
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
  const placaMatch = /(?:placa[*\s|:]+)?\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/i.exec(text)
  if (placaMatch) {
    placa = placaMatch[1].replace(/[-\s]/g, '').toUpperCase()
  }

  // Chassi: 17 caracteres alfanuméricos (excluindo I, O, Q)
  const chassiMatch = /(?:chassi[*\s|:]+)?\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(text)
  if (chassiMatch) {
    chassi = chassiMatch[1].toUpperCase()
  }

  // FIPE: 000000-0 ou 6-7 dígitos
  const fipeMatch = /(?:fipe|c[oó]digo\s+fipe|c[oó]d\.\s*fipe)[*\s|:]+([0-9]{6,7}-?[0-9]?)/i.exec(
    text,
  )
  if (fipeMatch) {
    codigoFipe = fipeMatch[1].trim()
  }

  // Ano Fabricação / Modelo (ex: 2023/2024 ou Ano/Modelo: 2022)
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

  // Marca / Modelo: geralmente próximo a "Veículo:", "Modelo:", "Descrição do veículo"
  const modMatch =
    /(?:ve[íi]culo|modelo|marca\/modelo)[*\s|:]+([A-Za-z0-9\s.\-/+]+?)(?=(?:\s*[|*]?\s*(?:produto|ano|placa|chassi|c[oó]d|vers[ãa]o)|\n|\||$))/i.exec(
      text,
    )
  if (modMatch) {
    const rawMod = sanitizarTextoExtraido(modMatch[1])
    if (rawMod.length > 3 && rawMod.length < 80) {
      marcaModelo = rawMod
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
    /(?:#+\s*|\*{0,2})SUAS\s+INFORMA[ÇC][ÕO]ES\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|\n{3,}|$))/i.exec(
      text,
    )
  const suasInfoText = suasInfoSectionMatch ? suasInfoSectionMatch[0] : ''

  // Isolar a seção do Condutor Principal para fallback de documento/nome quando mesmo condutor
  const condPrincipalSectionMatch =
    /(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO\s+CONDUTOR(?:\s+PRINCIPAL)?\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|\n{3,}|$))/i.exec(
      text,
    )
  const condPrincipalText = condPrincipalSectionMatch ? condPrincipalSectionMatch[0] : ''

  // CNPJs conhecidos de seguradoras / entidades que NUNCA devem ser atribuídos ao cliente
  const isCnpjSeguradoraOuInvalido = (docLimpo: string): boolean => {
    // Allianz: 06.157.796/0001-66 ou 06157379... ou qualquer 06.157...
    if (docLimpo.startsWith('06157')) return true
    // Matrícula SUSEP / Corretora Cred10mix (ex: 202062795...)
    if (docLimpo.startsWith('202062795')) return true
    return false
  }

  // 1. EXTRAÇÃO DE DOCUMENTO (CPF ou CNPJ) E DETECÇÃO PF vs PJ
  // REGRA DE OURO: Primeiro buscar dentro do bloco SUAS INFORMAÇÕES
  if (suasInfoText) {
    // Padrão: "CPF/CNPJ: 009.171.474-56" ou "**CPF/CNPJ:** 009.171.474-56" ou "| CPF/CNPJ | 009.171.474-56 |"
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

  // Fallback 2: Se não encontrou nos blocos estruturados, buscar em cabeçalhos específicos
  if (!cpfCnpj) {
    const cnpjMatch = /(?:cnpj|c\.n\.p\.j\.?)[*\s|:]+([0-9.\-/]{14,18})/i.exec(text)
    const cpfMatch = /(?:cpf|c\.p\.f\.?)[*\s|:]+([0-9.\-/]{11,14})/i.exec(text)
    const docMatch = /(?:documento)[*\s|:]+([0-9.\-/]{11,18})/i.exec(text)

    if (cnpjMatch) {
      const numLimpo = cnpjMatch[1].replace(/\D/g, '')
      if (numLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(numLimpo)) {
        cpfCnpj = numLimpo
        tipoPessoa = 'PJ'
      }
    }

    if (!cpfCnpj && cpfMatch) {
      const numLimpo = cpfMatch[1].replace(/\D/g, '')
      if (numLimpo.length === 11) {
        cpfCnpj = numLimpo
        tipoPessoa = 'PF'
      }
    }

    if (!cpfCnpj && docMatch) {
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

  // Fallback 3: Buscar qualquer CPF válido formatado no texto da página 1 (antes de termos contratuais/rodapés)
  if (!cpfCnpj) {
    const cpfsEncontrados = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)
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
  if (!cpfCnpj && /condom[íi]nio|residencia[l]?\s+do\s+edif[íi]cio/i.test(text)) {
    const cnpjsEncontrados = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)
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
  // Se for proposta Condomínio (PJ) da Allianz, pode ter razão social completa antes de "Essa é a proposta..."
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

  // Se não achou pelo cabeçalho de condomínio, busca no bloco "SUAS INFORMAÇÕES"
  if (!nome && suasInfoText) {
    // "Nome: IRIS NOVAES BUDACH MACHADO" ou "**Nome:** IRIS..." ou "| Nome | IRIS... |"
    // Pára em delimitador de campo (CPF, CNPJ, Tel, E-mail, Endereço, Idade, Estado, pipes ou nova linha)
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

  // Se ainda não achou nome, tenta saudação da Allianz:
  // Suporta markdown bold: "Olá **IRIS NOVAES BUDACH MACHADO**," ou "Olá IRIS NOVAES BUDACH MACHADO,"
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

  // Fallback 1: Buscar no bloco INFORMAÇÕES DO CONDUTOR PRINCIPAL
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
      /(?:nome\s+do\s+segurado|segurado(?:\s*\(a\))?|proponente|raz[ãa]o\s+social)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.-]+?)(?=\s*[|*]?\s*(?:cpf|cnpj|nasc|data|endere[çc]o|telefone|email)|\n|\||$)/i.exec(
        text,
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
    const nascMatch =
      /(?:data\s+de\s+nascimento|nascimento|nasc\.?)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    if (nascMatch) {
      dataNasc = parseDataFlexivel(nascMatch[1])
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

  if (suasInfoText) {
    email = searchForEmail(suasInfoText)
  }
  if (!email) {
    email = searchForEmail(text)
  }

  // 5. TELEFONE / CELULAR
  const normalizarTelefoneComDDD = (rawTel: string): string => {
    let clean = rawTel.trim()
    const digitsOnly = clean.replace(/\D/g, '')
    if (digitsOnly.length === 8 || digitsOnly.length === 9) {
      if (/OLINDA|RECIFE|\bPE\b/i.test(text)) {
        clean = `81${digitsOnly}`
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
    // 0800 (SACs de seguradoras)
    if (digits.startsWith('0800')) return true
    // Matrícula SUSEP / Corretora Cred10mix: telefone 8134939966 / 34939966
    if (digits.includes('34939966')) return true
    // Linha Direta Allianz: 40901110 / 08007777243
    if (digits.includes('40901110') || digits.includes('08007777243')) return true
    return false
  }

  if (suasInfoText) {
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

  if (!telefone) {
    // Busca no texto todo com label
    const telMatches = text.matchAll(
      /(?:telefone|celular|tel|fone)[*\s|:]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/gi,
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
  // Caso Auto / Allianz PF: linha única completa no bloco "SUAS INFORMAÇÕES":
  // "Endereço: AV DEZESSETE DE AGOSTO, 1070, AP 202 - CASA FORTE - RECIFE/PE - 52061540"
  // ou "**Endereço:** AV DEZESSETE DE AGOSTO..." ou "| Endereço | ..."
  let enderecoLinhaUnica = ''
  if (suasInfoText) {
    const endSuasMatch = /Endere[çc]o[*\s|:]+([^\n|]+)/i.exec(suasInfoText)
    if (endSuasMatch) {
      enderecoLinhaUnica = endSuasMatch[1].trim()
    }
  }

  if (enderecoLinhaUnica) {
    // Quebrar por traços:
    // Parte 0: "AV DEZESSETE DE AGOSTO, 1070, AP 202"
    // Parte 1: "CASA FORTE" (Bairro)
    // Parte 2: "RECIFE/PE" (Cidade/UF)
    // Parte 3: "52061540" (CEP)
    const partes = enderecoLinhaUnica.split('-').map((p) => p.trim())
    if (partes.length >= 2) {
      // Primeira parte: Logradouro, número e complemento
      const logradouroComp = partes[0]
      const pedacosLogr = logradouroComp.split(',').map((p) => p.trim())
      rua = pedacosLogr[0] || ''
      if (pedacosLogr.length >= 2) {
        numero = pedacosLogr[1]
      }
      if (pedacosLogr.length >= 3) {
        // Se tiver complemento (ex: AP 202), armazena junto com o número
        const comp = pedacosLogr.slice(2).join(', ')
        if (numero) {
          numero = `${numero}, ${comp}`
        } else {
          numero = comp
        }
      }

      // Varrer as outras partes para Bairro, Cidade/UF e CEP
      for (let i = 1; i < partes.length; i++) {
        const parte = partes[i]
        // CEP com 8 dígitos juntos ou com traço: 52061540 ou 52061-540
        const cepM = /\b([0-9]{5}-?[0-9]{3})\b/.exec(parte)
        if (cepM && !cep) {
          const cRaw = cepM[1].replace(/\D/g, '')
          cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
          continue
        }

        // Cidade / UF: RECIFE/PE
        const cidUfM = /([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})\b/.exec(parte)
        if (cidUfM) {
          const candidataCidade = cidUfM[1].trim()
          if (!isTextoCabecalhoOuInvalido(candidataCidade)) {
            cidade = candidataCidade
            estado = cidUfM[2].trim().toUpperCase()
          }
          continue
        }

        // Se não for CEP nem Cidade/UF e bairro ainda não estiver preenchido
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
    const endCorrespMatch = /endere[çc]o\s+de\s+correspond[êe]ncia[:\s]+([^\n|]+)/i.exec(text)
    if (endCorrespMatch) {
      rua = endCorrespMatch[1].trim()
    }
  }

  if (!bairro) {
    const bairroMatch = /bairro[:\s]+([A-Za-zÀ-ÿ0-9\s.-]+?)(?:\s+cidade|\s+cep|\n|$)/i.exec(text)
    if (bairroMatch) {
      const b = bairroMatch[1].trim()
      if (!isTextoCabecalhoOuInvalido(b)) bairro = b
    }
  }

  if (!cidade || !estado) {
    const cidadeUfMatch = /cidade\/uf[:\s]+([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})/i.exec(text)
    if (cidadeUfMatch) {
      const candidata = cidadeUfMatch[1].trim()
      if (!isTextoCabecalhoOuInvalido(candidata)) {
        cidade = candidata
        estado = cidadeUfMatch[2].trim().toUpperCase()
      }
    } else {
      const cidMatch = /cidade[:\s]+([A-Za-zÀ-ÿ\s.-]+?)(?:\s+uf|\s+estado|\n|$)/i.exec(text)
      if (cidMatch) {
        const c = cidMatch[1].trim()
        if (!isTextoCabecalhoOuInvalido(c)) cidade = c
      }
      const ufMatch = /(?:uf|estado)[:\s]+([A-Z]{2})\b/i.exec(text)
      if (ufMatch) estado = ufMatch[1].trim().toUpperCase()
    }
  }

  // CEP no texto se ainda faltar: "CEP Pernoite: 52061-540" ou "CEP: 52061-540"
  if (!cep) {
    const cepMatch = /(?:cep\s+pernoite|cep)[:\s]+([0-9]{5}-?[0-9]{3})/i.exec(text)
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

  // Isolar seção "INFORMAÇÕES DO CONDUTOR PRINCIPAL" (Allianz) se houver
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

  const antMatch = /(?:ap[oó]lice\s+anterior|n[ºo.]?\s+anterior)[*\s|:]+([0-9.\-/]{4,20})/i.exec(
    text,
  )
  if (antMatch) {
    apoliceAnt = antMatch[1].trim()
  }

  const segAntMatch =
    /(?:seguradora\s+anterior|cia\s+anterior)[*\s|:]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*]?\s*(?:ap[oó]lice|b[oó]nus|fim)|\n|\||$))/i.exec(
      text,
    )
  if (segAntMatch) {
    seguradoraAnt = sanitizarTextoExtraido(segAntMatch[1])
  }

  const bonusMatch =
    /(?:classe\s+de\s+b[oó]nus|classe\s+b[oó]nus|b[oó]nus)[*\s|:]+([0-9]{1,2})/i.exec(text)
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
