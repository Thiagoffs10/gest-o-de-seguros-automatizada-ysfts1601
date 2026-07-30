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
import { createUser } from '@/services/users'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UserFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'user' as 'admin' | 'user',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', password: '', passwordConfirm: '', role: 'user' })
      setErrors({})
    }
  }, [open])

  const set = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Nome e obrigatorio.'
    if (!form.email.trim()) errs.email = 'E-mail e obrigatorio.'
    if (!form.password) errs.password = 'Senha e obrigatoria.'
    if (form.password.length < 8) errs.password = 'A senha deve ter no minimo 8 caracteres.'
    if (form.password !== form.passwordConfirm) errs.passwordConfirm = 'As senhas nao conferem.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        role: form.role,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao criar usuario',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Nome *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nome do usuario"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold">E-mail *</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="usuario@exemplo.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold">Senha *</Label>
            <Input
              required
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Minimo 8 caracteres"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold">Confirmar Senha *</Label>
            <Input
              required
              type="password"
              value={form.passwordConfirm}
              onChange={(e) => set('passwordConfirm', e.target.value)}
              placeholder="Repita a senha"
            />
            {errors.passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold">Tipo de Usuario</Label>
            <Select value={form.role} onValueChange={(val) => set('role', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
