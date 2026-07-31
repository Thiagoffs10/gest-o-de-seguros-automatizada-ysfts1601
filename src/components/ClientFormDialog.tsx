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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BRAZILIAN_STATES } from '@/lib/constants'
import { lookupCep } from '@/lib/cep'
import { isValidCpf, isValidCnpj, maskCpf, maskCnpj } from '@/lib/document-validators'
import { maskPhone } from '@/lib/phone-utils'
import { Client } from '@/types'
import { getClients } from '@/services/clients'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  initialData?: Partial<Client>
  title?: string
}

const EMPTY_FORM = {
  tipo_pessoa: 'PF' as 'PF' | 'PJ',
  name: '',
  cpf: '',
  cnpj: '',
  email: '',
  phone: '',
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  birth_date: '',
  notes: '',
}

export function ClientFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = 'Adicionar Novo Cliente',
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm({
        tipo_pessoa: (initialData.tipo_pessoa as 'PF' | 'PJ') || 'PF',
        name: initialData.name || '',
        cpf: initialData.cpf || '',
        cnpj: initialData.cnpj || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        cep: initialData.cep || '',
        rua: initialData.rua || '',
        numero: initialData.numero || '',
        bairro: initialData.bairro || '',
        cidade: initialData.cidade || '',
        estado: initialData.estado || '',
        birth_date: initialData.birth_date?.split(' ')[0] || '',
        notes: initialData.notes || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [initialData, open])

  const handleCepBlur = async () => {
    if (!form.cep) return
    const result = await lookupCep(form.cep)
    if (result) {
      setForm((prev) => ({
        ...prev,
        rua: result.logradouro || prev.rua,
        bairro: result.bairro || prev.bairro,
        cidade: result.localidade || prev.cidade,
        estado: result.uf || prev.estado,
      }))
    }
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'

    if (form.tipo_pessoa === 'PF') {
      if (!form.cpf.trim()) {
        errs.cpf = 'CPF é obrigatório para Pessoa Física'
      } else if (!isValidCpf(form.cpf)) {
        errs.cpf = 'CPF inválido'
      }
    } else {
      if (!form.cnpj.trim()) {
        errs.cnpj = 'CNPJ é obrigatório para Pessoa Jurídica'
      } else if (!isValidCnpj(form.cnpj)) {
        errs.cnpj = 'CNPJ inválido'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const checkDuplicateDocument = async (): Promise<boolean> => {
    try {
      if (form.tipo_pessoa === 'PF' && form.cpf.trim()) {
        const existing = await getClients('', `cpf = "${form.cpf}"`)
        if (existing.length > 0 && existing[0].id !== initialData?.id) {
          setErrors((prev) => ({ ...prev, cpf: 'Este CPF já está cadastrado' }))
          return false
        }
      } else if (form.tipo_pessoa === 'PJ' && form.cnpj.trim()) {
        const existing = await getClients('', `cnpj = "${form.cnpj}"`)
        if (existing.length > 0 && existing[0].id !== initialData?.id) {
          setErrors((prev) => ({ ...prev, cnpj: 'Este CNPJ já está cadastrado' }))
          return false
        }
      }
    } catch {
      /* network error — allow submit, backend will enforce uniqueness */
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!(await checkDuplicateDocument())) return
    setLoading(true)
    const payload = { ...form }
    if (payload.tipo_pessoa === 'PF') {
      payload.cnpj = ''
    } else {
      payload.cpf = ''
      payload.birth_date = ''
    }
    try {
      await onSubmit(payload)
    } finally {
      setLoading(false)
    }
  }

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleTipoPessoaChange = (val: 'PF' | 'PJ') => {
    setForm((prev) => ({
      ...prev,
      tipo_pessoa: val,
      cpf: val === 'PF' ? prev.cpf : '',
      cnpj: val === 'PJ' ? prev.cnpj : '',
      birth_date: val === 'PF' ? prev.birth_date : '',
    }))
    setErrors({})
  }

  const isPF = form.tipo_pessoa === 'PF'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Tipo de Pessoa</Label>
            <RadioGroup
              value={form.tipo_pessoa}
              onValueChange={(v) => handleTipoPessoaChange(v as 'PF' | 'PJ')}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PF" id="tipo-pf" />
                <Label htmlFor="tipo-pf" className="text-sm font-normal cursor-pointer">
                  Pessoa Física (PF)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PJ" id="tipo-pj" />
                <Label htmlFor="tipo-pj" className="text-sm font-normal cursor-pointer">
                  Pessoa Jurídica (PJ)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">
                {isPF ? 'Nome Completo *' : 'Razão Social *'}
              </Label>
              <Input required value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            {isPF ? (
              <div>
                <Label className="text-xs font-semibold">CPF *</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => set('cpf', maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
                {errors.cpf && <p className="text-xs text-red-500 mt-0.5">{errors.cpf}</p>}
              </div>
            ) : (
              <div>
                <Label className="text-xs font-semibold">CNPJ *</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => set('cnpj', maskCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                />
                {errors.cnpj && <p className="text-xs text-red-500 mt-0.5">{errors.cnpj}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
              <Input
                value={form.phone}
                onChange={(e) => set('phone', maskPhone(e.target.value))}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs font-semibold">CEP</Label>
              <Input
                value={form.cep}
                onChange={(e) => set('cep', e.target.value)}
                onBlur={handleCepBlur}
                placeholder="00000-000"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold">Rua / Endereço</Label>
              <Input value={form.rua} onChange={(e) => set('rua', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs font-semibold">Número</Label>
              <Input value={form.numero} onChange={(e) => set('numero', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold">Bairro</Label>
              <Input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Cidade</Label>
              <Input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Estado</Label>
              <Select value={form.estado || ''} onValueChange={(v) => set('estado', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isPF && (
            <div>
              <Label className="text-xs font-semibold">Data de Nascimento</Label>
              <Input
                type="date"
                value={form.birth_date}
                onChange={(e) => set('birth_date', e.target.value)}
              />
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600" disabled={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
