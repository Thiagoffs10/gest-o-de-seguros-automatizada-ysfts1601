import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, AlertCircle, CheckCircle2, Loader2, ArrowLeft, KeyRound } from 'lucide-react'
import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Token de recuperação não informado ou link incompleto.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Token de recuperação não informado. Solicite um novo link.')
      return
    }

    if (!password) {
      setError('Informe a nova senha.')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setError('As senhas não conferem.')
      return
    }

    setLoading(true)
    try {
      await pb.send('/backend/v1/auth/reset-password', {
        method: 'POST',
        body: {
          token,
          password,
          passwordConfirm,
        },
      })
      setSuccess(true)
    } catch (err: any) {
      setError(
        err?.response?.message ||
          err?.message ||
          'Erro ao redefinir a senha. O link pode ter expirado ou já sido utilizado.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 flex items-center justify-center max-w-[280px] w-full">
              <img
                src={logoImg}
                alt="CRED10MIX CORRETORA DE SEGUROS"
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>
          </div>
          <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            Criar Nova Senha
          </CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium mt-1">
            Defina sua nova senha de acesso ao painel CRED10MIX
          </CardDescription>
        </CardHeader>

        {success ? (
          <CardContent className="space-y-4 pt-4 text-center">
            <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-2" />
              <h3 className="font-bold text-slate-900 text-base">Senha Redefinida!</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs">
                Sua senha foi alterada com sucesso. Agora você pode entrar com as novas credenciais.
              </p>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
              onClick={() => navigate('/login')}
            >
              Ir para o Login
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4 pt-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Nova Senha *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    type="password"
                    className="pl-9"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Confirmar Nova Senha *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    type="password"
                    className="pl-9"
                    placeholder="Repita a nova senha"
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value)
                      setError('')
                    }}
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
                disabled={loading || !token}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando Nova Senha...
                  </>
                ) : (
                  'Salvar Nova Senha'
                )}
              </Button>

              <div className="text-center mt-2">
                <Link
                  to="/login"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para o Login
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
