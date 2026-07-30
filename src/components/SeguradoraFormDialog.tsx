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
import { Seguradora } from '@/types'
import type { FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  initialData?: Partial<Seguradora>
  title?: string
  fieldErrors?: FieldErrors
  submitLabel?: string
}

function FieldErr({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-500 mt-0.5">{message}</p>
}

export function SeguradoraFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = 'Nova Seguradora',
  fieldErrors = {},
  submitLabel = 'Salvar',
}: Props) {
  const [form, setForm] = useState({ nome: '', imposto_percentual: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setForm({
        nome: initialData.nome || '',
        imposto_percentual: initialData.imposto_percentual ?? 0,
      })
    } else {
      setForm({ nome: '', imposto_percentual: 0 })
    }
  }, [open, initialData])

  const set = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  const err = (f: string) => fieldErrors[f]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold">Nome *</Label>
            <Input
              required
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Nome da seguradora"
            />
            <FieldErr message={err('nome')} />
          </div>
          <div>
            <Label className="text-xs font-semibold">Imposto (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.imposto_percentual}
              onChange={(e) => set('imposto_percentual', Number(e.target.value))}
            />
            <FieldErr message={err('imposto_percentual')} />
            <p className="text-xs text-slate-500 mt-1">
              Percentual de imposto deduzido do valor bruto para cálculo do valor líquido.
            </p>
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
