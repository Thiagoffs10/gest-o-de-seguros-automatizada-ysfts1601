import { useEffect, useState, useCallback } from 'react'
import { Edit2 } from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { Policy, Parceiro, FilterState } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlobalFilters } from '@/components/GlobalFilters'
import { FinancialSummaryCards } from '@/components/FinancialSummaryCards'
import { CommissionEditDialog, FinancialEditData } from '@/components/CommissionEditDialog'
import { buildFilterString } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

const calcCommission = (p: Policy) =>
  ((p.commission_percent || 0) / 100) * (p.valor_liquido || p.premium_amount || 0)
const calcRepasse = (p: Policy) =>
  ((p.valor_repasse || 0) / 100) * (p.valor_liquido || p.premium_amount || 0)
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Financial() {
  const { toast } = useToast()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [filters, setFilters] = useState<FilterState>({})
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const filter = buildFilterString('', filters, 'start_date')
      const [pols, pars] = await Promise.all([getPolicies(filter), getParceiros()])
      setPolicies(pols)
      setParceiros(pars)
    } catch {
      /* intentionally ignored */
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => loadData())

  const totalGross = policies.reduce((s, p) => s + (p.valor_bruto || 0), 0)
  const totalNet = policies.reduce((s, p) => s + (p.valor_liquido || p.premium_amount || 0), 0)
  const commReceived = policies
    .filter((p) => p.comissao_recebida)
    .reduce((s, p) => s + calcCommission(p), 0)
  const commPending = policies
    .filter((p) => !p.comissao_recebida)
    .reduce((s, p) => s + calcCommission(p), 0)
  const partnerPols = policies.filter((p) => p.tipo_de_venda === 'Parceiro')
  const repassePaid = partnerPols
    .filter((p) => p.pago_parceiro)
    .reduce((s, p) => s + calcRepasse(p), 0)
  const repassePending = partnerPols
    .filter((p) => !p.pago_parceiro)
    .reduce((s, p) => s + calcRepasse(p), 0)

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
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <GlobalFilters
          filters={filters}
          onFilterChange={setFilters}
          showPartnerFilter
          parceiros={parceiros}
        />
        <Button variant="outline" size="sm" onClick={() => setFilters({})}>
          Limpar Filtros
        </Button>
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
                <th className="p-3 text-center">Com. %</th>
                <th className="p-3 text-right">Valor Comissão</th>
                <th className="p-3 text-center">Recebida</th>
                <th className="p-3">Data Receb.</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center p-6 text-slate-500">
                    Nenhuma apólice encontrada.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
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
                    <td className="p-3 text-center">{p.commission_percent || 0}%</td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      R$ {fmtMoney(calcCommission(p))}
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
                      <Button size="sm" variant="ghost" onClick={() => setEditPolicy(p)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
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
                <th className="p-3 text-center">Repasse %</th>
                <th className="p-3 text-right">Valor Repasse</th>
                <th className="p-3 text-center">Pago</th>
                <th className="p-3">Data Pagto</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partnerPols.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-6 text-slate-500">
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
                    <td className="p-3 text-center">{p.valor_repasse || 0}%</td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      R$ {fmtMoney(calcRepasse(p))}
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
                      <Button size="sm" variant="ghost" onClick={() => setEditPolicy(p)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
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
