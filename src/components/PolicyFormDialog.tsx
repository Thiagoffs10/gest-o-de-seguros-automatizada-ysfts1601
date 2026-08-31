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
import { Loader2 } from 'lucide-react'
import { TIPOS_DE_SEGURO, TIPOS_DE_VENDA } from '@/lib/constants'
import { Client, Seguradora, Parceiro, Policy } from '@/types'
import { ClientAutocomplete } from '@/components/ClientAutocomplete'
import type { FieldErrors } from '@/lib/pocketbase/errors'
import {
  formatCurrency,
  formatCurrencyDisplay,
  parseCurrencyInput,
  formatDateForInput,
  todayLocalDate,
  toLocalDate,
} from '@/lib/utils'

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
  percentual_repasse: 50,
  valor_repasse: 0,
  notes: '',
  start_date: todayLocalDate(),
  end_date: toLocalDate(new Date(Date.now() + 365 * 86400000)),
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const skipAuto = useRef(true)

  useEffect(() => {
    if (!open) return
    skipAuto.current = true
    if (initialData) {
      const exp = initialData.expand as any
      const vBruto = initialData.valor_bruto != null ? Number(initialData.valor_bruto) : 0
      const vLiquido =
        initialData.valor_liquido != null
          ? Number(initialData.valor_liquido)
          : initialData.premium_amount != null
            ? Number(initialData.premium_amount)
            : 0
      const commPercent =
        initialData.commission_percent != null ? Number(initialData.commission_percent) : 0
      const commVal =
        initialData.commission != null
          ? Number(initialData.commission)
          : Math.round(((vLiquido * commPercent) / 100) * 100) / 100
      const issVal = initialData.iss != null ? Number(initialData.iss) : 0

      const pRepasse =
        initialData.percentual_repasse != null
          ? Number(initialData.percentual_repasse)
          : initialData.valor_repasse != null && vLiquido > 0
            ? Math.round((Number(initialData.valor_repasse) / vLiquido) * 100 * 100) / 100
            : 50

      const vRepasse =
        initialData.valor_repasse != null
          ? Number(initialData.valor_repasse)
          : Math.round(((vLiquido * pRepasse) / 100) * 100) / 100

      setForm({
        ...DEFAULT_FORM,
        client: initialData.client || (exp?.client?.id ?? ''),
        seguradora: initialData.seguradora || (exp?.seguradora?.id ?? ''),
        policy_number: initialData.policy_number || '',
        tipo_de_seguro: initialData.tipo_de_seguro || initialData.coverage_type || 'Auto',
        placa: initialData.placa || '',
        chassi: initialData.chassi || '',
        modelo_veiculo: initialData.modelo_veiculo || '',
        valor_bruto: vBruto,
        valor_liquido: vLiquido,
        commission_percent: commPercent,
        commission: commVal,
        iss: issVal,
        tipo_de_venda: initialData.tipo_de_venda || 'Produção Própria',
        observacao_indicacao: initialData.observacao_indicacao || '',
        parceiro: initialData.parceiro || (exp?.parceiro?.id ?? ''),
        percentual_repasse: pRepasse,
        valor_repasse: vRepasse,
        notes: initialData.notes || '',
        start_date: formatDateForInput(initialData.start_date) || DEFAULT_FORM.start_date,
        end_date: formatDateForInput(initialData.end_date) || DEFAULT_FORM.end_date,
        status: initialData.status || 'Ativa',
      })
    } else {
      setForm({ ...DEFAULT_FORM })
    }
    setValidationErrors({})
    setTimeout(() => {
      skipAuto.current = false
    }, 100)
  }, [open, initialData])

  const set = (key: string, val: any) => {
    setForm((prev: any) => ({ ...prev, [key]: val }))
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const selectedSeguradora = seguradoras.find((s) => s.id === form.seguradora)
  const impostoPercentual = selectedSeguradora?.imposto_percentual ?? 0
  const comissaoLiquida = Math.round(((form.commission || 0) - (form.iss || 0)) * 100) / 100

  // 1. Calculate Gross Commission based on Valor Líquido and Commission %
  useEffect(() => {
    if (skipAuto.current) return
    const v = form.valor_liquido != null ? Number(form.valor_liquido) : 0
    const p = form.commission_percent != null ? Number(form.commission_percent) : 0
    const comm = Math.round(((v * p) / 100) * 100) / 100
    setForm((prev: any) => ({ ...prev, commission: comm }))
  }, [form.valor_liquido, form.commission_percent])

  // 2. Calculate ISS based on Gross Commission and Seguradora Imposto %
  useEffect(() => {
    if (skipAuto.current) return
    const comm = form.commission != null ? Number(form.commission) : 0
    const issVal = Math.round(((comm * (impostoPercentual || 0)) / 100) * 100) / 100
    setForm((prev: any) => ({ ...prev, iss: issVal }))
  }, [form.commission, form.seguradora, impostoPercentual])

  // 3. Calculate Repasse to Partner based on Valor Líquido and % Repasse
  useEffect(() => {
    if (skipAuto.current) return
    if (form.tipo_de_venda === 'Parceiro') {
      const vLiquido = form.valor_liquido != null ? Number(form.valor_liquido) : 0
      const pRepasse = form.percentual_repasse != null ? Number(form.percentual_repasse) : 0
      const repasse = Math.round(((vLiquido * pRepasse) / 100) * 100) / 100
      setForm((prev: any) => ({ ...prev, valor_repasse: repasse }))
    }
  }, [form.tipo_de_venda, form.valor_liquido, form.percentual_repasse])

  const handleStartDateChange = (value: string) => {
    set('start_date', value)
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-')
      const nextYear = parseInt(parts[0], 10) + 1
      const nextYearStr = `${nextYear}-${parts[1]}-${parts[2]}`
      set('end_date', nextYearStr)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.client) errs.client = 'Selecione um cliente'
    if (!form.policy_number?.trim()) errs.policy_number = 'Número da apólice é obrigatório'
    if (!form.start_date) errs.start_date = 'Data de início é obrigatória'
    if (!form.end_date) errs.end_date = 'Data de fim é obrigatória'
    if (form.tipo_de_venda === 'Parceiro' && !form.parceiro) {
      errs.parceiro = 'Selecione um parceiro'
    }

    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs)
      return
    }
    setValidationErrors({})
    setLoading(true)
    try {
      const endDate = new Date(form.end_date + 'T00:00:00')
      const renewalDate = toLocalDate(new Date(endDate.getTime() - 30 * 86400000))
      await onSubmit({ ...form, renewal_date: renewalDate })
    } catch {
      setLoading(false)
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
            <FieldErr message={err('client') || validationErrors.client} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Nº Apólice Seguradora *</Label>
              <Input
                required
                value={form.policy_number}
                onChange={(e) => set('policy_number', e.target.value)}
              />
              <FieldErr message={err('policy_number') || validationErrors.policy_number} />
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
              <Label className="text-xs font-semibold">Valor Bruto</Label>
              <Input
                type="text"
                value={form.valor_bruto ? formatCurrencyDisplay(form.valor_bruto) : ''}
                placeholder="R$ 0,00"
                onChange={(e) => {
                  const num = parseCurrencyInput(e.target.value)
                  set('valor_bruto', num)
                }}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Valor Líquido</Label>
              <Input
                type="text"
                value={form.valor_liquido ? formatCurrencyDisplay(form.valor_liquido) : ''}
                placeholder="R$ 0,00"
                onChange={(e) => {
                  const num = parseCurrencyInput(e.target.value)
                  set('valor_liquido', num)
                }}
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
                value={`R$ ${formatCurrency(comissaoLiquida)}`}
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
            <div className="space-y-3 p-3 bg-slate-50 border rounded-md">
              <div>
                <Label className="text-xs font-semibold">Parceiro *</Label>
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
                <FieldErr message={err('parceiro') || validationErrors.parceiro} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Percentual de Repasse (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.percentual_repasse}
                    onChange={(e) => set('percentual_repasse', Number(e.target.value))}
                    placeholder="50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Valor Repasse (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_repasse}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      set('valor_repasse', val)
                      if (form.valor_liquido > 0) {
                        const calculatedP =
                          Math.round((val / Number(form.valor_liquido)) * 100 * 100) / 100
                        setForm((prev: any) => ({
                          ...prev,
                          percentual_repasse: calculatedP,
                          valor_repasse: val,
                        }))
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Calculado automaticamente: {form.percentual_repasse || 0}% de R${' '}
                {formatCurrency(form.valor_liquido || 0)} = R${' '}
                {formatCurrency(form.valor_repasse || 0)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Data Início *</Label>
              <Input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
              <FieldErr message={err('start_date') || validationErrors.start_date} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Data Fim *</Label>
              <Input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
              />
              <FieldErr message={err('end_date') || validationErrors.end_date} />
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

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Salvando...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
