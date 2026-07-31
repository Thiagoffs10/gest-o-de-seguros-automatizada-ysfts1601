import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { Policy } from '@/types'
import { exportPoliciesToXlsx } from '@/lib/policy-export'
import { useToast } from '@/hooks/use-toast'

interface Props {
  policies: Policy[]
  variant?: 'default' | 'outline'
}

export function PortfolioExportButton({ policies, variant = 'outline' }: Props) {
  const { toast } = useToast()
  const count = policies.length
  const label = `Exportar Carteira (Excel) — ${count} ${count === 1 ? 'apólice' : 'apólices'}`

  const handleExport = () => {
    toast({ title: `Exportando ${count} ${count === 1 ? 'apólice' : 'apólices'}` })
    exportPoliciesToXlsx(policies)
  }

  return (
    <Button variant={variant} size="sm" onClick={handleExport} disabled={count === 0}>
      <Download className="w-4 h-4 mr-2" />
      {label}
    </Button>
  )
}
