import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HelpCircle, Server, KeyRound, Plus, Save, ExternalLink, Globe, Mail } from 'lucide-react'

interface SecretsGuideDialogProps {
  trigger?: React.ReactNode
}

const STEPS = [
  {
    icon: Globe,
    title: 'Acesse a plataforma Skip Cloud',
    description:
      'Abra o painel da Skip Cloud onde sua aplicação está hospedada. Na barra superior (acima do preview da aplicação), você verá ícones de configuração do backend.',
  },
  {
    icon: Server,
    title: 'Abra o painel do backend',
    description:
      'Clique no ícone de servidor (🔧) na barra de ferramentas superior. Isso abrirá o painel de integração do backend PocketBase, onde você gerencia coleções, hooks e configurações.',
  },
  {
    icon: KeyRound,
    title: 'Navegue até a aba "Secrets"',
    description:
      'Dentro do painel do backend, localize e clique na aba "Secrets" (Segredos). Esta seção permite gerenciar variáveis de ambiente sensíveis como chaves de API.',
  },
  {
    icon: Plus,
    title: 'Adicione o segredo RESEND_API_KEY',
    description:
      'Clique no botão "Add new secret". Preencha os campos: Key (Chave): RESEND_API_KEY — Value (Valor): cole sua chave de API do Resend (começa com "re_").',
  },
  {
    icon: Mail,
    title: 'Remetente padrão (CRED10MIX <noreply@cred10mix.com.br>)',
    description:
      'Com o domínio cred10mix.com.br verificado no Resend, todos os e-mails são disparados através do remetente amigável oficial CRED10MIX <noreply@cred10mix.com.br> para máxima entregabilidade.',
  },
  {
    icon: Save,
    title: 'Salve a configuração',
    description:
      'Após preencher os campos, clique em "Save". Os segredos serão armazenados com segurança e estarão disponíveis para os hooks do backend via $secrets.get().',
  },
]

export function SecretsGuideDialog({ trigger }: SecretsGuideDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <HelpCircle className="w-4 h-4 mr-2" />
            Como configurar envio de e-mails
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            Configuração do Resend (Envio de E-mails)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">
            Para habilitar o envio automatizado de e-mails, você precisa configurar a chave de API
            do Resend como um segredo no painel da Skip Cloud. Siga os passos abaixo:
          </p>
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <Card key={index} className="p-4 border-slate-200">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className="w-0.5 flex-1 bg-slate-200 mt-2 min-h-[16px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-sm text-slate-800">{step.title}</h4>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </Card>
            )
          })}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-blue-900">Resumo rápido</h4>
                <p className="text-xs text-blue-800">
                  <strong>Key:</strong>{' '}
                  <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-900">
                    RESEND_API_KEY
                  </code>
                </p>
                <p className="text-xs text-blue-800">
                  <strong>Value:</strong>{' '}
                  <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-900">
                    re_sua_chave_aqui
                  </code>
                </p>
                <p className="text-xs text-blue-700 pt-1">
                  Obtenha sua chave em:{' '}
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    resend.com/api-keys
                  </a>
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-emerald-900">
                  Remetente Oficial Verificado
                </h4>
                <p className="text-xs text-emerald-800">
                  <strong>Key:</strong>{' '}
                  <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono text-emerald-900">
                    VERIFIED_FROM_EMAIL
                  </code>
                </p>
                <p className="text-xs text-emerald-800">
                  <strong>Value:</strong>{' '}
                  <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono text-emerald-900">
                    noreply@cred10mix.com.br
                  </code>
                </p>
                <p className="text-xs text-emerald-700 pt-1">
                  O domínio cred10mix.com.br está verificado no Resend. Todos os e-mails
                  automáticos, lembretes e campanhas utilizam este remetente e incluem rodapé
                  padronizado com canais de atendimento e WhatsApp.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
