import { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
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
import { Card } from '@/components/ui/card'
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

export default function Seguradoras() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Seguradoras</h1>
          <p className="text-slate-500 text-sm">
            Cadastre seguradoras e configure o percentual de imposto.
          </p>
        </div>
        {can('seguradoras', 'create') && (
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setEditing(undefined)
              setFieldErrors({})
              setIsModalOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Seguradora
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <Input
          placeholder="Buscar por nome..."
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Nome</th>
                <th className="p-3.5">Imposto (%)</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-6 text-slate-500">
                    Nenhuma seguradora encontrada.
                  </td>
                </tr>
              ) : (
                paginated.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">{s.nome}</td>
                    <td className="p-3.5 font-bold text-blue-600">
                      {s.imposto_percentual != null ? `${s.imposto_percentual}%` : '-'}
                    </td>
                    <td className="p-3.5">
                      <div className="flex justify-end gap-1">
                        {can('seguradoras', 'update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              setEditing(s)
                              setFieldErrors({})
                              setIsModalOpen(true)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {can('seguradoras', 'delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
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
      </Card>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Exibindo {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} a{' '}
            {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} seguradoras
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
