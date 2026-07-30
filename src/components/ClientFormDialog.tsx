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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BRAZILIAN_STATES } from '@/lib/constants'
import { lookupCep } from '@/lib/cep'
import { Client } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  initialData?: Partial<Client>
  title?: string
}

export function ClientFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = 'Adicionar Novo Cliente',
}: Props) {
  const [form, setForm] = useState({
    name: '',
    cpf: '',
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
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        cpf: initialData.cpf || '',
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
      setForm({
        name: '',
        cpf: '',
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
      })
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onSubmit(form)
    setLoading(false)
  }

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input required value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">CPF</Label>
              <Input
                value={form.cpf}
                onChange={(e) => set('cpf', e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
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
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
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
          <div>
            <Label className="text-xs font-semibold">Data de Nascimento</Label>
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => set('birth_date', e.target.value)}
            />
          </div>
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
