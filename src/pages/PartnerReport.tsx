import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  FileDown,
  X,
  Search,
  Plus,
  Trash2,
  Pencil,
  CheckCircle,
  History,
  SlidersHorizontal,
  DollarSign,
  AlertCircle,
  CreditCard,
} from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { findClientByDocument } from '@/services/clients'
import {
  getParceiroPagamentos,
  getParceiroDebitosPendentes,
  getDebitosPendentesPorParceiros,
  createParceiroDebito,
  updateParceiroDebito,
  deleteParceiroDebito,
  executarFechamentoParceiro,
  normalizeDateForPocketBase,
} from '@/services/parceiro-pagamentos'
import { Policy, Parceiro, Client, ParceiroDebitoItem, ParceiroPagamento } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { generatePartnerReportPDF, PartnerReportEntry } from '@/lib/partner-report-pdf'
import { maskDocument, formatClientDocument } from '@/lib/document-validators'
import { formatDateDisplay, todayLocalDate, extractDateOnly } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PartnerReport() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const initialYear = searchParams.get('year')
  const initialMonth = searchParams.get('month')

  // Se ano e mês vieram na URL, calcular data inicial e final do mês
  let initialDateFrom = ''
  let initialDateTo = ''
  if (initialYear && initialMonth) {
    const y = parseInt(initialYear, 10)
    const m = parseInt(initialMonth, 10)
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      const padM = String(m).padStart(2, '0')
      const lastDay = new Date(y, m, 0).getDate()
      initialDateFrom = `${y}-${padM}-01`
      initialDateTo = `${y}-${padM}-${String(lastDay).padStart(2, '0')}`
    }
  }

  const [policies, setPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [partnerSearch, setPartnerSearch] = useState('')
  const [selectedPartner, setSelectedPartner] = useState('all')
  const [repasseStatus, setRepasseStatus] = useState(
    initialStatus === 'pago' ? 'paid' : initialStatus === 'pendente' ? 'pending' : 'all',
  )
  const [seguradoraStatus, setSeguradoraStatus] = useState('all') // 'all' | 'received' | 'pending'
  const [cpfCnpjSearch, setCpfCnpjSearch] = useState('')
  const [foundClient, setFoundClient] = useState<Client | null>(null)
  const [documentNotFound, setDocumentNotFound] = useState(false)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  // Débitos manuais ou adicionados em tela
  const [debitos, setDebitos] = useState<ParceiroDebitoItem[]>([])
  const [isDebitoDialogOpen, setIsDebitoDialogOpen] = useState(false)
  const [editingDebitoIndex, setEditingDebitoIndex] = useState<number | null>(null)
  const [debitoDescricao, setDebitoDescricao] = useState('')
  const [debitoValor, setDebitoValor] = useState<string>('')
  const [debitoTargetPartnerId, setDebitoTargetPartnerId] = useState<string>('')

  // Taxa de Transferência PIX (R$): cálculo automático de 1% limitado a R$ 10,00, editável manualmente
  const [taxaPixManual, setTaxaPixManual] = useState<number | null>(null)

  // Histórico de pagamentos do parceiro selecionado
  const [pagamentosHistorico, setPagamentosHistorico] = useState<ParceiroPagamento[]>([])
  const [isHistoricoOpen, setIsHistoricoOpen] = useState(false)
  const [selectedHistoricoItem, setSelectedHistoricoItem] = useState<ParceiroPagamento | null>(null)

  // Modal para Marcar como Pago / Finalizar Fechamento
  const [isMarkPaidConfirmOpen, setIsMarkPaidConfirmOpen] = useState(false)
  const [dataPagamentoFinal, setDataPagamentoFinal] = useState<string>(todayLocalDate())
  const [observacaoPagamento, setObservacaoPagamento] = useState<string>('')
  const [isSavingPagamento, setIsSavingPagamento] = useState(false)

  // Seleção de apólices com checkbox (para atalho de fechamento pontual / seleção)
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([])

  // Débitos cadastrados do(s) parceiro(s) detectados pela seleção quando o filtro é "all"
  const [selectionDebitos, setSelectionDebitos] = useState<
    (ParceiroDebitoItem & { partnerId?: string; partnerNome?: string })[]
  >([])

  const loadData = useCallback(async () => {
    try {
      const [pols, pars] = await Promise.all([
        getPolicies('tipo_de_venda = "Parceiro"'),
        getParceiros(),
      ])
      setPolicies(pols)
      setParceiros(pars)
    } catch {
      /* ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setPage(1)
    setSelectedPolicyIds([])
  }, [selectedPartner, repasseStatus, seguradoraStatus, dateFrom, dateTo, cpfCnpjSearch])

  // Ao trocar de parceiro: limpar campos e carregar ajustes vinculados exclusivamente ao parceiro selecionado
  useEffect(() => {
    setTaxaPixManual(null)
    setDebitos([])

    if (selectedPartner && selectedPartner !== 'all') {
      // Carregar débitos pendentes e histórico de pagamentos salvos do parceiro
      getParceiroDebitosPendentes(selectedPartner)
        .then((items) => {
          setDebitos(
            items.map((d) => ({
              id: d.id,
              descricao: d.descricao,
              valor: d.valor,
              data: d.data,
            })),
          )
        })
        .catch(() => {})

      getParceiroPagamentos(selectedPartner)
        .then((pags) => {
          setPagamentosHistorico(pags)
        })
        .catch(() => {})
    } else {
      setPagamentosHistorico([])
    }
  }, [selectedPartner])

  // Busca por CPF/CNPJ de cliente
  useEffect(() => {
    const digits = cpfCnpjSearch.replace(/\D/g, '')
    if (digits.length !== 11 && digits.length !== 14) {
      setFoundClient(null)
      setDocumentNotFound(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const client = await findClientByDocument(cpfCnpjSearch)
        if (client) {
          setFoundClient(client)
          setDocumentNotFound(false)
        } else {
          setFoundClient(null)
          setDocumentNotFound(true)
        }
      } catch {
        setFoundClient(null)
        setDocumentNotFound(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [cpfCnpjSearch])

  const handleCpfCnpjChange = (value: string) => {
    setCpfCnpjSearch(maskDocument(value))
  }

  const handleClearDocument = () => {
    setCpfCnpjSearch('')
    setFoundClient(null)
    setDocumentNotFound(false)
  }

  const filteredParceiros = useMemo(() => {
    if (!partnerSearch) return parceiros
    return parceiros.filter((p) => p.nome?.toLowerCase().includes(partnerSearch.toLowerCase()))
  }, [parceiros, partnerSearch])

  const filteredPolicies = useMemo(() => {
    let result = policies
    if (selectedPartner !== 'all') result = result.filter((p) => p.parceiro === selectedPartner)

    // Filtro por repasse pago/pendente
    if (repasseStatus === 'paid') result = result.filter((p) => p.pago_parceiro)
    else if (repasseStatus === 'pending') result = result.filter((p) => !p.pago_parceiro)

    // Filtro por comissão seguradora recebida/pendente
    if (seguradoraStatus === 'received') result = result.filter((p) => p.comissao_recebida)
    else if (seguradoraStatus === 'pending') result = result.filter((p) => !p.comissao_recebida)

    const cleanDateFrom = extractDateOnly(dateFrom) || dateFrom
    const cleanDateTo = extractDateOnly(dateTo) || dateTo

    if (cleanDateFrom) {
      result = result.filter((p) => {
        // Se a apólice já teve o repasse pago ao parceiro, a data financeira de auditoria
        // do repasse é data_pagamento_parceiro (caso contrário, data de vigência start_date)
        const dateField =
          p.pago_parceiro && p.data_pagamento_parceiro ? p.data_pagamento_parceiro : p.start_date
        const ref = extractDateOnly(dateField)
        return ref && ref >= cleanDateFrom
      })
    }
    if (cleanDateTo) {
      result = result.filter((p) => {
        const dateField =
          p.pago_parceiro && p.data_pagamento_parceiro ? p.data_pagamento_parceiro : p.start_date
        const ref = extractDateOnly(dateField)
        return ref && ref <= cleanDateTo
      })
    }
    if (foundClient) {
      result = result.filter((p) => p.client === foundClient.id)
    }

    return result
  }, [policies, selectedPartner, repasseStatus, seguradoraStatus, dateFrom, dateTo, foundClient])

  const reportEntries: PartnerReportEntry[] = useMemo(() => {
    return filteredPolicies.map((p) => {
      const valorLiquido = p.valor_liquido || p.premium_amount || 0
      const repassePercent = p.percentual_repasse ?? 0
      // CRÍTICO: Se p.valor_repasse for explicitamente 0, continuar zero e não recalcular!
      const valorRepasse =
        p.valor_repasse !== undefined && p.valor_repasse !== null
          ? Number(p.valor_repasse)
          : (repassePercent / 100) * valorLiquido
      const client = p.expand?.client
      const partnerName =
        p.expand?.parceiro?.nome || parceiros.find((par) => par.id === p.parceiro)?.nome || 'N/A'

      return {
        policyId: p.id,
        clientName: client?.name || 'N/A',
        clientCpfCnpj: client ? formatClientDocument(client) : '',
        partnerName,
        partnerId: p.parceiro,
        seguradoraName: p.expand?.seguradora?.nome || p.insurance_company || 'N/A',
        tipoSeguro: p.tipo_de_seguro || p.coverage_type || 'N/A',
        valorLiquido,
        repassePercent,
        valorRepasse,
        statusRepasse: p.pago_parceiro ? 'Pago' : 'Pendente',
        dataPagamentoRepasse: p.data_pagamento_parceiro
          ? formatDateDisplay(p.data_pagamento_parceiro)
          : '',
        statusSeguradora: p.comissao_recebida ? 'Recebida' : 'Pendente',
        dataRecebimentoComissao: p.data_recebimento_comissao
          ? formatDateDisplay(p.data_recebimento_comissao)
          : '',
      }
    })
  }, [filteredPolicies, parceiros])

  const totalBrutoRepasse = useMemo(
    () => reportEntries.reduce((s, e) => s + e.valorRepasse, 0),
    [reportEntries],
  )

  const totalPages = Math.max(1, Math.ceil(reportEntries.length / PAGE_SIZE))
  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return reportEntries.slice(start, start + PAGE_SIZE)
  }, [reportEntries, page])

  // Quando há seleção ativa por checkbox, as pendências a pagar consideram a seleção
  const hasSelection = selectedPolicyIds.length > 0

  // Identificação dos parceiros das apólices selecionadas
  const selectedEntries = useMemo(() => {
    if (!hasSelection) return []
    const selectedSet = new Set(selectedPolicyIds)
    return reportEntries.filter((e) => e.policyId && selectedSet.has(e.policyId))
  }, [hasSelection, selectedPolicyIds, reportEntries])

  const selectedDistinctPartnerIds = useMemo(() => {
    if (selectedPartner !== 'all') return [selectedPartner]
    return Array.from(new Set(selectedEntries.map((e) => e.partnerId).filter(Boolean))) as string[]
  }, [selectedPartner, selectedEntries])

  // Se o filtro for "Todos os parceiros", carregar os débitos dos parceiros presentes na seleção
  useEffect(() => {
    if (selectedPartner !== 'all') {
      setSelectionDebitos([])
      return
    }

    if (selectedDistinctPartnerIds.length === 0) {
      setSelectionDebitos([])
      return
    }

    let isMounted = true
    getDebitosPendentesPorParceiros(selectedDistinctPartnerIds)
      .then((items) => {
        if (!isMounted) return
        setSelectionDebitos(
          items.map((d) => {
            const parName =
              (d as any).expand?.parceiro?.nome ||
              parceiros.find((p) => p.id === d.parceiro)?.nome ||
              'Parceiro'
            return {
              id: d.id,
              descricao: d.descricao,
              valor: d.valor,
              data: d.data,
              partnerId: d.parceiro,
              partnerNome: parName,
            }
          }),
        )
      })
      .catch(() => {
        if (isMounted) setSelectionDebitos([])
      })

    return () => {
      isMounted = false
    }
  }, [selectedPartner, selectedDistinctPartnerIds, parceiros])

  // Lista efetiva de débitos a considerar para o fechamento/resumo:
  // - Se parceiro específico filtrado: usa `debitos`
  // - Se "all" e há seleção: usa `selectionDebitos` agrupados por parceiro da seleção
  // - Caso contrário: vazia
  const activeDebitosList = useMemo(() => {
    if (selectedPartner !== 'all') {
      return debitos.map((d) => ({
        ...d,
        parceiroNome: parceiros.find((p) => p.id === selectedPartner)?.nome || 'Parceiro',
      }))
    }
    if (hasSelection) {
      return selectionDebitos
    }
    return []
  }, [selectedPartner, debitos, hasSelection, selectionDebitos, parceiros])

  // Somatório dos débitos ativos
  const totalDebitos = useMemo(
    () => activeDebitosList.reduce((s, d) => s + (Number(d.valor) || 0), 0),
    [activeDebitosList],
  )

  const totalPaid = reportEntries
    .filter((e) => e.statusRepasse === 'Pago')
    .reduce((s, e) => s + e.valorRepasse, 0)
  const totalPendingAll = reportEntries
    .filter((e) => e.statusRepasse === 'Pendente')
    .reduce((s, e) => s + e.valorRepasse, 0)

  // Apólices pendentes de repasse na listagem filtrada
  // Proteção: estritamente itens pendentes (pago_parceiro != true)
  const allPendingPolicies = useMemo(() => {
    return filteredPolicies.filter((p) => !p.pago_parceiro)
  }, [filteredPolicies])

  const pendingPoliciesToPay = useMemo(() => {
    if (hasSelection) {
      const selectedSet = new Set(selectedPolicyIds)
      return allPendingPolicies.filter((p) => selectedSet.has(p.id))
    }
    return allPendingPolicies
  }, [hasSelection, selectedPolicyIds, allPendingPolicies])

  // Total pendente efetivo considerado no fechamento (se houver seleção, soma apenas as selecionadas)
  const totalPending = useMemo(() => {
    if (hasSelection) {
      const selectedSet = new Set(selectedPolicyIds)
      return reportEntries
        .filter((e) => e.statusRepasse === 'Pendente' && e.policyId && selectedSet.has(e.policyId))
        .reduce((s, e) => s + e.valorRepasse, 0)
    }
    return totalPendingAll
  }, [hasSelection, selectedPolicyIds, reportEntries, totalPendingAll])

  // Saldo credor remanescente (quando débitos > total a pagar):
  // débito pendente retido / saldo a compensar futuramente com a corretora
  const saldoCredorRemanescente = useMemo(() => {
    if (totalDebitos > totalPending) {
      return Math.round((totalDebitos - totalPending) * 100) / 100
    }
    return 0
  }, [totalDebitos, totalPending])

  // Base para cálculo da taxa PIX: apenas repasses PENDENTES a pagar após débitos (se positivo)
  // Cálculo automático da taxa PIX: 1% sobre o valor da transferência a pagar, limitado ao máximo de R$ 10,00 (mínimo R$ 0)
  const taxaPixCalculadaAuto = useMemo(() => {
    if (totalPending <= 0) return 0
    const baseTransferencia = Math.max(0, totalPending - totalDebitos)
    if (baseTransferencia <= 0) return 0
    const taxa = (baseTransferencia * 1) / 100
    const taxaLimitada = Math.min(10, taxa)
    return Math.round(taxaLimitada * 100) / 100
  }, [totalPending, totalDebitos])

  // Taxa PIX efetiva (se foi editada manualmente, usa o valor manual; caso contrário a calculada automaticamente)
  const taxaPixEfetiva = useMemo(() => {
    if (totalPending <= 0 || totalPending - totalDebitos <= 0) return 0
    if (taxaPixManual !== null && !isNaN(taxaPixManual) && taxaPixManual >= 0) {
      return taxaPixManual
    }
    return taxaPixCalculadaAuto
  }, [totalPending, totalDebitos, taxaPixManual, taxaPixCalculadaAuto])

  // Líquido a Pagar final (destacado na tela): repasses PENDENTES a pagar menos débitos e taxa PIX
  const totalLiquidoAPagar = useMemo(() => {
    if (totalPending <= 0) return 0
    const liquido = totalPending - totalDebitos - taxaPixEfetiva
    return Math.max(0, Math.round(liquido * 100) / 100)
  }, [totalPending, totalDebitos, taxaPixEfetiva])

  // Ações de Débito
  const handleOpenAddDebito = () => {
    setEditingDebitoIndex(null)
    setDebitoDescricao('')
    setDebitoValor('')
    // Se filtro parceiro específico, usa ele. Se há seleção com parceiro único, pré-seleciona ele.
    const defaultPartner =
      selectedPartner !== 'all'
        ? selectedPartner
        : selectedDistinctPartnerIds.length === 1
          ? selectedDistinctPartnerIds[0]
          : ''
    setDebitoTargetPartnerId(defaultPartner || '')
    setIsDebitoDialogOpen(true)
  }

  const handleOpenEditDebito = (index: number) => {
    const item = activeDebitosList[index]
    if (!item) return
    setEditingDebitoIndex(index)
    setDebitoDescricao(item.descricao)
    setDebitoValor(String(item.valor))
    setDebitoTargetPartnerId((item as any).partnerId || selectedPartner || '')
    setIsDebitoDialogOpen(true)
  }

  const handleSaveDebito = async () => {
    const val = parseFloat(debitoValor.replace(',', '.'))
    if (!debitoDescricao.trim()) {
      toast({ title: 'Informe o motivo/descrição do débito', variant: 'destructive' })
      return
    }
    if (isNaN(val) || val <= 0) {
      toast({ title: 'Informe um valor válido maior que zero', variant: 'destructive' })
      return
    }

    const partnerIdForDebit =
      selectedPartner !== 'all'
        ? selectedPartner
        : debitoTargetPartnerId ||
          (selectedDistinctPartnerIds.length === 1 ? selectedDistinctPartnerIds[0] : '')

    if (editingDebitoIndex !== null) {
      const existing = activeDebitosList[editingDebitoIndex]
      if (existing?.id) {
        try {
          await updateParceiroDebito(existing.id, {
            descricao: debitoDescricao.trim(),
            valor: val,
          })
        } catch {
          /* ignored */
        }
      }

      // Atualiza lista local
      if (selectedPartner !== 'all') {
        const updatedList = [...debitos]
        const dIdx = debitos.findIndex((d) => d.id === existing?.id || d === existing)
        if (dIdx !== -1) {
          updatedList[dIdx] = {
            ...updatedList[dIdx],
            descricao: debitoDescricao.trim(),
            valor: val,
          }
          setDebitos(updatedList)
        }
      } else {
        setSelectionDebitos((prev) =>
          prev.map((d, i) =>
            i === editingDebitoIndex ? { ...d, descricao: debitoDescricao.trim(), valor: val } : d,
          ),
        )
      }
      toast({ title: 'Débito atualizado' })
    } else {
      let newId: string | undefined = undefined
      if (partnerIdForDebit) {
        try {
          const created = await createParceiroDebito({
            parceiro: partnerIdForDebit,
            descricao: debitoDescricao.trim(),
            valor: val,
            data: todayLocalDate(),
            status: 'Pendente',
          })
          newId = created.id
        } catch {
          /* fallback local */
        }
      }

      const pName = parceiros.find((p) => p.id === partnerIdForDebit)?.nome || 'Parceiro'

      if (selectedPartner !== 'all') {
        setDebitos((prev) => [
          ...prev,
          {
            id: newId,
            descricao: debitoDescricao.trim(),
            valor: val,
            data: todayLocalDate(),
          },
        ])
      } else {
        setSelectionDebitos((prev) => [
          ...prev,
          {
            id: newId,
            descricao: debitoDescricao.trim(),
            valor: val,
            data: todayLocalDate(),
            partnerId: partnerIdForDebit,
            partnerNome: pName,
          },
        ])
      }
      toast({ title: 'Débito adicionado' })
    }

    setIsDebitoDialogOpen(false)
  }

  const handleDeleteDebito = async (index: number) => {
    const item = activeDebitosList[index]
    if (item?.id) {
      try {
        await deleteParceiroDebito(item.id)
      } catch {
        /* ignored */
      }
    }
    if (selectedPartner !== 'all') {
      setDebitos((prev) => prev.filter((_, i) => i !== index))
    } else {
      setSelectionDebitos((prev) => prev.filter((_, i) => i !== index))
    }
    toast({ title: 'Débito removido' })
  }

  // Seleção múltipla por checkbox
  const pendingPaginatedEntries = useMemo(() => {
    return paginatedEntries.filter((e) => e.statusRepasse === 'Pendente' && e.policyId)
  }, [paginatedEntries])

  const isAllPaginatedPendingSelected = useMemo(() => {
    if (pendingPaginatedEntries.length === 0) return false
    return pendingPaginatedEntries.every(
      (e) => e.policyId && selectedPolicyIds.includes(e.policyId),
    )
  }, [pendingPaginatedEntries, selectedPolicyIds])

  const toggleSelectAllPaginated = () => {
    if (isAllPaginatedPendingSelected) {
      const pagePolicyIds = new Set(pendingPaginatedEntries.map((e) => e.policyId!))
      setSelectedPolicyIds((prev) => prev.filter((id) => !pagePolicyIds.has(id)))
    } else {
      const toAdd = pendingPaginatedEntries
        .map((e) => e.policyId!)
        .filter((id) => !selectedPolicyIds.includes(id))
      setSelectedPolicyIds((prev) => [...prev, ...toAdd])
    }
  }

  const toggleSelectPolicy = (policyId: string) => {
    setSelectedPolicyIds((prev) =>
      prev.includes(policyId) ? prev.filter((id) => id !== policyId) : [...prev, policyId],
    )
  }

  // Geração de PDF do relatório (opcionalmente restrito a apólices específicas, ex.: seleção)
  const handleGeneratePDF = (entriesToPrint?: PartnerReportEntry[]) => {
    const entries =
      entriesToPrint ||
      (hasSelection
        ? reportEntries.filter((e) => e.policyId && selectedPolicyIds.includes(e.policyId))
        : reportEntries)

    if (entries.length === 0) {
      toast({ title: 'Nenhum dado para gerar relatório', variant: 'destructive' })
      return
    }

    // Se as entradas pertencem todas ao mesmo parceiro, usa os dados desse parceiro
    const distinctPartnerIds = Array.from(new Set(entries.map((e) => e.partnerId).filter(Boolean)))
    const targetPartnerId =
      selectedPartner !== 'all'
        ? selectedPartner
        : distinctPartnerIds.length === 1
          ? (distinctPartnerIds[0] as string)
          : 'all'

    const selectedParceiro = parceiros.find((p) => p.id === targetPartnerId)
    const partnerName =
      targetPartnerId === 'all' ? 'Todos os Parceiros' : selectedParceiro?.nome || 'Parceiro'

    const pdfTotalBruto = entries.reduce((s, e) => s + e.valorRepasse, 0)
    const pdfTotalPaid = entries
      .filter((e) => e.statusRepasse === 'Pago')
      .reduce((s, e) => s + e.valorRepasse, 0)
    const pdfTotalPending = entries
      .filter((e) => e.statusRepasse === 'Pendente')
      .reduce((s, e) => s + e.valorRepasse, 0)

    // Se imprimindo a seleção do fechamento atual, usa os débitos e taxa vigentes
    const isCurrentSelection = !entriesToPrint || entriesToPrint === entries
    const pdfDebitos = isCurrentSelection ? totalDebitos : 0
    const pdfTaxaPix = isCurrentSelection ? taxaPixEfetiva : 0
    const pdfLiquido = isCurrentSelection
      ? totalLiquidoAPagar
      : Math.max(0, pdfTotalPending - pdfDebitos - pdfTaxaPix)
    const pdfSaldoCredorRemanescente = isCurrentSelection
      ? saldoCredorRemanescente
      : Math.max(0, pdfDebitos - pdfTotalPending)

    generatePartnerReportPDF({
      partnerName,
      isAllPartners: targetPartnerId === 'all',
      partnerInfo: selectedParceiro
        ? {
            nome: selectedParceiro.nome,
            cpf: selectedParceiro.cpf,
            telefone: selectedParceiro.telefone,
            email: selectedParceiro.email,
            dadosBancarios: selectedParceiro.dados_bancarios_ou_pix,
          }
        : null,
      foundClientName: foundClient?.name || null,
      foundClientDocument: foundClient ? formatClientDocument(foundClient) : null,
      generatedAt: new Date(),
      entries,
      totalBrutoRepasse: pdfTotalBruto,
      totalDebitos: pdfDebitos,
      debitosList: isCurrentSelection
        ? activeDebitosList.map((d) => ({
            descricao: d.descricao,
            valor: d.valor,
            data: d.data ? formatDateDisplay(d.data) : undefined,
            parceiroNome: d.parceiroNome,
          }))
        : [],
      taxaPixValor: pdfTaxaPix,
      totalLiquidoAPagar: pdfLiquido,
      totalPaid: pdfTotalPaid,
      totalPending: pdfTotalPending,
      saldoCredorRemanescente: pdfSaldoCredorRemanescente,
    })
  }

  // Atalho do usuário: Gerar relatório e seguir direto para pagamento das selecionadas
  const handleGerarRelatorioEPagarSelecionadas = () => {
    if (selectedPolicyIds.length === 0) {
      toast({
        title: 'Nenhuma apólice selecionada',
        description: 'Selecione ao menos uma apólice pendente nas caixas de seleção.',
        variant: 'destructive',
      })
      return
    }

    const selectedEntries = reportEntries.filter(
      (e) => e.policyId && selectedPolicyIds.includes(e.policyId) && e.statusRepasse === 'Pendente',
    )

    if (selectedEntries.length === 0) {
      toast({
        title: 'Nenhuma apólice pendente entre as selecionadas',
        description: 'Todas as apólices selecionadas já foram pagas.',
        variant: 'destructive',
      })
      return
    }

    // Se estiver com filtro "Todos os parceiros", verificar se pertencem ao mesmo parceiro
    const partnerIds = Array.from(new Set(selectedEntries.map((e) => e.partnerId).filter(Boolean)))
    if (partnerIds.length > 1) {
      toast({
        title: 'Parceiros múltiplos na seleção',
        description:
          'Selecione apenas apólices de um mesmo parceiro para gerar o relatório e realizar a baixa.',
        variant: 'destructive',
      })
      return
    }

    if (selectedPartner === 'all' && partnerIds.length === 1 && partnerIds[0]) {
      // Ajusta o parceiro selecionado automaticamente para alinhar os débitos e histórico
      setSelectedPartner(partnerIds[0])
    }

    // 1. Gera o PDF filtrado exatamente pelas selecionadas
    handleGeneratePDF(selectedEntries)

    // 2. Abre a confirmação de baixa para pagamento simultâneo
    setDataPagamentoFinal(todayLocalDate())
    setIsMarkPaidConfirmOpen(true)
  }

  // Marcar repasses como pagos e salvar histórico permanente de forma ATÔMICA e SEGURA
  const handleConfirmMarkAsPaid = async () => {
    // Determinar o ID do parceiro a baixar
    let targetPartnerId = selectedPartner
    if (!targetPartnerId || targetPartnerId === 'all') {
      const distinctPartners = Array.from(
        new Set(pendingPoliciesToPay.map((p) => p.parceiro).filter(Boolean)),
      )
      if (distinctPartners.length === 1 && distinctPartners[0]) {
        targetPartnerId = distinctPartners[0]
      } else {
        toast({
          title: 'Selecione um parceiro específico para registrar o pagamento',
          variant: 'destructive',
        })
        return
      }
    }

    if (pendingPoliciesToPay.length === 0) {
      toast({
        title: 'Nenhum repasse pendente para marcar como pago',
        variant: 'destructive',
      })
      return
    }

    setIsSavingPagamento(true)
    try {
      const policyIdsToPay = pendingPoliciesToPay.filter((p) => !p.pago_parceiro).map((p) => p.id)

      if (policyIdsToPay.length === 0) {
        toast({
          title: 'Nenhum repasse pendente',
          description:
            'Não existem apólices com repasse pendente para liquidar. Itens já pagos não podem compor um novo pagamento.',
          variant: 'destructive',
        })
        setIsMarkPaidConfirmOpen(false)
        setIsSavingPagamento(false)
        return
      }

      // Débitos efetivos a serem liquidados no fechamento transacional
      const debitosToClose =
        selectedPartner !== 'all'
          ? debitos
          : activeDebitosList
              .filter((d) => (d as any).partnerId === targetPartnerId || !(d as any).partnerId)
              .map((d) => ({
                id: d.id,
                descricao: d.descricao,
                valor: d.valor,
                data: d.data,
              }))

      // Chamada transacional ao endpoint seguro no servidor
      // Garante atomicidade: se falhar, nada é gravado.
      // Se débito > repasse disponível, abate somente o disponível e mantém o saldo restante pendente.
      // Repasse R$ 0,00 continua zero e nunca é recalculado.
      const canonicalDataPagamento = normalizeDateForPocketBase(
        dataPagamentoFinal || todayLocalDate(),
      )
      const res = await executarFechamentoParceiro({
        parceiro_id: targetPartnerId,
        data_pagamento: canonicalDataPagamento,
        observacoes: observacaoPagamento.trim(),
        debitos: debitosToClose.map((d) => ({
          ...d,
          data: normalizeDateForPocketBase(d.data || canonicalDataPagamento),
        })),
        taxa_pix_manual: taxaPixManual,
        policy_ids: policyIdsToPay,
      })

      if (!res.success) {
        throw new Error(res.error || 'Falha no fechamento transacional.')
      }

      toast({
        title: 'Pagamento concluído com sucesso!',
        description: `Fechamento gravado de forma atômica. Líquido pago: R$ ${fmt(res.valor_liquido)}`,
      })

      setIsMarkPaidConfirmOpen(false)
      setObservacaoPagamento('')
      setDebitos([])
      setSelectionDebitos([])
      setTaxaPixManual(null)
      setSelectedPolicyIds([])

      // Recarregar dados e débitos pendentes atualizados
      await loadData()
      const partnerToReload = targetPartnerId !== 'all' ? targetPartnerId : selectedPartner
      if (partnerToReload && partnerToReload !== 'all') {
        const [hist, debtList] = await Promise.all([
          getParceiroPagamentos(partnerToReload),
          getParceiroDebitosPendentes(partnerToReload),
        ])
        setPagamentosHistorico(hist)
        setDebitos(
          debtList.map((d) => ({
            id: d.id,
            descricao: d.descricao,
            valor: d.valor,
            data: d.data,
          })),
        )
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar pagamento',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsSavingPagamento(false)
    }
  }

  const showNotFoundMessage = documentNotFound
  const showNoCommissionsMessage = !!foundClient && reportEntries.length === 0

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 hover:text-slate-900"
            onClick={() => navigate('/financial')}
          >
            Voltar ao Financeiro
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Relatório de Comissões de Parceiros
            </h1>
            <p className="text-slate-500 text-sm">
              Fechamento de repasses, ajustes financeiros e histórico de transferências.
            </p>
          </div>
        </div>
        {selectedPartner !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            className="text-slate-700 hover:text-blue-600"
            onClick={() => setIsHistoricoOpen(true)}
          >
            <History className="w-4 h-4 mr-1.5" />
            Histórico de Pagamentos ({pagamentosHistorico.length})
          </Button>
        )}
      </div>

      {/* Card de Filtros e Ajustes */}
      <Card className="p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs font-semibold">Parceiro</Label>
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os parceiros</SelectItem>
                {filteredParceiros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-1 text-xs"
              placeholder="Filtrar parceiro por nome..."
              value={partnerSearch}
              onChange={(e) => setPartnerSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Filtrar por CPF/CNPJ</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                className="text-xs pl-8 pr-8"
                placeholder="CPF ou CNPJ..."
                value={cpfCnpjSearch}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
              />
              {cpfCnpjSearch && (
                <button
                  type="button"
                  onClick={handleClearDocument}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {foundClient && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs">
                <div className="font-semibold text-blue-700">Cliente localizado:</div>
                <div className="text-slate-800 font-medium">{foundClient.name}</div>
                <div className="text-slate-600">CPF/CNPJ: {formatClientDocument(foundClient)}</div>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold">Status Repasse Parceiro</Label>
            <Select value={repasseStatus} onValueChange={setRepasseStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Repasse Pago</SelectItem>
                <SelectItem value="pending">Repasse Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Status Seguradora</Label>
            <Select value={seguradoraStatus} onValueChange={setSeguradoraStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="received">Recebida</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Período</Label>
            <div className="grid grid-cols-2 gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Início"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Fim"
              />
            </div>
          </div>
        </div>

        {/* NOVA SEÇÃO: Ajustes deste pagamento (substitui Deduções Financeiras antigas) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 uppercase tracking-wider flex-wrap">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              Ajustes deste pagamento
              {selectedPartner !== 'all' ? (
                <span className="text-blue-600 font-normal lowercase">
                  (vinculado a{' '}
                  {parceiros.find((p) => p.id === selectedPartner)?.nome || 'parceiro selecionado'})
                </span>
              ) : hasSelection && selectedDistinctPartnerIds.length === 1 ? (
                <span className="text-emerald-700 font-normal lowercase flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" /> parceiro detectado na seleção:{' '}
                  <strong>
                    {parceiros.find((p) => p.id === selectedDistinctPartnerIds[0])?.nome ||
                      'Parceiro'}
                  </strong>
                </span>
              ) : hasSelection && selectedDistinctPartnerIds.length > 1 ? (
                <span className="text-amber-700 font-normal lowercase flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5" /> múltiplos parceiros selecionados (
                  {selectedDistinctPartnerIds.length}) — débitos agrupados por parceiro
                </span>
              ) : (
                <span className="text-amber-600 font-normal lowercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> selecione um parceiro no filtro ou marque
                  apólices para carregar débitos
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAddDebito}
              className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar débito
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Lista de Débitos do Parceiro */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                <span>Débitos do parceiro (adiantamentos / despesas / devoluções)</span>
                <span className="text-red-600 font-bold">Total: - R$ {fmt(totalDebitos)}</span>
              </div>

              {activeDebitosList.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-md p-3 text-center text-xs text-slate-500">
                  {selectedPartner === 'all' && !hasSelection
                    ? 'Nenhum débito carregado. Selecione um parceiro ou marque apólices pendentes.'
                    : 'Nenhum débito adicionado para este pagamento.'}{' '}
                  <button
                    type="button"
                    onClick={handleOpenAddDebito}
                    className="text-blue-600 font-medium hover:underline inline-flex items-center ml-1"
                  >
                    + Adicionar débito
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeDebitosList.map((deb, idx) => (
                    <div
                      key={deb.id || idx}
                      className="bg-white border border-slate-200 rounded-md p-2 flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex-1 pr-2 truncate">
                        <span className="font-semibold text-slate-800">{deb.descricao}</span>
                        {deb.parceiroNome && selectedPartner === 'all' && (
                          <span className="text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.2 text-[10px] ml-2 font-medium">
                            {deb.parceiroNome}
                          </span>
                        )}
                        {deb.data && (
                          <span className="text-slate-600 text-[11px] ml-2">
                            ({formatDateDisplay(deb.data)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-600 whitespace-nowrap">
                          - R$ {fmt(deb.valor)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                          onClick={() => handleOpenEditDebito(idx)}
                          title="Editar débito"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                          onClick={() => handleDeleteDebito(idx)}
                          title="Excluir débito"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Taxa de Transferência PIX */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-3 space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-800">
                  Taxa de Transferência PIX (R$)
                </Label>
                {taxaPixManual !== null && (
                  <button
                    type="button"
                    onClick={() => setTaxaPixManual(null)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Restaurar automático
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-semibold">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={
                      taxaPixManual !== null
                        ? taxaPixManual
                        : taxaPixCalculadaAuto > 0
                          ? taxaPixCalculadaAuto
                          : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value)
                      setTaxaPixManual(val)
                    }}
                    className="text-xs pl-8 font-semibold"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 leading-tight">
                Cálculo automático: <strong>1%</strong> do valor a transferir limitado ao teto de{' '}
                <strong>R$ 10,00</strong>.
                {taxaPixManual !== null && (
                  <span className="text-amber-700 font-medium block mt-0.5">
                    (Valor ajustado manualmente)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ações Inferiores do Painel de Filtro */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <span>
              {reportEntries.length} comissões encontradas |{' '}
              <strong className="text-slate-700">{allPendingPolicies.length} pendentes</strong>
            </span>
            {hasSelection && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                {selectedPolicyIds.length} apólice(s) selecionada(s) para fechamento
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasSelection && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                onClick={handleGerarRelatorioEPagarSelecionadas}
              >
                <CreditCard className="w-4 h-4 mr-2" /> Gerar relatório e pagar selecionadas (
                {selectedPolicyIds.length})
              </Button>
            )}
            <Button
              variant="outline"
              className="border-slate-300 hover:bg-slate-100"
              onClick={() => handleGeneratePDF()}
            >
              <FileDown className="w-4 h-4 mr-2 text-slate-700" />{' '}
              {hasSelection ? 'Gerar PDF (Selecionadas)' : 'Gerar PDF do Relatório'}
            </Button>
            {selectedPartner !== 'all' && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={pendingPoliciesToPay.length === 0}
                onClick={() => {
                  setDataPagamentoFinal(todayLocalDate())
                  setIsMarkPaidConfirmOpen(true)
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Marcar Repasse como Pago (
                {pendingPoliciesToPay.length})
              </Button>
            )}
          </div>
        </div>
      </Card>

      {showNotFoundMessage && (
        <Card className="p-6 text-center shadow-sm border-amber-200 bg-amber-50">
          <p className="text-amber-800 font-medium">
            Nenhum cliente encontrado para este CPF/CNPJ.
          </p>
        </Card>
      )}

      {showNoCommissionsMessage && (
        <Card className="p-6 text-center shadow-sm border-blue-200 bg-blue-50">
          <p className="text-blue-800 font-medium">
            Cliente encontrado, mas não há comissões de parceiro para os filtros selecionados.
          </p>
        </Card>
      )}

      {!showNotFoundMessage && !showNoCommissionsMessage && (
        <>
          {/* Tabela de Comissões */}
          <Card className="shadow-sm overflow-hidden border">
            {hasSelection && (
              <div className="bg-blue-50/90 border-b border-blue-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-blue-900 font-medium">
                  <strong>{selectedPolicyIds.length}</strong> apólice(s) selecionada(s) para
                  pagamento. O resumo de fechamento e a geração do relatório refletem apenas os
                  itens marcados.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => setSelectedPolicyIds([])}
                  >
                    Limpar seleção
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    onClick={handleGerarRelatorioEPagarSelecionadas}
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1" /> Gerar relatório e pagar selecionadas
                  </Button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <Checkbox
                        checked={isAllPaginatedPendingSelected}
                        disabled={pendingPaginatedEntries.length === 0}
                        onCheckedChange={toggleSelectAllPaginated}
                        aria-label="Selecionar todas as pendentes da página"
                        title="Selecionar todas as pendentes da página"
                      />
                    </th>
                    <th className="p-3.5">Nome do Cliente</th>
                    <th className="p-3.5">CPF/CNPJ</th>
                    <th className="p-3.5">Parceiro</th>
                    <th className="p-3.5">Seguradora</th>
                    <th className="p-3.5">Tipo de Seguro</th>
                    <th className="p-3.5 text-right">Valor Líquido</th>
                    <th className="p-3.5 text-center">% Repasse</th>
                    <th className="p-3.5 text-right">Bruto Repasse</th>
                    <th className="p-3.5 text-center">Repasse Parceiro</th>
                    <th className="p-3.5 text-center">Data Repasse</th>
                    <th className="p-3.5 text-center">Seguradora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedEntries.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center p-6 text-slate-500">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((e, i) => {
                      const isPending = e.statusRepasse === 'Pendente'
                      const isSelected = !!e.policyId && selectedPolicyIds.includes(e.policyId)

                      return (
                        <tr
                          key={e.policyId || i}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            {isPending && e.policyId ? (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectPolicy(e.policyId!)}
                                aria-label={`Selecionar apólice ${e.clientName}`}
                                title="Marcar apólice para pagamento"
                              />
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-3.5 font-semibold">{e.clientName}</td>
                          <td className="p-3.5 text-xs text-slate-600">{e.clientCpfCnpj || '-'}</td>
                          <td className="p-3.5">
                            <span className="font-semibold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                              {e.partnerName || '-'}
                            </span>
                          </td>
                          <td className="p-3.5">{e.seguradoraName}</td>
                          <td className="p-3.5">{e.tipoSeguro}</td>
                          <td className="p-3.5 text-right font-bold">R$ {fmt(e.valorLiquido)}</td>
                          <td className="p-3.5 text-center">{e.repassePercent}%</td>
                          <td className="p-3.5 text-right font-bold text-blue-600">
                            R$ {fmt(e.valorRepasse)}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              className={
                                e.statusRepasse === 'Pago' ? 'bg-emerald-500' : 'bg-amber-500'
                              }
                            >
                              {e.statusRepasse === 'Pago' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-center text-xs">
                            {e.dataPagamentoRepasse || '-'}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              className={
                                e.statusSeguradora === 'Recebida'
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                              }
                            >
                              {e.statusSeguradora}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
              <span>
                Exibindo {reportEntries.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} a{' '}
                {Math.min(page * PAGE_SIZE, reportEntries.length)} de {reportEntries.length}{' '}
                comissões
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

          {/* NOVO RESUMO DO PAGAMENTO COM DESTAQUE VISUAL (Item 4 dos Requisitos) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Status Geral de Repasses */}
            <div className="lg:col-span-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
                  <span className="text-emerald-700 font-semibold text-xs block">
                    Repasses Pagos:
                  </span>
                  <span className="font-bold text-lg text-emerald-900">R$ {fmt(totalPaid)}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5">
                  <span className="text-amber-700 font-semibold text-xs block">
                    {hasSelection ? 'Repasses Selecionados:' : 'Repasses Pendentes:'}
                  </span>
                  <span className="font-bold text-lg text-amber-900">R$ {fmt(totalPending)}</span>
                  {hasSelection && (
                    <span className="text-[11px] text-amber-800 block mt-0.5">
                      (Total geral pendente: R$ {fmt(totalPendingAll)})
                    </span>
                  )}
                </div>
              </div>

              {selectedPartner !== 'all' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Dica de Fechamento:</span> Ao
                  clicar em <em>"Marcar Repasse como Pago"</em>, o valor líquido final calculado, os
                  débitos e a taxa PIX ficarão registrados permanentemente no histórico deste
                  parceiro.
                </div>
              )}
            </div>

            {/* CARD DESTACADO: Resumo do Pagamento / Líquido a Pagar */}
            <Card className="lg:col-span-7 p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border-2 border-blue-600 shadow-md space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-blue-600" /> Resumo do Pagamento / Fechamento
                </h4>
                {selectedPartner !== 'all' && (
                  <Badge variant="outline" className="text-xs bg-white text-blue-700">
                    {parceiros.find((p) => p.id === selectedPartner)?.nome || 'Parceiro'}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>Total das Comissões (Bruto):</span>
                  <span className="font-semibold text-slate-900">R$ {fmt(totalBrutoRepasse)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Repasses já Pagos:</span>
                  <span className="font-semibold text-emerald-700">R$ {fmt(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>
                    {hasSelection
                      ? `Repasses Selecionados a Pagar (${pendingPoliciesToPay.length} itens):`
                      : 'Repasses Pendentes a Pagar (Base):'}
                  </span>
                  <span className="font-bold text-amber-700">R$ {fmt(totalPending)}</span>
                </div>

                {totalDebitos > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>
                      (-) Débitos do Parceiro ({activeDebitosList.length}{' '}
                      {activeDebitosList.length === 1 ? 'item' : 'itens'}):
                    </span>
                    <span className="font-semibold">- R$ {fmt(totalDebitos)}</span>
                  </div>
                )}

                {saldoCredorRemanescente > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 space-y-0.5">
                    <div className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Débito pendente retido
                      / saldo com a corretora
                    </div>
                    <div>
                      O valor do débito cadastrado (R$ {fmt(totalDebitos)}) é maior ou igual ao
                      repasse liberado neste fechamento (R$ {fmt(totalPending)}). O valor a
                      transferir fica R$ 0,00 e o saldo de{' '}
                      <strong>R$ {fmt(saldoCredorRemanescente)}</strong> permanece pendente para
                      compensação nos próximos repasses.
                    </div>
                  </div>
                )}

                {taxaPixEfetiva > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>(-) Taxa de Transferência PIX:</span>
                    <span className="font-semibold">- R$ {fmt(taxaPixEfetiva)}</span>
                  </div>
                )}

                {/* Bloco de Destaque Visual do Líquido a Transferir */}
                <div className="border-t-2 border-blue-600 pt-3 mt-2 bg-blue-600 text-white rounded-lg p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-inner">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-90 block">
                      Valor Líquido a Pagar (Transferência)
                    </span>
                    <span className="text-[11px] opacity-80">
                      Efetivamente a ser transferido via PIX
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight">
                    R$ {fmt(totalLiquidoAPagar)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* DIALOG: Adicionar / Editar Débito */}
      <Dialog open={isDebitoDialogOpen} onOpenChange={setIsDebitoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDebitoIndex !== null ? 'Editar Débito' : 'Adicionar Débito do Parceiro'}
            </DialogTitle>
            <DialogDescription>
              Informe o valor e o motivo do débito a ser descontado deste fechamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {selectedPartner === 'all' && (
              <div>
                <Label className="text-xs font-semibold">Parceiro Vinculado *</Label>
                <Select value={debitoTargetPartnerId} onValueChange={setDebitoTargetPartnerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parceiros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold">Valor do Débito (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 150.00"
                value={debitoValor}
                onChange={(e) => setDebitoValor(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Motivo / Descrição *</Label>
              <Input
                placeholder="Ex: Adiantamento solicitado em 12/05, taxa operacional..."
                value={debitoDescricao}
                onChange={(e) => setDebitoDescricao(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsDebitoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSaveDebito}
            >
              {editingDebitoIndex !== null ? 'Salvar Alteração' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: Confirmar Marcar como Pago e Salvar Histórico Permanente */}
      <AlertDialog open={isMarkPaidConfirmOpen} onOpenChange={setIsMarkPaidConfirmOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">
              Confirmar Pagamento ao Parceiro
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-slate-600 mt-2">
                <p>
                  Você está finalizando o fechamento e registrando o pagamento para{' '}
                  <strong className="text-slate-900">
                    {parceiros.find(
                      (p) =>
                        p.id ===
                        (selectedPartner !== 'all'
                          ? selectedPartner
                          : pendingPoliciesToPay[0]?.parceiro),
                    )?.nome || 'Parceiro'}
                  </strong>
                  .
                </p>

                <div className="p-3 bg-slate-50 border rounded-md space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>
                      {hasSelection
                        ? `Repasses Selecionados (${pendingPoliciesToPay.length}):`
                        : `Repasses Pendentes (${pendingPoliciesToPay.length}):`}
                    </span>
                    <strong className="text-slate-800">R$ {fmt(totalPending)}</strong>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>(-) Débitos:</span>
                    <strong>- R$ {fmt(totalDebitos)}</strong>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>(-) Taxa PIX:</span>
                    <strong>- R$ {fmt(taxaPixEfetiva)}</strong>
                  </div>
                  <div className="flex justify-between font-bold text-blue-700 border-t pt-1">
                    <span>Líquido a Transferir:</span>
                    <span>R$ {fmt(totalLiquidoAPagar)}</span>
                  </div>
                  {saldoCredorRemanescente > 0 && (
                    <div className="text-amber-700 font-semibold pt-1 border-t border-amber-200">
                      Saldo devedor do parceiro a compensar: R$ {fmt(saldoCredorRemanescente)}
                    </div>
                  )}
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold text-slate-700">Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={dataPagamentoFinal}
                    onChange={(e) => setDataPagamentoFinal(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Observações (opcional)
                  </Label>
                  <Input
                    placeholder="Ex: Comprovante PIX enviado por WhatsApp..."
                    value={observacaoPagamento}
                    onChange={(e) => setObservacaoPagamento(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <p className="text-[11px] text-slate-500 italic mt-1">
                  * Este registro ficará salvo no histórico e não afetará os próximos relatórios do
                  parceiro.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingPagamento}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={(e) => {
                e.preventDefault()
                handleConfirmMarkAsPaid()
              }}
              disabled={isSavingPagamento}
            >
              {isSavingPagamento ? 'Registrando...' : 'Confirmar e Salvar Histórico'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL: Histórico de Pagamentos Realizados */}
      <Dialog open={isHistoricoOpen} onOpenChange={setIsHistoricoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Histórico de Pagamentos —{' '}
              {parceiros.find((p) => p.id === selectedPartner)?.nome || 'Parceiro'}
            </DialogTitle>
            <DialogDescription>
              Registros consolidados de fechamentos e repasses realizados anteriormente.
            </DialogDescription>
          </DialogHeader>

          {pagamentosHistorico.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Nenhum histórico de pagamento registrado ainda para este parceiro.
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {pagamentosHistorico.map((pag) => {
                let parsedDebitos: ParceiroDebitoItem[] = []
                try {
                  if (pag.detalhes_debitos) {
                    parsedDebitos = JSON.parse(pag.detalhes_debitos)
                  }
                } catch {
                  /* fallback */
                }

                return (
                  <Card key={pag.id} className="p-3.5 border bg-white space-y-2 text-xs">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">
                          Pago em {formatDateDisplay(pag.data_pagamento)}
                        </span>
                        {pag.usuario_nome && (
                          <span className="text-slate-600 text-[11px] block">
                            Registrado por: {pag.usuario_nome}
                          </span>
                        )}
                      </div>
                      <Badge className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1">
                        Líquido: R$ {fmt(pag.valor_liquido)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-slate-700 pt-1">
                      <div>
                        <span className="text-slate-600 text-[11px]">Total Comissões:</span>
                        <div className="font-semibold text-slate-900">
                          R$ {fmt(pag.total_comissoes)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-600 text-[11px]">(-) Débitos:</span>
                        <div className="font-semibold text-red-600">
                          - R$ {fmt(pag.total_debitos)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-600 text-[11px]">(-) Taxa PIX:</span>
                        <div className="font-semibold text-red-600">- R$ {fmt(pag.taxa_pix)}</div>
                      </div>
                    </div>

                    {parsedDebitos.length > 0 && (
                      <div className="bg-slate-50 border rounded p-2 text-[11px] space-y-1">
                        <span className="font-semibold text-slate-700">Débitos deduzidos:</span>
                        {parsedDebitos.map((d, i) => (
                          <div key={i} className="flex justify-between text-slate-600">
                            <span>• {d.descricao}</span>
                            <span className="text-red-600">- R$ {fmt(d.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {pag.observacoes && (
                      <div className="text-[11px] text-slate-600 italic">
                        <strong>Obs:</strong> {pag.observacoes}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoricoOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
