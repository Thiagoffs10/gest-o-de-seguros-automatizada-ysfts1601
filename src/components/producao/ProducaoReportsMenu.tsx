import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react'
import { ProducaoReportKind } from '@/lib/producao-report'

interface ProducaoReportsMenuProps {
  disabled: boolean
  busyKind: ProducaoReportKind | null
  onGenerate: (kind: ProducaoReportKind, format: 'pdf' | 'xlsx') => void
}

const LOADING_TEXT: Record<ProducaoReportKind, string> = {
  sintetico: 'Gerando relatório…',
  analitico: 'Gerando relatório…',
}

export function ProducaoReportsMenu({ disabled, busyKind, onGenerate }: ProducaoReportsMenuProps) {
  const [open, setOpen] = useState(false)
  const loading = busyKind !== null
  const busyInMenu = busyKind !== null // while generating, the dropdown is force-closed by disabled state

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          title={
            disabled
              ? 'Nenhuma apólice no período selecionado'
              : 'Gerar relatório da produção do período'
          }
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {busyKind ? LOADING_TEXT[busyKind] : 'Gerando…'}
            </>
          ) : (
            <>
              <Printer className="w-4 h-4 mr-2" />
              Relatórios
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          disabled={busyInMenu}
          onClick={() => {
            setOpen(false)
            onGenerate('sintetico', 'pdf')
          }}
        >
          <FileText className="w-4 h-4 mr-2 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium">Sintético (PDF)</span>
            <span className="text-xs text-muted-foreground">
              Totais do período e resumo por seguradora
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busyInMenu}
          onClick={() => {
            setOpen(false)
            onGenerate('analitico', 'pdf')
          }}
        >
          <FileText className="w-4 h-4 mr-2 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium">Analítico (PDF)</span>
            <span className="text-xs text-muted-foreground">
              Cada apólice do período com totais
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busyInMenu}
          onClick={() => {
            setOpen(false)
            onGenerate('sintetico', 'xlsx')
          }}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
          <div className="flex flex-col">
            <span className="font-medium">Sintético (Excel)</span>
            <span className="text-xs text-muted-foreground">Totais do período por seguradora</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busyInMenu}
          onClick={() => {
            setOpen(false)
            onGenerate('analitico', 'xlsx')
          }}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
          <div className="flex flex-col">
            <span className="font-medium">Analítico (Excel)</span>
            <span className="text-xs text-muted-foreground">
              Cada apólice do período com totais
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
