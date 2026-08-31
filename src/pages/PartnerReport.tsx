import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { findClientByDocument } from '@/services/clients'
import {
  getParceiroPagamentos,
  createParceiroPagamento,
  getParceiroDebitosPendentes,
  createParceiroDebito,
  updateParceiroDebito,
  deleteParceiroDebito,
  liquidarDebitosPagamento,
} from '@/services/parceiro-pagamentos'
import { Policy, Parceiro, Client, ParceiroDebitoItem, ParceiroPagamento } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { formatDateDisplay, todayLocalDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'

const fmt = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PartnerReport() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [policies, setPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [partnerSearch, setPartnerSearch] = useState('')
  const [selectedPartner, setSelectedPartner] = useState('all')
  const [repasseStatus, setRepasseStatus] = useState('all') // 'all' | 'paid' | 'pending'
  const [seguradoraStatus, setSeguradoraStatus] = useState('all') // 'all' | 'received' | 'pending'
  const [cpfCnpjSearch, setCpfCnpjSearch] = useState('')
  const [foundClient, setFoundClient] = useState<Client | null>(null)
  const [documentNotFound, setDocumentNotFound] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Débitos do parceiro selecionado para este fechamento/pagamento
  const [debitos, setDebitos] = useState<ParceiroDebitoItem[]>([])
  const [isDebitoDialogOpen, setIsDebitoDialogOpen] = useState(false)
  const [editingDebitoIndex, setEditingDebitoIndex] = useState<number | null>(null)
  const [debitoDescricao, setDebitoDescricao] = useState('')
  const [debitoValor, setDebitoValor] = useState<string>('')

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

    if (dateFrom) {
      result = result.filter((p) => {
        const ref = p.start_date || p.data_pagamento_parceiro || ''
        return ref && ref >= dateFrom
      })
    }
    if (dateTo) {
      result = result.filter((p) => {
        const ref = p.start_date || p.data_pagamento_parceiro || ''
        return ref && ref <= dateTo
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
      const repassePercent = p.percentual_repasse || 0
      const valorRepasse = p.valor_repasse || (repassePercent / 100) * valorLiquido
      const client = p.expand?.client

      return {
        clientName: client?.name || 'N/A',
        clientCpfCnpj: client ? formatClientDocument(client) : '',
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
  }, [filteredPolicies])

  const totalBrutoRepasse = useMemo(
    () => reportEntries.reduce((s, e) => s + e.valorRepasse, 0),
    [reportEntries],
  )

  // Somatório dos débitos do parceiro
  const totalDebitos = useMemo(
    () => debitos.reduce((s, d) => s + (Number(d.valor) || 0), 0),
    [debitos],
  )

  // Base para cálculo da taxa PIX: valor após débitos (se positivo) ou total bruto
  // Cálculo automático da taxa PIX: 1% sobre o valor da transferência, limitado ao máximo de R$ 10,00 (mínimo R$ 0)
  const taxaPixCalculadaAuto = useMemo(() => {
    if (totalBrutoRepasse <= 0) return 0
    const baseTransferencia = Math.max(0, totalBrutoRepasse - totalDebitos)
    const taxa = (baseTransferencia * 1) / 100
    const taxaLimitada = Math.min(10, taxa)
    return Math.round(taxaLimitada * 100) / 100
  }, [totalBrutoRepasse, totalDebitos])

  // Taxa PIX efetiva (se foi editada manualmente, usa o valor manual; caso contrário a calculada automaticamente)
  const taxaPixEfetiva = useMemo(() => {
    if (taxaPixManual !== null && !isNaN(taxaPixManual) && taxaPixManual >= 0) {
      return taxaPixManual
    }
    return taxaPixCalculadaAuto
  }, [taxaPixManual, taxaPixCalculadaAuto])

  // Líquido a Pagar final (destacado na tela)
  const totalLiquidoAPagar = useMemo(() => {
    const liquido = totalBrutoRepasse - totalDebitos - taxaPixEfetiva
    return Math.max(0, Math.round(liquido * 100) / 100)
  }, [totalBrutoRepasse, totalDebitos, taxaPixEfetiva])

  const totalPaid = reportEntries
    .filter((e) => e.statusRepasse === 'Pago')
    .reduce((s, e) => s + e.valorRepasse, 0)
  const totalPending = reportEntries
    .filter((e) => e.statusRepasse === 'Pendente')
    .reduce((s, e) => s + e.valorRepasse, 0)

  // Apólices pendentes de repasse para o parceiro selecionado no fechamento
  const pendingPoliciesToPay = useMemo(() => {
    return filteredPolicies.filter((p) => !p.pago_parceiro)
  }, [filteredPolicies])

  // Ações de Débito
  const handleOpenAddDebito = () => {
    setEditingDebitoIndex(null)
    setDebitoDescricao('')
    setDebitoValor('')
    setIsDebitoDialogOpen(true)
  }

  const handleOpenEditDebito = (index: number) => {
    const item = debitos[index]
    if (!item) return
    setEditingDebitoIndex(index)
    setDebitoDescricao(item.descricao)
    setDebitoValor(String(item.valor))
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

    if (editingDebitoIndex !== null) {
      const existing = debitos[editingDebitoIndex]
      const updatedList = [...debitos]
      updatedList[editingDebitoIndex] = {
        ...existing,
        descricao: debitoDescricao.trim(),
        valor: val,
      }
      setDebitos(updatedList)

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
      toast({ title: 'Débito atualizado' })
    } else {
      let newId: string | undefined = undefined
      if (selectedPartner && selectedPartner !== 'all') {
        try {
          const created = await createParceiroDebito({
            parceiro: selectedPartner,
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
      setDebitos((prev) => [
        ...prev,
        {
          id: newId,
          descricao: debitoDescricao.trim(),
          valor: val,
          data: todayLocalDate(),
        },
      ])
      toast({ title: 'Débito adicionado' })
    }

    setIsDebitoDialogOpen(false)
  }

  const handleDeleteDebito = async (index: number) => {
    const item = debitos[index]
    if (item?.id) {
      try {
        await deleteParceiroDebito(item.id)
      } catch {
        /* ignored */
      }
    }
    setDebitos((prev) => prev.filter((_, i) => i !== index))
    toast({ title: 'Débito removido' })
  }

  // Geração de PDF do relatório
  const handleGeneratePDF = () => {
    if (reportEntries.length === 0) {
      toast({ title: 'Nenhum dado para gerar relatório', variant: 'destructive' })
      return
    }
    const selectedParceiro = parceiros.find((p) => p.id === selectedPartner)
    const partnerName =
      selectedPartner === 'all' ? 'Todos os Parceiros' : selectedParceiro?.nome || 'Parceiro'

    generatePartnerReportPDF({
      partnerName,
      isAllPartners: selectedPartner === 'all',
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
      entries: reportEntries,
      totalBrutoRepasse,
      totalDebitos,
      debitosList: debitos,
      taxaPixValor: taxaPixEfetiva,
      totalLiquidoAPagar,
      totalPaid,
      totalPending,
    })
  }

  // Marcar repasses como pagos e salvar histórico permanente
  const handleConfirmMarkAsPaid = async () => {
    if (!selectedPartner || selectedPartner === 'all') {
      toast({
        title: 'Selecione um parceiro específico para registrar o pagamento',
        variant: 'destructive',
      })
      return
    }

    if (pendingPoliciesToPay.length === 0 && totalBrutoRepasse === 0) {
      toast({
        title: 'Nenhum repasse pendente para marcar como pago neste filtro',
        variant: 'destructive',
      })
      return
    }

    setIsSavingPagamento(true)
    try {
      const policyIdsToPay = pendingPoliciesToPay.map((p) => p.id)

      // 1. Criar registro histórico de fechamento/pagamento
      const novoPagamento = await createParceiroPagamento({
        parceiro: selectedPartner,
        data_pagamento: dataPagamentoFinal || todayLocalDate(),
        total_comissoes: totalBrutoRepasse,
        total_debitos: totalDebitos,
        taxa_pix: taxaPixEfetiva,
        valor_liquido: totalLiquidoAPagar,
        policies_ids: JSON.stringify(policyIdsToPay),
        detalhes_debitos: JSON.stringify(debitos),
        observacoes: observacaoPagamento.trim(),
        usuario_id: user?.id,
        usuario_nome: user?.name || user?.email || '',
      })

      // 2. Liquidar débitos vinculando ao pagamento
      await liquidarDebitosPagamento(debitos, selectedPartner, novoPagamento.id)

      // 3. Atualizar as apólices pendentes para pago_parceiro = true com a data
      for (const policyId of policyIdsToPay) {
        await updatePolicyFinancial(policyId, {
          pago_parceiro: true,
          data_pagamento_parceiro: dataPagamentoFinal || todayLocalDate(),
          forma_pagamento_repasse: 'PIX',
        })
      }

      toast({
        title: 'Pagamento concluído com sucesso!',
        description: `Histórico salvo. Líquido pago: R$ ${fmt(totalLiquidoAPagar)}`,
      })

      setIsMarkPaidConfirmOpen(false)
      setObservacaoPagamento('')
      setDebitos([])
      setTaxaPixManual(null)

      // Recarregar dados
      await loadData()
      if (selectedPartner !== 'all') {
        const hist = await getParceiroPagamentos(selectedPartner)
        setPagamentosHistorico(hist)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar pagamento',
        description: err.message || 'Tente novamente.',
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
          <Button variant="outline" size="sm" onClick={() => navigate('/parceiros')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
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
            <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 uppercase tracking-wider">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              Ajustes deste pagamento
              {selectedPartner !== 'all' ? (
                <span className="text-blue-600 font-normal lowercase">
                  (vinculado ao parceiro selecionado)
                </span>
              ) : (
                <span className="text-amber-600 font-normal lowercase flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> selecione um parceiro específico para
                  ajustes precisos
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

              {debitos.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-md p-3 text-center text-xs text-slate-500">
                  Nenhum débito adicionado para este pagamento.{' '}
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
                  {debitos.map((deb, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-md p-2 flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex-1 pr-2 truncate">
                        <span className="font-semibold text-slate-800">{deb.descricao}</span>
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
          <div className="text-xs text-slate-500">
            {reportEntries.length} comissões encontradas |{' '}
            <strong className="text-slate-700">{pendingPoliciesToPay.length} pendentes</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-300 hover:bg-slate-100"
              onClick={handleGeneratePDF}
            >
              <FileDown className="w-4 h-4 mr-2 text-slate-700" /> Gerar PDF do Relatório
            </Button>
            {selectedPartner !== 'all' && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={() => {
                  setDataPagamentoFinal(todayLocalDate())
                  setIsMarkPaidConfirmOpen(true)
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Marcar Repasse como Pago
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3.5">Nome do Cliente</th>
                    <th className="p-3.5">CPF/CNPJ</th>
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
                  {reportEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center p-6 text-slate-500">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    reportEntries.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-semibold">{e.clientName}</td>
                        <td className="p-3.5 text-xs">{e.clientCpfCnpj || '-'}</td>
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
                              e.statusSeguradora === 'Recebida' ? 'bg-emerald-500' : 'bg-amber-500'
                            }
                          >
                            {e.statusSeguradora}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

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
                    Repasses Pendentes:
                  </span>
                  <span className="font-bold text-lg text-amber-900">R$ {fmt(totalPending)}</span>
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
                  <span className="font-bold text-slate-900">R$ {fmt(totalBrutoRepasse)}</span>
                </div>

                {totalDebitos > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>
                      (-) Débitos do Parceiro ({debitos.length}{' '}
                      {debitos.length === 1 ? 'item' : 'itens'}):
                    </span>
                    <span className="font-semibold">- R$ {fmt(totalDebitos)}</span>
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
                    {parceiros.find((p) => p.id === selectedPartner)?.nome}
                  </strong>
                  .
                </p>

                <div className="p-3 bg-slate-50 border rounded-md space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Total Comissões:</span>
                    <strong className="text-slate-800">R$ {fmt(totalBrutoRepasse)}</strong>
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
