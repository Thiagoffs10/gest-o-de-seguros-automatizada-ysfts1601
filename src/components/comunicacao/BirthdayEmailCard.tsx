import { useEffect, useMemo, useState } from 'react'
import { Cake, Eye, History, Loader2, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { getClients } from '@/services/clients'
import {
  BirthdayConfig,
  BirthdayLog,
  BIRTHDAY_DEFAULT_ASSUNTO,
  BIRTHDAY_DEFAULT_CORPO,
  getBirthdayConfig,
  getBirthdayLogs,
  updateBirthdayConfig,
} from '@/services/drip-sequences'

/** Extrai o par MM-DD de uma data (aceita 'YYYY-MM-DD...' ou timestamps PB). */
function bdayMMDD(birthDate?: string): string {
  const raw = (birthDate || '').trim()
  if (!raw) return ''
  const datePart = raw.split('T')[0].split(' ')[0]
  const parts = datePart.split('-')
  if (parts.length < 3) return ''
  const mm = String(parseInt(parts[1], 10) || 0).padStart(2, '0')
  const dd = String(parseInt(parts[2], 10) || 0).padStart(2, '0')
  if (mm === '00' || dd === '00' || mm === 'NaN' || dd === 'NaN') return ''
  return mm + '-' + dd
}

function applyVars(text: string, nome: string): string {
  const primeiro = nome.split(' ')[0] || nome
  return String(text || '')
    .split('{nome}')
    .join(nome)
    .split('{primeiro_nome}')
    .join(primeiro)
}

interface BirthdayCardProps {
  /** Recarrega os dados da aba (o pai já busca clients). */
  onRefresh?: () => Promise<void> | void
}

export function BirthdayEmailCard({ onRefresh }: BirthdayCardProps) {
  const { toast } = useToast()
  const [config, setConfig] = useState<BirthdayConfig | null>(null)
  const [assunto, setAssunto] = useState(BIRTHDAY_DEFAULT_ASSUNTO)
  const [corpo, setCorpo] = useState(BIRTHDAY_DEFAULT_CORPO)
  const [ativo, setAtivo] = useState(true)
  const [logs, setLogs] = useState<BirthdayLog[]>([])
  const [aniversariantes, setAniversariantes] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [cfg, bdayLogs, clients] = await Promise.all([
          getBirthdayConfig().catch(() => null),
          getBirthdayLogs().catch(() => []),
          getClients(),
        ])
        if (cancelled) return
        setConfig(cfg)
        setAssunto(cfg?.assunto || BIRTHDAY_DEFAULT_ASSUNTO)
        setCorpo(cfg?.corpo || BIRTHDAY_DEFAULT_CORPO)
        setAtivo(cfg ? cfg.ativo !== false : true)
        setLogs(bdayLogs)

        // Aniversariantes de hoje: clientes ativos da organização
        // (getClients já vem filtrado pela organização do usuário) com
        // dia+mês de birth_date = hoje. Mesma regra do hook birthday_emails.js.
        const hoje = new Date()
        const mmddHoje =
          String(hoje.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(hoje.getDate()).padStart(2, '0')
        setAniversariantes(
          clients
            .filter((c) => bdayMMDD(c.birth_date) === mmddHoje)
            .map((c) => ({ id: c.id, name: c.name })),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const recentLogs = useMemo(() => logs.slice(0, 5), [logs])

  const handleToggleAtivo = async (novoAtivo: boolean) => {
    setAtivo(novoAtivo)
    try {
      const updated = await updateBirthdayConfig({ ativo: novoAtivo, assunto, corpo }, config)
      setConfig(updated)
      toast({
        title: novoAtivo ? 'E-mail de aniversário ativado' : 'E-mail de aniversário pausado',
        description: novoAtivo
          ? 'Os aniversariantes do dia receberão a mensagem no disparo diário.'
          : 'Nenhum e-mail de aniversário será enviado.',
      })
      if (onRefresh) await onRefresh()
    } catch (err: any) {
      setAtivo(!novoAtivo)
      toast({
        title: 'Erro ao atualizar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateBirthdayConfig({ assunto, corpo, ativo }, config)
      setConfig(updated)
      toast({
        title: 'Mensagem salva!',
        description: 'O próximo disparo diário usará o novo texto.',
      })
      if (onRefresh) await onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar mensagem',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (d: string) => {
    if (!d) return '-'
    try {
      return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return d
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-600" /> E-mail de Aniversário
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{ativo ? 'Ativo' : 'Pausado'}</span>
            <Switch
              checked={ativo}
              onCheckedChange={handleToggleAtivo}
              aria-label="Ativar/pausar e-mail de aniversário"
            />
          </div>
        </div>
        <CardDescription>
          Envia automaticamente um e-mail de felicitação para os aniversariantes do dia, no disparo
          diário das 09:10 (antes do drip, mesmo teto de 100 e-mails/dia). Um envio por cliente por
          ano.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
            {aniversariantes.length}{' '}
            {aniversariantes.length === 1 ? 'aniversariante hoje' : 'aniversariantes hoje'}
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {logs.filter((l) => l.status_envio === 'ENVIADO').length} enviados
          </Badge>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bday-assunto">Assunto</Label>
          <Input
            id="bday-assunto"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Feliz aniversário, {primeiro_nome}! 🎉"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bday-corpo">Corpo do e-mail</Label>
          <Textarea
            id="bday-corpo"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={8}
            placeholder="Olá, {primeiro_nome}!..."
          />
          <p className="text-xs text-slate-500">
            Variáveis disponíveis: <code>{'{nome}'}</code> (nome completo) e{' '}
            <code>{'{primeiro_nome}'}</code>. São substituídas no envio.
          </p>
        </div>

        <details className="rounded-md border bg-slate-50 p-3">
          <summary className="text-xs font-semibold text-slate-600 cursor-pointer flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview (variáveis substituídas por exemplo)
          </summary>
          <p className="text-xs font-medium mt-2">{applyVars(assunto, 'Maria Souza')}</p>
          <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
            {applyVars(corpo, 'Maria Souza')}
          </p>
        </details>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-slate-500">
            Remetente fixo do sistema: <span className="font-medium">cred10mix.com.br</span>
          </p>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>

        <div className="rounded-md border">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-slate-50/60">
            <History className="h-3.5 w-3.5 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600">Últimos envios</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-xs text-slate-400 italic px-3 py-4">
              Nenhum e-mail de aniversário enviado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{formatDateTime(l.data_envio)}</TableCell>
                    <TableCell className="text-xs">
                      {l.expand?.client?.name || l.recipient_email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          l.status_envio === 'ENVIADO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }
                      >
                        {l.status_envio === 'ENVIADO' ? 'Enviado' : 'Falhou'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
