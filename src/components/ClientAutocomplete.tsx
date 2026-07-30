import { useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Client } from '@/types'

interface ClientAutocompleteProps {
  clients: Client[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ClientAutocomplete({
  clients,
  value,
  onChange,
  placeholder = 'Buscar cliente por nome...',
}: ClientAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedClient = clients.find((c) => c.id === value)

  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.cpf?.toLowerCase().includes(q)
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left h-10 px-3 bg-white"
        >
          <span className="truncate">{selectedClient ? selectedClient.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-2 bg-white shadow-md border rounded-md" align="start">
        <div className="flex items-center border-b px-2 pb-2 mb-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Digite o nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-none focus-visible:ring-0 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-[220px] overflow-y-auto space-y-1">
          {filteredClients.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-500">Nenhum cliente encontrado.</p>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => {
                  onChange(client.id)
                  setOpen(false)
                  setSearch('')
                }}
                className={cn(
                  'flex items-center justify-between px-2.5 py-2 text-xs rounded cursor-pointer transition-colors hover:bg-slate-100',
                  value === client.id && 'bg-blue-50 text-blue-700 font-medium',
                )}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="font-medium text-slate-900 truncate">{client.name}</span>
                  {client.tipo_pessoa === 'PJ' ? (
                    client.cnpj ? (
                      <span className="text-[10px] text-slate-500">CNPJ: {client.cnpj}</span>
                    ) : null
                  ) : (
                    client.cpf && (
                      <span className="text-[10px] text-slate-500">CPF: {client.cpf}</span>
                    )
                  )}
                </div>
                {value === client.id && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
