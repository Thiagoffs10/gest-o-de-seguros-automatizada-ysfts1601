import { useNavigate } from 'react-router-dom'
import { UserPlus, FileText, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { canAccessMassSend } from '@/lib/permissions'

export function FloatingActions() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!canAccessMassSend(user?.role)) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      <Button
        className="bg-blue-600 hover:bg-blue-700 shadow-lg rounded-full h-12 w-12 p-0"
        onClick={() => navigate('/clientes')}
        title="Novo Cliente"
      >
        <UserPlus className="w-5 h-5" />
      </Button>
      <Button
        className="bg-emerald-600 hover:bg-emerald-700 shadow-lg rounded-full h-12 w-12 p-0"
        onClick={() => navigate('/apolices')}
        title="Nova Apólice"
      >
        <FileText className="w-5 h-5" />
      </Button>
      <Button
        className="bg-amber-500 hover:bg-amber-600 shadow-lg rounded-full h-12 w-12 p-0"
        onClick={() => navigate('/envio-em-massa')}
        title="Envio em Massa"
      >
        <Send className="w-5 h-5" />
      </Button>
    </div>
  )
}
