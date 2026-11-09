import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type AbaFinanceiro = 'visao' | 'receber' | 'repasses' | 'extrato'

const ROTULOS: { valor: AbaFinanceiro; texto: string }[] = [
  { valor: 'visao', texto: 'Visão Geral' },
  { valor: 'receber', texto: 'A Receber' },
  { valor: 'repasses', texto: 'Repasses' },
  { valor: 'extrato', texto: 'Extrato' },
]

/**
 * Navegação em abas do Financeiro (Visão Geral / A Receber / Repasses / Extrato).
 * Conteúdo das abas fica no Financial.tsx (seções sempre montadas, só escondidas por CSS),
 * para preservar realtime, modais e cálculos exatamente como estavam.
 */
export function FinanceiroTabs({
  aba,
  onTrocar,
}: {
  aba: AbaFinanceiro
  onTrocar: (a: AbaFinanceiro) => void
}) {
  return (
    <Tabs value={aba} onValueChange={(v) => onTrocar(v as AbaFinanceiro)}>
      <TabsList className="h-9 bg-slate-100">
        {ROTULOS.map((t) => (
          <TabsTrigger key={t.valor} value={t.valor} className="text-xs px-3">
            {t.texto}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/**
 * Container de uma aba: esconde via CSS (não desmonta) para preservar estado,
 * realtime e modais de cada seção enquanto o usuário navega entre as abas.
 */
export function AbaContainer({
  ativa,
  valor,
  children,
}: {
  ativa: AbaFinanceiro
  valor: AbaFinanceiro
  children: React.ReactNode
}) {
  return <div className={ativa === valor ? 'space-y-4' : 'hidden'}>{children}</div>
}
