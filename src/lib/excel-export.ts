import { createZip } from '@/lib/zip-writer'

export type CellType = 'text' | 'number' | 'currency' | 'percent'

export interface ExcelColumn {
  header: string
  type: CellType
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
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`

function cellXml(ref: string, val: string | number, type: CellType): string {
  const s = type === 'currency' ? '2' : type === 'percent' ? '3' : type === 'text' ? '4' : '0'
  if (val === '' || val === null || val === undefined) {
    return `<c r="${ref}" s="${s}"/>`
  }
  if (type === 'text') {
    return `<c r="${ref}" t="inlineStr" s="4"><is><t xml:space="preserve">${escXml(String(val))}</t></is></c>`
  }
  return `<c r="${ref}" s="${s}"><v>${Number(val) || 0}</v></c>`
}

function buildSheet(columns: ExcelColumn[], rows: (string | number)[][]): string {
  const lastCol = colName(columns.length - 1)
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
    .map(
      (col, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${col.type === 'text' ? 22 : 16}" customWidth="1"/>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${colsXml}</cols><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:${lastCol}${rows.length + 1}"/></worksheet>`
}

export function downloadXlsx(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: (string | number)[][],
): void {
  const enc = (s: string) => new TextEncoder().encode(s)
  const entries = [
    {
      name: '[Content_Types].xml',
      data: enc(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: enc(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: enc(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: enc(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: enc(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: enc(buildSheet(columns, rows)) },
  ]
  const blob = new Blob([createZip(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
