/**
 * Parsers Determinísticos dos 6 Formatos de Extrato de Comissão de Seguradoras.
 *
 * 1. SUSEP Detalhado ("comissao-paga-detalhada-fc670.xlsx")
 * 2. Porto Seguro ("porto-939e3.xlsx")
 * 3. Bradesco ("bra1-b6364.xlsx")
 * 4. Tokio Marine ("comissao_mensal_09_2026-ff0de.xlsx")
 * 5. MAPFRE MSG CommissionPayments ("c500099665comissao1790184608797-9cbc0.xlsx")
 * 6. Demonstrativo Sintético Consolidado ("ExtratoComissoes_Consolidado_25092026121419-cc378.xlsx")
 *
 * REGRA DE OURO:
 * Baixa considera SOMENTE PAGAMENTOS REALIZADOS (Data de Crédito + Líquido > 0).
 * Linhas informativas (R$ 0,00, "COM.PG", "SALDO DEMONSTRATIVO ANTERIOR") são ignoradas para baixa.
 */

import {
  ExtratoLinhaCanonica,
  ExtratoParseResult,
  SeguradoraFormato,
  normalizarIdentificador,
  parseDataFlexivel,
  parseMoeda,
} from './extrato-types'

/**
 * Detecta o formato do extrato a partir das linhas e cabeçalhos
 */
export function detectarFormatoExtrato(rows: string[][], nomeArquivo: string): SeguradoraFormato {
  const nomeLower = (nomeArquivo || '').toLowerCase()
  const fullText = rows
    .slice(0, 15)
    .map((r) => r.join(' ').toLowerCase())
    .join(' ')

  if (
    nomeLower.includes('consolidado') ||
    fullText.includes('demonstrativo de pagamento') ||
    (fullText.includes('total de comissoes') &&
      fullText.includes('total liquido a pagar') &&
      !fullText.includes('apolice'))
  ) {
    return 'SINTETICO_CONSOLIDADO'
  }

  if (
    nomeLower.includes('porto') ||
    fullText.includes('porto seguro') ||
    fullText.includes('ordem de pagamento') ||
    fullText.includes('taxa de comissao')
  ) {
    return 'PORTO_SEGURO'
  }

  if (
    nomeLower.includes('bra') ||
    fullText.includes('bradesco') ||
    fullText.includes('subfatura') ||
    fullText.includes('saldo demonstrativo anterior') ||
    fullText.includes('com.pg')
  ) {
    return 'BRADESCO'
  }

  if (
    nomeLower.includes('tokio') ||
    fullText.includes('tokio marine') ||
    (fullText.includes('extrato') && fullText.includes('documento') && fullText.includes('cliente'))
  ) {
    return 'TOKIO_MARINE'
  }

  if (
    nomeLower.includes('mapfre') ||
    nomeLower.includes('commissionpayments') ||
    fullText.includes('mapfre') ||
    fullText.includes('data baixa') ||
    fullText.includes('data credito')
  ) {
    return 'MAPFRE'
  }

  if (
    nomeLower.includes('detalhad') ||
    fullText.includes('comissao antecipada') ||
    (fullText.includes('endosso') &&
      fullText.includes('recibo') &&
      fullText.includes('premio liquido'))
  ) {
    return 'SUSEP_DETALHADO'
  }

  return 'GENERICO_CSV'
}

/**
 * Parser unificado principal
 */
export function parseExtratoSeguradora(
  rows: string[][],
  nomeArquivo: string = '',
): ExtratoParseResult {
  const formato = detectarFormatoExtrato(rows, nomeArquivo)

  switch (formato) {
    case 'PORTO_SEGURO':
      return parsePortoSeguro(rows)
    case 'BRADESCO':
      return parseBradesco(rows)
    case 'TOKIO_MARINE':
      return parseTokioMarine(rows)
    case 'MAPFRE':
      return parseMapfre(rows)
    case 'SUSEP_DETALHADO':
      return parseSusepDetalhado(rows)
    case 'SINTETICO_CONSOLIDADO':
      return parseSinteticoConsolidado(rows)
    default:
      return parseGenerico(rows)
  }
}

// =========================================================================
// 1. PORTO SEGURO (Cabeçalho c/ OP/Data, linhas por Apl/Proposta, rodapé c/ totais)
// =========================================================================
function parsePortoSeguro(rows: string[][]): ExtratoParseResult {
  const validas: ExtratoLinhaCanonica[] = []
  const informativas: ExtratoLinhaCanonica[] = []
  const avisos: string[] = []

  let ordemPagamento = ''
  let dataPagamentoCabecalho = ''
  let totalBrutoEsperado = 0
  let totalLiquidoEsperado = 0
  let totalImpostosEsperado = 0

  // 1. Varrer cabeçalho e rodapé de totais
  for (const row of rows) {
    const rowStr = row.join(' ').toLowerCase()
    if (rowStr.includes('ordem de pagamento')) {
      const matchOp = /ordem de pagamento[:\s]+([A-Za-z0-9\-.]+)/i.exec(rowStr)
      if (matchOp) ordemPagamento = matchOp[1].trim()
    }
    if (
      rowStr.includes('data pagamento') ||
      rowStr.includes('data do pagamento') ||
      rowStr.includes('data credito')
    ) {
      for (const cell of row) {
        const d = parseDataFlexivel(cell)
        if (d && !dataPagamentoCabecalho) dataPagamentoCabecalho = d
      }
    }
    if (rowStr.includes('total liquido a pagar') || rowStr.includes('liquido a pagar')) {
      const nums = row.map(parseMoeda).filter((n) => n > 0)
      if (nums.length > 0) totalLiquidoEsperado = nums[nums.length - 1]
    }
    if (rowStr.includes('total bruto')) {
      const nums = row.map(parseMoeda).filter((n) => n > 0)
      if (nums.length > 0) totalBrutoEsperado = nums[nums.length - 1]
    }
  }

  // Achar índice do cabeçalho de colunas (Apl/Proposta, Parcela, Prêmio, Comissão etc.)
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const rowStr = rows[i].join(' ').toLowerCase()
    if (
      (rowStr.includes('proposta') || rowStr.includes('apolice') || rowStr.includes('apl')) &&
      (rowStr.includes('premio') || rowStr.includes('comissao'))
    ) {
      headerIdx = i
      break
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    const rowStr = row.join(' ').toLowerCase()
    if (
      rowStr.includes('total') ||
      rowStr.includes('subtotal') ||
      rowStr.includes('iss') ||
      rowStr.includes('irrf')
    ) {
      continue
    }

    // Porto geralmente traz: Proposta/Apólice | Parcela | Data Mov | Prêmio | Taxa | Comissão Bruta | Impostos | Líquido
    // Tentar localizar números de documento e valores
    let numDoc = ''
    let parcela = 1
    let dataCredito = dataPagamentoCabecalho
    let premio = 0
    let taxa = 0
    let bruto = 0
    let liquido = 0
    let segurado = ''

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim()
      if (!cell) continue

      // Data de movimento/crédito
      const maybeData = parseDataFlexivel(cell)
      if (maybeData && !dataCredito) {
        dataCredito = maybeData
      }

      // Parcela (ex: "1/4" ou número 1..24)
      if (/^\d{1,2}\/\d{1,2}$/.test(cell)) {
        parcela = parseInt(cell.split('/')[0], 10)
      } else if (/^\d{1,2}$/.test(cell) && parseInt(cell, 10) <= 36 && parcela === 1 && c <= 4) {
        parcela = parseInt(cell, 10)
      }

      // Proposta ou Apólice (geralmente sequência numérica com 6+ dígitos)
      if (/^\d{6,16}$/.test(cell.replace(/\D/g, '')) && !numDoc) {
        numDoc = normalizarIdentificador(cell)
      }

      // Nome do segurado (texto alfanumérico longo sem números principais)
      if (
        !segurado &&
        cell.length > 5 &&
        /^[A-Za-zÀ-ÿ\s.\-]+$/.test(cell) &&
        !cell.toLowerCase().includes('auto') &&
        !cell.toLowerCase().includes('porto')
      ) {
        segurado = cell
      }
    }

    // Capturar valores numéricos monetários da linha
    const moedas: number[] = []
    for (const cell of row) {
      const m = parseMoeda(cell)
      if (m > 0 || (typeof cell === 'string' && cell.includes(',') && m !== 0)) {
        moedas.push(m)
      }
    }

    if (moedas.length >= 2) {
      // Normalmente o maior valor é o prêmio líquido, seguido de comissão bruta e líquido
      premio = moedas[0]
      bruto = moedas.length >= 3 ? moedas[moedas.length - 2] : moedas[1]
      liquido = moedas[moedas.length - 1]
    } else if (moedas.length === 1) {
      bruto = moedas[0]
      liquido = moedas[0]
    }

    if (!numDoc && !bruto) continue

    const linhaCanonica: ExtratoLinhaCanonica = {
      id: `porto_${numDoc}_${parcela}_${bruto}_${i}`,
      seguradoraNome: 'Porto Seguro',
      numeroExtrato: ordemPagamento || 'PORTO-EXT',
      tipoReferencia: 'PROPOSTA', // Porto frequentemente traz a proposta e amarra depois
      numeroApolice: '',
      numeroProposta: numDoc,
      endosso: '0',
      parcela: parcela || 1,
      dataCredito: dataCredito || new Date().toISOString().split('T')[0],
      premioLiquido: premio,
      comissaoBruta: bruto,
      impostos: Math.max(0, Math.round((bruto - liquido) * 100) / 100),
      liquidoPago: liquido || bruto,
      percentualComissao:
        taxa || (premio > 0 ? Math.round((bruto / premio) * 100 * 100) / 100 : undefined),
      seguradoNome: segurado,
      isLinhaInformativa: false,
    }

    // REGRA DE OURO: Somente pagamentos com Data de Crédito + Líquido > 0
    if (linhaCanonica.liquidoPago <= 0 || !linhaCanonica.dataCredito) {
      linhaCanonica.isLinhaInformativa = true
      linhaCanonica.motivoInformativo = 'Líquido zero ou sem data de crédito'
      informativas.push(linhaCanonica)
    } else {
      validas.push(linhaCanonica)
    }
  }

  return {
    formato: 'PORTO_SEGURO',
    seguradoraNomeSugerida: 'Porto Seguro',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: validas,
    linhasInformativasIgnoradas: informativas,
    checksumEsperado: {
      totalBruto: totalBrutoEsperado || undefined,
      totalLiquido: totalLiquidoEsperado || undefined,
      totalImpostos: totalImpostosEsperado || undefined,
      ordemPagamento,
      dataPagamento: dataPagamentoCabecalho,
    },
    avisos,
  }
}

// =========================================================================
// 2. BRADESCO (Fatura/lote bancário: proposta + apólice/subfatura + endosso + segurado + parcela)
// Contém linhas informativas R$0,00/"COM.PG", "SALDO DEMONSTRATIVO ANTERIOR" e ramos múltiplos
// =========================================================================
function parseBradesco(rows: string[][]): ExtratoParseResult {
  const validas: ExtratoLinhaCanonica[] = []
  const informativas: ExtratoLinhaCanonica[] = []
  const avisos: string[] = []

  let numeroLoteFatura = ''
  let dataCreditoGeral = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    const rowStr = row.join(' ').toUpperCase()

    // Metadados do lote/fatura
    if (
      rowStr.includes('FATURA') ||
      rowStr.includes('LANCAMENTO') ||
      rowStr.includes('LANÇAMENTO')
    ) {
      const match = /(?:FATURA|LOTE)[:\s]+([0-9\-.\/]+)/i.exec(rowStr)
      if (match) numeroLoteFatura = match[1].trim()
    }
    for (const cell of row) {
      const d = parseDataFlexivel(cell)
      if (d && !dataCreditoGeral) dataCreditoGeral = d
    }

    // Regra de ouro: "SALDO DEMONSTRATIVO ANTERIOR" -> linha puramente informativa, NUNCA baixa
    if (rowStr.includes('SALDO DEMONSTRATIVO ANTERIOR') || rowStr.includes('SALDO ANTERIOR')) {
      informativas.push({
        id: `bra_info_saldo_${i}`,
        seguradoraNome: 'Bradesco Seguros',
        numeroExtrato: numeroLoteFatura,
        tipoReferencia: 'PROPOSTA',
        numeroApolice: '',
        numeroProposta: '',
        endosso: '',
        parcela: 0,
        dataCredito: dataCreditoGeral,
        premioLiquido: 0,
        comissaoBruta: 0,
        impostos: 0,
        liquidoPago: 0,
        isLinhaInformativa: true,
        motivoInformativo: 'SALDO DEMONSTRATIVO ANTERIOR (informativo)',
      })
      continue
    }

    // Proposta + Apólice + Endosso (00000 = sem endosso)
    // Bradesco traz linhas com "COM.PG" quando comissão já foi paga ou informativa de R$0,00
    const isComPg = rowStr.includes('COM.PG') || rowStr.includes('COMISSAO PAGA')

    // Extrair campos da linha
    let proposta = ''
    let apolice = ''
    let endosso = '00000'
    let parcela = 1
    let segurado = ''
    let ramo = ''
    let premio = 0
    let bruto = 0
    let liquido = 0
    let percentual = 0

    // Procurar identificadores numéricos
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim()
      if (!cell) continue

      // Proposta (geralmente 9 a 11 dígitos)
      if (/^\d{8,12}$/.test(cell.replace(/\D/g, ''))) {
        if (!proposta) proposta = normalizarIdentificador(cell)
        else if (!apolice) apolice = normalizarIdentificador(cell)
      }

      // Endosso
      if (/^\d{5}$/.test(cell) && (cell === '00000' || parseInt(cell, 10) > 0)) {
        endosso = cell
      }

      // Parcela
      if (/^(\d{1,2})\/(\d{1,2})$/.test(cell)) {
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec(cell)
        if (m) parcela = parseInt(m[1], 10)
      }

      // Segurado
      if (
        !segurado &&
        cell.length > 6 &&
        /^[A-Za-zÀ-ÿ\s.\-]+$/.test(cell) &&
        !cell.toUpperCase().includes('BRADESCO') &&
        !cell.toUpperCase().includes('FATURA')
      ) {
        segurado = cell
      }
    }

    // Extrair valores monetários
    const moedas: number[] = []
    for (const cell of row) {
      const m = parseMoeda(cell)
      if (m > 0) moedas.push(m)
    }

    if (moedas.length >= 2) {
      premio = moedas[0]
      bruto = moedas.length >= 3 ? moedas[moedas.length - 2] : moedas[1]
      liquido = moedas[moedas.length - 1]
    } else if (moedas.length === 1) {
      bruto = moedas[0]
      liquido = moedas[0]
    }

    if (!proposta && !apolice && bruto === 0) continue

    const linhaCanonica: ExtratoLinhaCanonica = {
      id: `bra_${proposta || apolice}_${endosso}_${parcela}_${bruto}_${i}`,
      seguradoraNome: 'Bradesco Seguros',
      numeroExtrato: numeroLoteFatura || 'BRADESCO-LOT',
      tipoReferencia: proposta && apolice ? 'AMBOS' : apolice ? 'APOLICE' : 'PROPOSTA',
      numeroApolice: apolice,
      numeroProposta: proposta,
      endosso: endosso === '00000' ? '0' : endosso,
      parcela: parcela || 1,
      dataCredito: dataCreditoGeral || new Date().toISOString().split('T')[0],
      premioLiquido: premio,
      comissaoBruta: bruto,
      impostos: Math.max(0, Math.round((bruto - liquido) * 100) / 100),
      liquidoPago: liquido || bruto,
      percentualComissao: percentual || undefined,
      seguradoNome: segurado,
      ramo,
      isLinhaInformativa: false,
    }

    // REGRA DE OURO: Linha informativa com R$0,00 ou COM.PG não entra para baixa
    if (linhaCanonica.liquidoPago <= 0 || isComPg) {
      linhaCanonica.isLinhaInformativa = true
      linhaCanonica.motivoInformativo = isComPg
        ? 'COM.PG (informativo de comissão já processada/paga)'
        : 'Valor líquido zerado'
      informativas.push(linhaCanonica)
    } else {
      validas.push(linhaCanonica)
    }
  }

  return {
    formato: 'BRADESCO',
    seguradoraNomeSugerida: 'Bradesco Seguros',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: validas,
    linhasInformativasIgnoradas: informativas,
    avisos,
  }
}

// =========================================================================
// 3. TOKIO MARINE (Extrato | Data | Documento com apólice+parcela "…439.000000 - 1/10" | Cliente | Prêmio | % | Valor)
// =========================================================================
function parseTokioMarine(rows: string[][]): ExtratoParseResult {
  const validas: ExtratoLinhaCanonica[] = []
  const informativas: ExtratoLinhaCanonica[] = []
  const avisos: string[] = []

  let extratoNum = ''
  let headerIdx = -1

  for (let i = 0; i < rows.length; i++) {
    const rowStr = rows[i].join(' ').toLowerCase()
    if (
      rowStr.includes('documento') &&
      (rowStr.includes('cliente') || rowStr.includes('premio') || rowStr.includes('valor'))
    ) {
      headerIdx = i
      break
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    const rowStr = row.join(' ').toLowerCase()
    if (rowStr.includes('total') || rowStr.includes('subtotal')) continue

    // Extrair documento composto: "0554.439.000000 - 1/10"
    let apolice = ''
    let parcela = 1
    let cliente = ''
    let dataCredito = ''
    let premio = 0
    let percentual = 0
    let valor = 0

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim()
      if (!cell) continue

      // Documento Tokio Marine
      if (cell.includes('-') && /\d+.*\d+\/\d+/.test(cell)) {
        const parts = cell.split('-')
        apolice = normalizarIdentificador(parts[0])
        const parcPart = parts[1] ? parts[1].trim() : '1/1'
        const parcMatch = /^(\d{1,2})\/(\d{1,2})/.exec(parcPart)
        if (parcMatch) {
          parcela = parseInt(parcMatch[1], 10)
        }
      } else if (!apolice && /^\d{6,14}(\.\d+)?$/.test(cell.replace(/\D/g, ''))) {
        apolice = normalizarIdentificador(cell)
      }

      // Data
      const maybeData = parseDataFlexivel(cell)
      if (maybeData && !dataCredito) {
        dataCredito = maybeData
      }

      // Cliente
      if (
        !cliente &&
        cell.length > 5 &&
        /^[A-Za-zÀ-ÿ\s.\-]+$/.test(cell) &&
        !cell.toLowerCase().includes('tokio')
      ) {
        cliente = cell
      }
    }

    // Moedas
    const moedas: number[] = []
    for (const cell of row) {
      const m = parseMoeda(cell)
      if (m > 0) moedas.push(m)
    }

    if (moedas.length >= 2) {
      premio = moedas[0]
      valor = moedas[moedas.length - 1]
    } else if (moedas.length === 1) {
      valor = moedas[0]
    }

    if (!apolice && valor === 0) continue

    const linhaCanonica: ExtratoLinhaCanonica = {
      id: `tokio_${apolice}_${parcela}_${valor}_${i}`,
      seguradoraNome: 'Tokio Marine',
      numeroExtrato: extratoNum || 'TOKIO-EXT',
      tipoReferencia: 'APOLICE',
      numeroApolice: apolice,
      numeroProposta: '',
      endosso: '0',
      parcela: parcela || 1,
      dataCredito: dataCredito || new Date().toISOString().split('T')[0],
      premioLiquido: premio,
      comissaoBruta: valor,
      impostos: 0, // Tokio normalmente traz valor líquido direto na comissão
      liquidoPago: valor,
      percentualComissao:
        percentual || (premio > 0 ? Math.round((valor / premio) * 100 * 100) / 100 : undefined),
      seguradoNome: cliente,
      isLinhaInformativa: false,
    }

    if (linhaCanonica.liquidoPago <= 0 || !linhaCanonica.dataCredito) {
      linhaCanonica.isLinhaInformativa = true
      linhaCanonica.motivoInformativo = 'Líquido zero ou sem data de crédito'
      informativas.push(linhaCanonica)
    } else {
      validas.push(linhaCanonica)
    }
  }

  return {
    formato: 'TOKIO_MARINE',
    seguradoraNomeSugerida: 'Tokio Marine',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: validas,
    linhasInformativasIgnoradas: informativas,
    avisos,
  }
}

// =========================================================================
// 4. MAPFRE (CommissionPayments: extrato, apólice, endosso, parcela, Data Baixa, Data Credito, débitos/impostos por linha)
// =========================================================================
function parseMapfre(rows: string[][]): ExtratoParseResult {
  const validas: ExtratoLinhaCanonica[] = []
  const informativas: ExtratoLinhaCanonica[] = []
  const avisos: string[] = []

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const rowStr = rows[i].join(' ').toLowerCase()
    if (
      rowStr.includes('apolice') &&
      (rowStr.includes('data credito') ||
        rowStr.includes('data baixa') ||
        rowStr.includes('comissao'))
    ) {
      headerIdx = i
      break
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    const rowStr = row.join(' ').toLowerCase()
    if (rowStr.includes('total') || rowStr.includes('subtotal')) continue

    let apolice = ''
    let endosso = '0'
    let parcela = 1
    let dataCredito = ''
    let premio = 0
    let bruto = 0
    let liquido = 0
    let impostos = 0
    let segurado = ''

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim()
      if (!cell) continue

      // Apólice Mapfre (geralmente 10-15 dígitos)
      if (/^\d{8,16}$/.test(cell.replace(/\D/g, '')) && !apolice) {
        apolice = normalizarIdentificador(cell)
      }

      // Data de crédito
      const d = parseDataFlexivel(cell)
      if (d && !dataCredito) {
        dataCredito = d
      }

      // Parcela
      if (/^\d{1,2}$/.test(cell) && parseInt(cell, 10) <= 24 && parcela === 1 && c >= 3 && c <= 8) {
        parcela = parseInt(cell, 10)
      }

      // Segurado
      if (
        !segurado &&
        cell.length > 6 &&
        /^[A-Za-zÀ-ÿ\s.\-]+$/.test(cell) &&
        !cell.toLowerCase().includes('mapfre')
      ) {
        segurado = cell
      }
    }

    // Moedas
    const moedas: number[] = []
    for (const cell of row) {
      const m = parseMoeda(cell)
      if (m > 0 || (typeof cell === 'string' && cell.includes(',') && m !== 0)) {
        moedas.push(m)
      }
    }

    if (moedas.length >= 3) {
      premio = moedas[0]
      bruto = moedas[moedas.length - 2]
      liquido = moedas[moedas.length - 1]
      impostos = Math.max(0, Math.round((bruto - liquido) * 100) / 100)
    } else if (moedas.length >= 2) {
      premio = moedas[0]
      bruto = moedas[1]
      liquido = moedas[1]
    } else if (moedas.length === 1) {
      bruto = moedas[0]
      liquido = moedas[0]
    }

    if (!apolice && bruto === 0) continue

    const linhaCanonica: ExtratoLinhaCanonica = {
      id: `mapfre_${apolice}_${endosso}_${parcela}_${bruto}_${i}`,
      seguradoraNome: 'Mapfre',
      numeroExtrato: 'MAPFRE-MSG',
      tipoReferencia: 'APOLICE',
      numeroApolice: apolice,
      numeroProposta: '',
      endosso,
      parcela: parcela || 1,
      dataCredito: dataCredito || new Date().toISOString().split('T')[0],
      premioLiquido: premio,
      comissaoBruta: bruto,
      impostos,
      liquidoPago: liquido || bruto,
      seguradoNome: segurado,
      isLinhaInformativa: false,
    }

    if (linhaCanonica.liquidoPago <= 0 || !linhaCanonica.dataCredito) {
      linhaCanonica.isLinhaInformativa = true
      linhaCanonica.motivoInformativo = 'Líquido zero ou sem data de crédito'
      informativas.push(linhaCanonica)
    } else {
      validas.push(linhaCanonica)
    }
  }

  return {
    formato: 'MAPFRE',
    seguradoraNomeSugerida: 'Mapfre',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: validas,
    linhasInformativasIgnoradas: informativas,
    avisos,
  }
}

// =========================================================================
// 5. SUSEP DETALHADO (apólice, endosso, recibo, parcela n/m, data movimento, prêmio líquido, comissão, % comissão, flag antecipada)
// =========================================================================
function parseSusepDetalhado(rows: string[][]): ExtratoParseResult {
  const validas: ExtratoLinhaCanonica[] = []
  const informativas: ExtratoLinhaCanonica[] = []
  const avisos: string[] = []

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const rowStr = rows[i].join(' ').toLowerCase()
    if (
      (rowStr.includes('apolice') || rowStr.includes('recibo')) &&
      (rowStr.includes('comissao') || rowStr.includes('premio'))
    ) {
      headerIdx = i
      break
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    const rowStr = row.join(' ').toLowerCase()
    if (rowStr.includes('total') || rowStr.includes('subtotal')) continue

    let apolice = ''
    let endosso = '0'
    let parcela = 1
    let dataCredito = ''
    let premio = 0
    let bruto = 0
    let liquido = 0
    let percentual = 0
    let isAntecipada = rowStr.includes('antecipad') || rowStr.includes('com.ant')

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim()
      if (!cell) continue

      if (/^\d{8,18}$/.test(cell.replace(/\D/g, '')) && !apolice) {
        apolice = normalizarIdentificador(cell)
      }

      // Parcela n/m
      if (/^(\d{1,2})\/(\d{1,2})$/.test(cell)) {
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec(cell)
        if (m) parcela = parseInt(m[1], 10)
      }

      const d = parseDataFlexivel(cell)
      if (d && !dataCredito) dataCredito = d
    }

    const moedas: number[] = []
    for (const cell of row) {
      const m = parseMoeda(cell)
      if (m > 0) moedas.push(m)
    }

    if (moedas.length >= 2) {
      premio = moedas[0]
      bruto = moedas[moedas.length - 1]
      liquido = bruto
    } else if (moedas.length === 1) {
      bruto = moedas[0]
      liquido = moedas[0]
    }

    if (!apolice && bruto === 0) continue

    const linhaCanonica: ExtratoLinhaCanonica = {
      id: `susep_${apolice}_${endosso}_${parcela}_${bruto}_${i}`,
      seguradoraNome: 'SUSEP Detalhado',
      numeroExtrato: 'SUSEP-DET',
      tipoReferencia: 'APOLICE',
      numeroApolice: apolice,
      numeroProposta: '',
      endosso,
      parcela: parcela || 1,
      dataCredito: dataCredito || new Date().toISOString().split('T')[0],
      premioLiquido: premio,
      comissaoBruta: bruto,
      impostos: 0,
      liquidoPago: liquido || bruto,
      percentualComissao: percentual || undefined,
      isComissaoAntecipada: isAntecipada,
      isLinhaInformativa: false,
    }

    if (linhaCanonica.liquidoPago <= 0 || !linhaCanonica.dataCredito) {
      linhaCanonica.isLinhaInformativa = true
      linhaCanonica.motivoInformativo = 'Líquido zero ou sem data de crédito'
      informativas.push(linhaCanonica)
    } else {
      validas.push(linhaCanonica)
    }
  }

  return {
    formato: 'SUSEP_DETALHADO',
    seguradoraNomeSugerida: 'SUSEP Detalhado',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: validas,
    linhasInformativasIgnoradas: informativas,
    avisos,
  }
}

// =========================================================================
// 6. DEMONSTRATIVO SINTÉTICO MENSAL (usado apenas como CHECKSUM mensal, não como fonte analítica de baixa)
// =========================================================================
function parseSinteticoConsolidado(rows: string[][]): ExtratoParseResult {
  let totalBruto = 0
  let totalImpostos = 0
  let totalLiquido = 0
  let dataPagamento = ''

  for (const row of rows) {
    const rowStr = row.join(' ').toLowerCase()
    for (const cell of row) {
      const d = parseDataFlexivel(cell)
      if (d && !dataPagamento) dataPagamento = d
    }

    if (rowStr.includes('bruto') || rowStr.includes('total comissao')) {
      const m = row.map(parseMoeda).filter((n) => n > 0)
      if (m.length > 0 && !totalBruto) totalBruto = m[m.length - 1]
    }
    if (
      rowStr.includes('irrf') ||
      rowStr.includes('imposto') ||
      rowStr.includes('inss') ||
      rowStr.includes('descontos')
    ) {
      const m = row.map(parseMoeda).filter((n) => n > 0)
      if (m.length > 0 && !totalImpostos) totalImpostos = m[m.length - 1]
    }
    if (
      rowStr.includes('liquido') ||
      rowStr.includes('total a pagar') ||
      rowStr.includes('valor pago')
    ) {
      const m = row.map(parseMoeda).filter((n) => n > 0)
      if (m.length > 0) totalLiquido = m[m.length - 1]
    }
  }

  return {
    formato: 'SINTETICO_CONSOLIDADO',
    seguradoraNomeSugerida: 'Consolidado Sintético',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: [], // Não baixa linhas diretamente
    linhasInformativasIgnoradas: [],
    checksumEsperado: {
      totalBruto: totalBruto || undefined,
      totalImpostos: totalImpostos || undefined,
      totalLiquido: totalLiquido || undefined,
      dataPagamento: dataPagamento || undefined,
    },
    avisos: [
      'Arquivo identificado como demonstrativo SINTÉTICO mensal. Usado como CHECKSUM de validação do mês, e não como fonte analítica direta de baixa.',
    ],
  }
}

// =========================================================================
// 7. GENÉRICO CSV / FALLBACK
// =========================================================================
function parseGenerico(rows: string[][]): ExtratoParseResult {
  const validas: ExtratoLinhaCanonica[] = []
  const informativas: ExtratoLinhaCanonica[] = []

  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowStr = rows[i].join(' ').toLowerCase()
    if (rowStr.includes('apolice') || rowStr.includes('proposta') || rowStr.includes('comissao')) {
      headerIdx = i
      break
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    let apolice = ''
    let data = ''
    let parcela = 1

    for (const cell of row) {
      if (/^\d{6,18}$/.test(cell.replace(/\D/g, '')) && !apolice) {
        apolice = normalizarIdentificador(cell)
      }
      const d = parseDataFlexivel(cell)
      if (d && !data) data = d
    }

    const moedas = row.map(parseMoeda).filter((n) => n > 0)
    const valor = moedas.length > 0 ? moedas[moedas.length - 1] : 0

    if (!apolice && valor === 0) continue

    const linhaCanonica: ExtratoLinhaCanonica = {
      id: `gen_${apolice}_${valor}_${i}`,
      seguradoraNome: 'Seguradora',
      numeroExtrato: 'GEN-EXT',
      tipoReferencia: 'APOLICE',
      numeroApolice: apolice,
      numeroProposta: '',
      endosso: '0',
      parcela,
      dataCredito: data || new Date().toISOString().split('T')[0],
      premioLiquido: moedas.length >= 2 ? moedas[0] : 0,
      comissaoBruta: valor,
      impostos: 0,
      liquidoPago: valor,
      isLinhaInformativa: valor <= 0 || !data,
      motivoInformativo: valor <= 0 ? 'Valor zerado' : undefined,
    }

    if (linhaCanonica.isLinhaInformativa) informativas.push(linhaCanonica)
    else validas.push(linhaCanonica)
  }

  return {
    formato: 'GENERICO_CSV',
    seguradoraNomeSugerida: 'Genérica',
    totalLinhasArquivo: rows.length,
    linhasValidasParaBaixa: validas,
    linhasInformativasIgnoradas: informativas,
    avisos: ['Extrato processado com parser genérico.'],
  }
}
