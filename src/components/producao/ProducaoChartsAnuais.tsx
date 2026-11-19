import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Policy } from '@/types'
import { extractDatePart } from '@/lib/date-filter'

const MONTHS_SHORT = [
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

interface ProducaoChartsAnuaisProps {
  /**
   * Apólices JÁ filtradas por período/seguradora/organização (as mesmas do card).
   * Com o mês em "Todos", o período cobre o ano inteiro selecionado no filtro de ano.
   */
  policies: Policy[]
  /** Formata valores monetários (respectando máscara de permissões). */
  formatValue: (value: number) => string
}

/**
 * Gráficos anuais do card "Produção do Período": produção (prêmio líquido) e
 * comissão (bruta) por mês. Só são exibidos quando o período é "Todos os meses".
 * Recebem as apólices já filtradas — organização/seguradora já aplicadas.
 */
export function ProducaoChartsAnuais({ policies, formatValue }: ProducaoChartsAnuaisProps) {
  const producaoData = useMemo(() => {
    const totals = new Array(12).fill(0)
    policies.forEach((p) => {
      const d = extractDatePart(p.start_date || p.created)
      if (d.length >= 7) {
        const m = parseInt(d.slice(5, 7), 10)
        if (m >= 1 && m <= 12) totals[m - 1] += Number(p.premium_amount ?? 0)
      }
    })
    return MONTHS_SHORT.map((month, i) => ({ month, value: totals[i] }))
  }, [policies])

  const comissaoData = useMemo(() => {
    const totals = new Array(12).fill(0)
    policies.forEach((p) => {
      const d = extractDatePart(p.start_date || p.created)
      if (d.length >= 7) {
        const m = parseInt(d.slice(5, 7), 10)
        if (m >= 1 && m <= 12) totals[m - 1] += Number(p.commission ?? 0)
      }
    })
    return MONTHS_SHORT.map((month, i) => ({ month, value: totals[i] }))
  }, [policies])

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">
          Produção por Mês (Prêmio Líquido)
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={producaoData}>
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v: number) => formatValue(v)} />
              <Tooltip formatter={(value) => [formatValue(Number(value)), 'Prêmio Líquido']} />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">Comissão por Mês (Bruta)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comissaoData}>
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v: number) => formatValue(v)} />
              <Tooltip formatter={(value) => [formatValue(Number(value)), 'Comissão Bruta']} />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
