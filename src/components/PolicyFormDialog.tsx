import { useState, useEffect, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { TIPOS_DE_SEGURO, TIPOS_DE_VENDA } from '@/lib/constants'
import { Client, Seguradora, Parceiro, Policy } from '@/types'
import { ClientAutocomplete } from '@/components/ClientAutocomplete'
import type { FieldErrors } from '@/lib/pocketbase/errors'

const DEFAULT_FORM = {
  client: '',
  seguradora: '',
  policy_number: '',
  tipo_de_seguro: 'Auto',
  placa: '',
  chassi: '',
  modelo_veiculo: '',
  valor_bruto: 0,
  valor_liquido: 0,
  commission_percent: 0,
  commission: 0,
  iss: 0,
  tipo_de_venda: 'Produção Própria',
  observacao_indicacao: '',
  parceiro: '',
  valor_repasse: 0,
  notes: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
  status: 'Ativa',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  clients: Client[]
  seguradoras: Seguradora[]
  parceiros: Parceiro[]
  initialData?: Partial<Policy>
  title?: string
  fieldErrors?: FieldErrors
  submitLabel?: string
}

function FieldErr({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-500 mt-0.5">{message}</p>
}

export function PolicyFormDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  seguradoras,
  parceiros,
  initialData,
  title = 'Registrar Nova Apólice',
  fieldErrors = {},
  submitLabel = 'Salvar Apólice',
}: Props) {
  const [form, setForm] = useState<any>({ ...DEFAULT_FORM })
  const [loading, setLoading] = useState(false)
  const skipAuto = useRef(true)

  useEffect(() => {
    if (!open) return
    skipAuto.current = true
    if (initialData) {
      const exp = initialData.expand as any
      setForm({
        ...DEFAULT_FORM,
        client: initialData.client || (exp?.client?.id ?? ''),
        seguradora: initialData.seguradora || (exp?.seguradora?.id ?? ''),
        policy_number: initialData.policy_number || '',
        tipo_de_seguro: initialData.tipo_de_seguro || initialData.coverage_type || 'Auto',
        placa: initialData.placa || '',
        chassi: initialData.chassi || '',
        modelo_veiculo: initialData.modelo_veiculo || '',
        valor_bruto: initialData.valor_bruto || 0,
        valor_liquido: initialData.valor_liquido || initialData.premium_amount || 0,
        commission_percent: initialData.commission_percent || 0,
        commission: initialData.commission || 0,
        iss: initialData.iss || 0,
        tipo_de_venda: initialData.tipo_de_venda || 'Produção Própria',
        observacao_indicacao: initialData.observacao_indicacao || '',
        parceiro: initialData.parceiro || (exp?.parceiro?.id ?? ''),
        valor_repasse: initialData.valor_repasse || 0,
        notes: initialData.notes || '',
        start_date: initialData.start_date
          ? String(initialData.start_date).split('T')[0]
          : DEFAULT_FORM.start_date,
        end_date: initialData.end_date
          ? String(initialData.end_date).split('T')[0]
          : DEFAULT_FORM.end_date,
        status: initialData.status || 'Ativa',
      })
    } else {
      setForm({ ...DEFAULT_FORM })
    }
    setTimeout(() => {
      skipAuto.current = false
    }, 0)
  }, [open, initialData])

  const set = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }))

  const selectedSeguradora = seguradoras.find((s) => s.id === form.seguradora)
  const impostoPercentual = selectedSeguradora?.imposto_percentual ?? 0
  const comissaoLiquida = (form.commission || 0) - (form.iss || 0)

  useEffect(() => {
    if (skipAuto.current) return
    const v = form.valor_liquido != null ? Number(form.valor_liquido) : 0
    const p = form.commission_percent != null ? Number(form.commission_percent) : 0
    set('commission', Math.max(0, (v * p) / 100))
  }, [form.valor_liquido, form.commission_percent])

  useEffect(() => {
    if (skipAuto.current) return
    const iss =
      form.commission != null ? Math.max(0, (form.commission * (impostoPercentual || 0)) / 100) : 0
    set('iss', iss)
  }, [form.commission, form.seguradora, impostoPercentual])

  useEffect(() => {
    if (skipAuto.current) return
    if (form.tipo_de_venda === 'Parceiro' && form.parceiro && form.valor_liquido) {
      set('valor_repasse', Math.max(0, form.valor_liquido * 0.5))
    }
  }, [form.tipo_de_venda, form.parceiro, form.valor_liquido])

  const handleStartDateChange = (value: string) => {
    set('start_date', value)
    if (value) {
      const d = new Date(value + 'T00:00:00')
      d.setFullYear(d.getFullYear() + 1)
      set('end_date', d.toISOString().split('T')[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client) return
    setLoading(true)
    try {
      const endDate = new Date(form.end_date + 'T00:00:00')
      const renewalDate = new Date(endDate.getTime() - 30 * 86400000).toISOString().split('T')[0]
      await onSubmit({ ...form, renewal_date: renewalDate })
    } finally {
      setLoading(false)
    }
  }

  const err = (f: string) => fieldErrors[f]

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
              onChange={(v: string) => set('client', v)}
              placeholder="Buscar cliente por nome..."
            />
            <FieldErr message={err('client')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Nº Apólice Seguradora *</Label>
              <Input
                required
                value={form.policy_number}
                onChange={(e) => set('policy_number', e.target.value)}
              />
              <FieldErr message={err('policy_number')} />
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
                <Label className="text-xs font-semibold">Chassi</Label>
                <Input
                  value={form.chassi}
                  onChange={(e) => set('chassi', e.target.value.toUpperCase())}
                  placeholder="9BWZZZ377VT004253"
                />
              </div>
              <div className="col-span-2">
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
                step="0.01"
                value={form.valor_bruto}
                onChange={(e) => set('valor_bruto', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Valor Líquido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_liquido}
                onChange={(e) => set('valor_liquido', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">% Comissão</Label>
              <Input
                type="number"
                step="0.01"
                value={form.commission_percent}
                onChange={(e) => set('commission_percent', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Comissão Bruta (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.commission}
                onChange={(e) => set('commission', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">ISS (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.iss}
                onChange={(e) => set('iss', Number(e.target.value))}
              />
              {form.seguradora && (
                <p className="text-xs text-slate-500 mt-0.5">Imposto: {impostoPercentual}%</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Com. Líquida</Label>
              <Input
                disabled
                value={`R$ ${comissaoLiquida.toFixed(2)}`}
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
              <div>
                <Label className="text-xs font-semibold">Valor Repasse (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_repasse}
                  onChange={(e) => set('valor_repasse', Number(e.target.value))}
                />
                <p className="text-xs text-slate-500 mt-0.5">50% do valor líquido (editável)</p>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Data Início</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
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
          <div>
            <Label className="text-xs font-semibold">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Notas adicionais sobre a apólice..."
              className="text-sm"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? 'Salvando...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
