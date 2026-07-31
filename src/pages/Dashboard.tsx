import { useEffect, useState, useMemo } from 'react'
import {
  Users,
  FileCheck,
  Clock,
  DollarSign,
  ArrowRight,
  Plus,
  HelpCircle,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { getPayments } from '@/services/payments'
import { getCustosFixos } from '@/services/custos-fixos'
import { Client, Policy, Payment, CustoFixo, FilterState } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SecretsGuideDialog } from '@/components/SecretsGuideDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { DevTrackingPanel } from '@/components/DevTrackingPanel'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/utils'
import { computePeriodFromFilters, isDateInPeriod } from '@/lib/date-filter'
import { calculateFinancialMetrics, computePendingCommissions } from '@/lib/financial-calcs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const COVERAGE_MAP: Record<string, string> = {
  Auto: 'Automóveis',
  Vida: 'Vidas',
  Residencial: 'Residenciais',
  Empresarial: 'Empresariais',
  Saúde: 'Saúde',
  Condomínio: 'Condomínios',
  Viagem: 'Viagens',
  Outros: 'Outros',
}

const COVERAGE_TYPES = [
  'Auto',
  'Vida',
  'Residencial',
  'Empresarial',
  'Saúde',
  'Condomínio',
  'Viagem',
  'Outros',
]
const COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#64748b',
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([])
  const [filters, setFilters] = useState<FilterState>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  })
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [cls, pols, pays, custos] = await Promise.all([
        getClients(),
        getPolicies(),
        getPayments(),
        getCustosFixos(),
      ])
      setClients(cls)
      setPolicies(pols)
      setPayments(pays)
      setCustosFixos(custos)
    } catch {
      /* intentionally ignored */
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('clients', () => loadData())
  useRealtime('policies', () => loadData())
  useRealtime('payments', () => loadData())
  useRealtime('custos_fixos', () => loadData())

  const period = useMemo(() => computePeriodFromFilters(filters), [filters])

  const periodPolicies = useMemo(
    () => policies.filter((p) => isDateInPeriod(period, p.start_date)),
    [policies, period],
  )

  const activePolicies = policies.filter((p) => p.status === 'Ativa')
  const pendingRenewals = policies.filter((p) => p.status === 'Renovação Pendente')

  const pendingCommissions = useMemo(() => computePendingCommissions(policies), [policies])

  const metrics = useMemo(
    () => calculateFinancialMetrics(policies, custosFixos, period),
    [policies, custosFixos, period],
  )

  const topCustos = useMemo(() => {
    const monthCustos = custosFixos.filter((c) => isDateInPeriod(period, c.data))
    return [...monthCustos].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 5)
  }, [custosFixos, period])

  const pieData = useMemo(() => {
    return COVERAGE_TYPES.map((type, idx) => {
      const count = periodPolicies.filter(
        (p) => p.coverage_type === type || p.tipo_de_seguro === type,
      ).length
      return {
        name: type,
        displayName: COVERAGE_MAP[type] || type,
        value: count,
        color: COLORS[idx % COLORS.length],
      }
    }).filter((d) => d.value > 0)
  }, [periodPolicies])

  const monthlyData = useMemo(() => {
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const counts = new Array(12).fill(0)
    periodPolicies.forEach((p) => {
      const d = new Date(p.start_date || p.created)
      if (!isNaN(d.getTime())) {
        counts[d.getMonth()]++
      }
    })
    return months.map((m, i) => ({ month: m, value: counts[i] }))
  }, [periodPolicies])

  if (loading)
    return <div className="text-slate-500 py-8 text-center">Carregando informações...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral da Corretora</h1>
          <p className="text-slate-500 text-sm">
            Resumo de clientes, apólices e indicadores operacionais.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SecretsGuideDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600">
                <HelpCircle className="w-4 h-4 mr-2" />
                Configurar E-mail
              </Button>
            }
          />
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/clientes')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
          <Button variant="outline" onClick={() => navigate('/apolices')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Apólice
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <GlobalFilters filters={filters} onFilterChange={setFilters} />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setFilters({
              year: String(new Date().getFullYear()),
              month: 'ALL',
            })
          }
        >
          Limpar Filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Clientes</CardTitle>
            <Users className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{clients.length}</div>
            <p className="text-xs text-slate-500 mt-1">Segurados cadastrados</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Apólices Ativas</CardTitle>
            <FileCheck className="w-5 h-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{activePolicies.length}</div>
            <p className="text-xs text-slate-500 mt-1">Vigência em andamento</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm ${pendingRenewals.length > 0 ? 'border-amber-300 bg-amber-50/30' : ''}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Renovações Pendentes
            </CardTitle>
            <Clock className="w-5 h-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{pendingRenewals.length}</div>
            <p className="text-xs text-amber-600 mt-1">Próximos 30 dias</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm ${pendingCommissions > 0 ? 'border-blue-300 bg-blue-50/30' : ''}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Comissões a Receber
            </CardTitle>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              R$ {formatCurrency(pendingCommissions)}
            </div>
            <p className="text-xs text-blue-600 mt-1">Comissões pendentes</p>
          </CardContent>
        </Card>
      </div>

      <DevTrackingPanel policies={policies} period={period} totalReceitas={metrics.totalReceitas} />

      <Card className="shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">Resumo de Lucro</h3>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
            {period.label}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-50 rounded-lg p-3 border">
            <p className="text-xs text-slate-500 font-medium">Receitas (Comissões Recebidas)</p>
            <p className="text-xl font-bold text-slate-900">
              R$ {formatCurrency(metrics.totalReceitas)}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-xs text-amber-600 font-medium">Repasses Pagos + Custos</p>
            <p className="text-xl font-bold text-amber-700">
              R$ {formatCurrency(metrics.totalRepasses + metrics.totalCustos)}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-blue-600 font-medium">Lucro Líquido</p>
            <p className="text-xl font-bold text-blue-700">
              R$ {formatCurrency(metrics.lucroLiquido)}
            </p>
          </div>
        </div>
        {topCustos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Top 5 Custos do Período</p>
            <div className="space-y-1.5">
              {topCustos.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between items-center text-sm bg-slate-50 rounded px-3 py-1.5 border"
                >
                  <span className="font-medium text-slate-700">{c.descricao}</span>
                  <span className="font-bold text-slate-900">R$ {formatCurrency(c.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Apólices no Período</h3>
            <span className="text-xs text-slate-500">{period.label}</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Distribuição por Cobertura</h3>
            <span className="text-xs text-slate-500">{period.label}</span>
          </div>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-between gap-4">
            {pieData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
                Nenhuma apólice cadastrada no período.
              </div>
            ) : (
              <>
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="displayName"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {pieData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} apólice(s)`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col justify-center gap-2.5 pl-2 overflow-y-auto max-h-56">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-800">
                        {item.value} {item.displayName}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800">Apólices Recentes</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => navigate('/apolices')}
          >
            Ver todas <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {policies.slice(0, 5).map((pol) => (
              <div
                key={pol.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {pol.policy_number} -{' '}
                    {pol.expand?.seguradora?.nome || pol.insurance_company || '-'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Cliente: {pol.expand?.client?.name || 'Cliente Indefinido'} | Tipo:{' '}
                    {pol.tipo_de_seguro || pol.coverage_type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">
                    R$ {formatCurrency(pol.valor_liquido || pol.premium_amount)}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pol.status === 'Ativa' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                  >
                    {pol.status}
                  </span>
                </div>
              </div>
            ))}
            {policies.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma apólice cadastrada.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
