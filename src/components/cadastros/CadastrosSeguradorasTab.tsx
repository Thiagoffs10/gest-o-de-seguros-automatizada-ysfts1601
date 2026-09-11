import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, Building2, HelpCircle } from 'lucide-react'
import {
  getSeguradoras,
  createSeguradora,
  updateSeguradora,
  deleteSeguradora,
} from '@/services/seguradoras'
import { getPolicies } from '@/services/policies'
import { Seguradora } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { SeguradoraFormDialog } from '@/components/SeguradoraFormDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function CadastrosSeguradorasTab() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Seguradora> | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const loadData = useCallback(async () => {
    try {
      const data = await getSeguradoras()
      setSeguradoras(data)
    } catch {
      /* ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('seguradoras', () => loadData())

  const filtered = seguradoras.filter((s) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return s.nome && s.nome.toLowerCase().includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleCreate = async (formData: any) => {
    try {
      await createSeguradora(formData)
      toast({ title: 'Seguradora cadastrada com sucesso!' })
      setIsModalOpen(false)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao cadastrar',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleEdit = async (formData: any) => {
    if (!editing?.id) return
    try {
      await updateSeguradora(editing.id, formData)
      toast({ title: 'Seguradora atualizada!' })
      setIsModalOpen(false)
      setEditing(undefined)
      setFieldErrors({})
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao atualizar',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const linkedPolicies = await getPolicies(`seguradora = "${deleteId}"`)
      if (linkedPolicies.length > 0) {
        toast({
          title: 'Não é possível excluir: existem apólices vinculadas a esta seguradora.',
          variant: 'destructive',
        })
        setDeleteId(null)
        return
      }
      await deleteSeguradora(deleteId)
      toast({ title: 'Seguradora excluída!' })
      setDeleteId(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const canCreate = can('seguradoras', 'create')
  const canUpdate = can('seguradoras', 'update')
  const canDelete = can('seguradoras', 'delete')

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">
                Seguradoras e Companhias
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Cadastro principal das companhias seguradoras. O imposto (ISS) cadastrado é aplicado
              no cálculo automático de comissão líquida das apólices.
            </CardDescription>
          </div>
          {canCreate && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={() => {
                setEditing(undefined)
                setFieldErrors({})
                setIsModalOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nova Seguradora
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar seguradora por nome..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">Seguradora</th>
                  <th className="p-3">
                    <div className="flex items-center gap-1">
                      <span>Alíquota de ISS / Imposto (%)</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Percentual de imposto retido na fonte pela seguradora
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center p-6 text-slate-500 text-sm">
                      Nenhuma seguradora cadastrada ou encontrada para o filtro.
                    </td>
                  </tr>
                ) : (
                  paginated.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">{s.nome}</td>
                      <td className="p-3 font-semibold text-blue-600">
                        {s.imposto_percentual != null ? `${s.imposto_percentual}%` : '0%'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              title="Editar seguradora"
                              onClick={() => {
                                setEditing(s)
                                setFieldErrors({})
                                setIsModalOpen(true)
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                              title="Excluir seguradora"
                              onClick={() => setDeleteId(s.id)}
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

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 pt-2">
              <span>
                Exibindo {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} a{' '}
                {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} seguradoras
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span className="font-semibold px-1">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SeguradoraFormDialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) {
            setEditing(undefined)
            setFieldErrors({})
          }
        }}
        onSubmit={editing ? handleEdit : handleCreate}
        initialData={editing}
        title={editing ? 'Editar Seguradora' : 'Nova Seguradora'}
        fieldErrors={fieldErrors}
        submitLabel={editing ? 'Salvar Alterações' : 'Cadastrar'}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta seguradora? Esta ação não pode ser desfeita.
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
export default CadastrosSeguradorasTab
