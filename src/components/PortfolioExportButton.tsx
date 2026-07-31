import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { Policy } from '@/types'
import { exportPoliciesToXlsx } from '@/lib/policy-export'

interface Props {
  policies: Policy[]
  variant?: 'default' | 'outline'
}

export function PortfolioExportButton({ policies, variant = 'outline' }: Props) {
  const count = policies.length
  const label = `Exportar Carteira (Excel) — ${count} ${count === 1 ? 'apólice' : 'apólices'}`

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => exportPoliciesToXlsx(policies)}
      disabled={count === 0}
    >
      <Download className="w-4 h-4 mr-2" />
      {label}
    </Button>
  )
}
