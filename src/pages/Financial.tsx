import { useEffect, useState, useCallback, useMemo } from 'react'
import { Edit2 } from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { getSeguradoras } from '@/services/seguradoras'
import { getCustosFixos } from '@/services/custos-fixos'
import { Policy, Parceiro, Seguradora, CustoFixo, FilterState } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlobalFilters } from '@/components/GlobalFilters'
import { FinancialSummaryCards } from '@/components/FinancialSummaryCards'
import { CommissionEditDialog, FinancialEditData } from '@/components/CommissionEditDialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { computePeriodFromFilters, isDateInPeriod } from '@/lib/date-filter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const calcNetCommission = (p: Policy) => (p.commission || 0) - (p.iss || 0)
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Financial() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [allPolicies, setAllPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([])
  const [filters, setFilters] = useState<FilterState>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  })
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [commFilter, setCommFilter] = useState('ALL')
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pols, pars, segs, custos] = await Promise.all([
        getPolicies(),
        getParceiros(),
        getSeguradoras(),
        getCustosFixos(),
      ])
      setAllPolicies(pols)
      setParceiros(pars)
      setSeguradoras(segs)
      setCustosFixos(custos)
    } catch {
      /* intentionally ignored */
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => loadData())
  useRealtime('custos_fixos', () => loadData())

  const period = useMemo(() => computePeriodFromFilters(filters), [filters])

  const applyNonDateFilters = (p: Policy): boolean => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (commFilter === 'received' && !p.comissao_recebida) return false
    if (commFilter === 'pending' && p.comissao_recebida) return false
    if (filters.partnerId && p.parceiro !== filters.partnerId) return false
    if (filters.seguradoraId && p.seguradora !== filters.seguradoraId) return false
    if (
      filters.tipoSeguro &&
      p.tipo_de_seguro !== filters.tipoSeguro &&
      p.coverage_type !== filters.tipoSeguro
    )
      return false
    return true
  }

  const policies = useMemo(
    () => allPolicies.filter((p) => applyNonDateFilters(p) && isDateInPeriod(period, p.start_date)),
    [allPolicies, filters, period, statusFilter, commFilter],
  )

  const tablePolicies = useMemo(
    () => allPolicies.filter((p) => applyNonDateFilters(p)),
    [allPolicies, statusFilter, commFilter, filters],
  )

  const periodLabel = period.label

  const {
    totalGross,
    totalNet,
    commReceived,
    commPending,
    partnerPols,
    repassePaid,
    repassePending,
    totalCustos,
    lucroLiquido,
  } = useMemo(() => {
    const totalGross = policies.reduce((s, p) => s + (p.valor_bruto || 0), 0)
    const totalNet = policies.reduce((s, p) => s + (p.valor_liquido || p.premium_amount || 0), 0)
    const commReceived = tablePolicies
      .filter(
        (p) =>
          p.comissao_recebida &&
          p.data_recebimento_comissao &&
          isDateInPeriod(period, p.data_recebimento_comissao),
      )
      .reduce((s, p) => s + calcNetCommission(p), 0)
    const commPending = tablePolicies
      .filter((p) => !p.comissao_recebida)
      .reduce((s, p) => s + calcNetCommission(p), 0)
    const partnerPols = tablePolicies.filter(
      (p) =>
        p.tipo_de_venda === 'Parceiro' &&
        (p.parceiro || p.expand?.parceiro) &&
        (p.valor_repasse || 0) > 0,
    )
    const repassePaid = tablePolicies
      .filter(
        (p) =>
          p.tipo_de_venda === 'Parceiro' &&
          (p.parceiro || p.expand?.parceiro) &&
          (p.valor_repasse || 0) > 0 &&
          p.pago_parceiro &&
          p.data_pagamento_parceiro &&
          isDateInPeriod(period, p.data_pagamento_parceiro),
      )
      .reduce((s, p) => s + (p.valor_repasse || 0), 0)
    const repassePending = tablePolicies
      .filter(
        (p) =>
          p.tipo_de_venda === 'Parceiro' &&
          (p.parceiro || p.expand?.parceiro) &&
          (p.valor_repasse || 0) > 0 &&
          !p.pago_parceiro,
      )
      .reduce((s, p) => s + (p.valor_repasse || 0), 0)
    const totalCustos = custosFixos
      .filter((c) => isDateInPeriod(period, c.data))
      .reduce((s, c) => s + (c.valor || 0), 0)
    const lucroLiquido = commReceived - repassePaid - totalCustos
    return {
      totalGross,
      totalNet,
      commReceived,
      commPending,
      partnerPols,
      repassePaid,
      repassePending,
      totalCustos,
      lucroLiquido,
    }
  }, [policies, tablePolicies, custosFixos, period])

  const handleSave = async (data: FinancialEditData) => {
    if (!editPolicy) return
    setSaving(true)
    try {
      await updatePolicyFinancial(editPolicy.id, data)
      toast({ title: 'Atualizado com sucesso!' })
      setEditPolicy(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="text-slate-500 py-8 text-center">Carregando informações...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Controle Financeiro</h1>
        <p className="text-slate-500 text-sm">
          Gestão de comissões, repasses e performance financeira.
        </p>
      </div>

      <FinancialSummaryCards
        totalGross={totalGross}
        totalNet={totalNet}
        commReceived={commReceived}
        commPending={commPending}
        repassePaid={repassePaid}
        repassePending={repassePending}
        totalCustos={totalCustos}
        lucroLiquido={lucroLiquido}
        periodLabel={periodLabel}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <GlobalFilters
          filters={filters}
          onFilterChange={setFilters}
          showPartnerFilter
          parceiros={parceiros}
          showSeguradoraFilter
          seguradoras={seguradoras}
          showTipoSeguroFilter
        />
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Renovação Pendente">Renovação Pendente</SelectItem>
              <SelectItem value="Expirada">Expirada</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={commFilter} onValueChange={setCommFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Comissão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Comissões</SelectItem>
              <SelectItem value="received">Recebidas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({
                year: String(new Date().getFullYear()),
                month: String(new Date().getMonth() + 1),
              })
              setStatusFilter('ALL')
              setCommFilter('ALL')
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <CardHeader>
          <CardTitle className="text-base font-bold">Gestão de Comissões</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3">Apólice</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Seguradora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-right">Bruto</th>
                <th className="p-3 text-right">Líquido</th>
                <th className="p-3 text-right">Comissão</th>
                <th className="p-3 text-right">ISS</th>
                <th className="p-3 text-right">Com. Líquida</th>
                <th className="p-3 text-center">Recebida</th>
                <th className="p-3">Data Receb.</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tablePolicies.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center p-6 text-slate-500">
                    Nenhuma apólice encontrada.
                  </td>
                </tr>
              ) : (
                tablePolicies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{p.policy_number}</td>
                    <td className="p-3">{p.expand?.client?.name || '-'}</td>
                    <td className="p-3">
                      {p.expand?.seguradora?.nome || p.insurance_company || '-'}
                    </td>
                    <td className="p-3">{p.tipo_de_seguro || p.coverage_type}</td>
                    <td className="p-3 text-right">R$ {fmtMoney(p.valor_bruto || 0)}</td>
                    <td className="p-3 text-right font-bold">
                      R$ {fmtMoney(p.valor_liquido || p.premium_amount || 0)}
                    </td>
                    <td className="p-3 text-right">R$ {fmtMoney(p.commission || 0)}</td>
                    <td className="p-3 text-right text-red-600">R$ {fmtMoney(p.iss || 0)}</td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      R$ {fmtMoney(calcNetCommission(p))}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={p.comissao_recebida ? 'bg-emerald-500' : 'bg-amber-500'}>
                        {p.comissao_recebida ? 'Recebida' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {p.data_recebimento_comissao
                        ? new Date(p.data_recebimento_comissao).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {can('policies', 'update') ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditPolicy(p)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="shadow-sm overflow-hidden border">
        <CardHeader>
          <CardTitle className="text-base font-bold">Repasses de Parceiros</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3">Apólice</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Parceiro</th>
                <th className="p-3 text-right">Líquido</th>
                <th className="p-3 text-right">Repasse (R$)</th>
                <th className="p-3 text-center">Pago</th>
                <th className="p-3">Data Pagto</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partnerPols.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-6 text-slate-500">
                    Nenhuma apólice de parceiro encontrada.
                  </td>
                </tr>
              ) : (
                partnerPols.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{p.policy_number}</td>
                    <td className="p-3">{p.expand?.client?.name || '-'}</td>
                    <td className="p-3">{p.expand?.parceiro?.nome || '-'}</td>
                    <td className="p-3 text-right font-bold">
                      R$ {fmtMoney(p.valor_liquido || p.premium_amount || 0)}
                    </td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      R$ {fmtMoney(p.valor_repasse || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={p.pago_parceiro ? 'bg-emerald-500' : 'bg-amber-500'}>
                        {p.pago_parceiro ? 'Pago' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {p.data_pagamento_parceiro
                        ? new Date(p.data_pagamento_parceiro).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {can('policies', 'update') ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditPolicy(p)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CommissionEditDialog
        open={!!editPolicy}
        onOpenChange={(open) => !open && setEditPolicy(null)}
        policy={editPolicy}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
