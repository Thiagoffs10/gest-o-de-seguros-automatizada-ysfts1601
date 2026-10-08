/**
 * Utilitários para formatação e cópia de relatórios de extração / debug de propostas
 */
import { APP_VERSION } from '@/lib/version'

export interface RelatorioExtracaoParams {
  textoBruto: string
  objetoParseado: any
  appVersion?: string
  arquivoNome?: string
}

export function formatarRelatorioExtracao({
  textoBruto,
  objetoParseado,
  appVersion = APP_VERSION,
  arquivoNome,
}: RelatorioExtracaoParams): string {
  const meta: string[] = []
  if (arquivoNome) meta.push(`Arquivo: ${arquivoNome}`)
  meta.push(`Data/Hora: ${new Date().toISOString()}`)

  return [
    '=== VERSÃO ===',
    `App Version: ${appVersion}`,
    meta.length > 0 ? meta.join(' | ') : '',
    '',
    '=== OBJETO PARSEADO ===',
    typeof objetoParseado === 'string' ? objetoParseado : JSON.stringify(objetoParseado, null, 2),
    '',
    '=== TEXTO BRUTO RECEBIDO ===',
    textoBruto || '(vazio)',
  ]
    .filter((line, idx) => !(idx === 2 && !line))
    .join('\n')
}

/**
 * Copia texto para a área de transferência com fallback robusto
 */
export async function copiarParaClipboard(texto: string): Promise<boolean> {
  // 1. Tentar API moderna navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch (err) {
      console.warn('navigator.clipboard falhou, tentando fallback com textarea:', err)
    }
  }

  // 2. Fallback com textarea temporária e document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = texto
      textarea.style.position = 'fixed'
      textarea.style.top = '0'
      textarea.style.left = '0'
      textarea.style.width = '2em'
      textarea.style.height = '2em'
      textarea.style.padding = '0'
      textarea.style.border = 'none'
      textarea.style.outline = 'none'
      textarea.style.boxShadow = 'none'
      textarea.style.background = 'transparent'
      textarea.setAttribute('readonly', '')
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (success) return true
    } catch (fallbackErr) {
      console.error('Fallback execCommand também falhou:', fallbackErr)
    }
  }

  return false
}
