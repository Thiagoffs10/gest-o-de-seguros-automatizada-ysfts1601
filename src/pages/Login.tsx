import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { ClientResponseError } from 'pocketbase'
import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'
import { useAuth } from '@/hooks/use-auth'
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
              <label className="text-xs font-semibold text-slate-700">Senha</label>
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
    </div>
  )
}
