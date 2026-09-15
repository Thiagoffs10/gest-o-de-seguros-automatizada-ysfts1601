import type { RowInput } from 'jspdf-autotable'
import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'

export interface SummaryCardItem {
  label: string
  value: string
  highlight?: boolean
  variant?: 'default' | 'green' | 'amber' | 'blue' | 'red'
}

export interface ActiveFiltersContext {
  periodo?: string
  seguradora?: string
  parceiro?: string
  tipoSeguro?: string
  busca?: string
  status?: string
}

export interface FinancialPDFOptions {
  title: string
  subtitle?: string
  periodLabel: string
  filters?: ActiveFiltersContext
  summaryCards?: SummaryCardItem[]
  columns: {
    header: string
    dataKey: string
    align?: 'left' | 'center' | 'right'
    width?: number
  }[]
  rows: Record<string, any>[]
  totalRow?: Record<string, any>
  orientation?: 'portrait' | 'landscape'
  filename?: string
  infoNotes?: string[]
}

// Converte imagem importada para base64 para uso no jsPDF (se for URL/vite asset)
async function loadImageAsBase64(src: string): Promise<string | null> {
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result as string)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Sanitiza string para nome de arquivo
export function slugifyFilename(name: string, period?: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const cleanPeriod = period
    ? '-' +
      period
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : ''

  return `${clean}${cleanPeriod}.pdf`
}

export async function exportFinancialListingPDF(options: FinancialPDFOptions) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default || autoTableModule

  const orientation = options.orientation || (options.columns.length > 6 ? 'landscape' : 'portrait')
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  // Tenta carregar o logo
  let base64Logo: string | null = null
  try {
    base64Logo = await loadImageAsBase64(logoImg)
  } catch {
    base64Logo = null
  }

  let currentY = margin

  // 1. Cabeçalho Principal (Logo + Título da Empresa + Título do Relatório + Metadados)
  const headerHeight = 22
  if (base64Logo) {
    try {
      doc.addImage(base64Logo, 'JPEG', margin, currentY, 40, 16)
    } catch {
      // Falha silenciosa no logo se houver formato não suportado
    }
  }

  // Título Institucional e Título do Modal
  const titleX = base64Logo ? margin + 44 : margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text('CRED10MIX CORRETORA DE SEGUROS', titleX, currentY + 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(37, 99, 235) // blue-600
  doc.text(options.title, titleX, currentY + 10)

  if (options.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139) // slate-500
    doc.text(options.subtitle, titleX, currentY + 15)
  }

  // Metadados à Direita (Data/Hora de Geração e Período)
  const now = new Date()
  const dataGeracao = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  const rightX = pageWidth - margin
  doc.text(`Gerado em: ${dataGeracao}`, rightX, currentY + 4, { align: 'right' })
  doc.text(`Competência: ${options.periodLabel}`, rightX, currentY + 9, { align: 'right' })
  doc.text(`Total de registros: ${options.rows.length}`, rightX, currentY + 14, { align: 'right' })

  currentY += headerHeight

  // Linha divisória horizontal
  doc.setDrawColor(203, 213, 225) // slate-300
  doc.setLineWidth(0.5)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 4

  // 2. Filtros Ativos / Contexto de Auditoria (se houver busca ou filtros)
  const activeFilters = options.filters || {}
  const filterParts: string[] = []

  if (activeFilters.periodo) {
    filterParts.push(`Período: ${activeFilters.periodo}`)
  }
  if (activeFilters.seguradora && activeFilters.seguradora !== 'ALL') {
    filterParts.push(`Seguradora: ${activeFilters.seguradora}`)
  }
  if (activeFilters.parceiro && activeFilters.parceiro !== 'ALL') {
    filterParts.push(`Parceiro: ${activeFilters.parceiro}`)
  }
  if (activeFilters.tipoSeguro && activeFilters.tipoSeguro !== 'ALL') {
    filterParts.push(`Ramo/Tipo: ${activeFilters.tipoSeguro}`)
  }
  if (activeFilters.status && activeFilters.status !== 'ALL') {
    filterParts.push(`Status: ${activeFilters.status}`)
  }
  if (activeFilters.busca && activeFilters.busca.trim()) {
    filterParts.push(`Busca ativa: "${activeFilters.busca.trim()}"`)
  }

  if (filterParts.length > 0) {
    doc.setFillColor(248, 250, 252) // slate-50
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(71, 85, 105) // slate-600
    doc.text('Filtros / Contexto:', margin + 3, currentY + 4.5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const filtersStr = filterParts.join('  •  ')
    doc.text(filtersStr, margin + 28, currentY + 4.5)

    currentY += 10
  }

  // 3. Cards de Resumo (quando fornecidos)
  if (options.summaryCards && options.summaryCards.length > 0) {
    const cardGap = 3
    const totalGap = cardGap * (options.summaryCards.length - 1)
    const cardWidth = (pageWidth - margin * 2 - totalGap) / options.summaryCards.length
    const cardHeight = 14

    options.summaryCards.forEach((card, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap)

      // Background e borda baseados no variante ou highlight
      let fillColor: [number, number, number] = [248, 250, 252] // slate-50
      let borderColor: [number, number, number] = [226, 232, 240] // slate-200
      let valueColor: [number, number, number] = [15, 23, 42] // slate-900

      if (card.variant === 'green') {
        fillColor = [240, 253, 244]
        borderColor = [187, 247, 208]
        valueColor = [22, 101, 52] // emerald-800
      } else if (card.variant === 'amber') {
        fillColor = [255, 251, 235]
        borderColor = [254, 215, 170]
        valueColor = [180, 83, 9] // amber-700
      } else if (card.variant === 'blue' || card.highlight) {
        fillColor = [239, 246, 255]
        borderColor = [191, 219, 254]
        valueColor = [29, 78, 216] // blue-700
      } else if (card.variant === 'red') {
        fillColor = [254, 242, 242]
        borderColor = [254, 202, 202]
        valueColor = [185, 28, 28] // red-700
      }

      doc.setFillColor(fillColor[0], fillColor[1], fillColor[2])
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.setLineWidth(0.4)
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD')

      // Label do card
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.setTextColor(100, 116, 139)
      doc.text(card.label, cardX + 3, currentY + 4.5)

      // Valor do card
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2])
      doc.text(card.value, cardX + 3, currentY + 10.5)
    })

    currentY += cardHeight + 4
  }

  // 4. Notas / Observações rápidas (opcional)
  if (options.infoNotes && options.infoNotes.length > 0) {
    options.infoNotes.forEach((note) => {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text(`* ${note}`, margin, currentY + 2)
      currentY += 4
    })
    currentY += 1
  }

  // 5. Tabela com autoTable
  const tableHeaders = options.columns.map((c) => c.header)
  const tableData: RowInput[] = options.rows.map((row) => {
    return options.columns.map((c) => {
      const val = row[c.dataKey]
      return val !== undefined && val !== null ? String(val) : '-'
    })
  })

  // Linha de total consolidado no fim
  const footRows: RowInput[] = []
  if (options.totalRow) {
    const footCells = options.columns.map((c) => {
      const val = options.totalRow![c.dataKey]
      return val !== undefined && val !== null ? String(val) : ''
    })
    footRows.push(footCells)
  }

  const columnStyles: Record<number, any> = {}
  options.columns.forEach((col, idx) => {
    columnStyles[idx] = {
      halign: col.align || 'left',
    }
  })

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableData,
    foot: footRows.length > 0 ? footRows : undefined,
    margin: { left: margin, right: margin, bottom: 16 },
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [30, 41, 59], // slate-800
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.15,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.8,
      lineColor: [148, 163, 184], // slate-400
      lineWidth: 0.25,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles,
    didDrawPage: (data) => {
      // Rodapé da página
      const pageStr = `Página ${data.pageNumber}`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(
        'CRED10MIX Corretora de Seguros — Sistema de Gestão Financeira',
        margin,
        pageHeight - 8,
      )
      doc.text(pageStr, pageWidth - margin, pageHeight - 8, { align: 'right' })
    },
  })

  const filename = options.filename || slugifyFilename(options.title, options.periodLabel)
  doc.save(filename)
}
