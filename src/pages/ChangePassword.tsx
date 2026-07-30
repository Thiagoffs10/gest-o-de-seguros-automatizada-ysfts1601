import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { verifyOldPassword, updatePassword, reauthenticate } from '@/services/users'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export default function ChangePassword() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    const errors: Record<string, string> = {}
    if (!oldPassword) errors.oldPassword = 'Senha atual e obrigatoria.'
    if (!newPassword) errors.newPassword = 'Nova senha e obrigatoria.'
    if (newPassword && newPassword.length < 8)
      errors.newPassword = 'A nova senha deve ter no minimo 8 caracteres.'
    if (!confirmPassword) errors.confirmPassword = 'Confirmacao e obrigatoria.'
    if (newPassword && confirmPassword && newPassword !== confirmPassword)
      errors.confirmPassword = 'As senhas nao conferem.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    const isOldValid = await verifyOldPassword(user?.email || '', oldPassword)
    if (!isOldValid) {
      setFieldErrors({ oldPassword: 'Senha atual incorreta.' })
      setLoading(false)
      return
    }

    try {
      await updatePassword(user?.id || '', newPassword)
      await reauthenticate(user?.email || '', newPassword)

      toast({ title: 'Senha alterada com sucesso!' })
      navigate('/configuracoes')
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao alterar senha',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alterar Senha</h1>
          <p className="text-slate-500 text-sm">Atualize sua senha de acesso ao sistema.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            Alteracao de Senha
          </CardTitle>
          <CardDescription>Digite sua senha atual e a nova senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Senha Atual</Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type={showOld ? 'text' : 'password'}
                  className="pl-9 pr-9"
                  placeholder="........"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowOld(!showOld)}
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.oldPassword && (
                <p className="text-xs text-red-500">{fieldErrors.oldPassword}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nova Senha</Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type={showNew ? 'text' : 'password'}
                  className="pl-9 pr-9"
                  placeholder="........"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.newPassword && (
                <p className="text-xs text-red-500">{fieldErrors.newPassword}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  className="pl-9 pr-9"
                  placeholder="........"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/configuracoes')}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
