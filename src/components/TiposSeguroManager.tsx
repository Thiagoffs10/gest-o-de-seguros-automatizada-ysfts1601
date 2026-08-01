import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getTiposSeguro,
  createTipoSeguro,
  updateTipoSeguro,
  deleteTipoSeguro,
} from '@/services/tipos-seguro'
import { TipoSeguro } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'

export function TiposSeguroManager() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [tipos, setTipos] = useState<TipoSeguro[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<TipoSeguro> | undefined>()
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const loadData = useCallback(async () => {
    try {
      const data = await getTiposSeguro()
      setTipos(data)
    } catch {
      /* ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('tipos_seguro', () => loadData())

  const openCreate = () => {
    setEditing(undefined)
    setNome('')
    setFieldErrors({})
    setIsDialogOpen(true)
  }

  const openEdit = (t: TipoSeguro) => {
    setEditing(t)
    setNome(t.nome)
    setFieldErrors({})
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing?.id) {
        await updateTipoSeguro(editing.id, { nome })
        toast({ title: 'Tipo de seguro atualizado!' })
      } else {
        await createTipoSeguro({ nome, ativo: true })
        toast({ title: 'Tipo de seguro cadastrado!' })
      }
      setIsDialogOpen(false)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (t: TipoSeguro) => {
    try {
      await updateTipoSeguro(t.id, { ativo: !t.ativo })
      loadData()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteTipoSeguro(deleteId)
      toast({ title: 'Tipo de seguro excluído!' })
      setDeleteId(null)
      loadData()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const canManage = can('tipos_seguro', 'create')

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold">Ramos de Seguro</CardTitle>
          <CardDescription>Gerencie os tipos de seguro disponíveis no sistema.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tipos.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-slate-800">{t.nome}</span>
                <Badge
                  variant={t.ativo ? 'default' : 'secondary'}
                  className={t.ativo ? 'bg-green-600' : ''}
                >
                  {t.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Switch checked={t.ativo} onCheckedChange={() => handleToggle(t)} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {tipos.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-4">Nenhum tipo cadastrado.</p>
          )}
        </div>
      </CardContent>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(o) => {
          setIsDialogOpen(o)
          if (!o) setEditing(undefined)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tipo' : 'Novo Tipo de Seguro'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Nome *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Rural, Fiança, etc."
              />
              {fieldErrors.nome && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.nome}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este tipo de seguro? Esta ação não pode ser desfeita.
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
    </Card>
  )
}
