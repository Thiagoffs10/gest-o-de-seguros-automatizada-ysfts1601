import { useState, useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
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
import { ComissaoRecebimento } from '@/types'
import { registrarEstornoComissao } from '@/services/comissao-recebimentos'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { todayLocalDate, formatDateDisplay } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  recebimento: ComissaoRecebimento | null
  onSuccess: () => void
}

export function EstornoRecebimentoModal({ open, onOpenChange, recebimento, onSuccess }: Props) {
  const { toast } = useToast()
  const [valorEstorno, setValorEstorno] = useState<number | ''>('')
  const [dataEstorno, setDataEstorno] = useState(todayLocalDate())
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && recebimento) {
      setValorEstorno(Number(recebimento.valor_bruto) || '')
      setDataEstorno(todayLocalDate())
      setMotivo('')
    }
  }, [open, recebimento])

  if (!recebimento) return null

  const valorBrutoOriginal = Number(recebimento.valor_bruto) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = Number(valorEstorno)
    if (isNaN(val) || val <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor de estorno maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (!motivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'O motivo do estorno é obrigatório para rastreabilidade e auditoria.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await registrarEstornoComissao({
        recebimento_original_id: recebimento.id,
        valor_estorno: val,
        data_estorno: dataEstorno,
        motivo: motivo.trim(),
      })

      toast({
        title: 'Estorno registrado com sucesso',
        description: `O estorno de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi gravado como lançamento negativo preservando o histórico.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Erro ao registrar estorno',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <RotateCcw className="w-5 h-5" />
            <span>Estornar Recebimento de Comissão</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1.5 text-slate-700">
            <div className="font-semibold text-slate-900">
              Recebimento original ref. apólice {recebimento.expand?.policy?.policy_number}
            </div>
            <div>
              <span className="text-slate-500">Data de recebimento original:</span>{' '}
              {formatDateDisplay(recebimento.data_recebimento)}
            </div>
            <div>
              <span className="text-slate-500">Valor Bruto original:</span>{' '}
              <strong>
                R$ {valorBrutoOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Valor Líquido original:</span>{' '}
              <strong className="text-emerald-700">
                R${' '}
                {Number(recebimento.valor_liquido || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
          </div>

          <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Regra de Estorno:</strong> O recebimento original <strong>NÃO</strong> é
              apagado. Um novo lançamento de estorno (valor negativo) é criado, preservando toda a
              rastreabilidade e histórico contábil.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Valor a Estornar (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={valorBrutoOriginal}
                required
                className="font-bold text-rose-700"
                value={valorEstorno}
                onChange={(e) =>
                  setValorEstorno(e.target.value === '' ? '' : Number(e.target.value))
                }
                disabled={loading}
              />
              <span className="text-[10px] text-slate-400">Total ou parcial</span>
            </div>

            <div>
              <Label className="text-xs font-semibold">Data do Estorno *</Label>
              <Input
                type="date"
                required
                value={dataEstorno}
                onChange={(e) => setDataEstorno(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Motivo do Estorno *</Label>
            <Input
              required
              placeholder="Ex: Cancelamento de apólice na seguradora, estorno por inadimplência, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={loading}
            >
              {loading ? 'Processando...' : 'Confirmar Estorno'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
