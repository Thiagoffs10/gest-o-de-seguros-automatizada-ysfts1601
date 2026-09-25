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

  return {
    formato,
    seguradoraNome,
    numeroProposta,
    numeroApolice: '', // No momento da proposta fica vazia aguardando emissão
    tipoSeguro: 'Auto',
    vigenciaInicio: vigencias.inicio,
    vigenciaFim: vigencias.fim,
    premioLiquido: premios.liquido,
    iof: premios.iof,
    premioTotal: premios.total,
    formaPagamento: parcelamento.forma,
    quantidadeParcelas: parcelamento.parcelas,
    parcelamentoDescricao: parcelamento.descricao,
    segurado,
    condutorPrincipal: condutor,
    veiculo,
    renovacao,
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
    /proposta(?:\s+n[ºo.]|\s+número)?[:\s]+([0-9\-./]{4,20})/i,
    /n[ºo]\s+da\s+proposta[:\s]+([0-9\-./]{4,20})/i,
    /proposta\s+de\s+seguro[:\s]+([0-9\-./]{4,20})/i,
    /c[oó]digo\s+da\s+proposta[:\s]+([0-9\-./]{4,20})/i,
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

  const liqMatch = /pr[êe]mio\s+l[íi]quido(?:\s+total)?[:\s]+R?\$?\s*([0-9.,]+)/i.exec(text)
  if (liqMatch) liquido = parseMoeda(liqMatch[1])

  const iofMatch = /iof[:\s]+R?\$?\s*([0-9.,]+)/i.exec(text)
  if (iofMatch) iof = parseMoeda(iofMatch[1])

  const totMatch =
    /(?:pr[êe]mio\s+total|valor\s+total\s+do\s+seguro)[:\s]+R?\$?\s*([0-9.,]+)/i.exec(text)
  if (totMatch) total = parseMoeda(totMatch[1])

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

function extrairParcelamento(
  text: string,
  formato: SeguradoraPropostaFormato,
): { forma: string; parcelas: number; descricao: string } {
  let forma = 'Boleto'
  let parcelas = 1
  let descricao = ''

  const textLower = text.toLowerCase()
  if (
    textLower.includes('cartão de crédito') ||
    textLower.includes('cartao de credito') ||
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
    // Padrão comum: "10x de R$ ...", "12 parcelas", "Parcelas: 6"
    const parcMatch =
      /(?:parcelas?|parcelamento)[:\s]+(\d{1,2})x?/i.exec(text) ||
      /(\d{1,2})\s*(?:x|vezes)\s+de\s+R?\$?/i.exec(text)
    if (parcMatch) {
      parcelas = parseInt(parcMatch[1], 10)
      descricao = `${parcelas}x`
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
  const placaMatch = /(?:placa[:\s]+)?\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/i.exec(text)
  if (placaMatch) {
    placa = placaMatch[1].replace(/[-\s]/g, '').toUpperCase()
  }

  // Chassi: 17 caracteres alfanuméricos (excluindo I, O, Q)
  const chassiMatch = /(?:chassi[:\s]+)?\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(text)
  if (chassiMatch) {
    chassi = chassiMatch[1].toUpperCase()
  }

  // FIPE: 000000-0 ou 6-7 dígitos
  const fipeMatch = /(?:fipe|c[oó]digo\s+fipe)[:\s]+([0-9]{6,7}-?[0-9]?)/i.exec(text)
  if (fipeMatch) {
    codigoFipe = fipeMatch[1].trim()
  }

  // Ano Fabricação / Modelo (ex: 2023/2024 ou 2024/2024)
  const anoMatch =
    /(?:ano(?:\s+fab(?:\.|\/mod)?)?[:\s]+)?\b(19\d{2}|20\d{2})\s*\/\s*(19\d{2}|20\d{2})\b/i.exec(
      text,
    )
  if (anoMatch) {
    anoFab = parseInt(anoMatch[1], 10)
    anoMod = parseInt(anoMatch[2], 10)
  }

  // Marca / Modelo: geralmente próximo a "Veículo:", "Modelo:", "Descrição do veículo"
  const modMatch =
    /(?:ve[íi]culo|modelo|marca\/modelo)[:\s]+([A-Za-z0-9\s.\-/+]+?)(?:\s+ano|\s+placa|\s+chassi|\s+fipe|\n|$)/i.exec(
      text,
    )
  if (modMatch) {
    const rawMod = modMatch[1].trim()
    if (rawMod.length > 3 && rawMod.length < 60) {
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

  // CPF / CNPJ do segurado
  const cpfMatch = /(?:cpf|cnpj|documento)[:\s]+([0-9.\-/]{11,18})/i.exec(text)
  if (cpfMatch) {
    const numLimpo = cpfMatch[1].replace(/\D/g, '')
    if (numLimpo.length === 11) {
      cpfCnpj = numLimpo
      tipoPessoa = 'PF'
    } else if (numLimpo.length === 14) {
      cpfCnpj = numLimpo
      tipoPessoa = 'PJ'
    }
  }

  // Nome do Segurado: após "Segurado:", "Nome do Segurado:", "Nome / Razão Social:"
  const nomeMatch =
    /(?:nome\s+do\s+segurado|segurado(?:\s*\(a\))?|proponente)[:\s]+([A-Za-zÀ-ÿ\s.-]+?)(?:\s+cpf|\s+cnpj|\s+nasc|\s+data|\s+endere[çc]o|\n|$)/i.exec(
      text,
    )
  if (nomeMatch) {
    const n = nomeMatch[1].trim()
    if (n.length > 3 && n.length < 80) nome = n
  }

  // Data de nascimento (Allianz NÃO traz)
  if (formato !== 'ALLIANZ') {
    const nascMatch =
      /(?:data\s+de\s+nascimento|nascimento|nasc\.?)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    if (nascMatch) {
      dataNasc = parseDataFlexivel(nascMatch[1])
    }
  }

  // E-mail
  const emailMatch = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/.exec(text)
  if (emailMatch && !emailMatch[1].includes('seguradora') && !emailMatch[1].includes('corretor')) {
    email = emailMatch[1].trim()
  }

  // Telefone / Celular
  const telMatch =
    /(?:telefone|celular|tel|fone)[:\s]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i.exec(text)
  if (telMatch) {
    telefone = telMatch[1].trim()
  }

  // CEP
  const cepMatch = /cep[:\s]+([0-9]{5}-?[0-9]{3})/i.exec(text)
  if (cepMatch) {
    cep = cepMatch[1].trim()
  }

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

  // Procurar por bloco "Condutor Principal", "Principal Condutor", "Condutor habitual"
  const condMatch =
    /(?:condutor\s+principal|principal\s+condutor|condutor\s+habitual|perfil\s+do\s+condutor)[:\s]+([A-Za-zÀ-ÿ\s.-]+?)(?:\s+cpf|\s+nasc|\s+parentesco|\s+sexo|\n|$)/i.exec(
      text,
    )

  if (condMatch) {
    const cNome = condMatch[1].trim()
    if (cNome.length > 3 && cNome.length < 80) {
      nomeCondutor = cNome
    }
  }

  // CPF do condutor
  const cpfCondMatch = /condutor.*?cpf[:\s]+([0-9.\-/]{11,14})/i.exec(text)
  if (cpfCondMatch) {
    cpfCondutor = cpfCondMatch[1].replace(/\D/g, '')
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

  const antMatch = /(?:ap[oó]lice\s+anterior|n[ºo]\s+anterior)[:\s]+([0-9.\-/]{4,20})/i.exec(text)
  if (antMatch) {
    apoliceAnt = antMatch[1].trim()
  }

  const segAntMatch =
    /(?:seguradora\s+anterior|cia\s+anterior)[:\s]+([A-Za-zÀ-ÿ\s.-]+?)(?:\s+ap[oó]lice|\s+b[oó]nus|\n|$)/i.exec(
      text,
    )
  if (segAntMatch) {
    seguradoraAnt = segAntMatch[1].trim()
  }

  const bonusMatch = /(?:classe\s+de\s+b[oó]nus|b[oó]nus)[:\s]+([0-9]{1,2})/i.exec(text)
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
