import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, Layers, Search } from 'lucide-react'
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

export function CadastrosRamosTab() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [tipos, setTipos] = useState<TipoSeguro[]>([])
  const [search, setSearch] = useState('')
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
        toast({ title: 'Ramo de seguro atualizado!' })
      } else {
        await createTipoSeguro({ nome, ativo: true })
        toast({ title: 'Ramo de seguro cadastrado!' })
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
      toast({ title: 'Ramo de seguro excluído!' })
      setDeleteId(null)
      loadData()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const canManage = can('tipos_seguro', 'create')

  const filtered = tipos.filter((t) =>
    search ? t.nome.toLowerCase().includes(search.toLowerCase().trim()) : true,
  )

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">Ramos de Seguro</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Categorias gerais de proteção (ex: Auto, Vida, Saúde, Residencial, Empresarial). Ramo
              representa a linha de negócio do seguro.
            </CardDescription>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo Ramo
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar ramo por nome..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-sm text-slate-800">{t.nome}</span>
                  <Badge
                    variant={t.ativo ? 'default' : 'secondary'}
                    className={
                      t.ativo
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-xs'
                        : 'text-xs text-slate-500'
                    }
                  >
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={t.ativo}
                      onCheckedChange={() => handleToggle(t)}
                      aria-label="Ativar ou desativar ramo"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                      title="Editar ramo"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                      title="Excluir ramo"
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center text-sm text-slate-500 py-6 border rounded-lg bg-slate-50">
                Nenhum ramo de seguro encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(o) => {
          setIsDialogOpen(o)
          if (!o) setEditing(undefined)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Ramo' : 'Novo Ramo de Seguro'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Nome do Ramo *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Rural, Fiança Locatícia, Náutico, etc."
                className="mt-1"
              />
              {fieldErrors.nome && <p className="text-xs text-red-500 mt-1">{fieldErrors.nome}</p>}
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
              Tem certeza que deseja excluir este ramo de seguro? Esta ação não pode ser desfeita.
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
export default CadastrosRamosTab
