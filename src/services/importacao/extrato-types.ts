/**
 * Tipos e Modelo Canônico de Linha de Extrato de Comissões
 * Representação unificada independente da seguradora de origem.
 */

export type SeguradoraFormato =
  | 'PORTO_SEGURO'
  | 'BRADESCO'
  | 'TOKIO_MARINE'
  | 'MAPFRE'
  | 'SUSEP_DETALHADO'
  | 'SINTETICO_CONSOLIDADO'
  | 'GENERICO_CSV'

export interface ExtratoLinhaCanonica {
  id: string // hash ou id gerado
  seguradoraNome: string
  numeroExtrato: string
  tipoReferencia: 'APOLICE' | 'PROPOSTA' | 'DOCUMENTO' | 'AMBOS'
  numeroApolice: string
  numeroProposta: string
  endosso: string
  parcela: number
  dataCredito: string // YYYY-MM-DD
  premioLiquido: number
  comissaoBruta: number
  impostos: number
  liquidoPago: number
  percentualComissao?: number
  seguradoNome?: string
  ramo?: string
  isComissaoAntecipada?: boolean
  // Flags informativas da regra de ouro
  isLinhaInformativa: boolean // true se R$0,00, COM.PG, saldo anterior etc.
  motivoInformativo?: string
  linhaBrutaOriginal?: Record<string, any>
}

export interface ExtratoParseResult {
  formato: SeguradoraFormato
  seguradoraNomeSugerida: string
  totalLinhasArquivo: number
  linhasValidasParaBaixa: ExtratoLinhaCanonica[]
  linhasInformativasIgnoradas: ExtratoLinhaCanonica[]
  checksumEsperado?: {
    totalBruto?: number
    totalImpostos?: number
    totalLiquido?: number
    ordemPagamento?: string
    dataPagamento?: string
  }
  avisos: string[]
}

/**
 * Normaliza número para float seguro tratando pontuação brasileira (1.234,56 ou 1234.56)
 */
export function parseMoeda(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return Math.round(val * 100) / 100
  let str = String(val).trim()
  if (!str) return 0
  // Remove símbolo de moeda R$, espaços
  str = str.replace(/[R$\s]/g, '')
  // Se contiver vírgula e ponto (ex: 1.250,50 ou 1,250.50)
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // 1.250,50 -> Brasil
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,250.50 -> Americano
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }
  const parsed = parseFloat(str)
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100
}

/**
 * Converte data em vários formatos para YYYY-MM-DD
 * Suporta DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, e número serial do Excel
 */
export function parseDataFlexivel(val: any): string {
  if (!val) return ''
  // Serial do Excel (número de dias desde 1899-12-30)
  if (
    typeof val === 'number' ||
    (/^\d{5}$/.test(String(val).trim()) && Number(val) > 30000 && Number(val) < 60000)
  ) {
    const serial = Number(val)
    const utcDays = Math.floor(serial - 25569)
    const utcValue = utcDays * 86400 * 1000
    const date = new Date(utcValue)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }

  const str = String(val).trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10)
  }
  // DD/MM/YYYY ou DD/MM/YY
  const brMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(str)
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0')
    const mes = brMatch[2].padStart(2, '0')
    let ano = brMatch[3]
    if (ano.length === 2) {
      ano = Number(ano) >= 70 ? `19${ano}` : `20${ano}`
    }
    return `${ano}-${mes}-${dia}`
  }

  return ''
}

/**
 * Extrai número limpo de proposta ou apólice removendo caracteres não numéricos supérfluos
 */
export function normalizarIdentificador(val: any): string {
  if (!val) return ''
  let str = String(val).trim()
  // Remove sufixos como ".000000" do Excel
  str = str.replace(/\.0+$/, '')
  return str
}
