import { useState, useEffect } from 'react'
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  HelpCircle,
  Building2,
  Calendar,
  Info,
  Sparkles,
} from 'lucide-react'
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
import {
  ModeloComissao,
  Seguradora,
  TipoSeguro,
  TipoModeloComissao,
  TIPOS_NATIVOS_RECEBIMENTO,
} from '@/types'
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
  const [initialFormValues, setInitialFormValues] = useState<
    | {
        seguradora?: string
        tipo_seguro?: string
      }
    | undefined
  >(undefined)
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

  // ITEM B.2: Ler query params seguradora e produto da URL para pré-preencher e abrir modal de cadastro
  useEffect(() => {
    loadData()

    const urlParams = new URLSearchParams(window.location.search)
    const paramSeg = urlParams.get('seguradora')
    const paramProd = urlParams.get('produto')
    if (paramSeg || paramProd) {
      setInitialFormValues({
        seguradora: paramSeg || undefined,
        tipo_seguro: paramProd || undefined,
      })
      setEditingModelo(null)
      setDialogOpen(true)
    }
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
    const info = TIPOS_NATIVOS_RECEBIMENTO[tipo as TipoModeloComissao]
    const nome = info?.nome || tipo

    const badgeEl = (() => {
      switch (tipo) {
        case 'A_VISTA':
          return <Badge className="bg-blue-100 text-blue-800 border-blue-200">1. À Vista</Badge>
        case 'PARCELADA':
          return (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">2. Parcelada</Badge>
          )
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
    })()

    if (!info) return badgeEl

    return (
      <div className="flex items-center gap-1.5">
        {badgeEl}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-slate-400 hover:text-blue-600 focus:outline-none"
              aria-label={`Mais informações sobre tipo ${nome}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs p-2.5 bg-slate-900 text-white">
            <p className="font-bold mb-0.5">{nome}</p>
            <p className="text-slate-200">{info.descricaoCompleta}</p>
            <p className="text-[10px] text-slate-400 mt-1 italic">{info.exemplo}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  const canCreate = can('modelos_comissao', 'create')
  const canUpdate = can('modelos_comissao', 'update')
  const canDelete = can('modelos_comissao', 'delete')

  return (
    <div className="space-y-4">
      {/* Card explicativo dos 5 Tipos Nativos de Recebimento */}
      <div className="p-4 bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-200/70 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              5 Tipos Nativos de Recebimento (Nativos do Sistema)
            </h3>
          </div>
          <span className="text-[11px] text-blue-700 font-semibold bg-blue-100/70 px-2 py-0.5 rounded">
            Nativo • Não requer cadastro manual
          </span>
        </div>
        <p className="text-xs text-slate-600">
          O sistema já dispõe nativamente dos 5 modos de operação da comissão. Abaixo, cadastre os{' '}
          <strong>Modelos Configurados</strong> para vincular a condição comercial específica de{' '}
          <strong>Seguradora + Produto</strong>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
          {(
            [
              'A_VISTA',
              'PARCELADA',
              'RECORRENTE',
              'POR_FASES',
              'POR_ESGOTAMENTO',
            ] as TipoModeloComissao[]
          ).map((tipoKey, idx) => {
            const info = TIPOS_NATIVOS_RECEBIMENTO[tipoKey]
            return (
              <div
                key={tipoKey}
                className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    {idx + 1}. {info.nome}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Ajuda sobre ${info.nome}`}
                        className="text-slate-400 hover:text-blue-600"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs p-2.5 bg-slate-900 text-white">
                      <p className="font-bold mb-1">{info.nome}</p>
                      <p>{info.descricaoCompleta}</p>
                      <p className="text-[10px] text-slate-300 mt-1 italic">{info.exemplo}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{info.descricaoCurta}</p>
              </div>
            )
          })}
        </div>
      </div>

      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Modelos Configurados (Seguradora + Produto)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Cadastros das regras comerciais específicas. Quando o operador registrar uma apólice
              com esta seguradora e produto, o modelo configurado será sugerido automaticamente.
            </CardDescription>
          </div>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setInitialFormValues(undefined)
                setEditingModelo(null)
                setDialogOpen(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Novo Modelo Configurado
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
        initialData={
          editingModelo ||
          (initialFormValues
            ? ({
                seguradora: initialFormValues.seguradora,
                tipo_seguro: initialFormValues.tipo_seguro,
              } as any)
            : null)
        }
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
