import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import {
  getCustosFixos,
  createCustoFixo,
  updateCustoFixo,
  deleteCustoFixo,
} from '@/services/custos-fixos'
import { CustoFixo } from '@/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CustoFixoFormDialog } from '@/components/CustoFixoFormDialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/pocketbase/errors'

type SortField = 'data' | 'valor'
type SortDir = 'asc' | 'desc'

const CATEGORIA_COLORS: Record<string, string> = {
  Contador: 'bg-blue-100 text-blue-800',
  Impostos: 'bg-red-100 text-red-800',
  Energia: 'bg-amber-100 text-amber-800',
  Aluguel: 'bg-purple-100 text-purple-800',
  Telecomunicação: 'bg-cyan-100 text-cyan-800',
  Marketing: 'bg-pink-100 text-pink-800',
  Outros: 'bg-slate-100 text-slate-800',
}

export default function CustosFixos() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [costs, setCosts] = useState<CustoFixo[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<CustoFixo> | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustoFixo | null>(null)
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const loadCosts = useCallback(async () => {
    try {
      const data = await getCustosFixos()
      setCosts(data)
    } catch {
      /* intentionally ignored */
    }
  }, [])

  useEffect(() => {
    loadCosts()
  }, [loadCosts])
  useRealtime('custos_fixos', () => loadCosts())

  const sortedCosts = [...costs].sort((a, b) => {
    const cmp =
      sortField === 'data'
        ? new Date(a.data).getTime() - new Date(b.data).getTime()
        : (a.valor || 0) - (b.valor || 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const handleCreate = async (formData: any) => {
    try {
      await createCustoFixo(formData)
      toast({ title: 'Custo fixo adicionado!' })
      setIsModalOpen(false)
      loadCosts()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleEditSubmit = async (formData: any) => {
    if (!editingItem?.id) return
    try {
      await updateCustoFixo(editingItem.id, formData)
      toast({ title: 'Custo fixo atualizado!' })
      setIsEditOpen(false)
      setEditingItem(null)
      loadCosts()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCustoFixo(deleteTarget.id)
      toast({ title: 'Custo fixo excluído!' })
      setDeleteTarget(null)
      loadCosts()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const total = costs.reduce((sum, c) => sum + (c.valor || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Custos Fixos</h1>
          <p className="text-slate-500 text-sm">Gerencie despesas mensais da corretora.</p>
        </div>
        {can('custos_fixos', 'create') && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Custo
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Card className="px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500">Total de Custos</p>
          <p className="text-lg font-bold text-slate-900">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <p className="text-sm text-slate-500">{costs.length} registros</p>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Descrição</th>
                <th
                  className="p-3.5 cursor-pointer select-none"
                  onClick={() => toggleSort('valor')}
                >
                  <span className="flex items-center gap-1">
                    Valor <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="p-3.5 cursor-pointer select-none" onClick={() => toggleSort('data')}>
                  <span className="flex items-center gap-1">
                    Data <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Observações</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-500">
                    Nenhum custo fixo cadastrado.
                  </td>
                </tr>
              ) : (
                sortedCosts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-medium">{c.descricao}</td>
                    <td className="p-3.5 font-bold">
                      R$ {(c.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5">{new Date(c.data).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3.5">
                      <Badge className={CATEGORIA_COLORS[c.categoria] || 'bg-slate-100'}>
                        {c.categoria}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">
                      {c.observacoes || '-'}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {can('custos_fixos', 'update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600"
                            onClick={() => {
                              setEditingItem(c)
                              setIsEditOpen(true)
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {can('custos_fixos', 'delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      <CustoFixoFormDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleCreate}
      />

      {editingItem && (
        <CustoFixoFormDialog
          open={isEditOpen}
          onOpenChange={(o) => {
            setIsEditOpen(o)
            if (!o) setEditingItem(null)
          }}
          onSubmit={handleEditSubmit}
          initialData={editingItem}
          title="Editar Custo Fixo"
        />
      )}

      {deleteTarget && (
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null)
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Deseja excluir &quot;{deleteTarget.descricao}&quot;?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
