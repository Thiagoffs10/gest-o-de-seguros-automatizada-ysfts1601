import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { ClientResponseError } from 'pocketbase'
import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function Login() {
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [generalError, setGeneralError] = useState('')

  // Modal de Esqueci minha senha
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

  useEffect(() => {
    localStorage.removeItem('rememberedPassword')
    const savedEmail = localStorage.getItem('rememberedEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError('E-mail é obrigatório')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError('Digite um e-mail válido')
      return false
    }
    setEmailError('')
    return true
  }

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Senha é obrigatória')
      return false
    }
    if (value.length < 8) {
      setPasswordError('A senha deve ter no mínimo 8 caracteres')
      return false
    }
    setPasswordError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')

    const isEmailValid = validateEmail(email)
    const isPasswordValid = validatePassword(password)

    if (!isEmailValid || !isPasswordValid) return

    setLoading(true)

    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email)
    } else {
      localStorage.removeItem('rememberedEmail')
    }

    try {
      const { error } = await signIn(email, password)

      if (error) {
        if (error instanceof ClientResponseError) {
          if (error.status === 0) {
            setGeneralError(
              'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
            )
          } else if (error.status === 400) {
            const fieldData = error.response?.data
            if (fieldData && (fieldData.identity || fieldData.email)) {
              setEmailError('E-mail inválido')
            } else {
              setGeneralError('E-mail ou senha inválidos.')
            }
          } else if (error.status === 401) {
            setGeneralError('E-mail ou senha inválidos.')
          } else {
            setGeneralError('Erro ao fazer login. Tente novamente.')
          }
        } else {
          setGeneralError('Não foi possível conectar. Tente novamente.')
        }
      } else {
        navigate('/dashboard')
      }
    } catch {
      setGeneralError('Ocorreu um erro inesperado. Tente novamente.')
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
          <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">
            CRED10MIX CORRETORA DE SEGUROS
          </CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium mt-1">
            Painel de Gestão de Seguros e Controle de Apólices
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4 pt-4">
            {generalError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type="email"
                  className={`pl-9 ${emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  placeholder="corretor@exemplo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setGeneralError('')
                    if (emailError) validateEmail(e.target.value)
                  }}
                  required
                />
              </div>
              {emailError && <p className="text-xs text-red-500 font-medium">{emailError}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email || '')
                    setForgotError('')
                    setForgotSuccess(false)
                    setIsForgotModalOpen(true)
                  }}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type="password"
                  className={`pl-9 ${passwordError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setGeneralError('')
                    if (passwordError) validatePassword(e.target.value)
                  }}
                  required
                  minLength={8}
                />
              </div>
              {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label
                  htmlFor="remember-me"
                  className="text-xs font-medium text-slate-700 cursor-pointer select-none"
                >
                  Lembrar-me
                </label>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aguarde...
                </>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Modal Esqueci Minha Senha */}
      <Dialog
        open={isForgotModalOpen}
        onOpenChange={(open) => {
          setIsForgotModalOpen(open)
          if (!open) {
            setForgotError('')
            setForgotSuccess(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Recuperar Senha
            </DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado no sistema para receber o link seguro de redefinição de
              senha.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="py-4 space-y-4 text-center">
              <div className="flex flex-col items-center justify-center p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mb-2" />
                <p className="text-sm font-semibold text-emerald-900">
                  Solicitação enviada com sucesso!
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Se o e-mail <strong>{forgotEmail}</strong> estiver cadastrado em nossa base, você
                  receberá em instantes um link seguro e temporário para criar sua nova senha.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => setIsForgotModalOpen(false)}
                >
                  Entendi e Voltar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!forgotEmail.trim()) {
                  setForgotError('Informe o e-mail cadastrado.')
                  return
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (!emailRegex.test(forgotEmail)) {
                  setForgotError('Digite um e-mail válido.')
                  return
                }
                setForgotLoading(true)
                setForgotError('')
                try {
                  await pb.send('/backend/v1/auth/request-password-reset', {
                    method: 'POST',
                    body: { email: forgotEmail.trim() },
                  })
                  setForgotSuccess(true)
                } catch {
                  // Mensagem neutra para não vazar se e-mail existe
                  setForgotSuccess(true)
                } finally {
                  setForgotLoading(false)
                }
              }}
              className="space-y-4 pt-2"
            >
              {forgotError && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">E-mail Cadastrado *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    className="pl-9"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value)
                      setForgotError('')
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  O link de redefinição expirará em 1 hora por segurança.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotModalOpen(false)}
                  disabled={forgotLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 font-semibold"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Link de Redefinição'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
