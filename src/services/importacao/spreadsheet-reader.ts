/**
 * Leitor determinístico e utilitário de planilhas XLSX e CSV sem dependências pesadas.
 * Descompacta o arquivo ZIP nativamente (via DecompressionStream do navegador/Node)
 * e faz parse do XML das planilhas (sharedStrings.xml + sheet1.xml).
 */

export interface SheetRow {
  [colIndex: number]: string
}

export interface ParsedSpreadsheet {
  sheetName: string
  rows: string[][]
}

/**
 * Lê um arquivo XLSX (ArrayBuffer) e retorna as linhas como matriz de strings
 */
export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedSpreadsheet> {
  const bytes = new Uint8Array(buffer)
  const files = await unzipEntries(bytes)

  const sharedStringsXml = files['xl/sharedstrings.xml'] || files['xl/sharedStrings.xml'] || ''
  const sharedStrings = parseSharedStrings(sharedStringsXml)

  // Acha a primeira planilha (geralmente sheet1.xml)
  let sheetXml = files['xl/worksheets/sheet1.xml'] || ''
  if (!sheetXml) {
    const sheetKey = Object.keys(files).find(
      (k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'),
    )
    if (sheetKey) sheetXml = files[sheetKey]
  }

  if (!sheetXml) {
    throw new Error('Nenhuma planilha válida encontrada no arquivo XLSX.')
  }

  const rows = parseSheetRows(sheetXml, sharedStrings)
  return {
    sheetName: 'Planilha1',
    rows,
  }
}

/**
 * Faz parse de CSV simples ou delimitado por ponto-e-vírgula / vírgula / tabulação
 */
export function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r?\n/)
  const result: string[][] = []

  // Detectar delimitador provável (; ou , ou \t)
  const firstLine = lines.find((l) => l.trim().length > 0) || ''
  const countSemi = (firstLine.match(/;/g) || []).length
  const countComma = (firstLine.match(/,/g) || []).length
  const countTab = (firstLine.match(/\t/g) || []).length

  let delimiter = ';'
  if (countComma > countSemi && countComma > countTab) delimiter = ','
  else if (countTab > countSemi && countTab > countComma) delimiter = '\t'

  for (const line of lines) {
    if (!line.trim()) continue
    const row: string[] = []
    let inQuotes = false
    let currentToken = ''

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentToken += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(currentToken.trim())
        currentToken = ''
      } else {
        currentToken += char
      }
    }
    row.push(currentToken.trim())
    result.push(row)
  }

  return result
}

// ==========================================
// Parsing interno de ZIP e XML de XLSX
// ==========================================

async function unzipEntries(zipData: Uint8Array): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const view = new DataView(zipData.buffer, zipData.byteOffset, zipData.byteLength)

  let offset = 0
  while (offset + 30 <= zipData.length) {
    const signature = view.getUint32(offset, true)
    if (signature !== 0x04034b50) {
      // Fim das entradas locais de arquivo
      break
    }

    const compressionMethod = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const uncompressedSize = view.getUint32(offset + 22, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraFieldLength = view.getUint16(offset + 28, true)

    const fileNameBytes = zipData.subarray(offset + 30, offset + 30 + fileNameLength)
    const fileName = new TextDecoder('utf-8').decode(fileNameBytes)

    const fileDataOffset = offset + 30 + fileNameLength + extraFieldLength
    const compressedBytes = zipData.subarray(fileDataOffset, fileDataOffset + compressedSize)

    offset = fileDataOffset + compressedSize

    // Se o arquivo for relevante para XLSX (xl/...)
    if (fileName.toLowerCase().endsWith('.xml') || fileName.toLowerCase().endsWith('.rels')) {
      try {
        let decompressedText = ''
        if (compressionMethod === 0) {
          // Stored (sem compressão)
          decompressedText = new TextDecoder('utf-8').decode(compressedBytes)
        } else if (compressionMethod === 8) {
          // Deflate
          decompressedText = await decompressDeflate(compressedBytes)
        }
        if (decompressedText) {
          result[fileName] = decompressedText
        }
      } catch (err) {
        // Arquivo opcional ou erro pontual
      }
    }
  }

  return result
}

async function decompressDeflate(data: Uint8Array): Promise<string> {
  // Tentativa com DecompressionStream nativo (Browser moderno & Node 18+)
  if (typeof DecompressionStream !== 'undefined') {
    const chunk =
      data.buffer instanceof ArrayBuffer &&
      data.byteOffset === 0 &&
      data.byteLength === data.buffer.byteLength
        ? data
        : new Uint8Array(data)

    try {
      const ds = new DecompressionStream('deflate-raw')
      const writer = ds.writable.getWriter()
      writer.write(chunk as unknown as BufferSource)
      writer.close()
      const response = new Response(ds.readable)
      const buffer = await response.arrayBuffer()
      return new TextDecoder('utf-8').decode(buffer)
    } catch {
      // fallback deflate padrão
      try {
        const ds = new DecompressionStream('deflate')
        const writer = ds.writable.getWriter()
        writer.write(chunk as unknown as BufferSource)
        writer.close()
        const response = new Response(ds.readable)
        const buffer = await response.arrayBuffer()
        return new TextDecoder('utf-8').decode(buffer)
      } catch {
        // continua
      }
    }
  }
  return ''
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return []
  const strings: string[] = []
  // Cada <si> contém ou <t>texto</t> ou vários <r><t>texto</t></r>
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
  let siMatch: RegExpExecArray | null

  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1]
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi
    let tMatch: RegExpExecArray | null
    let str = ''
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      str += decodeXml(tMatch[1])
    }
    strings.push(str)
  }

  return strings
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = []
  const rowRegex = /<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowIndex = parseInt(rowMatch[1], 10) - 1
    const rowContent = rowMatch[2]

    const cellRegex = /<c\b[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/gi
    let cellMatch: RegExpExecArray | null
    const rowValues: string[] = []

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLetters = cellMatch[1]
      const cellType = cellMatch[2]
      const cellContent = cellMatch[3]
      const colIdx = colLettersToIndex(colLetters)

      let val = ''
      const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellContent)
      if (vMatch) {
        val = decodeXml(vMatch[1]).trim()
      } else {
        const isMatch = /<is\b[^>]*>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/i.exec(
          cellContent,
        )
        if (isMatch) val = decodeXml(isMatch[1]).trim()
      }

      if (cellType === 's') {
        const sIdx = parseInt(val, 10)
        if (!isNaN(sIdx) && sharedStrings[sIdx] !== undefined) {
          val = sharedStrings[sIdx]
        }
      }

      // Preenche lacunas até a coluna correspondente
      while (rowValues.length < colIdx) {
        rowValues.push('')
      }
      rowValues[colIdx] = val
    }

    while (rows.length < rowIndex) {
      rows.push([])
    }
    rows[rowIndex] = rowValues
  }

  return rows
}

function colLettersToIndex(letters: string): number {
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64)
  }
  return index - 1
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
