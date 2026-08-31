import { useEffect, useState } from 'react'
import { Plus, CheckCircle, Trash2, CheckCheck } from 'lucide-react'
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  completeAllPendingReminders,
} from '@/services/reminders'
import { getClients } from '@/services/clients'
import { Reminder, Client } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function RemindersPage() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [completeAllOpen, setCompleteAllOpen] = useState(false)
  const [completingAll, setCompletingAll] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    type: 'Renovação' as const,
    client: '',
    date: new Date().toISOString().split('T')[0],
    message: '',
  })

  const loadData = async () => {
    try {
      const [cls, rems] = await Promise.all([getClients(), getReminders()])
      setClients(cls)
      setReminders(rems)
    } catch {
      /* intentionally ignored */
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('reminders', () => loadData())

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createReminder({ ...formData, sent: false })
      toast({ title: 'Lembrete agendado com sucesso!' })
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao agendar lembrete', description: err.message, variant: 'destructive' })
    }
  }

  const handleToggleSent = async (rem: Reminder) => {
    try {
      await updateReminder(rem.id, { sent: !rem.sent })
      loadData()
    } catch {
      /* intentionally ignored */
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteReminder(deleteTarget.id)
      toast({ title: 'Lembrete excluído!' })
      setDeleteTarget(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const handleCompleteAll = async () => {
    setCompletingAll(true)
    try {
      const count = await completeAllPendingReminders()
      toast({
        title: 'Lembretes baixados com sucesso!',
        description: `${count} lembrete(s) marcado(s) como concluído(s).`,
      })
      setCompleteAllOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao baixar lembretes',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCompletingAll(false)
    }
  }

  const pendingCount = reminders.filter((r) => !r.sent).length

  if (loading)
    return <div className="text-slate-500 py-8 text-center">Carregando informações...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Lembretes</h1>
          <p className="text-slate-500 text-sm">
            Alertas automáticos de renovações e datas importantes. {pendingCount} pendente(s).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('reminders', 'update') && pendingCount > 0 && (
            <Button
              variant="outline"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={() => setCompleteAllOpen(true)}
            >
              <CheckCheck className="w-4 h-4 mr-2" /> Baixar todos ({pendingCount})
            </Button>
          )}
          {can('reminders', 'create') && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Criar Lembrete
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Data Programada</th>
                <th className="p-3.5">Mensagem / Observação</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-500">
                    Nenhum lembrete cadastrado.
                  </td>
                </tr>
              ) : (
                reminders.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-blue-600">{r.type}</td>
                    <td className="p-3.5 font-medium">{r.expand?.client?.name || 'Geral'}</td>
                    <td className="p-3.5">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3.5 max-w-xs truncate">{r.message}</td>
                    <td className="p-3.5">
                      <Badge className={r.sent ? 'bg-slate-400' : 'bg-amber-500'}>
                        {r.sent ? 'Concluído' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can('reminders', 'update') && (
                          <Button variant="ghost" size="sm" onClick={() => handleToggleSent(r)}>
                            <CheckCircle
                              className={`w-4 h-4 mr-1 ${r.sent ? 'text-slate-400' : 'text-emerald-600'}`}
                            />
                            {r.sent ? 'Reabrir' : 'Concluir'}
                          </Button>
                        )}
                        {can('reminders', 'delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Lembrete</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(val: any) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Renovação">Renovação</SelectItem>
                  <SelectItem value="Aniversário">Aniversário</SelectItem>
                  <SelectItem value="Customizado">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente Vinculado (opcional)</Label>
              <Select
                value={formData.client}
                onValueChange={(val) => setFormData({ ...formData, client: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (Lembrete Geral)" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do Lembrete</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Mensagem / Detalhes</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600">
                Agendar Lembrete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir este lembrete? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={completeAllOpen} onOpenChange={setCompleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Baixar todos os lembretes pendentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar{' '}
              <strong>todos os {pendingCount} lembretes pendentes</strong> como concluídos/baixados
              de uma única vez?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleCompleteAll}
              disabled={completingAll}
            >
              {completingAll ? 'Baixando...' : 'Confirmar e Baixar Todos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
