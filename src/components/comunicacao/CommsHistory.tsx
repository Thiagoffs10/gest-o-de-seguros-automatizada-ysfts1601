import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Communication } from '@/types'

interface Props {
  communications: Communication[]
}

export function CommsHistory({ communications }: Props) {
  const [search, setSearch] = useState('')

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Email' | 'WhatsApp'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Rascunho' | 'Enviado' | 'Falhou'>('ALL')

  const filtered = useMemo(() => {
    return communications.filter((cm) => {
      if (typeFilter !== 'ALL' && cm.type !== typeFilter) return false
      if (statusFilter !== 'ALL' && cm.status !== statusFilter) return false

      if (search.trim()) {
        const raw = search.trim().toLowerCase()
        const clean = raw.replace(/\D/g, '')
        const client = cm.expand?.client
        let matches = false
        if (client) {
          if (client.name && client.name.toLowerCase().includes(raw)) matches = true
          if (client.cpf && client.cpf.toLowerCase().includes(raw)) matches = true
          if (client.cnpj && client.cnpj.toLowerCase().includes(raw)) matches = true
          if (clean && client.cpf && client.cpf.replace(/\D/g, '').includes(clean)) matches = true
          if (clean && client.cnpj && client.cnpj.replace(/\D/g, '').includes(clean)) matches = true
        }
        if (cm.subject && cm.subject.toLowerCase().includes(raw)) matches = true
        if (cm.recipient_email && cm.recipient_email.toLowerCase().includes(raw)) matches = true
        if (cm.recipient_phone && cm.recipient_phone.includes(raw)) matches = true
        if (cm.body && cm.body.toLowerCase().includes(raw)) matches = true
        if (!matches) return false
      }

      return true
    })
  }, [communications, search, typeFilter, statusFilter])

  return (
    <Card className="shadow-sm overflow-hidden border mt-6">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-base font-bold">Histórico Unificado de Comunicações</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filtrar por Cliente, CPF ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56 text-xs h-8 bg-white"
          />
          <select
            aria-label="Filtrar por canal"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-8 px-2 text-xs border rounded-md bg-white text-slate-700"
          >
            <option value="ALL">Todos os canais</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">E-mail</option>
          </select>
          <select
            aria-label="Filtrar por status da comunicação"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 px-2 text-xs border rounded-md bg-white text-slate-700"
          >
            <option value="ALL">Todos os status</option>
            <option value="Enviado">Enviado</option>
            <option value="Rascunho">Rascunho</option>
            <option value="Falhou">Falhou</option>
          </select>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
            <tr>
              <th className="p-3">Tipo</th>
              <th className="p-3">Cliente / Destinatário</th>
              <th className="p-3">Assunto / Prévia</th>
              <th className="p-3">Data / Hora</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-6 text-slate-500">
                  Nenhuma comunicação registrada no histórico.
                </td>
              </tr>
            ) : (
              filtered.map((cm) => (
                <tr key={cm.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold">{cm.type}</td>
                  <td className="p-3 font-medium">
                    {cm.expand?.client?.name ||
                      cm.recipient_email ||
                      cm.recipient_phone ||
                      'Campanha'}
                  </td>
                  <td className="p-3 max-w-xs truncate text-slate-600">{cm.subject || cm.body}</td>
                  <td className="p-3">{new Date(cm.created).toLocaleString('pt-BR')}</td>
                  <td className="p-3">
                    <Badge
                      variant={cm.status === 'Enviado' ? 'default' : 'outline'}
                      className={cm.status === 'Enviado' ? 'bg-emerald-600' : ''}
                    >
                      {cm.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
