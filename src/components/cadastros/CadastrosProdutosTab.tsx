import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, Package, Search, Filter } from 'lucide-react'
import {
  getProdutos,
  createProduto,
  updateProduto,
  deleteProduto,
  CreateProdutoPayload,
} from '@/services/produtos'
import { getSeguradoras } from '@/services/seguradoras'
import { getTiposSeguro } from '@/services/tipos-seguro'
import { Produto, Seguradora, TipoSeguro } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'

export function CadastrosProdutosTab() {
  const { toast } = useToast()
  const { can } = usePermissions()

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [ramos, setRamos] = useState<TipoSeguro[]>([])
  const [search, setSearch] = useState('')
  const [filterSeguradora, setFilterSeguradora] = useState('ALL')
  const [filterRamo, setFilterRamo] = useState('ALL')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // Form state
  const [nome, setNome] = useState('')
  const [seguradoraId, setSeguradoraId] = useState('')
  const [ramoId, setRamoId] = useState('')
  const [codigoComercial, setCodigoComercial] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [prods, segs, rms] = await Promise.all([
        getProdutos(),
        getSeguradoras(),
        getTiposSeguro(),
      ])
      setProdutos(prods)
      setSeguradoras(segs)
      setRamos(rms)
    } catch {
      /* ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('produtos', () => loadData())
  useRealtime('seguradoras', () => loadData())
  useRealtime('tipos_seguro', () => loadData())

  const openCreate = () => {
    setEditing(null)
    setNome('')
    setSeguradoraId('')
    setRamoId('')
    setCodigoComercial('')
    setDescricao('')
    setAtivo(true)
    setFieldErrors({})
    setIsDialogOpen(true)
  }

  const openEdit = (p: Produto) => {
    setEditing(p)
    setNome(p.nome)
    setSeguradoraId(p.seguradora || '')
    setRamoId(p.ramo || '')
    setCodigoComercial(p.codigo_comercial || '')
    setDescricao(p.descricao || '')
    setAtivo(p.ativo !== false)
    setFieldErrors({})
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setFieldErrors({ nome: 'Nome do produto é obrigatório' })
      return
    }

    setLoading(true)
    const payload: CreateProdutoPayload = {
      nome: nome.trim(),
      seguradora: seguradoraId || null,
      ramo: ramoId || null,
      codigo_comercial: codigoComercial.trim(),
      descricao: descricao.trim(),
      ativo,
    }

    try {
      if (editing?.id) {
        await updateProduto(editing.id, payload)
        toast({ title: 'Produto atualizado com sucesso!' })
      } else {
        await createProduto(payload)
        toast({ title: 'Produto cadastrado com sucesso!' })
      }
      setIsDialogOpen(false)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (p: Produto) => {
    try {
      await updateProduto(p.id, { ativo: !p.ativo })
      loadData()
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteProduto(deleteId)
      toast({ title: 'Produto excluído com sucesso!' })
      setDeleteId(null)
      loadData()
    } catch (err) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const canManage = can('produtos', 'create')
  const canUpdate = can('produtos', 'update')
  const canDelete = can('produtos', 'delete')

  const filtered = produtos.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      const matchNome = p.nome.toLowerCase().includes(q)
      const matchCodigo = p.codigo_comercial?.toLowerCase().includes(q)
      const matchSeg = p.expand?.seguradora?.nome?.toLowerCase().includes(q)
      const matchRamo = p.expand?.ramo?.nome?.toLowerCase().includes(q)
      if (!matchNome && !matchCodigo && !matchSeg && !matchRamo) return false
    }
    if (filterSeguradora !== 'ALL' && p.seguradora !== filterSeguradora) return false
    if (filterRamo !== 'ALL' && p.ramo !== filterRamo) return false
    return true
  })

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">
                Produtos Comerciais
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Produtos comerciais específicos de cada seguradora (ex: Ramo = <em>Vida</em> / Produto
              = <em>Vida Mais Simples - Bradesco</em>). Permite associar produto a ramo e seguradora
              para sugestão automática de modelos.
            </CardDescription>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo Produto
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {/* Filtros rápidos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar produto por nome ou código..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterSeguradora} onValueChange={setFilterSeguradora}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Todas as Seguradoras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Seguradoras</SelectItem>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRamo} onValueChange={setFilterRamo}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Todos os Ramos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Ramos</SelectItem>
                  {ramos.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">Produto Comercial</th>
                  <th className="p-3">Seguradora</th>
                  <th className="p-3">Ramo</th>
                  <th className="p-3">Código</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-6 text-slate-500 text-sm">
                      Nenhum produto comercial encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const segNome =
                      p.expand?.seguradora?.nome ||
                      seguradoras.find((s) => s.id === p.seguradora)?.nome ||
                      'Todas'
                    const ramoNome =
                      p.expand?.ramo?.nome ||
                      ramos.find((r) => r.id === p.ramo)?.nome ||
                      'Geral / Todos'

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{p.nome}</div>
                          {p.descricao && (
                            <div className="text-xs text-slate-500 line-clamp-1">{p.descricao}</div>
                          )}
                        </td>
                        <td className="p-3 text-xs font-medium text-slate-700">{segNome}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs font-normal">
                            {ramoNome}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-slate-500 font-mono">
                          {p.codigo_comercial || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={p.ativo ? 'default' : 'secondary'}
                            className={
                              p.ativo
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-xs'
                                : 'text-xs text-slate-500'
                            }
                          >
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end items-center gap-1">
                            {canUpdate && (
                              <Switch
                                checked={p.ativo}
                                onCheckedChange={() => handleToggle(p)}
                                className="mr-1"
                                aria-label="Ativar/desativar produto"
                              />
                            )}
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                                title="Editar produto"
                                onClick={() => openEdit(p)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                                title="Excluir produto"
                                onClick={() => setDeleteId(p.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de cadastro/edição de Produto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar Produto Comercial' : 'Novo Produto Comercial'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div>
              <Label className="text-xs font-semibold">Nome do Produto Comercial *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Vida Viva Mais, Auto Fácil, Seguro Residencial Protegido..."
                className="mt-1"
              />
              {fieldErrors.nome && <p className="text-xs text-red-500 mt-1">{fieldErrors.nome}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Seguradora</Label>
                <Select
                  value={seguradoraId || 'none'}
                  onValueChange={(v) => setSeguradoraId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Todas / Sem vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas / Sem vínculo</SelectItem>
                    {seguradoras.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Ramo de Seguro</Label>
                <Select
                  value={ramoId || 'none'}
                  onValueChange={(v) => setRamoId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Todos os Ramos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os Ramos</SelectItem>
                    {ramos.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Código Comercial / Interno (opcional)</Label>
              <Input
                value={codigoComercial}
                onChange={(e) => setCodigoComercial(e.target.value)}
                placeholder="Ex: PR-0192, BRD-VIDA-01"
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Descrição / Observações</Label>
              <Textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Diferenciais do produto, regras específicas de subscrição..."
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="prod-ativo" className="text-xs font-medium cursor-pointer">
                Produto Ativo para Comercialização
              </Label>
              <Switch id="prod-ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <DialogFooter className="pt-2">
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
              Tem certeza que deseja excluir este produto comercial? Esta ação não pode ser
              desfeita.
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
export default CadastrosProdutosTab
