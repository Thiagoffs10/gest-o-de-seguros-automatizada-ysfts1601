import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { getParceiros, createParceiro, updateParceiro, deleteParceiro } from '@/services/parceiros'
import { Parceiro } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PartnerFormDialog } from '@/components/PartnerFormDialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/pocketbase/errors'
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

const PAGE_SIZE = 10

export default function Parceiros() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { can } = usePermissions()
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Parceiro> | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const loadData = useCallback(async () => {
    try {
      const data = await getParceiros()
      setParceiros(data)
    } catch {
      /* ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('parceiros', () => loadData())

  const filtered = parceiros.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.nome?.toLowerCase().includes(q) || p.cpf?.toLowerCase().includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleCreate = async (formData: any) => {
    try {
      await createParceiro(formData)
      toast({ title: 'Parceiro cadastrado com sucesso!' })
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
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
      await updateParceiro(editing.id, formData)
      toast({ title: 'Parceiro atualizado!' })
      setIsModalOpen(false)
      setEditing(undefined)
      loadData()
    } catch (err: any) {
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
      await deleteParceiro(deleteId)
      toast({ title: 'Parceiro excluído!' })
      setDeleteId(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Parceiros</h1>
          <p className="text-slate-500 text-sm">Cadastre e gerencie parceiros e indicadores.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/relatorio-comissoes')}>
            <FileBarChart className="w-4 h-4 mr-2" /> Relatório de Comissões
          </Button>
          {can('parceiros', 'create') && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setEditing(undefined)
                setIsModalOpen(true)
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" /> Novo Parceiro
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <Input
          placeholder="Buscar por nome ou documento..."
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
                <th className="p-3.5">Cód.</th>
                <th className="p-3.5">Nome</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Documento</th>
                <th className="p-3.5">Telefone</th>
                <th className="p-3.5">E-mail</th>
                <th className="p-3.5">Dados Bancários / PIX</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-6 text-slate-500">
                    Nenhum parceiro encontrado.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-blue-600">
                      {p.partner_code ? `#${p.partner_code}` : '-'}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">{p.nome}</td>
                    <td className="p-3.5 text-slate-600">{p.tipo_documento || 'CPF'}</td>
                    <td className="p-3.5 text-slate-600">{p.cpf || '-'}</td>
                    <td className="p-3.5 text-slate-600">{p.telefone || '-'}</td>
                    <td className="p-3.5 text-slate-600">{p.email || '-'}</td>
                    <td className="p-3.5 text-slate-500">{p.dados_bancarios_ou_pix || '-'}</td>
                    <td className="p-3.5">
                      <div className="flex justify-end gap-1">
                        {can('parceiros', 'update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              setEditing(p)
                              setIsModalOpen(true)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {can('parceiros', 'delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => setDeleteId(p.id)}
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
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <PartnerFormDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={editing ? handleEdit : handleCreate}
        initialData={editing}
        title={editing ? 'Editar Parceiro' : 'Novo Parceiro'}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este parceiro? Esta ação não pode ser desfeita.
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
