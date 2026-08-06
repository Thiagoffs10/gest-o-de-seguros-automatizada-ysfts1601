import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileDown, X, Search } from 'lucide-react'
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
  const [status, setStatus] = useState('all')
  const [cpfCnpjSearch, setCpfCnpjSearch] = useState('')
  const [foundClient, setFoundClient] = useState<Client | null>(null)
  const [documentNotFound, setDocumentNotFound] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
    if (status === 'received') result = result.filter((p) => p.comissao_recebida)
    else if (status === 'pending') result = result.filter((p) => !p.comissao_recebida)
    if (dateFrom) {
      result = result.filter((p) => {
        const ref = p.data_recebimento_comissao || ''
        return ref && ref >= dateFrom
      })
    }
    if (dateTo) {
      result = result.filter((p) => {
        const ref = p.data_recebimento_comissao || ''
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
      const client = p.expand?.client
      return {
        clientName: client?.name || 'N/A',
        clientCpfCnpj: client ? formatClientDocument(client) : '',
        seguradoraName: p.expand?.seguradora?.nome || p.insurance_company || 'N/A',
        tipoSeguro: p.tipo_de_seguro || p.coverage_type || 'N/A',
        valorLiquido,
        repassePercent,
        valorRepasse,
        status: p.comissao_recebida ? 'Recebida' : 'Pendente',
        paymentDate: p.data_recebimento_comissao
          ? formatDateDisplay(p.data_recebimento_comissao)
          : '',
      }
    })
  }, [policies, selectedPartner, status, dateFrom, dateTo, foundClient])

  const totalPaid = reportEntries
    .filter((e) => e.status === 'Recebida')
    .reduce((s, e) => s + e.valorRepasse, 0)
  const totalPending = reportEntries
    .filter((e) => e.status === 'Pendente')
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
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
                placeholder="CPF ou CNPJ do cliente..."
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
            <Label className="text-xs font-semibold">Status da Comissão</Label>
            <Select value={status} onValueChange={setStatus}>
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
            <Label className="text-xs font-semibold">Data Inicial</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-semibold">Data Final</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleGeneratePDF}>
            <FileDown className="w-4 h-4 mr-2" /> Gerar PDF
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
                    <th className="p-3.5 text-right">Valor do Repasse</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Data Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-6 text-slate-500">
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
                            className={e.status === 'Recebida' ? 'bg-emerald-500' : 'bg-amber-500'}
                          >
                            {e.status}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-center text-xs">{e.paymentDate || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
              <span className="text-emerald-700 font-semibold">Total Recebido: </span>
              <span className="font-bold text-emerald-900">R$ {fmt(totalPaid)}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
              <span className="text-amber-700 font-semibold">Total Pendente: </span>
              <span className="font-bold text-amber-900">R$ {fmt(totalPending)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
