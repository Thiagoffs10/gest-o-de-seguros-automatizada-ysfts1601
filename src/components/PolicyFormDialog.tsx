import { useState, useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { createClient } from '@/services/clients'
import { useToast } from '@/hooks/use-toast'
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
import { Client, Seguradora, Parceiro, Policy, ModeloComissao } from '@/types'
import { getModelosComissao, findSuggestedModelo } from '@/services/modelos-comissao'
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
  numero_proposta: '',
  policy_number: '',
  tipo_de_seguro: 'Auto',
  placa: '',
  chassi: '',
  modelo_veiculo: '',
  valor_bruto: 0,
  valor_liquido: 0,
  forma_pagamento: '',
  parcelas: '',
  forma_recebimento: '',
  qtde_parcelas_esperadas: '',
  obs_forma_recebimento: '',
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
  previous_policy: '',
  modelo_comissao: '',
  comissao_personalizada: false,
  comissao_personalizada_config: null,
  motivo_personalizacao: '',
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
  clients: initialClients,
  seguradoras,
  parceiros,
  initialData,
  title = 'Registrar Nova Apólice',
  fieldErrors = {},
  submitLabel = 'Salvar Apólice',
}: Props) {
  const { toast } = useToast()
  const [clientsList, setClientsList] = useState<Client[]>(initialClients)
  const [isNewClientOpen, setIsNewClientOpen] = useState(false)
  const [form, setForm] = useState<any>({ ...DEFAULT_FORM })

  useEffect(() => {
    setClientsList(initialClients)
  }, [initialClients])
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [modelosList, setModelosList] = useState<ModeloComissao[]>([])
  const [modeloAtivo, setModeloAtivo] = useState<ModeloComissao | null>(null)
  const skipAuto = useRef(true)

  useEffect(() => {
    if (open) {
      getModelosComissao()
        .then(setModelosList)
        .catch(() => {})
    }
  }, [open])

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
        numero_proposta: initialData.numero_proposta || '',
        policy_number: initialData.policy_number || '',
        tipo_de_seguro: initialData.tipo_de_seguro || initialData.coverage_type || 'Auto',
        placa: initialData.placa || '',
        chassi: initialData.chassi || '',
        modelo_veiculo: initialData.modelo_veiculo || '',
        valor_bruto: vBruto,
        valor_liquido: vLiquido,
        forma_pagamento: initialData.forma_pagamento || '',
        parcelas: initialData.parcelas != null ? initialData.parcelas : '',
        forma_recebimento: initialData.forma_recebimento || '',
        qtde_parcelas_esperadas:
          initialData.qtde_parcelas_esperadas != null ? initialData.qtde_parcelas_esperadas : '',
        obs_forma_recebimento: initialData.obs_forma_recebimento || '',
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
        previous_policy: initialData.previous_policy || '',
        modelo_comissao: initialData.modelo_comissao || '',
        comissao_personalizada: Boolean(initialData.comissao_personalizada),
        comissao_personalizada_config: initialData.comissao_personalizada_config || null,
        motivo_personalizacao: '',
      })
      if (initialData.modelo_comissao) {
        const m = modelosList.find((x) => x.id === initialData.modelo_comissao)
        if (m) setModeloAtivo(m)
      }
    } else {
      setForm({ ...DEFAULT_FORM })
      setModeloAtivo(null)
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

  // Sugestão automática de modelo por Seguradora + Produto ao trocar
  useEffect(() => {
    if (!open || initialData || form.comissao_personalizada) return
    if (form.seguradora || form.tipo_de_seguro) {
      findSuggestedModelo(form.seguradora, form.tipo_de_seguro).then((sugestao) => {
        if (sugestao && (!form.modelo_comissao || form.modelo_comissao === '')) {
          set('modelo_comissao', sugestao.id)
          setModeloAtivo(sugestao)
          if (sugestao.percentual_padrao && Number(sugestao.percentual_padrao) > 0) {
            set('commission_percent', Number(sugestao.percentual_padrao))
          }
        }
      })
    }
  }, [form.seguradora, form.tipo_de_seguro, open, initialData, form.comissao_personalizada])

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

  // 3. Calculate Repasse to Partner based on Valor Líquido and % Repasse (apenas se % Repasse mudar e valor não for fixado em 0 manualmente)
  useEffect(() => {
    if (skipAuto.current) return
    if (form.tipo_de_venda === 'Parceiro') {
      // Se o percentual de repasse for 0 explicitamente, repasse é 0
      const vLiquido = form.valor_liquido != null ? Number(form.valor_liquido) : 0
      const pRepasse = form.percentual_repasse != null ? Number(form.percentual_repasse) : 0
      if (pRepasse === 0) {
        setForm((prev: any) => ({ ...prev, valor_repasse: 0 }))
      } else {
        const repasse = Math.round(((vLiquido * pRepasse) / 100) * 100) / 100
        setForm((prev: any) => ({ ...prev, valor_repasse: repasse }))
      }
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
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-semibold">Cliente *</Label>
              <button
                type="button"
                onClick={() => setIsNewClientOpen(true)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> Novo Cliente
              </button>
            </div>
            <ClientAutocomplete
              clients={clientsList}
              value={form.client}
              onChange={(v: string) => set('client', v)}
              placeholder="Buscar cliente por nome..."
            />
            <FieldErr message={err('client') || validationErrors.client} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Nº da proposta (opcional)</Label>
              <Input
                value={form.numero_proposta || ''}
                onChange={(e) => set('numero_proposta', e.target.value)}
                placeholder="Ex: PROP-12345"
              />
              <FieldErr message={err('numero_proposta') || validationErrors.numero_proposta} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Nº da apólice (opcional)</Label>
              <Input
                value={form.policy_number || ''}
                onChange={(e) => set('policy_number', e.target.value)}
                placeholder="Ex: AP-987654"
              />
              <FieldErr message={err('policy_number') || validationErrors.policy_number} />
            </div>
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
              <Label className="text-xs font-semibold">Forma de pagamento</Label>
              <Select
                value={form.forma_pagamento || ''}
                onValueChange={(v) => set('forma_pagamento', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Crédito">Crédito</SelectItem>
                  <SelectItem value="Débito em conta">Débito em conta</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Em quantas vezes</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="Ex: 1, 6, 10, 12"
                value={form.parcelas ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10)
                  set('parcelas', isNaN(val as number) ? '' : val)
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
              <Label className="text-xs font-semibold">Comissão Bruta Prevista (R$)</Label>
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
              <Label className="text-xs font-semibold">ISS Estimado (R$)</Label>
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
              <Label className="text-xs font-semibold">Com. Líquida Estimada</Label>
              <Input
                disabled
                value={`R$ ${formatCurrency(comissaoLiquida)}`}
                className="bg-slate-100 font-bold"
              />
            </div>
          </div>

          {/* Modelo de Recebimento de Comissão (ETAPA 2A) */}
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-900">
                Modelo de Recebimento de Comissão
              </Label>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    set('comissao_personalizada', false)
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    !form.comissao_personalizada
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border'
                  }`}
                >
                  Usar modelo padrão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set('comissao_personalizada', true)
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    form.comissao_personalizada
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border'
                  }`}
                >
                  Personalizar nesta apólice
                </button>
              </div>
            </div>

            {!form.comissao_personalizada ? (
              <div>
                <Select
                  value={form.modelo_comissao || 'none'}
                  onValueChange={(v) => {
                    const mId = v === 'none' ? '' : v
                    set('modelo_comissao', mId)
                    const m = modelosList.find((x) => x.id === mId)
                    setModeloAtivo(m || null)
                    if (m?.percentual_padrao && Number(m.percentual_padrao) > 0) {
                      set('commission_percent', Number(m.percentual_padrao))
                    }
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecione o modelo de comissão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Sem modelo pré-definido (Manual / À vista padrão)
                    </SelectItem>
                    {modelosList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome} ({m.tipo_modelo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modeloAtivo && (
                  <p className="text-[11px] text-blue-700 mt-1">
                    ✓ Modelo ativo: <strong>{modeloAtivo.nome}</strong> — tipo{' '}
                    {modeloAtivo.tipo_modelo}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded text-xs">
                <p className="text-[11px] font-medium text-amber-900">
                  ⚠️ Negociação exclusiva desta apólice. Não alterará o modelo padrão das demais
                  apólices.
                </p>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Motivo da personalização *
                  </Label>
                  <Input
                    placeholder="Ex: Negociação especial 25% pelo volume ou condição de fase diferente"
                    className="bg-white text-xs h-8 mt-0.5"
                    value={form.motivo_personalizacao || ''}
                    onChange={(e) => set('motivo_personalizacao', e.target.value)}
                  />
                </div>
              </div>
            )}
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
                      if (val === 0) {
                        setForm((prev: any) => ({
                          ...prev,
                          percentual_repasse: 0,
                          valor_repasse: 0,
                        }))
                      } else if (form.valor_liquido > 0) {
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
                <SelectItem value="Vencida">Vencida</SelectItem>
                <SelectItem value="Expirada">Expirada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>{' '}
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

      <ClientFormDialog
        open={isNewClientOpen}
        onOpenChange={setIsNewClientOpen}
        title="Cadastrar Novo Cliente"
        onSubmit={async (newClientData) => {
          try {
            const created = await createClient(newClientData)
            setClientsList((prev) => [created, ...prev])
            set('client', created.id)
            toast({ title: 'Cliente criado com sucesso!' })
            setIsNewClientOpen(false)
          } catch (e: any) {
            toast({
              title: 'Erro ao cadastrar cliente',
              description: e?.message,
              variant: 'destructive',
            })
          }
        }}
      />
    </Dialog>
  )
}
