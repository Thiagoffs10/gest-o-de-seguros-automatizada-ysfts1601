import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileDown, X, Search, DollarSign } from 'lucide-react'
import { getPolicies } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { findClientByDocument } from '@/services/clients'
import { Policy, Parceiro, Client } from '@/types'
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
import { generatePartnerReportPDF, PartnerReportEntry } from '@/lib/partner-report-pdf'
import { maskDocument, formatClientDocument } from '@/lib/document-validators'
import { formatDateDisplay } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PartnerReport() {
  const navigate = useNavigate()
  const { toast } = useToast()
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

  // Taxa de Transferência / PIX e Adiantamentos
  const [taxaPixPercent, setTaxaPixPercent] = useState<number>(0)
  const [adiantamentoValor, setAdiantamentoValor] = useState<number>(0)
  const [adiantamentoDescricao, setAdiantamentoDescricao] = useState('')

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

  const reportEntries: PartnerReportEntry[] = useMemo(() => {
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

    return result.map((p) => {
      const valorLiquido = p.valor_liquido || p.premium_amount || 0
      const repassePercent = p.percentual_repasse || 0
      const valorRepasse = p.valor_repasse || (repassePercent / 100) * valorLiquido
      const taxaVal = Math.round(((valorRepasse * (taxaPixPercent || 0)) / 100) * 100) / 100
      const valorLiquidoRepasse = Math.round((valorRepasse - taxaVal) * 100) / 100
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
        taxaPercent: taxaPixPercent || 0,
        taxaValor: taxaVal,
        valorLiquidoRepasse,
      }
    })
  }, [
    policies,
    selectedPartner,
    repasseStatus,
    seguradoraStatus,
    dateFrom,
    dateTo,
    foundClient,
    taxaPixPercent,
  ])

  const totalBrutoRepasse = useMemo(
    () => reportEntries.reduce((s, e) => s + e.valorRepasse, 0),
    [reportEntries],
  )
  const totalTaxaPix = useMemo(
    () => Math.round(((totalBrutoRepasse * (taxaPixPercent || 0)) / 100) * 100) / 100,
    [totalBrutoRepasse, taxaPixPercent],
  )
  const totalLiquidoAPagar = useMemo(
    () =>
      Math.max(
        0,
        Math.round((totalBrutoRepasse - totalTaxaPix - (adiantamentoValor || 0)) * 100) / 100,
      ),
    [totalBrutoRepasse, totalTaxaPix, adiantamentoValor],
  )

  const totalPaid = reportEntries
    .filter((e) => e.statusRepasse === 'Pago')
    .reduce((s, e) => s + e.valorRepasse, 0)
  const totalPending = reportEntries
    .filter((e) => e.statusRepasse === 'Pendente')
    .reduce((s, e) => s + e.valorRepasse, 0)

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
      totalTaxaPix,
      taxaPixPercent,
      totalAdiantamentos: adiantamentoValor || 0,
      adiantamentosDescricao: adiantamentoDescricao || '',
      totalLiquidoAPagar,
      totalPaid,
      totalPending,
    })
  }

  const showNotFoundMessage = documentNotFound
  const showNoCommissionsMessage = !!foundClient && reportEntries.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/parceiros')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Comissões de Parceiros</h1>
          <p className="text-slate-500 text-sm">Comissões de parceiros — pagas e pendentes.</p>
        </div>
      </div>

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

        {/* Seção de Deduções: Taxa PIX e Adiantamentos */}
        <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-700 uppercase tracking-wider">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Deduções Financeiras do Parceiro (Taxa PIX / Adiantamentos)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Taxa Transferência / PIX (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Ex: 1.5"
                value={taxaPixPercent || ''}
                onChange={(e) => setTaxaPixPercent(Number(e.target.value))}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Valor da taxa: <strong className="text-red-600">R$ {fmt(totalTaxaPix)}</strong>
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold">
                Dívida / Adiantamento / Antecipação (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 250.00"
                value={adiantamentoValor || ''}
                onChange={(e) => setAdiantamentoValor(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descrição / Motivo do Adiantamento</Label>
              <Input
                placeholder="Ex: Adiantamento solicitado em 10/05"
                value={adiantamentoDescricao}
                onChange={(e) => setAdiantamentoDescricao(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleGeneratePDF}>
            <FileDown className="w-4 h-4 mr-2" /> Gerar PDF do Relatório
          </Button>
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

          {/* Demonstrativo Financeiro do Relatório do Parceiro */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
                <span className="text-emerald-700 font-semibold">Repasses Pagos: </span>
                <span className="font-bold text-emerald-900">R$ {fmt(totalPaid)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
                <span className="text-amber-700 font-semibold">Repasses Pendentes: </span>
                <span className="font-bold text-amber-900">R$ {fmt(totalPending)}</span>
              </div>
            </div>

            <Card className="p-4 bg-slate-50 border space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Demonstrativo de Fechamento do Parceiro
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Valor Bruto do Repasse:</span>
                  <span className="font-semibold text-slate-900">R$ {fmt(totalBrutoRepasse)}</span>
                </div>
                {(taxaPixPercent > 0 || totalTaxaPix > 0) && (
                  <div className="flex justify-between text-red-600">
                    <span>Taxa Transferência/PIX ({taxaPixPercent}%):</span>
                    <span className="font-semibold">- R$ {fmt(totalTaxaPix)}</span>
                  </div>
                )}
                {adiantamentoValor > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>
                      Dívidas / Adiantamentos{' '}
                      {adiantamentoDescricao ? `(${adiantamentoDescricao})` : ''}:
                    </span>
                    <span className="font-semibold">- R$ {fmt(adiantamentoValor)}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-1 flex justify-between text-sm font-bold text-blue-700">
                  <span>Valor Líquido a Pagar:</span>
                  <span>R$ {fmt(totalLiquidoAPagar)}</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
