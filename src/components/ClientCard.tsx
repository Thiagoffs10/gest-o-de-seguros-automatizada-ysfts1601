import { Link } from 'react-router-dom'
import { Phone, Mail, MessageSquare, Eye, Pencil, Trash2, Building2, User } from 'lucide-react'
import { Client } from '@/types'
import { formatDocumentLabel } from '@/lib/document-validators'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface Props {
  client: Client
  activePoliciesCount: number
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
}

export function ClientCard({ client, activePoliciesCount, onEdit, onDelete }: Props) {
  const cleanPhone = client.phone?.replace(/\D/g, '')
  const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : null
  const callUrl = cleanPhone ? `tel:${cleanPhone}` : null

  return (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 bg-blue-600 text-white font-bold shrink-0">
          <AvatarFallback>{client.name?.substring(0, 2).toUpperCase() || 'CL'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link to={`/clientes/${client.id}`} className="block">
            <h3 className="font-bold text-slate-900 truncate hover:text-blue-600 transition-colors">
              {client.name}
            </h3>
          </Link>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            {client.tipo_pessoa === 'PJ' ? (
              <Building2 className="w-3 h-3" />
            ) : (
              <User className="w-3 h-3" />
            )}
            {formatDocumentLabel(client)}
          </p>
          <div className="flex flex-col gap-0.5 mt-1 text-xs text-slate-600">
            {client.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {client.phone}
              </span>
            )}
            {client.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3" />
                {client.email}
              </span>
            )}
          </div>
        </div>
        {activePoliciesCount > 0 && (
          <Badge className="bg-emerald-500 shrink-0">{activePoliciesCount} ativas</Badge>
        )}
      </div>
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={!whatsappUrl}
          onClick={() => whatsappUrl && window.open(whatsappUrl, '_blank')}
        >
          <MessageSquare className="w-3.5 h-3.5 mr-1" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!callUrl}
          onClick={() => callUrl && (window.location.href = callUrl)}
        >
          <Phone className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
          <Link to={`/clientes/${client.id}`}>
            <Eye className="w-3.5 h-3.5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-blue-600"
          onClick={() => onEdit(client)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-600"
          onClick={() => onDelete(client)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  )
}
