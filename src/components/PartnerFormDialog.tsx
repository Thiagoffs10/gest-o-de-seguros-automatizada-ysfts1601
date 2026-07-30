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
import { Parceiro } from '@/types'

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
    cpf: '',
    telefone: '',
    email: '',
    dados_bancarios_ou_pix: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm({
        nome: initialData.nome || '',
        cpf: initialData.cpf || '',
        telefone: initialData.telefone || '',
        email: initialData.email || '',
        dados_bancarios_ou_pix: initialData.dados_bancarios_ou_pix || '',
      })
    } else {
      setForm({ nome: '', cpf: '', telefone: '', email: '', dados_bancarios_ou_pix: '' })
    }
  }, [initialData, open])

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onSubmit(form)
    setLoading(false)
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
          <div>
            <Label className="text-xs font-semibold">CPF *</Label>
            <Input
              required
              value={form.cpf}
              onChange={(e) => set('cpf', e.target.value)}
              placeholder="000.000.000-00"
            />
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
