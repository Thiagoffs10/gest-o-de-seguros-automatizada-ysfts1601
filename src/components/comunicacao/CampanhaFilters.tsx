import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Seguradora, Parceiro, TipoSeguro } from '@/types'

export interface CampaignFilterState {
  statusFilter: string
  eventFilter: string
  seguradoraId: string
  tipoSeguro: string
  parceiroId: string
  cidade: string
  estado: string
}

interface Props {
  filters: CampaignFilterState
  setFilters: React.Dispatch<React.SetStateAction<CampaignFilterState>>
  seguradoras: Seguradora[]
  parceiros: Parceiro[]
  tiposSeguro: TipoSeguro[]
}

export function CampanhaFilters({
  filters,
  setFilters,
  seguradoras,
  parceiros,
  tiposSeguro,
}: Props) {
  const update = (key: keyof CampaignFilterState, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border">
      <div>
        <Label className="text-xs font-semibold">Status do Cliente</Label>
        <Select value={filters.statusFilter} onValueChange={(v) => update('statusFilter', v)}>
          <SelectTrigger className="h-8 text-xs bg-white mt-1">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            <SelectItem value="ativos">Com Apólice Ativa</SelectItem>
            <SelectItem value="vencidas">Com Apólice Vencida</SelectItem>
            <SelectItem value="inativos">Inativos / Expirados</SelectItem>
            <SelectItem value="sem_apolice">Sem Apólice Cadastrada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Evento / Vencimento</Label>
        <Select value={filters.eventFilter} onValueChange={(v) => update('eventFilter', v)}>
          <SelectTrigger className="h-8 text-xs bg-white mt-1">
            <SelectValue placeholder="Todos com e-mail" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos com e-mail</SelectItem>
            <SelectItem value="aniversariantes">Aniversariantes do Mês</SelectItem>
            <SelectItem value="renovacao_30">Renovação nos próximos 30 dias</SelectItem>
            <SelectItem value="renovacao_15">Renovação nos próximos 15 dias</SelectItem>
            <SelectItem value="renovacao_7">Renovação nos próximos 7 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Seguradora</Label>
        <Select value={filters.seguradoraId} onValueChange={(v) => update('seguradoraId', v)}>
          <SelectTrigger className="h-8 text-xs bg-white mt-1">
            <SelectValue placeholder="Todas as seguradoras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as seguradoras</SelectItem>
            {seguradoras.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Tipo de Seguro</Label>
        <Select value={filters.tipoSeguro} onValueChange={(v) => update('tipoSeguro', v)}>
          <SelectTrigger className="h-8 text-xs bg-white mt-1">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tiposSeguro.map((t) => (
              <SelectItem key={t.id} value={t.nome}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Parceiro</Label>
        <Select value={filters.parceiroId} onValueChange={(v) => update('parceiroId', v)}>
          <SelectTrigger className="h-8 text-xs bg-white mt-1">
            <SelectValue placeholder="Todos os parceiros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os parceiros</SelectItem>
            {parceiros.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Cidade</Label>
        <Input
          value={filters.cidade}
          onChange={(e) => update('cidade', e.target.value)}
          placeholder="Ex: São Paulo"
          className="h-8 text-xs bg-white mt-1"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold">Estado (UF)</Label>
        <Input
          value={filters.estado}
          onChange={(e) => update('estado', e.target.value)}
          placeholder="Ex: SP"
          className="h-8 text-xs bg-white mt-1"
        />
      </div>
    </div>
  )
}
