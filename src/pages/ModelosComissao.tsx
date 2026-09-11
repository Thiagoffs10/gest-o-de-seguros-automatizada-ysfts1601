import { useState, useEffect } from 'react'
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Calendar,
  Building2,
  ShieldAlert,
  Percent,
  Info,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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

import { Link } from 'react-router-dom'
import { Boxes, ArrowRight } from 'lucide-react'

export function ModelosComissao() {
  const { toast } = useToast()
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
              aria-label={`Mais informações sobre ${nome}`}
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

  return (
    <div className="space-y-6">
      {/* Banner de atalho para a Central de Cadastros */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-blue-600" />
          <span>
            Os modelos de recebimento agora estão organizados em{' '}
            <strong>Configurações → Cadastros do Sistema → Modelos de Recebimento</strong>.
          </span>
        </div>
        <Link
          to="/cadastros?tab=modelos"
          className="font-semibold text-blue-700 hover:underline flex items-center gap-1"
        >
          Abrir na Central de Cadastros <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600" />
            Modelos de Recebimento de Comissão
          </h1>
          <p className="text-sm text-slate-500">
            Defina como as comissões são pagas pelas seguradoras (à vista, parceladas, recorrentes,
            por fases ou por saldo).
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingModelo(null)
            setDialogOpen(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Modelo
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Modelos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Modelo</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Seguradora / Produto</TableHead>
                <TableHead>% Padrão / Condição</TableHead>
                <TableHead>Válido a partir de</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Carregando modelos de comissão...
                  </TableCell>
                </TableRow>
              ) : modelos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                    Nenhum modelo de comissão cadastrado ainda. Clique em "Novo Modelo" para criar.
                  </TableCell>
                </TableRow>
              ) : (
                modelos.map((m) => {
                  const segNome =
                    m.expand?.seguradora?.nome ||
                    seguradoras.find((s) => s.id === m.seguradora)?.nome ||
                    'Todas'
                  const prodNome = m.tipo_seguro || 'Todos'

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold text-slate-900">
                        {m.nome}
                        {m.descricao && (
                          <div className="text-xs text-slate-400 font-normal">{m.descricao}</div>
                        )}
                      </TableCell>
                      <TableCell>{getTipoModeloBadge(m.tipo_modelo)}</TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-700 font-medium">{segNome}</div>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingModelo(m)
                              setDialogOpen(true)
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteId(m.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Dialog de criação/edição */}
      <ModeloComissaoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingModelo}
        seguradoras={seguradoras}
        tiposSeguro={tiposSeguro}
        produtos={produtos}
        onSuccess={loadData}
      />

      {/* Confirmação de exclusão */}
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
export default ModelosComissao
