import { Policy } from '@/types'
import { DatePeriod, isDateInPeriod, extractDatePart } from '@/lib/date-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  policies: Policy[]
  period: DatePeriod
  totalReceitas: number
}

const TRACKING_NUMBERS = ['2310312747550', '5413279539']

export function DevTrackingPanel({ policies, period, totalReceitas }: Props) {
  if (!import.meta.env.DEV) return null

  const tracked = policies.filter((p) => TRACKING_NUMBERS.includes(p.policy_number))
  if (tracked.length === 0) return null

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="text-sm text-amber-800">
          🔍 Painel de Rastreamento (DEV) — Apólices: {TRACKING_NUMBERS.join(', ')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs font-mono">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>Period.label:</strong> {period.label}
          </div>
          <div>
            <strong>Period:</strong> start={period.start} end={period.end} endInclusive=
            {String(period.endInclusive)}
          </div>
        </div>
        <div className="text-sm">
          <strong>Total Receitas:</strong> R$ {totalReceitas.toFixed(2)}
        </div>
        {tracked.map((p) => {
          const rawDate = p.data_recebimento_comissao
          const datePart = extractDatePart(rawDate || '')
          const inPeriod = isDateInPeriod(period, rawDate || '')
          const netComm = (p.commission || 0) - (p.iss || 0)
          return (
            <div key={p.id} className="border-t border-amber-200 pt-2 space-y-1">
              <div>
                <strong>Apólice:</strong> {p.policy_number} (id: {p.id})
              </div>
              <div>
                <strong>data_recebimento_comissao (raw):</strong> "{rawDate}" | type:{' '}
                {typeof rawDate}
              </div>
              <div>
                <strong>extractDatePart:</strong> "{datePart}"
              </div>
              <div>
                <strong>comissao_recebida:</strong> {String(p.comissao_recebida)} |{' '}
                <strong>commission:</strong> {p.commission} | <strong>iss:</strong> {p.iss} |{' '}
                <strong>líquida:</strong> {netComm.toFixed(2)}
              </div>
              <div>
                <strong>isDateInPeriod:</strong> {String(inPeriod)}
              </div>
              <div
                className={inPeriod && p.comissao_recebida ? 'text-emerald-700' : 'text-red-700'}
              >
                <strong>Incluída:</strong> {inPeriod && p.comissao_recebida ? 'SIM ✅' : 'NÃO ❌'}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
