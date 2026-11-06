import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContaAReceberFechada } from '@/services/contas-a-receber-fechadas'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  contas: ContaAReceberFechada[]
  loading?: boolean
  confirmingId?: string | null
  onConfirmar: (conta: ContaAReceberFechada) => void | Promise<void>
}

/**
 * Card "Contas a receber de competências fechadas" (Financeiro):
 * comissões pendentes de competências já fechadas na Conciliação Mensal.
 * A baixa usa o MESMO fluxo "Confirmar recebimento" (comissao_recebimentos) — nada muda no fluxo.
 */
export function ContasAReceberFechadasCard({ contas, loading, confirmingId, onConfirmar }: Props) {
  const total = Math.round(contas.reduce((s, c) => s + c.valor, 0) * 100) / 100

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold text-slate-800">
            Contas a receber de competências fechadas
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
            {contas.length}
          </Badge>
        </div>
        <span className="text-sm font-bold text-amber-700">R$ {fmt(total)}</span>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-slate-500">
          Comissões vencidas em aberto de meses já fechados na Conciliação. Ao confirmar o
          recebimento, o valor entra no <strong>caixa do mês da baixa</strong> (o lucro previsto do
          mês fechado não muda).
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando pendências...
          </div>
        ) : contas.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Nenhuma pendência de competências fechadas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
            {contas.map((c) => (
              <div
                key={`${c.policyId}-${c.comissaoPrevistaId ?? 'avulsa'}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 hover:bg-amber-50/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {c.policyNumber}
                    </span>
                    <span className="text-sm text-slate-600 truncate">{c.segurado}</span>
                    <Badge
                      variant="outline"
                      className="text-[11px] text-slate-500 border-slate-300"
                    >
                      {c.seguradora}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[11px] border-blue-200 bg-blue-50 text-blue-700"
                    >
                      Competência {c.competencia}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                    {c.diasVencidos > 0 ? `Vencida há ${c.diasVencidos} dia(s)` : 'Vence hoje'}
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">
                      {c.vencimento ? c.vencimento.split('-').reverse().join('/') : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-slate-900">R$ {fmt(c.valor)}</span>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={confirmingId === `${c.policyId}-${c.comissaoPrevistaId ?? 'avulsa'}`}
                    onClick={() => onConfirmar(c)}
                  >
                    {confirmingId === `${c.policyId}-${c.comissaoPrevistaId ?? 'avulsa'}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    )}
                    Confirmar recebimento
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5 opacity-70" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
