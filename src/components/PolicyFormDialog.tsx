import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { TIPOS_DE_SEGURO, TIPOS_DE_VENDA } from '@/lib/constants'
import { Client, Seguradora, Parceiro } from '@/types'
import { ClientAutocomplete } from '@/components/ClientAutocomplete'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  clients: Client[]
  seguradoras: Seguradora[]
  parceiros: Parceiro[]
  title?: string
}

export function PolicyFormDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  seguradoras,
  parceiros,
  title = 'Registrar Nova Apólice',
}: Props) {
  const [form, setForm] = useState<any>({
    client: '',
    seguradora: '',
    policy_number: '',
    tipo_de_seguro: 'Auto',
    placa: '',
    modelo_veiculo: '',
    valor_bruto: 0,
    valor_liquido: 0,
    commission_percent: 10,
    tipo_de_venda: 'Produção Própria',
    observacao_indicacao: '',
    parceiro: '',
    valor_repasse: 0,
    data_pagamento_parceiro: '',
    pago_parceiro: false,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    status: 'Ativa',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm((prev: any) => ({ ...prev }))
  }, [open])

  const set = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }))
  const calculatedCommission =
    form.valor_liquido && form.commission_percent
      ? (form.commission_percent / 100) * form.valor_liquido
      : 0
  const calculatedRepasse =
    form.valor_liquido && form.valor_repasse ? (form.valor_repasse / 100) * form.valor_liquido : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client) return
    setLoading(true)
    const endDate = new Date(form.end_date)
    const renewalDate = new Date(endDate.getTime() - 30 * 86400000).toISOString()
    await onSubmit({ ...form, commission: calculatedCommission, renewal_date: renewalDate })
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Cliente *</Label>
            <ClientAutocomplete
              clients={clients}
              value={form.client}
              onChange={(v) => set('client', v)}
              placeholder="Buscar segurado por nome..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Nº Apólice Seguradora *</Label>
              <Input
                required
                value={form.policy_number}
                onChange={(e) => set('policy_number', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Seguradora</Label>
              <Select value={form.seguradora} onValueChange={(v) => set('seguradora', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Tipo de Seguro</Label>
            <Select value={form.tipo_de_seguro} onValueChange={(v) => set('tipo_de_seguro', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DE_SEGURO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.tipo_de_seguro === 'Auto' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Placa</Label>
                <Input
                  value={form.placa}
                  onChange={(e) => set('placa', e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Modelo do Veículo</Label>
                <Input
                  value={form.modelo_veiculo}
                  onChange={(e) => set('modelo_veiculo', e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Valor Bruto (R$)</Label>
              <Input
                type="number"
                value={form.valor_bruto}
                onChange={(e) => set('valor_bruto', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Valor Líquido (R$)</Label>
              <Input
                type="number"
                value={form.valor_liquido}
                onChange={(e) => set('valor_liquido', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Comissão (%)</Label>
              <Input
                type="number"
                value={form.commission_percent}
                onChange={(e) => set('commission_percent', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Valor da Comissão</Label>
              <Input
                disabled
                value={`R$ ${calculatedCommission.toFixed(2)}`}
                className="bg-slate-100 font-bold"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Tipo de Venda</Label>
            <Select value={form.tipo_de_venda} onValueChange={(v) => set('tipo_de_venda', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DE_VENDA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.tipo_de_venda === 'Indicação' && (
            <div>
              <Label className="text-xs font-semibold">Observação (Quem indicou)</Label>
              <Input
                value={form.observacao_indicacao}
                onChange={(e) => set('observacao_indicacao', e.target.value)}
              />
            </div>
          )}
          {form.tipo_de_venda === 'Parceiro' && (
            <>
              <div>
                <Label className="text-xs font-semibold">Parceiro</Label>
                <Select value={form.parceiro} onValueChange={(v) => set('parceiro', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o parceiro" />
                  </SelectTrigger>
                  <SelectContent>
                    {parceiros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Repasse (%)</Label>
                  <Input
                    type="number"
                    value={form.valor_repasse}
                    onChange={(e) => set('valor_repasse', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Valor Repasse</Label>
                  <Input
                    disabled
                    value={`R$ ${calculatedRepasse.toFixed(2)}`}
                    className="bg-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Data Pagto Parceiro</Label>
                  <Input
                    type="date"
                    value={form.data_pagamento_parceiro}
                    onChange={(e) => set('data_pagamento_parceiro', e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Checkbox
                    id="pago_parceiro"
                    checked={form.pago_parceiro}
                    onCheckedChange={(v) => set('pago_parceiro', !!v)}
                  />
                  <Label htmlFor="pago_parceiro" className="text-xs">
                    Pago ao Parceiro
                  </Label>
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Data Início</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Data Fim</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Renovação Pendente">Renovação Pendente</SelectItem>
                <SelectItem value="Expirada">Expirada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600" disabled={loading}>
              Salvar Apólice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
