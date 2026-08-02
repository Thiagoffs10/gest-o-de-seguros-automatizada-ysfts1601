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

  const filtered = useMemo(() => {
    if (!search.trim()) return communications
    const raw = search.trim().toLowerCase()
    const clean = raw.replace(/\D/g, '')

    return communications.filter((cm) => {
      const client = cm.expand?.client
      if (client) {
        if (client.name && client.name.toLowerCase().includes(raw)) return true
        if (client.cpf && client.cpf.toLowerCase().includes(raw)) return true
        if (client.cnpj && client.cnpj.toLowerCase().includes(raw)) return true
        if (clean && client.cpf && client.cpf.replace(/\D/g, '').includes(clean)) return true
        if (clean && client.cnpj && client.cnpj.replace(/\D/g, '').includes(clean)) return true
      }
      if (cm.subject && cm.subject.toLowerCase().includes(raw)) return true
      if (cm.recipient_email && cm.recipient_email.toLowerCase().includes(raw)) return true
      return false
    })
  }, [communications, search])

  return (
    <Card className="shadow-sm overflow-hidden border mt-6">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-base font-bold">Histórico Unificado de Comunicações</CardTitle>
        <Input
          placeholder="Filtrar histórico por Cliente, CPF ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 text-xs h-8 bg-white"
        />
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
