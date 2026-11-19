import { useState } from 'react'
import {
  Loader2,
  Play,
  Mail,
  Settings2,
  GraduationCap,
  Megaphone,
  History,
  Users,
  Search,
} from 'lucide-react'
import { DripClientHistoryDialog } from '@/components/comunicacao/DripClientHistoryDialog'
import { BirthdayEmailCard } from '@/components/comunicacao/BirthdayEmailCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  DripSequence,
  DripStep,
  DripSendLog,
  DRIP_RAMO_LABELS,
  updateDripSequence,
  runDripNow,
} from '@/services/drip-sequences'

interface DripTabProps {
  sequences: DripSequence[]
  logs: DripSendLog[]
  onRefresh: () => Promise<void> | void
}

export function DripSequencesTab({ sequences, logs, onRefresh }: DripTabProps) {
  const { toast } = useToast()
  const [editingStep, setEditingStep] = useState<{ seq: DripSequence; step: DripStep } | null>(null)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [historySeq, setHistorySeq] = useState<DripSequence | null>(null)
  const [clientHistoryOpen, setClientHistoryOpen] = useState(false)

  const enviadosMes = logs.filter(
    (l) =>
      l.status_envio === 'ENVIADO' &&
      l.data_envio &&
      l.data_envio.substring(0, 7) === new Date().toISOString().substring(0, 7),
  ).length

  const inscritosEstimados = sequences.filter((s) => s.ativo).length

  const handleToggleAtivo = async (sq: DripSequence, ativo: boolean) => {
    try {
      await updateDripSequence(sq.id, { ativo })
      await onRefresh()
      toast({
        title: ativo ? 'Sequência ativada' : 'Sequência pausada',
        description: ativo
          ? 'Os clientes começarão a receber os e-mails desta sequência.'
          : 'Nenhum novo e-mail desta sequência será enviado.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar sequência',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveIntervalo = async (sq: DripSequence, valor: number) => {
    if (valor < 1 || valor > 90) return
    try {
      await updateDripSequence(sq.id, { intervalo_dias: valor })
      await onRefresh()
    } catch {
      toast({ title: 'Erro ao salvar intervalo', variant: 'destructive' })
    }
  }

  const handleRunNow = async () => {
    setRunning(true)
    try {
      const result = await runDripNow()
      toast({
        title: result.success ? 'Disparo manual concluído' : 'Disparo com aviso',
        description: result.message,
      })
      await onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro no disparo',
        description: err?.message || 'Falha ao executar o disparo.',
        variant: 'destructive',
      })
    } finally {
      setRunning(false)
    }
  }

  const handleSaveStep = async () => {
    if (!editingStep) return
    setSaving(true)
    try {
      const novosPassos = editingStep.seq.passos.map((p) =>
        p.ordem === editingStep.step.ordem ? { ...editingStep.step } : p,
      )
      await updateDripSequence(editingStep.seq.id, { passos: novosPassos })
      setEditingStep(null)
      await onRefresh()
      toast({
        title: 'Passo atualizado!',
        description: 'Os próximos envios desta sequência usarão o novo texto.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar passo',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const seqLogs = historySeq ? logs.filter((l) => l.sequence === historySeq.id) : []

  const formatDateTime = (d: string) => {
    if (!d) return '-'
    try {
      return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return d
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-blue-600" /> Drip de E-mails por Ramo
              </CardTitle>
              <CardDescription>
                Sequência automática: 1 e-mail educativo, 1 oferta, 1 educativo... até converter em
                venda. Cada cliente ativo avança 1 passo por envio, com intervalo configurável.
                Cliente com apólice ativa no ramo não recebe oferta dele — o passo é pulado
                automaticamente.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={() => setClientHistoryOpen(true)}>
                <Search className="h-4 w-4 mr-2" /> Histórico por cliente
              </Button>
              <Button onClick={handleRunNow} disabled={running}>
                {running ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {running ? 'Enviando...' : 'Disparar agora'}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Users className="h-3 w-3 mr-1" /> {inscritosEstimados} sequências ativas
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {enviadosMes} e-mails enviados no mês
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <BirthdayEmailCard onRefresh={onRefresh} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sequences.map((sq) => {
          const enviadosMesSq = logs.filter(
            (l) =>
              l.sequence === sq.id &&
              l.status_envio === 'ENVIADO' &&
              l.data_envio &&
              l.data_envio.substring(0, 7) === new Date().toISOString().substring(0, 7),
          ).length
          return (
            <Card key={sq.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">{sq.nome}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{sq.ativo ? 'Ativa' : 'Pausada'}</span>
                    <Switch
                      checked={sq.ativo}
                      onCheckedChange={(v) => handleToggleAtivo(sq, v)}
                      aria-label={`Ativar/pausar sequência ${sq.nome}`}
                    />
                  </div>
                </div>
                <CardDescription>{sq.descricao}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {
                      logs.filter((l) => l.sequence === sq.id && l.status_envio === 'ENVIADO')
                        .length
                    }{' '}
                    enviados
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {enviadosMesSq} no mês
                  </Badge>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Label htmlFor={`intervalo-${sq.id}`} className="text-xs text-slate-500">
                      Intervalo:
                    </Label>
                    <Input
                      id={`intervalo-${sq.id}`}
                      type="number"
                      min={1}
                      max={90}
                      value={sq.intervalo_dias}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 7
                        handleSaveIntervalo(sq, v)
                      }}
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-xs text-slate-500">dias</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {(sq.passos || []).length === 0 && (
                    <p className="text-xs text-slate-400 italic">
                      Nenhum passo cadastrado nesta sequência.
                    </p>
                  )}
                  {(sq.passos || []).map((st) => (
                    <button
                      key={st.ordem}
                      type="button"
                      onClick={() => setEditingStep({ seq: sq, step: { ...st } })}
                      className="w-full text-left flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      <span className="font-mono text-[10px] text-slate-400 w-5">{st.ordem}.</span>
                      {st.tipo === 'educativo' ? (
                        <GraduationCap className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <Megaphone className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      )}
                      <span className="font-medium text-slate-700 shrink-0">
                        {st.tipo === 'oferta' ? 'Oferta' : 'Educativo'}
                      </span>
                      <span className="text-slate-500 truncate">{st.assunto}</span>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setHistorySeq(sq)}>
                    <History className="h-3.5 w-3.5 mr-1.5" /> Ver histórico
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {sequences.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Nenhuma sequência encontrada. As 6 sequências padrão (Viagem, Celular, Notebook, Auto,
            Residência e Saúde) são criadas automaticamente pelo sistema.
          </CardContent>
        </Card>
      )}

      {/* Editor de passo */}
      <Dialog open={!!editingStep} onOpenChange={(open) => !open && setEditingStep(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editingStep && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-blue-600" />
                  Editar Passo {editingStep.step.ordem} ·{' '}
                  {editingStep.step.tipo === 'educativo' ? 'Educativo' : 'Oferta'}
                </DialogTitle>
                <DialogDescription>
                  Variáveis disponíveis: <code>{'{nome}'}</code> (nome do cliente) e{' '}
                  <code>{'{primeiro_nome}'}</code>. São substituídas no envio.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="step-assunto">Assunto</Label>
                  <Input
                    id="step-assunto"
                    value={editingStep.step.assunto}
                    onChange={(e) =>
                      setEditingStep({
                        ...editingStep,
                        step: { ...editingStep.step, assunto: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-corpo">Corpo do e-mail</Label>
                  <Textarea
                    id="step-corpo"
                    value={editingStep.step.corpo}
                    onChange={(e) =>
                      setEditingStep({
                        ...editingStep,
                        step: { ...editingStep.step, corpo: e.target.value },
                      })
                    }
                    rows={10}
                  />
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">
                    Preview (variáveis substituídas por exemplo):
                  </p>
                  <p className="text-xs font-medium">
                    {editingStep.step.assunto
                      .split('{nome}')
                      .join('Maria')
                      .split('{primeiro_nome}')
                      .join('Maria')}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                    {editingStep.step.corpo
                      .split('{nome}')
                      .join('Maria')
                      .split('{primeiro_nome}')
                      .join('Maria')}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingStep(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveStep} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Salvar passo
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!historySeq} onOpenChange={(open) => !open && setHistorySeq(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Histórico: {historySeq?.nome}
            </DialogTitle>
            <DialogDescription>
              E-mails desta sequência enviados por cliente, em ordem cronológica.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Passo</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seqLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 text-sm py-6">
                    Nenhum e-mail enviado ainda nesta sequência.
                  </TableCell>
                </TableRow>
              )}
              {seqLogs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{formatDateTime(l.data_envio)}</TableCell>
                  <TableCell className="text-xs">
                    {l.expand?.client?.name || l.recipient_email}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.passo_ordem} · {l.tipo_mensagem === 'oferta' ? 'Oferta' : 'Educativo'}
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
        </DialogContent>
      </Dialog>

      {/* Histórico por cliente (todos os e-mails do drip, todas as sequências) */}
      <DripClientHistoryDialog
        open={clientHistoryOpen}
        onOpenChange={setClientHistoryOpen}
        sequences={sequences}
      />
    </div>
  )
}
