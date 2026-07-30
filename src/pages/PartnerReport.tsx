import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileDown, Search } from 'lucide-react'
import { getPolicies } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { Policy, Parceiro } from '@/types'
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
import { useToast } from '@/hooks/use-toast'

export default function PartnerReport() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [partnerSearch, setPartnerSearch] = useState('')
  const [selectedPartner, setSelectedPartner] = useState('all')
  const [status, setStatus] = useState('all')
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

  const filteredParceiros = useMemo(() => {
    if (!partnerSearch) return parceiros
    const q = partnerSearch.toLowerCase()
    return parceiros.filter((p) => p.nome?.toLowerCase().includes(q))
  }, [parceiros, partnerSearch])

  const reportEntries: PartnerReportEntry[] = useMemo(() => {
    let result = policies
    if (selectedPartner !== 'all') {
      result = result.filter((p) => p.parceiro === selectedPartner)
    }
    if (status === 'paid') result = result.filter((p) => p.pago_parceiro)
    else if (status === 'pending') result = result.filter((p) => !p.pago_parceiro)

    if (dateFrom) {
      result = result.filter((p) => {
        const ref = p.pago_parceiro ? p.data_pagamento_parceiro : p.created?.split(' ')[0]
        return ref && ref >= dateFrom
      })
    }
    if (dateTo) {
      result = result.filter((p) => {
        const ref = p.pago_parceiro ? p.data_pagamento_parceiro : p.created?.split(' ')[0]
        return ref && ref <= dateTo
      })
    }

    return result.map((p) => {
      const valorLiquido = p.valor_liquido || p.premium_amount || 0
      const repassePercent = p.valor_repasse || 0
      const valorRepasse = (repassePercent / 100) * valorLiquido
      return {
        clientName: p.expand?.client?.name || 'N/A',
        seguradoraName: p.expand?.seguradora?.nome || p.insurance_company || 'N/A',
        tipoSeguro: p.tipo_de_seguro || p.coverage_type || 'N/A',
        valorLiquido,
        repassePercent,
        valorRepasse,
        status: p.pago_parceiro ? 'Pago' : 'Em aberto',
      }
    })
  }, [policies, selectedPartner, status, dateFrom, dateTo])

  const totalPaid = reportEntries
    .filter((e) => e.status === 'Pago')
    .reduce((s, e) => s + e.valorRepasse, 0)
  const totalPending = reportEntries
    .filter((e) => e.status === 'Em aberto')
    .reduce((s, e) => s + e.valorRepasse, 0)

  const handleGeneratePDF = () => {
    if (reportEntries.length === 0) {
      toast({ title: 'Nenhum dado para gerar relatório', variant: 'destructive' })
      return
    }
    const partnerName =
      selectedPartner === 'all'
        ? 'Todos os Parceiros'
        : parceiros.find((p) => p.id === selectedPartner)?.nome || 'Parceiro'
    generatePartnerReportPDF({
      partnerName,
      generatedAt: new Date(),
      entries: reportEntries,
      totalPaid,
      totalPending,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/parceiros')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Comissões</h1>
          <p className="text-slate-500 text-sm">Comissões de parceiros — pagas e pendentes.</p>
        </div>
      </div>

      <Card className="p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-semibold">Parceiro</Label>
            <div className="flex gap-1">
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
            </div>
            <Input
              className="mt-1 text-xs"
              placeholder="Buscar parceiro..."
              value={partnerSearch}
              onChange={(e) => setPartnerSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Status da Comissão</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Em aberto</SelectItem>
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

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Seguradora</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5 text-right">Vl. Líquido</th>
                <th className="p-3.5 text-center">% Repasse</th>
                <th className="p-3.5 text-right">Vl. Repasse</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-slate-500">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                reportEntries.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-semibold">{e.clientName}</td>
                    <td className="p-3.5">{e.seguradoraName}</td>
                    <td className="p-3.5">{e.tipoSeguro}</td>
                    <td className="p-3.5 text-right font-bold">
                      R$ {e.valorLiquido.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3.5 text-center">{e.repassePercent}%</td>
                    <td className="p-3.5 text-right font-bold text-blue-600">
                      R$ {e.valorRepasse.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge className={e.status === 'Pago' ? 'bg-emerald-500' : 'bg-amber-500'}>
                        {e.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-emerald-700 font-semibold">Total Pago: </span>
          <span className="font-bold text-emerald-900">R$ {totalPaid.toLocaleString('pt-BR')}</span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-amber-700 font-semibold">Total Em Aberto: </span>
          <span className="font-bold text-amber-900">
            R$ {totalPending.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
    </div>
  )
}
