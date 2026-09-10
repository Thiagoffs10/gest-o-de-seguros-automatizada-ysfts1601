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
import { AlertTriangle, AlertCircle } from 'lucide-react'
import { ComissaoRecebimento } from '@/types'
import { formatDateForInput } from '@/lib/utils'
import { updateComissaoRecebimento } from '@/services/comissao-recebimentos'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth } from '@/hooks/use-auth'

interface EditRecebimentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recebimento: ComissaoRecebimento | null
  comissaoPrevista: number
  totalOutrosRecebimentosBrutos: number
  onSuccess: () => void
}

export function EditRecebimentoModal({
  open,
  onOpenChange,
  recebimento,
  comissaoPrevista,
  totalOutrosRecebimentosBrutos,
  onSuccess,
}: EditRecebimentoModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()

  const [dataRecebimento, setDataRecebimento] = useState('')
  const [valorBruto, setValorBruto] = useState<number | ''>('')
  const [aliquotaImposto, setAliquotaImposto] = useState<number>(0)
  const [descontosImpostos, setDescontosImpostos] = useState<number>(0)
  const [valorLiquido, setValorLiquido] = useState<number>(0)
  const [parcela, setParcela] = useState<number | ''>('')
  const [competencia, setCompetencia] = useState('')
  const [observacao, setObservacao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLegado = recebimento?.origem === 'Legado'

  useEffect(() => {
    if (open && recebimento) {
      setDataRecebimento(formatDateForInput(recebimento.data_recebimento) || '')
      setValorBruto(recebimento.valor_bruto != null ? Number(recebimento.valor_bruto) : '')
      const desc =
        recebimento.descontos_impostos != null ? Number(recebimento.descontos_impostos) : 0
      setDescontosImpostos(desc)
      const liq =
        recebimento.valor_liquido != null
          ? Number(recebimento.valor_liquido)
          : Math.max(0, Number(recebimento.valor_bruto || 0) - desc)
      setValorLiquido(liq)
      setAliquotaImposto(
        recebimento.aliquota_imposto != null ? Number(recebimento.aliquota_imposto) : 0,
      )
      setParcela(recebimento.parcela != null ? Number(recebimento.parcela) : '')
      setCompetencia(recebimento.competencia || '')
      setObservacao(recebimento.observacao || '')
      setIsSubmitting(false)
    }
  }, [open, recebimento])

  const handleBrutoChange = (brutoVal: number | '') => {
    setValorBruto(brutoVal)
    const num = brutoVal === '' ? 0 : Number(brutoVal)
    const imposto =
      aliquotaImposto > 0
        ? Math.round(((num * aliquotaImposto) / 100) * 100) / 100
        : descontosImpostos
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
  const novoTotalBrutoApos = Math.round((totalOutrosRecebimentosBrutos + numBruto) * 100) / 100
  const isAcimaDoPrevisto = comissaoPrevista > 0 && novoTotalBrutoApos > comissaoPrevista

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recebimento || isSubmitting) return

    if (!valorBruto || Number(valorBruto) <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor bruto válido maior que zero.',
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

    try {
      const editorInfo = user?.name || user?.email || 'Usuário'
      await updateComissaoRecebimento(recebimento.id, {
        data_recebimento: dataRecebimento,
        valor_bruto: Number(valorBruto),
        descontos_impostos: Number(descontosImpostos || 0),
        valor_liquido: Number(valorLiquido),
        aliquota_imposto: Number(aliquotaImposto || 0),
        parcela: parcela !== '' ? Number(parcela) : null,
        competencia: competencia.trim() || null,
        observacao: observacao.trim() || undefined,
        editor_info: editorInfo,
      })

      toast({
        title: 'Recebimento atualizado com sucesso!',
        description: 'Os saldos e indicadores financeiros foram recalculados automaticamente.',
      })

      // Fecha o modal antes de chamar o callback de sucesso para prevenir conflito de re-render
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast({
        title: 'Erro ao atualizar recebimento',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  if (!recebimento) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Recebimento de Comissão</DialogTitle>
          <p className="text-xs text-slate-500">
            Atualize os dados deste lançamento. O valor líquido e os saldos da apólice serão
            recalculados automaticamente.
          </p>
        </DialogHeader>

        {isLegado && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção: Registro de Origem Legado</p>
              <p>
                Este recebimento foi importado/migrado como legado. A edição manual é permitida, mas
                certifique-se de que os valores conferem com o extrato da seguradora.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Alerta se ultrapassar previsto */}
          {isAcimaDoPrevisto && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aviso: Total recebido supera a comissão prevista</p>
                <p>
                  Com este valor bruto, o total recebido atingirá R${' '}
                  {novoTotalBrutoApos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })},
                  excedendo a comissão prevista de R${' '}
                  {comissaoPrevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                </p>
              </div>
            </div>
          )}

          {/* Valor Bruto e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Valor Bruto Recebido (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
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

          {/* Impostos e Líquido */}
          <div className="p-3 bg-slate-50/80 rounded border space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Impostos e Deduções</span>
              <span className="text-[11px] text-slate-400">
                (Líquido recalculado automaticamente)
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
                <Label className="text-[11px] text-slate-500">Impostos / Descontos (R$)</Label>
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

          {/* Detalhes opcionais */}
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
                  placeholder="Ex: 09/2026"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Observação</Label>
              <Input
                placeholder="Observação deste recebimento"
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
