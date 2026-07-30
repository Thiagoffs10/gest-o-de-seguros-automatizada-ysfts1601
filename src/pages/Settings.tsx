import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Bell, Key, Shield, HelpCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SecretsGuideDialog } from '@/components/SecretsGuideDialog'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

export default function Settings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name || '')
  const [remindRenewals, setRemindRenewals] = useState(true)
  const [remindBirthdays, setRemindBirthdays] = useState(true)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    try {
      await pb.collection('users').update(user.id, { name })
      toast({ title: 'Perfil atualizado com sucesso!' })
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações do Sistema</h1>
        <p className="text-slate-500 text-sm">
          Gerencie o seu perfil e preferências de notificação da corretora.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Dados do Corretor
          </CardTitle>
          <CardDescription>Atualize seu nome de exibição no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
            <div>
              <Label>Nome Completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>E-mail Cadastrado</Label>
              <Input value={user?.email || ''} disabled className="bg-slate-100" />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="bg-blue-600">
                Salvar Perfil
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/alterar-senha')}>
                <Key className="w-4 h-4 mr-2" /> Alterar Senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Preferências de Lembretes
          </CardTitle>
          <CardDescription>Escolha quais alertas visuais exibir no painel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ren"
              checked={remindRenewals}
              onCheckedChange={(val) => setRemindRenewals(!!val)}
            />
            <Label htmlFor="ren" className="text-sm font-medium">
              Lembrar de renovações de apólices com 30 dias de antecedência
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="aniv"
              checked={remindBirthdays}
              onCheckedChange={(val) => setRemindBirthdays(!!val)}
            />
            <Label htmlFor="aniv" className="text-sm font-medium">
              Exibir notificações de aniversariantes do mês
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-slate-100 border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
            <Shield className="w-5 h-5 text-slate-600" />
            Integrações Futuras
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-3">
          <p>
            Esta plataforma permite conexão futura via webhook para gateways de pagamento, APIs de
            WhatsApp Oficial e envio de e-mails em massa.
          </p>
          <SecretsGuideDialog
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Como configurar envio de e-mails (Resend)
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
