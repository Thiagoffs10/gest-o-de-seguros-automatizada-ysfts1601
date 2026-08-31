import { createZip } from '@/lib/zip-writer'

export type CellType = 'text' | 'number' | 'currency' | 'percent' | 'date'

export interface ExcelColumn {
  header: string
  type: CellType
}

export interface ExcelSheet {
  name: string
  columns: ExcelColumn[]
  rows: (string | number | boolean | null | undefined)[][]
}

function colName(index: number): string {
  let r = ''
  let i = index + 1
  while (i > 0) {
    r = String.fromCharCode(65 + ((i - 1) % 26)) + r
    i = Math.floor((i - 1) / 26)
  }
  return r
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
  <numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/>
  <numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/>
  <numFmt numFmtId="166" formatCode="DD/MM/YYYY"/>
</numFmts>
<fonts count="2">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1">
  <border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="6">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`

function cellXml(
  ref: string,
  val: string | number | boolean | null | undefined,
  type: CellType,
): string {
  const styleIdx =
    type === 'currency'
      ? '2'
      : type === 'percent'
        ? '3'
        : type === 'date'
          ? '5'
          : type === 'text'
            ? '4'
            : '0'

  if (val === '' || val === null || val === undefined) {
    return `<c r="${ref}" s="${styleIdx}"/>`
  }

  if (type === 'number' || type === 'currency' || type === 'percent') {
    const num = Number(val)
    if (isNaN(num)) {
      return `<c r="${ref}" t="inlineStr" s="${styleIdx}"><is><t xml:space="preserve">${escXml(String(val))}</t></is></c>`
    }
    return `<c r="${ref}" s="${styleIdx}"><v>${num}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr" s="${styleIdx}"><is><t xml:space="preserve">${escXml(String(val))}</t></is></c>`
}

function buildSheet(
  columns: ExcelColumn[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const lastCol = colName(Math.max(0, columns.length - 1))
  let rowsXml = ''
  let headerCells = ''
  for (let c = 0; c < columns.length; c++) {
    headerCells += `<c r="${colName(c)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${escXml(columns[c].header)}</t></is></c>`
  }
  rowsXml += `<row r="1">${headerCells}</row>`
  for (let r = 0; r < rows.length; r++) {
    let cells = ''
    for (let c = 0; c < columns.length; c++) {
      cells += cellXml(`${colName(c)}${r + 2}`, rows[r][c], columns[c].type)
    }
    rowsXml += `<row r="${r + 2}">${cells}</row>`
  }
  const colsXml = columns
    .map((col, i) => {
      const w = col.type === 'text' ? 24 : col.type === 'currency' ? 16 : 14
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${colsXml}</cols>
<sheetData>${rowsXml}</sheetData>
<autoFilter ref="A1:${lastCol}${Math.max(1, rows.length + 1)}"/>
</worksheet>`
}

export function downloadXlsx(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: (string | number | boolean | null | undefined)[][],
): void {
  downloadMultiSheetXlsx(filename, [{ name: sheetName, columns, rows }])
}

export function downloadMultiSheetXlsx(filename: string, sheets: ExcelSheet[]): void {
  const enc = (s: string) => new TextEncoder().encode(s)
  const validSheets = sheets.length > 0 ? sheets : [{ name: 'Dados', columns: [], rows: [] }]

  // 1. Content Types
  let sheetOverrides = ''
  for (let i = 0; i < validSheets.length; i++) {
    sheetOverrides += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  }
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

  // 2. Root rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

  // 3. Workbook
  let sheetTags = ''
  for (let i = 0; i < validSheets.length; i++) {
    const sName = validSheets[i].name.substring(0, 31) || `Aba${i + 1}`
    sheetTags += `<sheet name="${escXml(sName)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  }
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`

  // 4. Workbook Rels
  let wbRels = ''
  for (let i = 0; i < validSheets.length; i++) {
    wbRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  }
  wbRels += `<Relationship Id="rId${validSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels}</Relationships>`

  // Entries
  const entries: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc(contentTypesXml) },
    { name: '_rels/.rels', data: enc(rootRelsXml) },
    { name: 'xl/workbook.xml', data: enc(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc(workbookRelsXml) },
    { name: 'xl/styles.xml', data: enc(STYLES_XML) },
  ]

  for (let i = 0; i < validSheets.length; i++) {
    const s = validSheets[i]
    entries.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc(buildSheet(s.columns, s.rows)),
    })
  }

  const zipBytes = createZip(entries)
  const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
