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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Policy } from '@/types'
import { formatDateForInput, todayLocalDate } from '@/lib/utils'

const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Boleto', 'Outro']

export interface FinancialEditData {
  pago_parceiro: boolean
  data_pagamento_parceiro: string | null
  forma_pagamento_repasse?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy: Policy | null
  onSave: (data: FinancialEditData) => Promise<void>
  saving: boolean
}

export function CommissionEditDialog({ open, onOpenChange, policy, onSave, saving }: Props) {
  const [pagoParceiro, setPagoParceiro] = useState(false)
  const [dataPagamento, setDataPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')

  useEffect(() => {
    if (policy) {
      setPagoParceiro(!!policy.pago_parceiro)
      setDataPagamento(formatDateForInput(policy.data_pagamento_parceiro))
      setFormaPagamento(policy.forma_pagamento_repasse || '')
    }
  }, [policy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      pago_parceiro: pagoParceiro,
      data_pagamento_parceiro: dataPagamento || null,
      forma_pagamento_repasse: formaPagamento || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestão Financeira — Repasse ao Parceiro</DialogTitle>
          {policy && (
            <p className="text-xs text-slate-500">
              Apólice {policy.policy_number} — Baixa de repasse a parceiros
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50/50 rounded border text-xs text-slate-600">
            <span className="font-semibold text-slate-800 block mb-1">
              Aviso sobre recebimento de comissão:
            </span>
            O recebimento de comissões deve ser registrado pelo botão{' '}
            <strong>&quot;Registrar recebimento&quot;</strong> na tabela de comissões (permite
            baixas parciais, alíquota de impostos e múltiplos registros).
          </div>
          {policy?.tipo_de_venda === 'Parceiro' ? (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700">Repasse ao Parceiro</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="parceiro"
                  checked={pagoParceiro}
                  onCheckedChange={(v) => {
                    const checked = !!v
                    setPagoParceiro(checked)
                    if (checked && !dataPagamento) {
                      setDataPagamento(todayLocalDate())
                    }
                  }}
                />
                <Label htmlFor="parceiro" className="text-sm cursor-pointer">
                  Pago ao Parceiro
                </Label>
              </div>
              <div>
                <Label className="text-xs font-semibold">Data de Pagamento</Label>
                <Input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="p-3 text-xs text-slate-500 italic">
              Esta apólice é de venda direta (sem parceiro para repasse).
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Salvar Repasse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
