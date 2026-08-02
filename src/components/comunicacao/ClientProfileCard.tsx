import { Client, Policy } from '@/types'
import { formatClientDocument } from '@/lib/document-validators'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface Props {
  client: Client
  policies: Policy[]
  type: 'WhatsApp' | 'Email'
}

export function ClientProfileCard({ client, policies, type }: Props) {
  const clientPolicies = policies.filter((p) => p.client === client.id)
  const lastPolicy = clientPolicies[0]
  const hasEmail = Boolean(client.email && client.email.trim().length > 0)

  return (
    <div className="space-y-3">
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">{client.name}</span>
            <Badge
              variant={clientPolicies.length > 0 ? 'default' : 'secondary'}
              className={clientPolicies.length > 0 ? 'bg-emerald-600' : ''}
            >
              {clientPolicies.length > 0 ? 'Com Apólice Ativa' : 'Sem Apólice Ativa'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <strong>Documento:</strong> {formatClientDocument(client) || 'Não informado'}
            </div>
            <div>
              <strong>Telefone:</strong> {client.phone || 'Não informado'}
            </div>
            <div className="col-span-2">
              <strong>E-mail:</strong> {client.email || 'Não informado'}
            </div>
          </div>

          {type === 'Email' && !hasEmail && (
            <Alert variant="destructive" className="py-2 mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold">Atenção</AlertTitle>
              <AlertDescription className="text-xs">
                Este cliente não possui e-mail cadastrado.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {lastPolicy && (
        <Card className="bg-blue-50/60 border-blue-200">
          <CardContent className="p-3 text-xs space-y-1 text-blue-950">
            <p className="font-bold text-blue-900 mb-1">Última Apólice do Cliente:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Seguradora:</strong>{' '}
                {lastPolicy.expand?.seguradora?.nome || lastPolicy.insurance_company || '-'}
              </div>
              <div>
                <strong>Tipo:</strong>{' '}
                {lastPolicy.tipo_de_seguro || lastPolicy.coverage_type || '-'}
              </div>
              <div>
                <strong>Apólice nº:</strong> {lastPolicy.policy_number}
              </div>
              <div>
                <strong>Vigência:</strong>{' '}
                {new Date(lastPolicy.start_date).toLocaleDateString('pt-BR')} a{' '}
                {new Date(lastPolicy.end_date).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
