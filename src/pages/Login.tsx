import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Mail, Lock, User } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
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
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (isRegister) {
      const { error } = await signUp(email, password, name)
      setLoading(false)
      if (error) {
        toast({
          title: 'Erro ao cadastrar',
          description: 'Verifique se a senha possui 8+ caracteres ou se o e-mail já existe.',
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Conta criada!', description: 'Bem-vindo ao SeguroControl.' })
        navigate('/dashboard')
      }
    } else {
      const { error } = await signIn(email, password)
      setLoading(false)
      if (error) {
        toast({
          title: 'Falha no login',
          description: 'E-mail ou senha incorretos.',
          variant: 'destructive',
        })
      } else {
        navigate('/dashboard')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {isRegister ? 'Criar Conta de Corretor' : 'Gestão de Seguros'}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? 'Preencha seus dados para criar acesso'
              : 'Entre com suas credenciais para acessar o painel'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {isRegister && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Nome Completo</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="corretor@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type="password"
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              disabled={loading}
            >
              {loading ? 'Aguarde...' : isRegister ? 'Cadastrar Corretora' : 'Entrar no Sistema'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? 'Já possui conta? Faça login' : 'Primeiro acesso? Crie uma conta'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
