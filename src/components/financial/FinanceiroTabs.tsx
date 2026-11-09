import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export type AbaFinanceiro = 'visao-geral' | 'a-receber' | 'repasses' | 'extrato'

export function normalizarAba(raw?: string | null): AbaFinanceiro {
  if (!raw) return 'visao-geral'
  const r = String(raw).toLowerCase().trim()
  if (r === 'a-receber' || r === 'areceber' || r === 'receber') return 'a-receber'
  if (r === 'repasses' || r === 'repasse') return 'repasses'
  if (r === 'extrato' || r === 'extratos') return 'extrato'
  return 'visao-geral'
}

export interface FinanceiroTabsProps {
  aba?: AbaFinanceiro
  activeTab?: AbaFinanceiro
  onTrocar?: (aba: AbaFinanceiro) => void
  onChange?: (aba: AbaFinanceiro) => void
  badges?: {
    aReceber?: number
    repasses?: number
    extrato?: number
  }
}

export function FinanceiroTabs({
  aba,
  activeTab,
  onTrocar,
  onChange,
  badges,
}: FinanceiroTabsProps) {
  const currentTab = aba || activeTab || 'visao-geral'
  const handleTabChange = (val: string) => {
    const tabNormalizada = normalizarAba(val)
    if (onChange) onChange(tabNormalizada)
    if (onTrocar) onTrocar(tabNormalizada)
  }

  const abas: { valor: AbaFinanceiro; texto: string; badge?: number }[] = [
    { valor: 'visao-geral', texto: 'Visão Geral' },
    { valor: 'a-receber', texto: 'A Receber', badge: badges?.aReceber },
    { valor: 'repasses', texto: 'Repasses', badge: badges?.repasses },
    { valor: 'extrato', texto: 'Extrato', badge: badges?.extrato },
  ]

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-slate-100 rounded-lg">
        {abas.map((t) => (
          <TabsTrigger
            key={t.valor}
            value={t.valor}
            className="text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>{t.texto}</span>
            {typeof t.badge === 'number' && t.badge > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-slate-200 text-slate-700"
              >
                {t.badge}
              </Badge>
            )}
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
  active,
  children,
}: {
  ativa?: AbaFinanceiro
  valor?: AbaFinanceiro
  active?: boolean
  children: React.ReactNode
}) {
  const isAtiva =
    typeof active === 'boolean'
      ? active
      : ativa && valor
        ? normalizarAba(ativa) === normalizarAba(valor)
        : false

  return <div className={isAtiva ? 'space-y-6' : 'hidden'}>{children}</div>
}
