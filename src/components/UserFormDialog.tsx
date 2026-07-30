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
import { createUser, updateUser } from '@/services/users'
import { User } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingUser?: User | null
}

const ROLE_OPTIONS = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Gerente', label: 'Gerente' },
  { value: 'Operador', label: 'Operador' },
  { value: 'Visualizador', label: 'Visualizador' },
]

export function UserFormDialog({ open, onOpenChange, onSuccess, editingUser }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'Operador' as string,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = !!editingUser

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setForm({
          name: editingUser.name || '',
          email: editingUser.email || '',
          password: '',
          passwordConfirm: '',
          role: editingUser.role || 'Operador',
        })
      } else {
        setForm({
          name: '',
          email: '',
          password: '',
          passwordConfirm: '',
          role: 'Operador',
        })
      }
      setErrors({})
    }
  }, [open, editingUser])

  const set = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.'

    if (!isEdit) {
      if (!form.email.trim()) errs.email = 'E-mail é obrigatório.'
      if (!form.password) errs.password = 'Senha é obrigatória.'
      if (form.password.length < 8) errs.password = 'A senha deve ter no mínimo 8 caracteres.'
      if (form.password !== form.passwordConfirm) errs.passwordConfirm = 'As senhas não conferem.'
    } else {
      if (form.password && form.password.length < 8)
        errs.password = 'A senha deve ter no mínimo 8 caracteres.'
      if (form.password && form.password !== form.passwordConfirm)
        errs.passwordConfirm = 'As senhas não conferem.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      if (isEdit && editingUser) {
        const updateData: Record<string, any> = {
          name: form.name.trim(),
          role: form.role,
        }
        if (form.password) {
          updateData.password = form.password
          updateData.passwordConfirm = form.passwordConfirm
        }
        await updateUser(editingUser.id, updateData)
        toast({ title: 'Usuário atualizado com sucesso!' })
      } else {
        await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          passwordConfirm: form.passwordConfirm,
          role: form.role as any,
        })
        toast({ title: 'Usuário criado com sucesso!' })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: isEdit ? 'Erro ao atualizar usuário' : 'Erro ao criar usuário',
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
          <DialogTitle>{isEdit ? 'Editar Usuário' : 'Criar Usuário'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Nome *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nome do usuário"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {!isEdit && (
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
          )}

          {isEdit && (
            <div>
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input value={form.email} disabled className="bg-slate-100" />
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">
              {isEdit ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div>
            <Label className="text-xs font-semibold">Confirmar Senha</Label>
            <Input
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
            <Label className="text-xs font-semibold">Tipo de Usuário *</Label>
            <Select value={form.role} onValueChange={(val) => set('role', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600" disabled={loading}>
              {loading
                ? isEdit
                  ? 'Salvando...'
                  : 'Criando...'
                : isEdit
                  ? 'Salvar Alterações'
                  : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
