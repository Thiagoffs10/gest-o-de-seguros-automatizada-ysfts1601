import { useState, useEffect } from 'react'

/**
 * Hook para atrasar a atualização de um valor (debounce).
 * Útil para campos de busca de texto que disparam filtros ou requisições.
 *
 * @param value Valor a ser debounced
 * @param delay Tempo em ms (padrão: 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
