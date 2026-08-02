import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Lock, Unlock, FileText } from 'lucide-react'
import { getPolicies } from '@/services/policies'
import { getCustosFixos } from '@/services/custos-fixos'
import { getConciliacao, createConciliacao, deleteConciliacao } from '@/services/conciliacoes'
import { Policy, CustoFixo, Conciliacao } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth } from '@/hooks/use-auth'
import { computePeriod, isDateInPeriod, formatBRDate } from '@/lib/date-filter'
import {
  calcNetCommission,
  computeReceivedCommissions,
  computePendingRepasses,
  computePaidRepasses,
  computePaidCosts,
  computePendingCosts,
  computeExpectedCommissions,
  computeExpectedRepasses,
  computeCosts,
} from '@/lib/financial-calcs'
import { generateConciliacaoPDF } from '@/lib/conciliacao-pdf'

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ConciliacaoMensal() {
  const { toast } = useToast()
  const { isAdmin } = usePermissions()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [policies, setPolicies] = useState<Policy[]>([])
  const [custos, setCustos] = useState<CustoFixo[]>([])
  const [conciliacao, setConciliacao] = useState<Conciliacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const period = useMemo(() => computePeriod(String(mes), String(ano)), [mes, ano])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pols, custosData, conc] = await Promise.all([
        getPolicies(),
        getCustosFixos(),
        getConciliacao(mes, ano),
      ])
      setPolicies(pols)
      setCustos(custosData)
      setConciliacao(conc)
    } catch {
      /* ignored */
    }
    setLoading(false)
  }, [mes, ano])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => loadData())
  useRealtime('custos_fixos', () => loadData())
  useRealtime('conciliacoes', () => loadData())

  const m = useMemo(() => {
    const periodPolicies = policies.filter((p) => isDateInPeriod(period, p.start_date))
    const expectedComm = computeExpectedCommissions(policies, period)
    const receivedComm = computeReceivedCommissions(policies, period)
    const pendingComm = expectedComm - receivedComm
    const paidRepasses = computePaidRepasses(policies, period)
    const pendingRepasses = computePendingRepasses(policies)
    const paidCustos = computePaidCosts(custos, period)
    const pendingCustos = computePendingCosts(custos, period)
    const totalCustos = computeCosts(custos, period)
    const expectedRepasses = computeExpectedRepasses(policies, period)
    const lucroPrevisto = expectedComm - expectedRepasses - totalCustos
    const lucroReal = receivedComm - paidRepasses - paidCustos
    const pendencias: string[] = []
    const pendComm = periodPolicies.filter((p) => !p.comissao_recebida).length
    if (pendComm > 0) pendencias.push(`${pendComm} comissão(ões) pendente(s)`)
    const pendRep = policies.filter(
      (p) =>
        p.tipo_de_venda === 'Parceiro' &&
        (p.parceiro || p.expand?.parceiro) &&
        (p.valor_repasse || 0) > 0 &&
        !p.pago_parceiro,
    ).length
    if (pendRep > 0) pendencias.push(`${pendRep} repasse(s) pendente(s)`)
    if (pendingCustos > 0)
      pendencias.push(
        `${custos.filter((c) => c.pago !== true && isDateInPeriod(period, c.data)).length} custo(s) pendente(s)`,
      )
    return {
      totalApolices: periodPolicies.length,
      expectedComm,
      receivedComm,
      pendingComm,
      paidRepasses,
      pendingRepasses,
      paidCustos,
      pendingCustos,
      lucroPrevisto,
      lucroReal,
      pendencias,
    }
  }, [policies, custos, period])

  const isClosed = !!conciliacao

  const handleClose = async () => {
    if (m.pendencias.length > 0) {
      const confirmar = window.confirm(
        `Atenção! Existem pendências:\n\n${m.pendencias.join('\n')}\n\nDeseja fechar o mês mesmo assim?`,
      )
      if (!confirmar) return
    }
    setActionLoading(true)
    try {
      const resumo = JSON.stringify(m)
      const conc = await createConciliacao({
        mes,
        ano,
        data_fechamento: new Date().toISOString(),
        usuario_fechamento: user?.name || user?.email || 'Unknown',
        usuario_id: user?.id,
        resumo,
        pendencias: JSON.stringify(m.pendencias),
      })
      setConciliacao(conc)
      generateConciliacaoPDF({
        mes,
        ano,
        ...m,
        dataFechamento: conc.data_fechamento || new Date().toISOString(),
        usuarioFechamento: conc.usuario_fechamento || '',
      })
      toast({ title: 'Mês fechado com sucesso!' })
    } catch (err: any) {
      toast({ title: 'Erro ao fechar mês', description: err.message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopen = async () => {
    if (!conciliacao) return
    if (!window.confirm('Deseja reabrir este mês para alterações?')) return
    setActionLoading(true)
    try {
      await deleteConciliacao(conciliacao.id)
      setConciliacao(null)
      toast({ title: 'Mês reaberto!' })
    } catch (err: any) {
      toast({ title: 'Erro ao reabrir', description: err.message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="text-slate-500 py-8 text-center">Carregando...</div>

  const steps = [
    {
      title: 'Produção',
      content: (
        <>
          <Row label="Total de Apólices" value={String(m.totalApolices)} />
          <Row label="Comissão Prevista" value={`R$ ${fmt(m.expectedComm)}`} />
        </>
      ),
    },
    {
      title: 'Comissões',
      content: (
        <>
          <Row label="Previstas" value={`R$ ${fmt(m.expectedComm)}`} />
          <Row label="Recebidas" value={`R$ ${fmt(m.receivedComm)}`} green />
          <Row label="Pendentes" value={`R$ ${fmt(m.pendingComm)}`} amber />
        </>
      ),
    },
    {
      title: 'Repasses',
      content: (
        <>
          <Row label="Pagos" value={`R$ ${fmt(m.paidRepasses)}`} green />
          <Row label="Pendentes" value={`R$ ${fmt(m.pendingRepasses)}`} amber />
        </>
      ),
    },
    {
      title: 'Custos',
      content: (
        <>
          <Row label="Pagos" value={`R$ ${fmt(m.paidCustos)}`} green />
          <Row label="Pendentes" value={`R$ ${fmt(m.pendingCustos)}`} amber />
        </>
      ),
    },
    {
      title: 'Resultado',
      content: (
        <>
          <Row label="Receita (Comissões Recebidas)" value={`R$ ${fmt(m.receivedComm)}`} />
          <Row label="(-) Repasses Pagos" value={`R$ ${fmt(m.paidRepasses)}`} red />
          <Row label="(-) Custos Pagos" value={`R$ ${fmt(m.paidCustos)}`} red />
          <Row label="= Lucro Real" value={`R$ ${fmt(m.lucroReal)}`} blue bold />
          <div className="mt-3 pt-3 border-t">
            <Row label="Lucro Previsto" value={`R$ ${fmt(m.lucroPrevisto)}`} bold />
          </div>
        </>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conciliação Mensal</h1>
          <p className="text-slate-500 text-sm">Assistente de fechamento mensal.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(mes)}
            onValueChange={(v) => {
              setMes(Number(v))
              setStep(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((mn, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {mn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(ano)}
            onValueChange={(v) => {
              setAno(Number(v))
              setStep(1)
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isClosed && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <Lock className="w-4 h-4" />
            <span>
              Mês fechado em{' '}
              {conciliacao?.data_fechamento
                ? formatBRDate(conciliacao.data_fechamento.split(' ')[0])
                : '-'}{' '}
              por {conciliacao?.usuario_fechamento || '-'}
            </span>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleReopen} disabled={actionLoading}>
              <Unlock className="w-4 h-4 mr-1" /> Reabrir Mês
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i + 1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === i + 1 ? 'bg-white text-blue-600' : 'bg-slate-300 text-white'}`}
              >
                {i + 1}
              </span>
              {s.title}
            </button>
            {i < steps.length - 1 && <div className="w-4 h-px bg-slate-300" />}
          </div>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold">{steps[step - 1].title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">{steps[step - 1].content}</CardContent>
      </Card>

      {m.pendencias.length > 0 && !isClosed && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-semibold text-amber-800 mb-1">Pendências detectadas:</p>
          <ul className="list-disc list-inside text-sm text-amber-700">
            {m.pendencias.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep(Math.min(5, step + 1))}>
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : isClosed ? (
          <Button
            variant="outline"
            onClick={() =>
              conciliacao &&
              generateConciliacaoPDF({
                mes,
                ano,
                ...m,
                dataFechamento: conciliacao.data_fechamento || new Date().toISOString(),
                usuarioFechamento: conciliacao.usuario_fechamento || '',
              })
            }
          >
            <FileText className="w-4 h-4 mr-1" /> Gerar PDF
          </Button>
        ) : (
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleClose}
            disabled={actionLoading}
          >
            <Lock className="w-4 h-4 mr-1" /> Fechar Mês
          </Button>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  green,
  amber,
  red,
  blue,
  bold,
}: {
  label: string
  value: string
  green?: boolean
  amber?: boolean
  red?: boolean
  blue?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={`text-sm ${bold ? 'font-bold' : 'font-semibold'} ${green ? 'text-emerald-700' : amber ? 'text-amber-700' : red ? 'text-red-700' : blue ? 'text-blue-700' : 'text-slate-900'}`}
      >
        {value}
      </span>
    </div>
  )
}
