import { useState, useEffect } from 'react'
import { Layers, Plus, Edit2, Trash2, HelpCircle, Building2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
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
import { ModeloComissao, Seguradora, TipoSeguro } from '@/types'
import { getModelosComissao, deleteModeloComissao } from '@/services/modelos-comissao'
import { getSeguradoras } from '@/services/seguradoras'
import { getTiposSeguro } from '@/services/tipos-seguro'
import { getProdutos } from '@/services/produtos'
import { Produto } from '@/types'
import { ModeloComissaoFormDialog } from '@/components/ModeloComissaoFormDialog'
import { useToast } from '@/hooks/use-toast'
import { formatDateDisplay } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function CadastrosModelosRecebimentoTab() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [modelos, setModelos] = useState<ModeloComissao[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [tiposSeguro, setTiposSeguro] = useState<TipoSeguro[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModelo, setEditingModelo] = useState<ModeloComissao | null>(null)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [mods, segs, tips, prods] = await Promise.all([
        getModelosComissao(),
        getSeguradoras(),
        getTiposSeguro(),
        getProdutos(),
      ])
      setModelos(mods)
      setSeguradoras(segs)
      setTiposSeguro(tips)
      setProdutos(prods)
    } catch {
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os modelos de recebimento.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('modelos_comissao', () => loadData())
  useRealtime('seguradoras', () => loadData())
  useRealtime('tipos_seguro', () => loadData())
  useRealtime('produtos', () => loadData())

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteModeloComissao(deleteId)
      toast({ title: 'Modelo excluído com sucesso.' })
      setDeleteId(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir modelo',
        description: 'Verifique se este modelo já não está vinculado a apólices.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const getTipoModeloBadge = (tipo: string) => {
    switch (tipo) {
      case 'A_VISTA':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">1. À Vista</Badge>
      case 'PARCELADA':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">2. Parcelada</Badge>
      case 'RECORRENTE':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
            3. Recorrente
          </Badge>
        )
      case 'POR_FASES':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200">4. Por Fases</Badge>
        )
      case 'POR_ESGOTAMENTO':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            5. Por Esgotamento
          </Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const canCreate = can('modelos_comissao', 'create')
  const canUpdate = can('modelos_comissao', 'update')
  const canDelete = can('modelos_comissao', 'delete')

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">
                Modelos de Recebimento de Comissões
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Centraliza os 5 modelos criados na ETAPA 2A (À vista, Parcelada, Recorrente, Por fases
              e Por esgotamento). Relacione a <strong>Seguradora + Produto</strong> para sugestão
              automática na apólice.
            </CardDescription>
          </div>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingModelo(null)
                setDialogOpen(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Novo Modelo
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 text-xs uppercase tracking-wider">
                <TableHead className="py-3">Nome do Modelo</TableHead>
                <TableHead className="py-3">Tipo de Modelo</TableHead>
                <TableHead className="py-3">Vínculo (Seguradora / Produto)</TableHead>
                <TableHead className="py-3">% Padrão / Condição</TableHead>
                <TableHead className="py-3">Válido a partir de</TableHead>
                <TableHead className="py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500 text-sm">
                    Carregando modelos de recebimento...
                  </TableCell>
                </TableRow>
              ) : modelos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500 text-sm">
                    Nenhum modelo cadastrado ainda. Clique em "Novo Modelo" para cadastrar.
                  </TableCell>
                </TableRow>
              ) : (
                modelos.map((m) => {
                  const segNome =
                    m.expand?.seguradora?.nome ||
                    seguradoras.find((s) => s.id === m.seguradora)?.nome ||
                    'Todas'
                  const prodNome = m.tipo_seguro || 'Todos os produtos'

                  return (
                    <TableRow key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="font-semibold text-slate-900">
                        {m.nome}
                        {m.descricao && (
                          <div className="text-xs text-slate-400 font-normal">{m.descricao}</div>
                        )}
                      </TableCell>
                      <TableCell>{getTipoModeloBadge(m.tipo_modelo)}</TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-800 font-medium">{segNome}</div>
                        <div className="text-[11px] text-slate-400">{prodNome}</div>
                      </TableCell>
                      <TableCell>
                        {m.tipo_modelo === 'POR_FASES' ? (
                          <span className="text-xs font-medium text-purple-700">
                            {m.config_json?.fases?.length || 0} fase(s) configurada(s)
                          </span>
                        ) : m.tipo_modelo === 'PARCELADA' ? (
                          <span className="text-xs font-medium text-amber-700">
                            {m.config_json?.quantidade_competencias || 1} competências (
                            {m.percentual_padrao || 0}%)
                          </span>
                        ) : m.tipo_modelo === 'POR_ESGOTAMENTO' ? (
                          <span className="text-xs font-medium text-orange-700">
                            Até esgotar R${' '}
                            {Number(m.config_json?.saldo_total || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700">
                            {m.percentual_padrao || 0}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {m.valido_a_partir_de
                          ? formatDateDisplay(m.valido_a_partir_de)
                          : 'Imediato'}
                        {m.versao && m.versao > 1 && (
                          <span className="ml-1 text-[10px] text-slate-400">(v{m.versao})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              title="Editar modelo"
                              onClick={() => {
                                setEditingModelo(m)
                                setDialogOpen(true)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Excluir modelo"
                              onClick={() => setDeleteId(m.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ModeloComissaoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingModelo}
        seguradoras={seguradoras}
        tiposSeguro={tiposSeguro}
        produtos={produtos}
        onSuccess={loadData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo de Recebimento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este modelo de recebimento? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
export default CadastrosModelosRecebimentoTab
