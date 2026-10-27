import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook para coalescência / debounce de callbacks assíncronos (como refetches disparados por eventos realtime).
 * Evita rajadas de requisições concorrentes quando múltiplas coleções mudam juntas (ex: baixa de comissão
 * atualiza comissao_recebimentos, comissoes_previstas e policies quase ao mesmo tempo).
 *
 * @param callback Função assíncrona ou síncrona a ser executada
 * @param delayMs Tempo de coalescência em milissegundos (padrão 250ms)
 * @returns Função com debounce que garante limpeza automática ao desmontar o componente
 */
export function useCoalescedCallback(callback: () => void | Promise<void>, delayMs: number = 250) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const schedule = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void callbackRef.current()
    }, delayMs)
  }, [delayMs])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return { schedule, cancel }
}
