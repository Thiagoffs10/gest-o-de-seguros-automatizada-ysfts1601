import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Policy, Seguradora } from '@/types'
import { todayLocalDate } from '@/lib/utils'
import { createComissaoRecebimento } from '@/services/comissao-recebimentos'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy: Policy | null
  seguradoras: Seguradora[]
  alreadyReceived: number
  onSuccess: () => void
}

export function RegistrarRecebimentoModal({
  open,
  onOpenChange,
  policy,
  seguradoras,
  alreadyReceived,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [dataRecebimento, setDataRecebimento] = useState(todayLocalDate())
  const [valorBruto, setValorBruto] = useState<number | ''>('')
  const [aliquotaImposto, setAliquotaImposto] = useState<number>(0)
  const [descontosImpostos, setDescontosImpostos] = useState<number>(0)
  const [valorLiquido, setValorLiquido] = useState<number>(0)
  const [parcela, setParcela] = useState<number | ''>('')
  const [competencia, setCompetencia] = useState('')
  const [observacao, setObservacao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Identificar a alíquota da seguradora vinculada à apólice
  const policySeguradora = policy
    ? policy.expand?.seguradora ||
      seguradoras.find((s) => s.id === policy.seguradora || s.nome === policy.insurance_company)
    : undefined

  // Previsão total da comissão
  const comissaoPrevista = policy
    ? policy.commission != null
      ? Number(policy.commission)
      : Math.round(
          (((policy.valor_liquido || policy.premium_amount || 0) *
            (policy.commission_percent || 0)) /
            100) *
            100,
        ) / 100
    : 0

  // Saldo a receber ANTES desta baixa
  const saldoAtual = Math.max(0, Math.round((comissaoPrevista - alreadyReceived) * 100) / 100)

  // Quando o modal abre, preencher valor bruto sugerido = saldo atual e imposto padrão da seguradora
  useEffect(() => {
    if (open) {
      setDataRecebimento(todayLocalDate())
      const defaultAliquota =
        policySeguradora?.imposto_percentual != null
          ? Number(policySeguradora.imposto_percentual)
          : policy.iss != null && comissaoPrevista > 0
            ? Math.round((policy.iss / comissaoPrevista) * 100 * 10) / 10
            : 0

      setAliquotaImposto(defaultAliquota)

      // Sugere o saldo restante se for > 0, senão a comissão total
      const initialBruto = saldoAtual > 0 ? saldoAtual : comissaoPrevista || 0
      setValorBruto(initialBruto > 0 ? initialBruto : '')

      const initialImposto = Math.round(((initialBruto * defaultAliquota) / 100) * 100) / 100
      setDescontosImpostos(initialImposto)
      setValorLiquido(Math.round((initialBruto - initialImposto) * 100) / 100)

      setParcela('')
      setCompetencia('')
      setObservacao('')
      setIsSubmitting(false)
    }
  }, [open, policy, policySeguradora, saldoAtual, comissaoPrevista])

  // Recalcula imposto e líquido ao alterar valor bruto ou alíquota
  const handleBrutoChange = (brutoVal: number | '') => {
    setValorBruto(brutoVal)
    const num = brutoVal === '' ? 0 : Number(brutoVal)
    const imposto = Math.round(((num * aliquotaImposto) / 100) * 100) / 100
    setDescontosImpostos(imposto)
    setValorLiquido(Math.round((num - imposto) * 100) / 100)
  }

  const handleAliquotaChange = (aliqVal: number) => {
    setAliquotaImposto(aliqVal)
    const num = valorBruto === '' ? 0 : Number(valorBruto)
    const imposto = Math.round(((num * aliqVal) / 100) * 100) / 100
    setDescontosImpostos(imposto)
    setValorLiquido(Math.round((num - imposto) * 100) / 100)
  }

  const handleDescontoChange = (descVal: number) => {
    setDescontosImpostos(descVal)
    const num = valorBruto === '' ? 0 : Number(valorBruto)
    setValorLiquido(Math.round((num - descVal) * 100) / 100)
  }

  const numBruto = valorBruto === '' ? 0 : Number(valorBruto)
  const totalRecebidoApos = Math.round((alreadyReceived + numBruto) * 100) / 100
  const isAcimaDoPrevisto = comissaoPrevista > 0 && totalRecebidoApos > comissaoPrevista

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !policy) return

    if (!valorBruto || Number(valorBruto) <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor bruto de recebimento válido maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (!dataRecebimento) {
      toast({
        title: 'Data obrigatória',
        description: 'Informe a data do recebimento.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    // Chave de idempotência no cliente baseada no timestamp único + id apólice + valor
    const idempotencyKey = `rec_${policy.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    try {
      await createComissaoRecebimento({
        policy: policy.id,
        data_recebimento: dataRecebimento,
        valor_bruto: Number(valorBruto),
        descontos_impostos: Number(descontosImpostos || 0),
        valor_liquido: Number(valorLiquido),
        aliquota_imposto: Number(aliquotaImposto || 0),
        origem: 'Manual',
        observacao: observacao.trim() || undefined,
        parcela: parcela !== '' ? Number(parcela) : undefined,
        competencia: competencia.trim() || undefined,
        idempotency_key: idempotencyKey,
      })

      toast({
        title: 'Recebimento registrado com sucesso!',
        description: isAcimaDoPrevisto
          ? 'Aviso: o total recebido excedeu a comissão prevista da apólice.'
          : undefined,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Erro ao registrar recebimento',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!policy) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento de Comissão</DialogTitle>
          <p className="text-xs text-slate-500">
            Apólice {policy.policy_number} — {policy.expand?.client?.name || 'Cliente'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card com resumo de previsão e saldo */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border text-center text-xs">
            <div>
              <span className="text-slate-500 block">Comissão Prevista</span>
              <strong className="text-slate-800 text-sm">
                R$ {comissaoPrevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Já Recebido</span>
              <strong className="text-emerald-700 text-sm">
                R$ {alreadyReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Saldo Restante</span>
              <strong className="text-amber-700 text-sm">
                R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* Alerta caso o valor exceda a comissão prevista */}
          {isAcimaDoPrevisto && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aviso de Divergência — Recebimento acima do previsto</p>
                <p>
                  O total acumulado (R${' '}
                  {totalRecebidoApos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  ultrapassa a comissão prevista em R${' '}
                  {(totalRecebidoApos - comissaoPrevista).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                  . O registro será gravado normalmente para refletir a realidade financeira.
                </p>
              </div>
            </div>
          )}

          {/* Baixa simples: Valor bruto + Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Valor Bruto Recebido (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                placeholder="0,00"
                value={valorBruto}
                onChange={(e) =>
                  handleBrutoChange(e.target.value === '' ? '' : Number(e.target.value))
                }
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Data do Recebimento *</Label>
              <Input
                type="date"
                required
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Sugestão de imposto pela seguradora */}
          <div className="p-3 bg-slate-50/80 rounded border space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                Imposto da Seguradora (
                {policySeguradora?.nome || policy.insurance_company || 'Seguradora'}:{' '}
                {policySeguradora?.imposto_percentual != null
                  ? `${policySeguradora.imposto_percentual}%`
                  : 'alíquota padrão'}
                )
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px] text-slate-500">Alíquota (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={aliquotaImposto}
                  onChange={(e) => handleAliquotaChange(Number(e.target.value))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500">Descontos / Impostos (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={descontosImpostos}
                  onChange={(e) => handleDescontoChange(Number(e.target.value))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 font-bold text-slate-700">
                  Valor Líquido (R$)
                </Label>
                <div className="h-9 px-3 py-2 bg-white rounded-md border text-sm font-bold text-emerald-700 flex items-center">
                  R$ {valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Detalhes opcionais: Parcela, Competência, Observação */}
          <div className="space-y-2 pt-1 border-t">
            <p className="text-xs font-semibold text-slate-600">Detalhes Opcionais</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Parcela</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ex: 1"
                  value={parcela}
                  onChange={(e) => setParcela(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Competência</Label>
                <Input
                  placeholder="Ex: 08/2026"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Observação</Label>
              <Input
                placeholder="Observação opcional sobre este recebimento"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Recebimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
