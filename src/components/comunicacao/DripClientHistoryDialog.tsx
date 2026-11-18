import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Client } from '@/types'
import { DripSequence, DripSendLog, DRIP_RAMO_LABELS, getDripLogs } from '@/services/drip-sequences'
import { getClients } from '@/services/clients'

interface DripClientHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sequências existentes: fornece o nome de cada uma no resultado. */
  sequences: DripSequence[]
}

/**
 * Histórico por CLIENTE: busca por nome ou e-mail e lista TODOS os e-mails
 * do drip que aquele cliente já recebeu, cronologicamente, independente
 * da sequência. O isolamento por organização é aplicado no serviço
 * (withOrgFilter) e também no servidor (tenant_isolation).
 */
export function DripClientHistoryDialog({
  open,
  onOpenChange,
  sequences,
}: DripClientHistoryDialogProps) {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [logs, setLogs] = useState<DripSendLog[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const seqNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of sequences) map[s.id] = s.nome
    return map
  }, [sequences])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setLogs([])
      setError('')
    }
  }, [open])

  // Carrega a lista de clientes UMA vez ao abrir (já vem com withOrgFilter
  // do serviço getClients — o parceiro só busca entre os clientes dele).
  useEffect(() => {
    if (!open) return
    let active = true
    setLoadingClients(true)
    getClients()
      .then((res) => {
        if (!active) return
        setClients(res)
        setLoadingClients(false)
      })
      .catch(() => {
        if (active) setLoadingClients(false)
      })
    return () => {
      active = false
    }
  }, [open])

  // O recorte por cliente é local (a lista já vem isolada por organização).
  const matchingClients = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return clients.filter(
      (c) => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q),
    )
  }, [clients, query])

  // Ao digitar, busca os logs do(s) cliente(s) correspondente(s) no servidor.
  // O serviço getDripLogs já aplica withOrgFilter (isolamento por organização).
  useEffect(() => {
    let active = true
    const q = query.trim()
    if (!q || matchingClients.length === 0) {
      setLogs([])
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    const ids = matchingClients.map((c) => c.id)
    // PocketBase: || tem precedência menor que && — agrupar o OR é obrigatório.
    const clientClause = `(${ids.map((id) => `client = "${id}"`).join(' || ')})`
    getDripLogs(clientClause)
      .then((res) => {
        if (!active) return
        setLogs(res)
        setLoading(false)
      })
      .catch((err: any) => {
        if (!active) return
        setError(err?.message || 'Falha ao carregar o histórico.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, matchingClients])

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name || 'Cliente'

  const ramoLabel = (ramo: string) =>
    DRIP_RAMO_LABELS[ramo] || (ramo ? ramo.charAt(0).toUpperCase() + ramo.slice(1) : '-')

  const formatDateTime = (d: string) => {
    if (!d) return '-'
    try {
      return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return d
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico por cliente</DialogTitle>
          <DialogDescription>
            Busque pelo nome ou e-mail do cliente para ver todos os e-mails do drip que ele já
            recebeu, em ordem cronológica, de todas as sequências.
          </DialogDescription>
        </DialogHeader>

        {loadingClients && (
          <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando clientes...
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente por nome ou e-mail..."
            className="pl-9 pr-8"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!query.trim() && (
          <p className="text-sm text-slate-500 py-6 text-center">
            Digite o nome ou o e-mail do cliente para começar.
          </p>
        )}

        {query.trim() && !loading && matchingClients.length === 0 && !error && (
          <p className="text-sm text-slate-500 py-6 text-center">
            Nenhum cliente encontrado com esse nome ou e-mail.
          </p>
        )}

        {error && <p className="text-sm text-red-600 py-2">{error}</p>}

        {loading && (
          <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando histórico...
          </div>
        )}

        {!loading && matchingClients.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {matchingClients.slice(0, 5).map((c) => (
                <Badge
                  key={c.id}
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  {c.name}
                </Badge>
              ))}
              {matchingClients.length > 5 && (
                <span className="text-xs text-slate-400">
                  +{matchingClients.length - 5} clientes
                </span>
              )}
            </div>

            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Nenhum e-mail do drip enviado ainda para este(s) cliente(s).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sequência</TableHead>
                    <TableHead>Passo</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateTime(l.data_envio)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.expand?.client?.name || clientName(l.client)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.expand?.sequence?.nome || seqNames[l.sequence] || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.passo_ordem} · {ramoLabel(l.ramo)} ·{' '}
                        {l.tipo_mensagem === 'oferta' ? 'Oferta' : 'Educativo'}
                      </TableCell>
                      <TableCell className="text-xs">{l.assunto}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            l.status_envio === 'ENVIADO'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {l.status_envio}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
