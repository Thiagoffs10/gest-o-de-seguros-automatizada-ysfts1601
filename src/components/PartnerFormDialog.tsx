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
import { Parceiro } from '@/types'
import { isValidCpf, isValidCnpj, maskCpf, maskCnpj } from '@/lib/document-validators'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  initialData?: Partial<Parceiro>
  title?: string
}

export function PartnerFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = 'Novo Parceiro',
}: Props) {
  const [form, setForm] = useState({
    nome: '',
    tipo_documento: 'CPF' as 'CPF' | 'CNPJ',
    cpf: '',
    telefone: '',
    email: '',
    dados_bancarios_ou_pix: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setForm({
        nome: initialData.nome || '',
        tipo_documento: initialData.tipo_documento || 'CPF',
        cpf: initialData.cpf || '',
        telefone: initialData.telefone || '',
        email: initialData.email || '',
        dados_bancarios_ou_pix: initialData.dados_bancarios_ou_pix || '',
      })
    } else {
      setForm({
        nome: '',
        tipo_documento: 'CPF',
        cpf: '',
        telefone: '',
        email: '',
        dados_bancarios_ou_pix: '',
      })
    }
    setErrors({})
  }, [initialData, open])

  const set = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleDocumentChange = (val: string) => {
    const masked = form.tipo_documento === 'CNPJ' ? maskCnpj(val) : maskCpf(val)
    set('cpf', masked)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.nome.trim()) errs.nome = 'Nome é obrigatório'
    if (form.tipo_documento === 'CPF') {
      if (!form.cpf.trim()) {
        errs.cpf = 'CPF é obrigatório'
      } else if (!isValidCpf(form.cpf)) {
        errs.cpf = 'CPF inválido'
      }
    } else {
      if (!form.cpf.trim()) {
        errs.cpf = 'CNPJ é obrigatório'
      } else if (!isValidCnpj(form.cpf)) {
        errs.cpf = 'CNPJ inválido'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Nome *</Label>
            <Input required value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Tipo Documento</Label>
              <Select
                value={form.tipo_documento}
                onValueChange={(v) => {
                  set('tipo_documento', v)
                  set('cpf', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Documento *</Label>
              <Input
                required
                value={form.cpf}
                onChange={(e) => handleDocumentChange(e.target.value)}
                placeholder={
                  form.tipo_documento === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'
                }
                className={errors.cpf ? 'border-red-500' : ''}
              />
              {errors.cpf && <p className="text-xs text-red-500 mt-0.5">{errors.cpf}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Dados Bancários / PIX</Label>
            <Input
              value={form.dados_bancarios_ou_pix}
              onChange={(e) => set('dados_bancarios_ou_pix', e.target.value)}
            />
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
