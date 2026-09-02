import { useState } from 'react'
import { Plus, Pencil, Trash2, Mail, Check, AlertCircle, FileText, Sparkles } from 'lucide-react'
import { EmailTemplate } from '@/types'
import {
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from '@/services/email-templates'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

interface Props {
  templates: EmailTemplate[]
  onTemplatesChange: () => void
}

export function EmailTemplatesManager({ templates, onTemplatesChange }: Props) {
  const { toast } = useToast()
  const { can } = usePermissions()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    type: 'Personalizado' as 'Aniversário' | 'Renovação' | 'Comercial' | 'Personalizado',
    subject: '',
    body: '',
  })

  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      type: 'Personalizado',
      subject: '',
      body: '',
    })
    setModalOpen(true)
  }

  const handleOpenEdit = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl)
    setFormData({
      name: tpl.name,
      type: tpl.type || 'Personalizado',
      subject: tpl.subject,
      body: tpl.body,
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha o nome do modelo, o assunto e o corpo da mensagem.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      if (editingTemplate) {
        await updateEmailTemplate(editingTemplate.id, {
          name: formData.name.trim(),
          type: formData.type,
          subject: formData.subject.trim(),
          body: formData.body.trim(),
        })
        toast({ title: 'Modelo de e-mail atualizado com sucesso!' })
      } else {
        await createEmailTemplate({
          name: formData.name.trim(),
          type: formData.type,
          subject: formData.subject.trim(),
          body: formData.body.trim(),
          is_system: false,
        })
        toast({ title: 'Novo modelo de e-mail salvo com sucesso!' })
      }
      setModalOpen(false)
      onTemplatesChange()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar modelo',
        description: err?.message || 'Verifique se já existe outro modelo com este mesmo nome.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteEmailTemplate(deleteTarget.id)
      toast({ title: 'Modelo de e-mail excluído!' })
      setDeleteTarget(null)
      onTemplatesChange()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir modelo',
        description: err?.message || 'Ocorreu um erro ao excluir o modelo.',
        variant: 'destructive',
      })
    }
  }

  const insertVariable = (varName: string) => {
    setFormData((prev) => ({
      ...prev,
      body: prev.body + varName,
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Modelos de Mensagens de E-mail
          </h2>
          <p className="text-xs text-slate-500">
            Crie, edite e personalize os modelos salvos para envio individual ou em campanhas em
            massa.
          </p>
        </div>
        {can('communications', 'create') && (
          <Button onClick={handleOpenCreate} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1.5" /> Criar Novo Modelo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <Card className="col-span-full border-dashed p-8 text-center text-slate-500">
            <p>Nenhum modelo cadastrado.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreate}
              className="mt-3 text-blue-600"
            >
              <Plus className="w-4 h-4 mr-1" /> Criar primeiro modelo
            </Button>
          </Card>
        ) : (
          templates.map((tpl) => (
            <Card
              key={tpl.id}
              className="flex flex-col justify-between hover:shadow-md transition-shadow border"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle
                      className="text-sm font-bold text-slate-900 truncate"
                      title={tpl.name}
                    >
                      {tpl.name}
                    </CardTitle>
                    <CardDescription className="text-xs truncate font-medium text-blue-600 mt-0.5">
                      Assunto: {tpl.subject}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      tpl.type === 'Aniversário'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : tpl.type === 'Renovação'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : tpl.type === 'Comercial'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {tpl.type || 'Geral'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
                <div className="bg-slate-50 p-2.5 rounded text-xs text-slate-600 line-clamp-4 whitespace-pre-line border border-slate-100 font-mono text-[11px]">
                  {tpl.body}
                </div>
                <div className="flex items-center justify-between pt-2 border-t text-xs text-slate-400">
                  <span>{tpl.is_system ? 'Padrão do Sistema' : 'Personalizado'}</span>
                  <div className="flex items-center gap-1">
                    {can('communications', 'update') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Editar modelo"
                        onClick={() => handleOpenEdit(tpl)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                    )}
                    {can('communications', 'delete') && !tpl.is_system && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Excluir modelo"
                        onClick={() => setDeleteTarget(tpl)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Criar / Editar Modelo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {editingTemplate ? 'Editar Modelo de E-mail' : 'Novo Modelo de E-mail'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Nome de Identificação *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Aniversário Especial 2026, Renovação Auto..."
                  className="mt-1 text-xs"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Categoria / Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: any) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aniversário">Aniversário</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Assunto do E-mail *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ex: Feliz aniversário, {nome_cliente}! 🎉 ou Apólice nº {numero_apolice}"
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Corpo da Mensagem *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Inserir tag:
                  </span>
                  <button
                    type="button"
                    onClick={() => insertVariable('{nome_cliente}')}
                    className="text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    {'{nome_cliente}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{numero_apolice}')}
                    className="text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    {'{numero_apolice}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{seguradora}')}
                    className="text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    {'{seguradora}'}
                  </button>
                </div>
              </div>
              <Textarea
                rows={7}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Digite o texto do e-mail..."
                className="text-xs leading-relaxed"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                O rodapé institucional oficial (site, Instagram e WhatsApp direto) é anexado
                automaticamente a todos os envios de e-mail.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving ? 'Salvando...' : editingTemplate ? 'Salvar Alterações' : 'Criar Modelo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão do modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir o modelo <strong>{deleteTarget?.name}</strong>? Esta ação não
              poderá ser desfeita.
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
    </div>
  )
}
