import { useEffect, useState } from 'react'
import {
  Plus,
  CheckCircle,
  Trash2,
  CheckCheck,
  Mail,
  Pencil,
  Loader2,
  Send,
  Search,
  X,
  Cake,
  Users,
} from 'lucide-react'
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  completeAllPendingReminders,
} from '@/services/reminders'
import { getClients } from '@/services/clients'
import { sendSingleEmail, sendMonthlyBirthdaysEmail } from '@/services/communications'
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
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'completed'>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  // Estados para edição do lembrete
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [editFormData, setEditFormData] = useState({
    type: 'Renovação' as 'Renovação' | 'Aniversário' | 'Customizado',
    client: '',
    date: '',
    message: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Estados para envio rápido com confirmação/edição de assunto
  const [emailModalReminder, setEmailModalReminder] = useState<Reminder | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  // Estados para envio do lembrete agrupado de aniversariantes do mês
  const [groupBirthdayModalReminder, setGroupBirthdayModalReminder] = useState<Reminder | null>(
    null,
  )
  const [groupBirthdaySubject, setGroupBirthdaySubject] = useState(
    'Feliz aniversário, {nome_cliente}! 🎉',
  )
  const [groupBirthdayBody, setGroupBirthdayBody] = useState(
    'Olá, {nome_cliente}!\n\nDesejamos a você um feliz aniversário com muita saúde, paz e conquistas!\n\nAgradecemos pela parceria e por confiar na CRED10MIX para cuidar da sua proteção.\n\nAtenciosamente,\nEquipe CRED10MIX',
  )
  const [sendingGroupBirthdays, setSendingGroupBirthdays] = useState(false)

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

  const handleOpenEdit = (rem: Reminder) => {
    setEditingReminder(rem)
    setEditFormData({
      type: rem.type,
      client: rem.client || '',
      date: rem.date ? rem.date.split('T')[0] : new Date().toISOString().split('T')[0],
      message: rem.message || '',
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReminder) return
    setSavingEdit(true)
    try {
      await updateReminder(editingReminder.id, {
        type: editFormData.type,
        client: editFormData.client || undefined,
        date: editFormData.date,
        message: editFormData.message,
      })
      toast({ title: 'Lembrete atualizado com sucesso!' })
      setEditingReminder(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar lembrete',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const isGroupBirthdayReminder = (rem: Reminder) => {
    return (
      rem.type === 'Aniversário' &&
      (!rem.client || rem.client.trim() === '') &&
      (rem.message?.includes('Aniversariantes de') || !rem.client)
    )
  }

  const getTargetMonthForReminder = (rem: Reminder): number => {
    if (rem.date) {
      const d = new Date(rem.date)
      const rawMonth = rem.date.split('T')[0].split('-')[1]
      if (rawMonth) return parseInt(rawMonth, 10)
      return d.getUTCMonth() + 1
    }
    return new Date().getMonth() + 1
  }

  const getMonthClientsForReminder = (rem: Reminder): Client[] => {
    const month = getTargetMonthForReminder(rem)
    return clients.filter((c) => {
      if (!c.birth_date) return false
      let bMonth = -1
      const rawDateOnly = c.birth_date.split('T')[0].split(' ')[0]
      const parts = rawDateOnly.split('-')
      if (parts.length >= 2) {
        bMonth = parseInt(parts[1], 10)
      }
      if (bMonth === -1 || isNaN(bMonth)) {
        bMonth = new Date(c.birth_date).getUTCMonth() + 1
      }
      return bMonth === month
    })
  }

  const handleOpenEmailModal = (rem: Reminder) => {
    if (isGroupBirthdayReminder(rem)) {
      setGroupBirthdayModalReminder(rem)
      setGroupBirthdaySubject('Feliz aniversário, {nome_cliente}! 🎉')
      setGroupBirthdayBody(
        'Olá, {nome_cliente}!\n\nDesejamos a você um feliz aniversário com muita saúde, paz e conquistas!\n\nAgradecemos pela parceria e por confiar na CRED10MIX para cuidar da sua proteção.\n\nAtenciosamente,\nEquipe CRED10MIX',
      )
      return
    }

    const client = rem.expand?.client || clients.find((c) => c.id === rem.client)
    if (!client) {
      toast({
        title: 'Cliente não vinculado',
        description: 'Vincule um cliente a este lembrete antes de enviar e-mail.',
        variant: 'destructive',
      })
      return
    }
    if (!client.email || !client.email.trim()) {
      toast({
        title: 'Cliente sem e-mail',
        description: `O cliente ${client.name} não possui e-mail cadastrado.`,
        variant: 'destructive',
      })
      return
    }

    const clientFirstName = (client.name || '').trim().split(' ')[0] || ''
    const defaultSubject =
      rem.type === 'Renovação'
        ? `Sua apólice vence em breve`
        : rem.type === 'Aniversário'
          ? clientFirstName
            ? `Feliz aniversário, ${clientFirstName}! 🎉`
            : `Feliz aniversário! 🎉`
          : `Lembrete importante CRED10MIX`

    setEmailModalReminder(rem)
    setEmailSubject(defaultSubject)
    setEmailBody(rem.message || '')
  }

  const handleConfirmSendMonthlyBirthdays = async () => {
    if (!groupBirthdayModalReminder) return
    const rem = groupBirthdayModalReminder
    const month = getTargetMonthForReminder(rem)

    setSendingGroupBirthdays(true)
    try {
      const res = await sendMonthlyBirthdaysEmail({
        month,
        reminder_id: rem.id,
        subject: groupBirthdaySubject,
        body: groupBirthdayBody,
      })

      if (res.success) {
        toast({
          title: 'E-mails de aniversário enviados!',
          description: res.message,
        })
        setGroupBirthdayModalReminder(null)
        loadData()
      } else {
        toast({
          title: 'Falha no disparo',
          description: res.message || 'Erro ao enviar e-mails de aniversário.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro no envio',
        description: err?.message || 'Erro inesperado.',
        variant: 'destructive',
      })
    } finally {
      setSendingGroupBirthdays(false)
    }
  }

  const handleConfirmSendEmail = async () => {
    if (!emailModalReminder) return
    const rem = emailModalReminder
    const client = rem.expand?.client || clients.find((c) => c.id === rem.client)
    if (!client || !client.email) return

    setSendingEmailId(rem.id)
    try {
      const res = await sendSingleEmail({
        to: client.email,
        client_id: client.id,
        subject: emailSubject || 'Lembrete CRED10MIX',
        body: emailBody || rem.message || '',
      })

      if (res.success) {
        toast({
          title: 'E-mail enviado com sucesso!',
          description: `Enviado para ${client.email}`,
        })
        setEmailModalReminder(null)
        loadData()
      } else {
        toast({
          title: 'Falha no envio de e-mail',
          description: res.message || 'Verifique a configuração do serviço de e-mail.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar e-mail',
        description: err?.message || 'Erro inesperado.',
        variant: 'destructive',
      })
    } finally {
      setSendingEmailId(null)
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

  const filteredReminders = reminders.filter((r) => {
    if (statusFilter === 'pending' && r.sent) return false
    if (statusFilter === 'completed' && !r.sent) return false
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const clientName = r.expand?.client?.name || ''
      const msg = r.message || ''
      const typ = r.type || ''
      if (
        !clientName.toLowerCase().includes(q) &&
        !msg.toLowerCase().includes(q) &&
        !typ.toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredReminders.length / PAGE_SIZE))
  const paginatedReminders = filteredReminders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por cliente ou mensagem..."
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val: any) => {
            setStatusFilter(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="completed">Concluídos</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(val) => {
            setTypeFilter(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="Renovação">Renovação</SelectItem>
            <SelectItem value="Aniversário">Aniversário</SelectItem>
            <SelectItem value="Customizado">Customizado</SelectItem>
          </SelectContent>
        </Select>
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
              {filteredReminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-500">
                    Nenhum lembrete encontrado.
                  </td>
                </tr>
              ) : (
                paginatedReminders.map((r) => {
                  const isGroupBirthday = isGroupBirthdayReminder(r)
                  const monthClientsCount = isGroupBirthday
                    ? getMonthClientsForReminder(r).length
                    : 0

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 ${isGroupBirthday ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="p-3.5 font-bold text-blue-600">
                        <div className="flex items-center gap-1.5">
                          {isGroupBirthday && <Cake className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span>{r.type}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium">
                        {isGroupBirthday ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                            <Users className="w-3 h-3 text-amber-700" />
                            Todos do Mês ({monthClientsCount})
                          </span>
                        ) : (
                          r.expand?.client?.name || 'Geral'
                        )}
                      </td>
                      <td className="p-3.5">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3.5 max-w-xs truncate" title={r.message}>
                        {r.message}
                      </td>
                      <td className="p-3.5">
                        <Badge className={r.sent ? 'bg-slate-400' : 'bg-amber-500'}>
                          {r.sent ? 'Concluído' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão Enviar E-mail (Individual ou Todos do Mês com 1 clique) */}
                          {can('communications', 'create') && (
                            <Button
                              variant={isGroupBirthday && !r.sent ? 'default' : 'ghost'}
                              size="sm"
                              className={
                                isGroupBirthday && !r.sent
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm font-semibold'
                                  : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                              }
                              title={
                                isGroupBirthday
                                  ? 'Enviar e-mail de parabéns para todos os aniversariantes do mês'
                                  : 'Enviar e-mail para o cliente vinculado'
                              }
                              onClick={() => handleOpenEmailModal(r)}
                              disabled={sendingEmailId === r.id}
                            >
                              {sendingEmailId === r.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : isGroupBirthday ? (
                                <Cake className="w-4 h-4 mr-1" />
                              ) : (
                                <Mail className="w-4 h-4 mr-1" />
                              )}
                              <span>{isGroupBirthday ? 'Enviar para Todos' : 'Enviar e-mail'}</span>
                            </Button>
                          )}

                          {/* Botão Editar */}
                          {can('reminders', 'update') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              title="Editar mensagem ou dados do lembrete"
                              onClick={() => handleOpenEdit(r)}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              <span className="hidden md:inline">Editar</span>
                            </Button>
                          )}

                          {/* Botão Concluir / Reabrir */}
                          {can('reminders', 'update') && (
                            <Button variant="ghost" size="sm" onClick={() => handleToggleSent(r)}>
                              <CheckCircle
                                className={`w-4 h-4 mr-1 ${r.sent ? 'text-slate-400' : 'text-emerald-600'}`}
                              />
                              {r.sent ? 'Reabrir' : 'Concluir'}
                            </Button>
                          )}

                          {/* Botão Excluir */}
                          {can('reminders', 'delete') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              title="Excluir lembrete"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}{' '}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Exibindo {filteredReminders.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} a{' '}
            {Math.min(page * PAGE_SIZE, filteredReminders.length)} de {filteredReminders.length}{' '}
            lembretes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="font-semibold px-1">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Modal Criar Lembrete */}
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

      {/* Modal Editar Lembrete */}
      <Dialog open={!!editingReminder} onOpenChange={(open) => !open && setEditingReminder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lembrete</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-3 pt-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={editFormData.type}
                onValueChange={(val: any) => setEditFormData({ ...editFormData, type: val })}
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
                value={editFormData.client}
                onValueChange={(val) =>
                  setEditFormData({ ...editFormData, client: val === '_none' ? '' : val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (Lembrete Geral)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum (Lembrete Geral)</SelectItem>
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
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Mensagem / Observação</Label>
              <Textarea
                rows={4}
                value={editFormData.message}
                onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={savingEdit}
                onClick={() => setEditingReminder(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600" disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Enviar E-mail do Lembrete */}
      <Dialog
        open={!!emailModalReminder}
        onOpenChange={(open) => !open && setEmailModalReminder(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Enviar E-mail do Lembrete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1">
              <p>
                <strong>Destinatário:</strong>{' '}
                {emailModalReminder?.expand?.client?.name ||
                  clients.find((c) => c.id === emailModalReminder?.client)?.name ||
                  'Cliente'}
              </p>
              <p className="text-slate-600">
                <strong>E-mail:</strong>{' '}
                {emailModalReminder?.expand?.client?.email ||
                  clients.find((c) => c.id === emailModalReminder?.client)?.email ||
                  '—'}
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Assunto do E-mail</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Assunto da mensagem..."
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Mensagem (Corpo do E-mail)</Label>
              <Textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Corpo do e-mail..."
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={!!sendingEmailId}
              onClick={() => setEmailModalReminder(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!!sendingEmailId}
              onClick={handleConfirmSendEmail}
            >
              {sendingEmailId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar E-mail Agora
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Enviar E-mail Único para Todos os Aniversariantes do Mês */}
      <Dialog
        open={!!groupBirthdayModalReminder}
        onOpenChange={(open) => !open && setGroupBirthdayModalReminder(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Cake className="w-5 h-5 text-amber-500" />
              Enviar Parabéns para Aniversariantes do Mês
            </DialogTitle>
          </DialogHeader>

          {groupBirthdayModalReminder &&
            (() => {
              const monthClients = getMonthClientsForReminder(groupBirthdayModalReminder)
              const withEmailCount = monthClients.filter((c) => c.email && c.email.trim()).length
              const withoutEmailCount = monthClients.length - withEmailCount

              return (
                <div className="space-y-4 pt-1">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                    <p className="font-bold text-sm text-amber-950">
                      Prévia do Envio Agrupado ({monthClients.length} cliente
                      {monthClients.length !== 1 ? 's' : ''})
                    </p>
                    <p>
                      • <strong>{withEmailCount}</strong> cliente(s) com e-mail cadastrado receberão
                      a mensagem personalizada.
                    </p>
                    {withoutEmailCount > 0 && (
                      <p className="text-amber-700">
                        • <strong>{withoutEmailCount}</strong> cliente(s) não possuem e-mail e serão
                        ignorados com segurança.
                      </p>
                    )}
                    <p className="text-[11px] text-amber-800 pt-1 border-t border-amber-200/60 mt-1">
                      Remetente oficial: <strong>CRED10MIX &lt;noreply@cred10mix.com.br&gt;</strong>{' '}
                      (com rodapé oficial e link do WhatsApp).
                    </p>
                  </div>

                  <div className="max-h-36 overflow-y-auto border rounded p-2 bg-slate-50 text-xs space-y-1">
                    <p className="font-semibold text-slate-700 mb-1">Lista de Aniversariantes:</p>
                    {monthClients.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between py-0.5 border-b border-slate-200/60 last:border-0"
                      >
                        <span className="font-medium truncate max-w-[240px]">{c.name}</span>
                        <span
                          className={
                            c.email
                              ? 'text-slate-600 text-[11px]'
                              : 'text-amber-600 text-[11px] font-semibold'
                          }
                        >
                          {c.email || 'Sem e-mail'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Assunto do E-mail</Label>
                    <Input
                      value={groupBirthdaySubject}
                      onChange={(e) => setGroupBirthdaySubject(e.target.value)}
                      placeholder="Feliz aniversário, {nome_cliente}! 🎉"
                      className="mt-1 text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Variável disponível:{' '}
                      <code className="bg-slate-100 px-1 rounded">{'{nome_cliente}'}</code>
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Mensagem (Corpo do E-mail)</Label>
                    <Textarea
                      rows={4}
                      value={groupBirthdayBody}
                      onChange={(e) => setGroupBirthdayBody(e.target.value)}
                      placeholder="Corpo do e-mail..."
                      className="mt-1 text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      O rodapé oficial CRED10MIX com o link direto do WhatsApp é anexado
                      automaticamente.
                    </p>
                  </div>
                </div>
              )
            })()}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sendingGroupBirthdays}
              onClick={() => setGroupBirthdayModalReminder(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              disabled={sendingGroupBirthdays}
              onClick={handleConfirmSendMonthlyBirthdays}
            >
              {sendingGroupBirthdays ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disparando para Todos...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Confirmar e Enviar para Todos
                </>
              )}
            </Button>
          </DialogFooter>
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
