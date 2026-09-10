import { useNavigate } from 'react-router-dom'
import { Mail, Phone, MapPin, Pencil, Trash2, Eye, Send } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Client } from '@/types'

interface Props {
  client: Client
  activePoliciesCount: number
  hasOpportunities?: boolean
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
}

export function ClientCard({
  client,
  activePoliciesCount,
  hasOpportunities = false,
  onEdit,
  onDelete,
}: Props) {
  const navigate = useNavigate()

  return (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow border flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-3">
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={() => navigate(`/clientes/${client.id}`)}
          >
            <h3 className="font-bold text-slate-900 truncate hover:text-blue-600 transition-colors">
              {client.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {client.tipo_pessoa === 'PJ'
                ? `CNPJ: ${client.cnpj || '-'}`
                : `CPF: ${client.cpf || '-'}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={activePoliciesCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}>
              {activePoliciesCount} ativa{activePoliciesCount !== 1 ? 's' : ''}
            </Badge>
            {hasOpportunities && (
              <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                Oportunidade
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-slate-600 mb-3">
          {client.email && (
            <div className="flex items-center gap-2 truncate text-xs">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {(client.cidade || client.estado) && (
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {client.cidade}
                {client.estado ? ` - ${client.estado}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t mt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-slate-700 h-7 px-2"
          onClick={() => navigate(`/clientes/${client.id}`)}
        >
          <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" /> Ficha 360º
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 h-7 px-2"
            title="Enviar e-mail para este cliente"
            onClick={() =>
              navigate(`/comunicacao?clientId=${encodeURIComponent(client.id)}&canal=Email`)
            }
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 h-7 px-2"
            onClick={() => onEdit(client)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 h-7 px-2"
            onClick={() => onDelete(client)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
