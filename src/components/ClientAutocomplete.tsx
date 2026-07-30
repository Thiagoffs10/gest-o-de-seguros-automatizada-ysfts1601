import { useState, useMemo, useRef, useEffect } from 'react'
import { Client } from '@/types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Props {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  placeholder?: string
}

export function ClientAutocomplete({
  clients,
  value,
  onChange,
  placeholder = 'Buscar por nome...',
}: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedClient = clients.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (!query) return clients.slice(0, 50)
    const q = query.toLowerCase()
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50)
  }, [clients, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (selectedClient) setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectedClient])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [query])

  const handleSelect = (client: Client) => {
    onChange(client.id)
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[highlightedIndex]) {
      e.preventDefault()
      handleSelect(filtered[highlightedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }

  const displayValue = isOpen ? query : selectedClient?.name || ''

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
          if (value) onChange('')
        }}
        onFocus={() => {
          setIsOpen(true)
          setQuery('')
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(value && !isOpen && 'font-semibold')}
      />
      {value && !isOpen && <Check className="absolute right-3 top-3 w-4 h-4 text-blue-600" />}
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-slate-200 rounded-md shadow-lg">
          {filtered.map((client, idx) => (
            <div
              key={client.id}
              className={cn(
                'flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 transition-colors',
                idx === highlightedIndex && 'bg-blue-50',
                value === client.id && 'font-semibold text-blue-600',
              )}
              onClick={() => handleSelect(client)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <span>{client.name}</span>
              {value === client.id && <Check className="w-4 h-4 text-blue-600" />}
            </div>
          ))}
        </div>
      )}
      {isOpen && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3 text-sm text-slate-500 text-center">
          Nenhum cliente encontrado.
        </div>
      )}
    </div>
  )
}
