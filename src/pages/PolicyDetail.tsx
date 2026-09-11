import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  Pencil,
  RefreshCw,
  Trash2,
  Ban,
  AlertOctagon,
  ArrowUpRight,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import {
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicyWithRelations,
  prepareRenewalData,
  cancelPolicy,
} from '@/services/policies'
import { getPayments, createPayment } from '@/services/payments'
import { getReminders } from '@/services/reminders'
import { getClients } from '@/services/clients'
import { getSeguradoras } from '@/services/seguradoras'
import { getParceiros } from '@/services/parceiros'
import {
  Policy,
  Payment,
  Client,
  Seguradora,
  Parceiro,
  ComissaoRecebimento,
  ComissaoPrevista,
} from '@/types'
import {
  getComissaoRecebimentosByPolicy,
  deleteComissaoRecebimento,
} from '@/services/comissao-recebimentos'
import { getComissoesPrevistasByPolicy } from '@/services/modelos-comissao'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PolicyFormDialog } from '@/components/PolicyFormDialog'
import { DeletePolicyDialog } from '@/components/DeletePolicyDialog'
import { CancelPolicyDialog } from '@/components/CancelPolicyDialog'
import { EditRecebimentoModal } from '@/components/EditRecebimentoModal'
import { EstornoRecebimentoModal } from '@/components/EstornoRecebimentoModal'
import { RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { formatDateDisplay, todayLocalDate } from '@/lib/utils'

type DialogMode = 'edit' | 'renew' | null

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { can } = usePermissions()

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [recebimentos, setRecebimentos] = useState<ComissaoRecebimento[]>([])
  const [previsoes, setPrevisoes] = useState<ComissaoPrevista[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPaySubmitting, setIsPaySubmitting] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [relatedCount, setRelatedCount] = useState({ payments: 0, reminders: 0 })

  // Estados para edição e exclusão de recebimento com confirmação
  // Separação de aberto/fechado de item selecionado para evitar desmontagem abrupta e flicker
  const [isEditRecebimentoOpen, setIsEditRecebimentoOpen] = useState(false)
  const [editingRecebimento, setEditingRecebimento] = useState<ComissaoRecebimento | null>(null)
  const [isEstornoOpen, setIsEstornoOpen] = useState(false)
  const [estornandoRecebimento, setEstornandoRecebimento] = useState<ComissaoRecebimento | null>(
    null,
  )

  const [isDeleteRecebimentoOpen, setIsDeleteRecebimentoOpen] = useState(false)
  const [deletingRecebimento, setDeletingRecebimento] = useState<ComissaoRecebimento | null>(null)
  const [deleteRecebimentoLoading, setDeleteRecebimentoLoading] = useState(false)
  const isOperationInProgressRef = useRef(false)

  const [paymentForm, setPaymentForm] = useState({
    amount: 1000,
    due_date: todayLocalDate(),
    status: 'Pendente' as const,
    payment_method: 'Boleto' as const,
  })

  const loadData = async () => {
    if (!id) return
    try {
      const p = await getPolicy(id)
      setPolicy(p)
      const [pays, recs, prevList, cls, segs, pars] = await Promise.all([
        getPayments(`policy = "${id}"`),
        getComissaoRecebimentosByPolicy(id),
        getComissoesPrevistasByPolicy(id).catch(() => []),
        getClients(),
        getSeguradoras(),
        getParceiros(),
      ])
      setPayments(pays)
      setRecebimentos(recs)
      setPrevisoes(prevList)
      setClients(cls)
      setSeguradoras(segs)
      setParceiros(pars)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [id])
  // Carregamento com debounce/guard para evitar re-renderizações e reaberturas múltiplas via WebSocket
  useRealtime('policies', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
    }
  })
  useRealtime('payments', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
    }
  })
  useRealtime('comissao_recebimentos', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
    }
  })
  useRealtime('comissoes_previstas', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
    }
  })

  const handleSubmit = async (formData: any) => {
    if (!policy) return
    setFieldErrors({})
    try {
      if (dialogMode === 'edit') {
        await updatePolicy(policy.id, formData)
        toast({ title: 'Apólice atualizada com sucesso!' })
        setDialogMode(null)
        setFieldErrors({})
        loadData()
      } else if (dialogMode === 'renew') {
        const newPolicy = await createPolicy(formData)
        toast({ title: 'Apólice renovada com sucesso!' })
        navigate(`/apolices/${newPolicy.id}`)
      }
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDeleteClick = async () => {
    if (!policy) return
    try {
      const [pays, rems] = await Promise.all([
        getPayments(`policy = "${policy.id}"`),
        getReminders(`policy = "${policy.id}"`),
      ])
      setRelatedCount({ payments: pays.length, reminders: rems.length })
    } catch {
      setRelatedCount({ payments: 0, reminders: 0 })
    }
    setDeleteOpen(true)
  }

  const handleCancelConfirm = async (data: {
    data_cancelamento: string
    motivo_cancelamento: string
  }) => {
    if (!policy) return
    try {
      await cancelPolicy(policy.id, {
        data_cancelamento: data.data_cancelamento,
        motivo_cancelamento: data.motivo_cancelamento,
      })
      toast({ title: 'Apólice cancelada com sucesso!' })
      setCancelOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar apólice',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
      throw err
    }
  }

  const handleDeleteConfirm = async () => {
    if (!policy) return
    setDeleteLoading(true)
    try {
      await deletePolicyWithRelations(policy.id)
      toast({ title: 'Apólice excluída com sucesso!' })
      navigate('/apolices')
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || isPaySubmitting) return
    setIsPaySubmitting(true)
    isOperationInProgressRef.current = true
    try {
      await createPayment({ policy: id, ...paymentForm })
      toast({ title: 'Pagamento registrado!' })
      setIsPayModalOpen(false)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsPaySubmitting(false)
      isOperationInProgressRef.current = false
    }
  }

  const handleConfirmDeleteRecebimento = async () => {
    if (!deletingRecebimento || !id || deleteRecebimentoLoading) return
    setDeleteRecebimentoLoading(true)
    isOperationInProgressRef.current = true
    const recId = deletingRecebimento.id
    try {
      // 1. Fecha o diálogo primeiro para completar a transição de UI sem re-render prematuro
      setIsDeleteRecebimentoOpen(false)
      // 2. Executa a exclusão
      await deleteComissaoRecebimento(recId, id)
      toast({
        title: 'Recebimento excluído com sucesso!',
        description: 'Os saldos e o status da apólice foram recalculados.',
      })
      // 3. Recarrega os dados APÓS o fechamento
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir recebimento',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeleteRecebimentoLoading(false)
      isOperationInProgressRef.current = false
    }
  }

  if (!policy) return <div className="p-8 text-center text-slate-500">Carregando apólice...</div>

  const fmtMoney = (v: number) => v?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'
  const initialData =
    dialogMode === 'edit' ? policy : dialogMode === 'renew' ? prepareRenewalData(policy) : undefined

  // REGRA CORRETA:
  // - Comissão prevista = valor bruto previsto
  // - Já recebido = soma dos valores BRUTOS recebidos
  // - Saldo a receber = comissão prevista - total BRUTO recebido
  // - Impostos/descontos NÃO reduzem o saldo da comissão prevista
  // - Valor líquido recebido = receita líquida realizada no financeiro
  const comissaoPrevista =
    policy.commission != null
      ? Number(policy.commission)
      : Math.round(
          (((policy.valor_liquido || policy.premium_amount || 0) *
            (policy.commission_percent || 0)) /
            100) *
            100,
        ) / 100

  // Total BRUTO recebido (soma dos recebimentos brutos)
  const jaRecebido =
    recebimentos.length > 0
      ? Math.round(recebimentos.reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0) * 100) /
        100
      : policy.comissao_recebida
        ? comissaoPrevista
        : 0

  // Total de Impostos/Descontos realizados
  const impostosRealizados =
    recebimentos.length > 0
      ? Math.round(
          recebimentos.reduce((sum, r) => sum + (Number(r.descontos_impostos) || 0), 0) * 100,
        ) / 100
      : policy.comissao_recebida
        ? policy.iss || 0
        : 0

  // Total LÍQUIDO recebido (soma do líquido efetivamente recebido)
  // Regra: NÃO usar líquido para reduzir o saldo bruto da comissão
  const receitaLiquidaRealizada =
    recebimentos.length > 0
      ? Math.round(
          recebimentos.reduce(
            (sum, r) =>
              sum +
              (r.valor_liquido != null
                ? Number(r.valor_liquido)
                : Math.max(0, (Number(r.valor_bruto) || 0) - (Number(r.descontos_impostos) || 0))),
            0,
          ) * 100,
        ) / 100
      : policy.comissao_recebida
        ? Math.max(0, comissaoPrevista - (policy.iss || 0))
        : 0

  // Saldo = previsto bruto − realizado bruto (NÃO usar líquido para reduzir saldo)
  const saldoAReceber = Math.max(0, Math.round((comissaoPrevista - jaRecebido) * 100) / 100)
  const temDivergenciaExcesso = jaRecebido > comissaoPrevista && comissaoPrevista > 0

  // Total estornado e recebido para exibição simplificada
  const totalRecebimentosNormais =
    Math.round(
      recebimentos
        .filter((r) => !r.is_estorno && (Number(r.valor_bruto) || 0) > 0)
        .reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0) * 100,
    ) / 100

  const totalEstornos =
    Math.round(
      recebimentos
        .filter((r) => r.is_estorno || (Number(r.valor_bruto) || 0) < 0)
        .reduce((sum, r) => sum + Math.abs(Number(r.valor_bruto) || 0), 0) * 100,
    ) / 100

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/apolices')}
            className="mb-2"
          >
            ← Voltar para Apólices
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">
            {policy.policy_number
              ? `Apólice ${policy.policy_number}`
              : policy.numero_proposta
                ? `Proposta ${policy.numero_proposta}`
                : `Registro #${policy.policy_code || policy.id}`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('policies', 'update') && (
            <Button
              variant="outline"
              onClick={() => {
                setFieldErrors({})
                setDialogMode('edit')
              }}
            >
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
          )}
          {can('policies', 'update') && policy.status !== 'Cancelada' && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="w-4 h-4 mr-2" /> Cancelar Apólice
            </Button>
          )}
          {can('policies', 'create') && policy.status !== 'Cancelada' && (
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setFieldErrors({})
                setDialogMode('renew')
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Renovar
            </Button>
          )}
          {can('policies', 'delete') && (
            <Button variant="destructive" onClick={handleDeleteClick}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {/* ETAPA 2B — ITEM 6: ÁREA CONSOLIDADA E LIMPA DE COMISSÕES */}
      <Card className="border-blue-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b pb-3.5 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">Comissões</CardTitle>
                {saldoAReceber === 0 && comissaoPrevista > 0 && (
                  <Badge className="bg-emerald-600 text-white font-medium text-xs">Recebida</Badge>
                )}
                {saldoAReceber > 0 && jaRecebido > 0 && (
                  <Badge className="bg-amber-500 text-white font-medium text-xs">Parcial</Badge>
                )}
                {saldoAReceber > 0 && jaRecebido === 0 && (
                  <Badge className="bg-slate-500 text-white font-medium text-xs">Pendente</Badge>
                )}
                {temDivergenciaExcesso && (
                  <Badge className="bg-rose-500 text-white font-medium text-xs">
                    Acima do Previsto
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Modelo utilizado:{' '}
                <strong className="text-slate-700">
                  {policy.comissao_personalizada
                    ? 'Personalizado nesta apólice'
                    : (policy as any).expand?.modelo_comissao?.nome
                      ? `${(policy as any).expand.modelo_comissao.nome} (${(policy as any).expand.modelo_comissao.tipo_modelo})`
                      : policy.forma_recebimento || 'À Vista / Padrão'}
                </strong>
              </p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 h-9">
              <Link
                to={`/financeiro?policy=${policy.policy_number || policy.numero_proposta || ''}`}
              >
                <ArrowUpRight className="w-4 h-4 mr-1.5" />
                Registrar recebimento
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-5">
          {temDivergenciaExcesso && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-xs text-amber-800">
              <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Aviso:</strong> O total já recebido (R$ {fmtMoney(jaRecebido)}) supera a
                comissão prevista (R$ {fmtMoney(comissaoPrevista)}) em R${' '}
                {fmtMoney(jaRecebido - comissaoPrevista)}.
              </span>
            </div>
          )}

          {/* ITEM 3 & ITEM 6: 3 CARDS ESSENCIAIS: Total Previsto | Recebido | Saldo a receber */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 text-center sm:text-left">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Previsto
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                R$ {fmtMoney(comissaoPrevista)}
              </p>
              <span className="text-[11px] text-slate-500">
                {policy.commission_percent || 0}% do prêmio líquido
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/70 rounded-lg border border-emerald-200 text-center sm:text-left">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Recebido
              </span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">R$ {fmtMoney(jaRecebido)}</p>
              <span className="text-[11px] text-emerald-600">
                {recebimentos.length} recebimento{recebimentos.length !== 1 ? 's' : ''} registrado
                {recebimentos.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="p-3.5 bg-amber-50/70 rounded-lg border border-amber-200 text-center sm:text-left">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Saldo a Receber
              </span>
              <p className="text-2xl font-bold text-amber-700 mt-1">R$ {fmtMoney(saldoAReceber)}</p>
              <span className="text-[11px] text-amber-600">
                {saldoAReceber === 0 ? 'Quitado integralmente' : 'Pendente de recebimento'}
              </span>
            </div>
          </div>

          {/* ITEM 5: RESUMO DE ESTORNOS (quando houver estorno) */}
          {totalEstornos > 0 && (
            <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold text-rose-900">Histórico de Estornos:</span>
                <span className="text-slate-700">
                  Recebimento bruto: <strong>+R$ {fmtMoney(totalRecebimentosNormais)}</strong>
                </span>
                <span className="text-rose-700 font-semibold">
                  / Estorno: <strong>-R$ {fmtMoney(totalEstornos)}</strong>
                </span>
                <span className="text-slate-900 font-bold">
                  / Líquido recebido: <strong>R$ {fmtMoney(jaRecebido)}</strong>
                </span>
              </div>
            </div>
          )}

          {/* ITEM 3: TABELA DE COMPETÊNCIAS / PREVISÕES */}
          {previsoes.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Previsão por Competência
                </h4>
                <span className="text-[11px] text-slate-500">
                  {previsoes.length} parcela{previsoes.length > 1 ? 's' : ''} programada
                  {previsoes.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Competência</th>
                      <th className="p-2.5">Data Prevista</th>
                      <th className="p-2.5">Previsto</th>
                      <th className="p-2.5">Recebido</th>
                      <th className="p-2.5">Saldo</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previsoes.map((prev) => {
                      // Calcula o recebido para esta previsão específica
                      const recsDesta = recebimentos.filter(
                        (r) =>
                          r.comissao_prevista === prev.id ||
                          (r.competencia && prev.competencia && r.competencia === prev.competencia),
                      )
                      const recBrutoDesta =
                        Math.round(
                          recsDesta.reduce((acc, r) => acc + (Number(r.valor_bruto) || 0), 0) * 100,
                        ) / 100
                      const vPrev = Number(prev.valor_previsto) || 0
                      const saldoDesta = Math.max(
                        0,
                        Math.round((vPrev - recBrutoDesta) * 100) / 100,
                      )

                      return (
                        <tr key={prev.id} className="hover:bg-slate-50/80">
                          <td className="p-2.5 font-bold text-slate-900">
                            {prev.competencia || `Parcela ${prev.parcela_numero}`}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {formatDateDisplay(prev.data_prevista)}
                          </td>
                          <td className="p-2.5 font-medium text-slate-800">R$ {fmtMoney(vPrev)}</td>
                          <td className="p-2.5 font-semibold text-emerald-700">
                            R$ {fmtMoney(recBrutoDesta)}
                          </td>
                          <td className="p-2.5 font-semibold text-amber-700">
                            R$ {fmtMoney(saldoDesta)}
                          </td>
                          <td className="p-2.5">
                            <Badge
                              className={
                                prev.status === 'Recebida' || saldoDesta === 0
                                  ? 'bg-emerald-600 text-white'
                                  : prev.status === 'Parcial' || recBrutoDesta > 0
                                    ? 'bg-amber-500 text-white'
                                    : prev.status === 'Cancelada'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-slate-400 text-white'
                              }
                            >
                              {saldoDesta === 0 && vPrev > 0
                                ? 'Recebida'
                                : recBrutoDesta > 0
                                  ? 'Parcial'
                                  : prev.status || 'Pendente'}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-right">
                            {saldoDesta > 0 && (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                              >
                                <Link
                                  to={`/financeiro?policy=${policy.policy_number || policy.numero_proposta || ''}&competencia=${encodeURIComponent(prev.competencia || '')}&prevId=${encodeURIComponent(prev.id)}&valor=${encodeURIComponent(String(prev.valor_previsto || ''))}`}
                                >
                                  Receber
                                </Link>
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ITEM 4, 5 & 6: RECEBIMENTOS E ESTORNOS REGISTRADOS */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recebimentos e Estornos
              </h4>
              {recebimentos.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {recebimentos.length} lançamento{recebimentos.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {recebimentos.length === 0 ? (
              <div className="p-4 bg-slate-50 border rounded-lg text-center text-xs text-slate-500">
                Nenhum recebimento registrado para esta apólice ainda.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Competência</th>
                      <th className="p-2.5">Valor Bruto</th>
                      <th className="p-2.5">Impostos</th>
                      <th className="p-2.5">Valor Líquido</th>
                      <th className="p-2.5">Observação</th>
                      <th className="p-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recebimentos.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-medium">
                          {formatDateDisplay(rec.data_recebimento)}
                        </td>
                        <td className="p-2.5 font-medium text-slate-900">
                          {rec.competencia || (rec.parcela ? `Parc. ${rec.parcela}` : '-')}
                        </td>
                        <td
                          className={`p-2.5 ${rec.is_estorno || rec.valor_bruto < 0 ? 'text-rose-600 font-bold' : 'font-medium'}`}
                        >
                          {rec.valor_bruto < 0
                            ? `- R$ ${fmtMoney(Math.abs(rec.valor_bruto))}`
                            : `R$ ${fmtMoney(rec.valor_bruto)}`}
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {rec.descontos_impostos ? `R$ ${fmtMoney(rec.descontos_impostos)}` : '-'}
                        </td>
                        <td
                          className={`p-2.5 font-bold ${rec.is_estorno || (rec.valor_liquido || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}
                        >
                          {(rec.valor_liquido || 0) < 0
                            ? `- R$ ${fmtMoney(Math.abs(rec.valor_liquido || 0))}`
                            : `R$ ${fmtMoney(rec.valor_liquido)}`}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            {rec.is_estorno && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-rose-50 text-rose-700 border-rose-200"
                              >
                                Estorno
                              </Badge>
                            )}
                            <span className="text-slate-600 text-[11px]">
                              {rec.observacao || rec.motivo_estorno || rec.origem || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {can('policies', 'update') && !rec.is_estorno && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2"
                                onClick={() => {
                                  setEstornandoRecebimento(rec)
                                  setIsEstornoOpen(true)
                                }}
                                title="Registrar estorno"
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Estornar
                              </Button>
                            )}
                            {can('policies', 'update') && !rec.is_estorno && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 px-2"
                                onClick={() => {
                                  setEditingRecebimento(rec)
                                  setIsEditRecebimentoOpen(true)
                                }}
                                title="Editar recebimento"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {can('policies', 'delete') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                onClick={() => {
                                  setDeletingRecebimento(rec)
                                  setIsDeleteRecebimentoOpen(true)
                                }}
                                title="Excluir recebimento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {policy.status === 'Cancelada' && (
        <Card className="border-red-300 bg-red-50/70 shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-red-900 text-sm">Esta apólice foi cancelada</p>
              <p className="text-red-800">
                <span className="font-semibold">Data do Cancelamento:</span>{' '}
                {formatDateDisplay(policy.data_cancelamento) || 'Não informada'}
              </p>
              {policy.motivo_cancelamento && (
                <p className="text-red-800">
                  <span className="font-semibold">Motivo:</span> {policy.motivo_cancelamento}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>Detalhes da Cobertura</span>
            <Badge
              className={
                policy.status === 'Ativa'
                  ? 'bg-emerald-500'
                  : policy.status === 'Renovação Pendente'
                    ? 'bg-amber-500'
                    : policy.status === 'Vencida' || policy.status === 'Expirada'
                      ? 'bg-slate-500'
                      : policy.status === 'Cancelada'
                        ? 'bg-red-600'
                        : 'bg-slate-500'
              }
            >
              {policy.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-slate-700">
          <div>
            <p className="text-xs text-slate-500">Nº da Proposta</p>
            <p className="font-bold text-slate-900">
              {policy.numero_proposta || (
                <span className="text-slate-400 font-normal">Não informada</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Nº da Apólice</p>
            <p className="font-bold text-slate-900">
              {policy.policy_number || (
                <span className="text-slate-400 font-normal">Não informada</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cliente Segurado</p>
            <p className="font-bold text-slate-900">
              {policy.expand?.client?.name || 'Não informado'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Seguradora</p>
            <p className="font-semibold text-slate-900">
              {policy.expand?.seguradora?.nome || policy.insurance_company || '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tipo de Seguro</p>
            <p className="font-semibold">{policy.tipo_de_seguro || policy.coverage_type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tipo de Venda</p>
            <p className="font-semibold">{policy.tipo_de_venda || '-'}</p>
          </div>
          {policy.tipo_de_seguro === 'Auto' && (
            <>
              <div>
                <p className="text-xs text-slate-500">Placa</p>
                <p className="font-semibold">{policy.placa || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Chassi</p>
                <p className="font-semibold">{policy.chassi || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Modelo do Veículo</p>
                <p className="font-semibold">{policy.modelo_veiculo || '-'}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-slate-500">Valor Bruto</p>
            <p className="font-bold text-slate-900">R$ {fmtMoney(policy.valor_bruto || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor Líquido</p>
            <p className="font-bold text-slate-900">
              R$ {fmtMoney(policy.valor_liquido || policy.premium_amount || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pagamento do Seguro (Cliente)</p>
            <p className="font-semibold">
              {policy.forma_pagamento ? `${policy.forma_pagamento}` : '-'}
              {policy.parcelas ? ` (${policy.parcelas}x)` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Parcelas do Seguro</p>
            <p className="font-semibold">{policy.parcelas ? `${policy.parcelas}x` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Comissão (%)</p>
            <p className="font-semibold">{policy.commission_percent || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor da Comissão</p>
            <p className="font-bold text-blue-600">
              R${' '}
              {fmtMoney(
                ((policy.commission_percent || 0) / 100) *
                  (policy.valor_liquido || policy.premium_amount || 0),
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Modelo de Recebimento</p>
            <p className="font-semibold text-slate-900">
              {policy.comissao_personalizada ? (
                <span className="text-amber-700 font-bold">Personalizado nesta apólice</span>
              ) : (policy as any).expand?.modelo_comissao?.nome ? (
                <span>
                  {(policy as any).expand.modelo_comissao.nome} (
                  {(policy as any).expand.modelo_comissao.tipo_modelo})
                </span>
              ) : (
                policy.forma_recebimento || 'À Vista / Padrão'
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Data Início</p>
            <p className="font-semibold">{formatDateDisplay(policy.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Data Fim</p>
            <p className="font-semibold">{formatDateDisplay(policy.end_date)}</p>
          </div>
          {policy.expand?.parceiro && (
            <div>
              <p className="text-xs text-slate-500">Parceiro</p>
              <p className="font-semibold">{policy.expand.parceiro.nome}</p>
            </div>
          )}
          {policy.notes && (
            <div className="md:col-span-4">
              <p className="text-xs text-slate-500">Observações</p>
              <p className="text-sm">{policy.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="mt-4">
          <Card className="p-4 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm">Histórico de Parcelas</h3>
              <Button size="sm" onClick={() => setIsPayModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Registrar Pagamento
              </Button>
            </div>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Nenhum pagamento registrado nesta apólice.
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 bg-slate-50 border rounded text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        R$ {p.amount?.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-slate-500">Vencimento: {formatDateDisplay(p.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={p.status === 'Pago' ? 'bg-emerald-500' : 'bg-red-500'}>
                        {p.status}
                      </Badge>
                      <p className="text-slate-400 mt-1">{p.payment_method}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <PolicyFormDialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null)
            setFieldErrors({})
          }
        }}
        onSubmit={handleSubmit}
        clients={clients}
        seguradoras={seguradoras}
        parceiros={parceiros}
        initialData={initialData}
        title={dialogMode === 'edit' ? 'Editar Apólice' : 'Renovar Apólice'}
        fieldErrors={fieldErrors}
        submitLabel={dialogMode === 'edit' ? 'Salvar Alterações' : 'Criar Renovação'}
      />

      <DeletePolicyDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        policyNumber={policy.policy_number || policy.numero_proposta || ''}
        relatedCount={relatedCount}
        loading={deleteLoading}
      />

      <CancelPolicyDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancelConfirm}
        policyNumber={policy.policy_number || policy.numero_proposta || ''}
      />

      {/* Modal de Estorno de Recebimento */}
      <EstornoRecebimentoModal
        open={isEstornoOpen}
        onOpenChange={(open) => {
          setIsEstornoOpen(open)
          if (!open) setEstornandoRecebimento(null)
        }}
        recebimento={estornandoRecebimento}
        onSuccess={() => {
          setTimeout(() => {
            loadData()
          }, 50)
        }}
      />

      {/* Modal de Edição de Recebimento */}
      <EditRecebimentoModal
        open={isEditRecebimentoOpen}
        onOpenChange={(open) => {
          setIsEditRecebimentoOpen(open)
        }}
        recebimento={editingRecebimento}
        comissaoPrevista={comissaoPrevista}
        totalOutrosRecebimentosBrutos={
          editingRecebimento
            ? Math.round(
                recebimentos
                  .filter((r) => r.id !== editingRecebimento.id)
                  .reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0) * 100,
              ) / 100
            : 0
        }
        onSuccess={() => {
          // Recarregar os dados de forma assíncrona após fechamento
          setTimeout(() => {
            loadData()
          }, 50)
        }}
      />

      {/* Diálogo de Confirmação para Desfazer / Excluir Recebimento */}
      <Dialog
        open={isDeleteRecebimentoOpen}
        onOpenChange={(open) => {
          setIsDeleteRecebimentoOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Desfazer / Excluir Recebimento?</span>
            </DialogTitle>
          </DialogHeader>

          {deletingRecebimento && (
            <div className="space-y-3 text-sm text-slate-600 py-1">
              <p>
                Tem certeza de que deseja desfazer este recebimento de comissão da apólice{' '}
                <strong>{policy.policy_number || policy.numero_proposta || policy.id}</strong>?
              </p>

              <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Data:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {formatDateDisplay(deletingRecebimento.data_recebimento)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Valor Bruto:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    R$ {fmtMoney(deletingRecebimento.valor_bruto)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Valor Líquido:</span>{' '}
                  <span className="font-semibold text-emerald-700">
                    R$ {fmtMoney(deletingRecebimento.valor_liquido)}
                  </span>
                </div>
                {deletingRecebimento.origem && (
                  <div>
                    <span className="text-slate-500">Origem:</span>{' '}
                    <span className="font-semibold">{deletingRecebimento.origem}</span>
                  </div>
                )}
              </div>

              {deletingRecebimento.origem === 'Legado' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <strong>Aviso especial:</strong> Este registro possui origem &quot;Legado&quot;.
                  Ao excluí-lo, o saldo da apólice voltará a ficar em aberto e você poderá registrar
                  um novo recebimento corrigido se necessário.
                </div>
              )}

              <p className="text-xs text-slate-500">
                Esta ação atualizará automaticamente o saldo a receber, a receita líquida e o status
                de quitação da comissão no Financeiro e no Dashboard.
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteRecebimentoOpen(false)}
              disabled={deleteRecebimentoLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteRecebimento}
              disabled={deleteRecebimentoLoading}
            >
              {deleteRecebimentoLoading ? 'Excluindo...' : 'Confirmar e Desfazer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Parcela / Pagamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={paymentForm.due_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={paymentForm.status}
                onValueChange={(val: any) => setPaymentForm({ ...paymentForm, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(val: any) =>
                  setPaymentForm({ ...paymentForm, payment_method: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPayModalOpen(false)}
                disabled={isPaySubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600" disabled={isPaySubmitting}>
                {isPaySubmitting ? 'Salvando...' : 'Salvar Pagamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
