import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { todayLocalDate } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: { data_cancelamento: string; motivo_cancelamento: string }) => Promise<void>
  policyNumber: string
}

export function CancelPolicyDialog({ open, onOpenChange, onConfirm, policyNumber }: Props) {
  const [dataCancelamento, setDataCancelamento] = useState(todayLocalDate())
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDataCancelamento(todayLocalDate())
      setMotivoCancelamento('')
      setError('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dataCancelamento) {
      setError('Data de cancelamento é obrigatória.')
      return
    }
    if (!motivoCancelamento.trim()) {
      setError('Informe o motivo do cancelamento.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onConfirm({
        data_cancelamento: dataCancelamento,
        motivo_cancelamento: motivoCancelamento.trim(),
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao cancelar apólice.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Cancelar Apólice {policyNumber}
          </DialogTitle>
          <DialogDescription>
            A apólice será alterada para o status <strong>Cancelada</strong> e seu histórico de
            dados será mantido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {error}
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">Data do Cancelamento *</Label>
            <Input
              type="date"
              required
              value={dataCancelamento}
              onChange={(e) => setDataCancelamento(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Motivo do Cancelamento *</Label>
            <Textarea
              required
              rows={3}
              placeholder="Descreva o motivo do cancelamento da apólice..."
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Voltar
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
