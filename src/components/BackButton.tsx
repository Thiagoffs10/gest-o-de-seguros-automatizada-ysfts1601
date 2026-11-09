import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface BackButtonProps {
  /** Rota fallback se não houver histórico de navegação */
  fallbackPath?: string
  /** Rótulo do destino de fallback (ex: "Dashboard", "Visão Geral", "Financeiro") */
  fallbackLabel?: string
  /** Ação customizada (ex: trocar de aba interna em vez de mudar de rota) */
  onClick?: () => void
  /** Rótulo customizado para o botão (substitui "Voltar para {destino}") */
  label?: string
  /** Classes adicionais para estilização */
  className?: string
  /** Se true, só exibe o botão se location.state?.from estiver preenchido */
  onlyIfHasOrigin?: boolean
}

export function BackButton({
  fallbackPath,
  fallbackLabel,
  onClick,
  label,
  className = '',
  onlyIfHasOrigin = false,
}: BackButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const stateOrigin = (location.state as any)?.from
  const stateLabel = (location.state as any)?.label

  // Se configurado para exibir apenas quando houver origem (ex: clique em card vindo de outra tela)
  if (onlyIfHasOrigin && !stateOrigin && !onClick) {
    return null
  }

  const destinationLabel = stateLabel || fallbackLabel || 'tela anterior'
  const buttonText = label || `Voltar para ${destinationLabel}`

  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    if (
      window.history.state &&
      typeof window.history.state.idx === 'number' &&
      window.history.state.idx > 0
    ) {
      navigate(-1)
      return
    }

    if (stateOrigin) {
      navigate(stateOrigin)
      return
    }

    if (fallbackPath) {
      navigate(fallbackPath)
      return
    }

    navigate(-1)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={`mb-1 text-slate-600 hover:text-slate-900 -ml-2 text-xs font-medium h-7 px-2 inline-flex items-center gap-1.5 transition-colors ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>{buttonText}</span>
    </Button>
  )
}
