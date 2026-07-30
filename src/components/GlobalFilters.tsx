import { FilterState, Parceiro, Seguradora } from '@/types'
import { YEARS, MONTHS, TIPOS_DE_SEGURO } from '@/lib/constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Filter } from 'lucide-react'

interface GlobalFiltersProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  showPartnerFilter?: boolean
  showSeguradoraFilter?: boolean
  showTipoSeguroFilter?: boolean
  parceiros?: Parceiro[]
  seguradoras?: Seguradora[]
}

export function GlobalFilters({
  filters,
  onFilterChange,
  showPartnerFilter,
  showSeguradoraFilter,
  showTipoSeguroFilter,
  parceiros,
  seguradoras,
}: GlobalFiltersProps) {
  const update = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value || undefined })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 mr-2">
        <Filter className="w-4 h-4" /> Filtros:
      </div>
      <div>
        <Label className="text-xs">Ano</Label>
        <Select value={filters.year || ''} onValueChange={(v) => update('year', v)}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Mês</Label>
        <Select value={filters.month || ''} onValueChange={(v) => update('month', v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">De</Label>
        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => update('dateFrom', e.target.value)}
          className="w-[150px]"
        />
      </div>
      <div>
        <Label className="text-xs">Até</Label>
        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => update('dateTo', e.target.value)}
          className="w-[150px]"
        />
      </div>
      {showSeguradoraFilter && seguradoras && (
        <div>
          <Label className="text-xs">Seguradora</Label>
          <Select
            value={filters.seguradoraId || ''}
            onValueChange={(v) => update('seguradoraId', v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Seguradora" />
            </SelectTrigger>
            <SelectContent>
              {seguradoras.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showPartnerFilter && parceiros && (
        <div>
          <Label className="text-xs">Parceiro</Label>
          <Select value={filters.partnerId || ''} onValueChange={(v) => update('partnerId', v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              {parceiros.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showTipoSeguroFilter && (
        <div>
          <Label className="text-xs">Tipo Seguro</Label>
          <Select value={filters.tipoSeguro || ''} onValueChange={(v) => update('tipoSeguro', v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DE_SEGURO.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
