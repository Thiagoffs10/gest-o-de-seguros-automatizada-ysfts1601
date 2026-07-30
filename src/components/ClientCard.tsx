import { Mail, Phone, MapPin, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Client } from '@/types'

interface Props {
  client: Client
  activePoliciesCount: number
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
}

export function ClientCard({ client, activePoliciesCount, onEdit, onDelete }: Props) {
  return (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow border">
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 truncate">{client.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {client.tipo_pessoa === 'PJ'
              ? `CNPJ: ${client.cnpj || '-'}`
              : `CPF: ${client.cpf || '-'}`}
          </p>
        </div>
        <Badge className={activePoliciesCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}>
          {activePoliciesCount} ativa{activePoliciesCount !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-slate-600 mb-3">
        {client.email && (
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
        {(client.cidade || client.estado) && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {client.cidade}
              {client.estado ? ` - ${client.estado}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-1 pt-2 border-t">
        <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => onEdit(client)}>
          <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
        </Button>
        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(client)}>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
        </Button>
      </div>
    </Card>
  )
}
