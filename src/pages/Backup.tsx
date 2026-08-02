import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  FileJson,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { exportBackup, type BackupData } from '@/services/backup'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const COLLECTION_LABELS: Record<string, string> = {
  users: 'Usuários',
  clients: 'Clientes',
  policies: 'Apólices',
  payments: 'Pagamentos',
  reminders: 'Lembretes',
  communications: 'Comunicações',
  seguradoras: 'Seguradoras',
  parceiros: 'Parceiros',
  custos_fixos: 'Custos Fixos',
  tipos_seguro: 'Tipos de Seguro',
}

export default function Backup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const isAdmin = user?.role === 'Admin' || user?.role === 'Administrador'
    if (user && !isAdmin) navigate('/dashboard')
  }, [user, navigate])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const data: BackupData = await exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
      a.download = `backup_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const counts: Record<string, number> = {}
      for (const [col, records] of Object.entries(data.records)) {
        counts[col] = Array.isArray(records) ? records.length : 0
      }
      setSummary(counts)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const totalRecords = summary ? Object.values(summary).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-7 h-7 text-blue-600" />
          Backup de Dados
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Exporte todos os dados do sistema em um arquivo JSON para migração ou restauração.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Data e Hora Atual
          </CardTitle>
          <CardDescription>
            O backup será gerado com os dados existentes até o momento da exportação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="text-sm font-mono">
            {currentTime.toLocaleDateString('pt-BR')} {currentTime.toLocaleTimeString('pt-BR')}
          </Badge>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <FileJson className="w-16 h-16 text-blue-600" />
            <div>
              <h3 className="font-semibold text-slate-900">Backup Completo do Sistema</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md">
                Inclui todas as coleções, registros, esquema do banco, definições de acesso, hashes
                de senha dos usuários e URLs de arquivos anexados.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleExport}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gerando Backup...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Exportar Backup Completo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Erro ao Exportar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <Card className="shadow-sm border-green-200">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Backup Exportado com Sucesso
            </CardTitle>
            <CardDescription>
              Total de {totalRecords} registros exportados em {Object.keys(summary).length}{' '}
              coleções.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(summary).map(([col, count]) => (
                <div
                  key={col}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {COLLECTION_LABELS[col] || col}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
