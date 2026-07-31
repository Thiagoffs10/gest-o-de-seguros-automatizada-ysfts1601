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
import { CustoFixo } from '@/types'

const CATEGORIAS = [
  'Contador',
  'Impostos',
  'Energia',
  'Aluguel',
  'Telecomunicação',
  'Marketing',
  'Outros',
]

const EMPTY = {
  descricao: '',
  valor: '',
  data: '',
  categoria: 'Outros',
  tipo: 'Fixo',
  observacoes: '',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  initialData?: Partial<CustoFixo>
  title?: string
}

export function CustoFixoFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = 'Adicionar Custo',
}: Props) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setForm({
        descricao: initialData.descricao || '',
        valor: initialData.valor?.toString() || '',
        data: initialData.data?.split(' ')[0] || '',
        categoria: initialData.categoria || 'Outros',
        tipo: initialData.tipo || 'Fixo',
        observacoes: initialData.observacoes || '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [initialData, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.descricao || !form.valor || !form.data) return
    setLoading(true)
    try {
      await onSubmit({
        descricao: form.descricao,
        valor: Number(form.valor),
        data: form.data,
        categoria: form.categoria,
        tipo: form.tipo,
        observacoes: form.observacoes,
      })
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Descrição *</Label>
            <Input
              required
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Valor *</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => set('valor', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Data *</Label>
              <Input
                required
                type="date"
                value={form.data}
                onChange={(e) => set('data', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixo">Fixo</SelectItem>
                  <SelectItem value="Variável">Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => set('categoria', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
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
