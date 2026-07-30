import { useEffect, useState } from 'react'
import { Users, FileCheck, Clock, AlertTriangle, Plus, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { getPayments } from '@/services/payments'
import { Client, Policy, Payment } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export default function Dashboard() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [cls, pols, pays] = await Promise.all([getClients(), getPolicies(), getPayments()])
        setClients(cls)
        setPolicies(pols)
        setPayments(pays)
      } catch {
        /* intentionally ignored */
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const activePolicies = policies.filter((p) => p.status === 'Ativa')
  const pendingRenewals = policies.filter((p) => p.status === 'Renovação Pendente')
  const overduePayments = payments.filter((p) => p.status === 'Atrasado')

  const coverageTypes = ['Auto', 'Vida', 'Residencial', 'Empresarial', 'Saúde', 'Outros']
  const pieData = coverageTypes
    .map((type) => ({
      name: type,
      value: policies.filter((p) => p.coverage_type === type).length,
    }))
    .filter((d) => d.value > 0)

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']

  const monthlyEmittedData = [
    { month: 'Jan', value: 4 },
    { month: 'Fev', value: 7 },
    { month: 'Mar', value: 5 },
    { month: 'Abr', value: 9 },
    { month: 'Mai', value: 12 },
    { month: 'Jun', value: 8 },
  ]

  if (loading) {
    return (
      <div className="text-slate-500 py-8 text-center">Carregando informações do dashboard...</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Bar Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral da Corretora</h1>
          <p className="text-slate-500 text-sm">
            Resumo de clientes, apólices e indicadores operacionais.
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Summary Cards */}
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
          className={`shadow-sm ${overduePayments.length > 0 ? 'border-red-300 bg-red-50/30' : ''}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Pagamentos Atrasados
            </CardTitle>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{overduePayments.length}</div>
            <p className="text-xs text-red-600 mt-1">Necessitam cobrança</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Apólices Emitidas por Mês</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEmittedData}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Distribuição por Cobertura</h3>
          <div className="h-64 flex items-center justify-center">
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma apólice registrada.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity / Policies */}
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
                    {pol.policy_number} - {pol.insurance_company}
                  </p>
                  <p className="text-xs text-slate-500">
                    Cliente: {pol.expand?.client?.name || 'Cliente Indefinido'} | Tipo:{' '}
                    {pol.coverage_type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">
                    R$ {pol.premium_amount?.toLocaleString('pt-BR')}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      pol.status === 'Ativa'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {pol.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
