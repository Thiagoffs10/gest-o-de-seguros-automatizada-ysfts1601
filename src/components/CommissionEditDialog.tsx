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

const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Boleto', 'Outro']

export interface FinancialEditData {
  comissao_recebida: boolean
  data_recebimento_comissao: string | null
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
  const [comissaoRecebida, setComissaoRecebida] = useState(false)
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [pagoParceiro, setPagoParceiro] = useState(false)
  const [dataPagamento, setDataPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')

  useEffect(() => {
    if (policy) {
      setComissaoRecebida(!!policy.comissao_recebida)
      setDataRecebimento(
        policy.data_recebimento_comissao ? policy.data_recebimento_comissao.split('T')[0] : '',
      )
      setPagoParceiro(!!policy.pago_parceiro)
      setDataPagamento(
        policy.data_pagamento_parceiro ? policy.data_pagamento_parceiro.split('T')[0] : '',
      )
      setFormaPagamento(policy.forma_pagamento_repasse || '')
    }
  }, [policy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      comissao_recebida: comissaoRecebida,
      data_recebimento_comissao: dataRecebimento || null,
      pago_parceiro: pagoParceiro,
      data_pagamento_parceiro: dataPagamento || null,
      forma_pagamento_repasse: formaPagamento || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestão Financeira — {policy?.policy_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 border-b pb-3">
            <h4 className="text-sm font-bold text-slate-700">Comissão</h4>
            <div className="flex items-center gap-2">
              <Checkbox
                id="comissao"
                checked={comissaoRecebida}
                onCheckedChange={(v) => setComissaoRecebida(!!v)}
              />
              <Label htmlFor="comissao" className="text-sm cursor-pointer">
                Comissão Recebida
              </Label>
            </div>
            <div>
              <Label className="text-xs font-semibold">Data de Recebimento</Label>
              <Input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
              />
            </div>
          </div>
          {policy?.tipo_de_venda === 'Parceiro' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700">Repasse ao Parceiro</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="parceiro"
                  checked={pagoParceiro}
                  onCheckedChange={(v) => setPagoParceiro(!!v)}
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
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
