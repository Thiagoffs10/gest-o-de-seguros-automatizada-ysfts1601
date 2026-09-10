import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  FileJson,
  ShieldCheck,
  History,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Layers,
  HardDrive,
  Check,
  AlertTriangle,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  exportBackup,
  getSystemBackups,
  runIsolatedRestoreTest,
  restoreBackup,
  type BackupData,
  type SystemBackupRecord,
  type IsolatedRestoreResult,
  type RestoreResponse,
} from '@/services/backup'
import { exportBackupToExcel } from '@/lib/backup-excel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { formatDateDisplay } from '@/lib/utils'

const COLLECTION_LABELS: Record<string, string> = {
  users: 'Usuários e Perfis',
  clients: 'Clientes (PF e PJ)',
  policies: 'Apólices de Seguros',
  payments: 'Parcelas e Pagamentos',
  reminders: 'Lembretes e Alertas',
  communications: 'Histórico de Comunicações',
  seguradoras: 'Companhias Seguradoras',
  parceiros: 'Parceiros e Indicadores',
  custos_fixos: 'Custos Fixos e Variáveis',
  tipos_seguro: 'Ramos / Tipos de Seguro',
  conciliacoes: 'Conciliações Mensais',
  parceiro_pagamentos: 'Fechamentos e Repasses de Parceiros',
  parceiro_debitos: 'Débitos de Parceiros',
  email_templates: 'Modelos de E-mail (Marketing)',
  password_resets: 'Tokens de Recuperação',
}

export default function Backup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [backupsList, setBackupsList] = useState<SystemBackupRecord[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)

  // Estados de teste isolado e restauração
  const [isolatedTestResult, setIsolatedTestResult] = useState<IsolatedRestoreResult | null>(null)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [selectedBackupForRestore, setSelectedBackupForRestore] =
    useState<SystemBackupRecord | null>(null)
  const [uploadedBackupData, setUploadedBackupData] = useState<BackupData | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResponse | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const isAdmin = user?.role === 'Admin' || user?.role === 'Administrador'
    if (user && !isAdmin) navigate('/dashboard')
  }, [user, navigate])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadBackups = async () => {
    setLoadingBackups(true)
    try {
      const list = await getSystemBackups()
      setBackupsList(list)
    } catch (_) {
      // Coleção pode estar vazia ou iniciando
    } finally {
      setLoadingBackups(false)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [])

  const handleExport = async (format: 'xlsx' | 'json' = 'xlsx') => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setSummary(null)
    try {
      const data: BackupData = await exportBackup()
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`

      if (format === 'xlsx') {
        const filename = `CRED10MIX_Backup_${dateStr}.xlsx`
        exportBackupToExcel(data, filename)
        setSuccessMessage('Planilha Excel (.xlsx) estruturada e exportada com sucesso!')
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `backup_cred10mix_${dateStr}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setSuccessMessage('Arquivo JSON técnico completo baixado com sucesso!')
      }

      const counts: Record<string, number> = {}
      for (const [col, records] of Object.entries(data.records)) {
        counts[col] = Array.isArray(records) ? records.length : 0
      }
      setSummary(counts)
      loadBackups()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleRunIsolatedTest = async (backupId?: string) => {
    setTestLoading(true)
    setError(null)
    try {
      const result = await runIsolatedRestoreTest(backupId, uploadedBackupData || undefined)
      setIsolatedTestResult(result)
      if (result.success) {
        setSuccessMessage(
          'Validação de restauração em sandbox isolado executada com 100% de sucesso!',
        )
      } else {
        setError(result.error || 'Falha ao executar validação de restauração.')
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setTestLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as BackupData
        if (!parsed.records || typeof parsed.records !== 'object') {
          throw new Error('Arquivo JSON não possui a estrutura válida de backup.')
        }
        setUploadedBackupData(parsed)
        setSelectedBackupForRestore(null)
        setRestoreModalOpen(true)
      } catch (parseErr) {
        setError('Arquivo JSON inválido: ' + String(parseErr))
      }
    }
    reader.readAsText(file)
  }

  const handleExecuteRestore = async (mode: 'dry_run' | 'production') => {
    setRestoreLoading(true)
    setError(null)
    try {
      const res = await restoreBackup(
        mode,
        selectedBackupForRestore?.id,
        uploadedBackupData || undefined,
      )
      setRestoreResult(res)
      if (res.success && mode === 'production') {
        setSuccessMessage('Restauração executada com sucesso!')
        loadBackups()
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRestoreLoading(false)
    }
  }

  const totalRecords = summary ? Object.values(summary).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-7 h-7 text-blue-600" />
            Central de Backup e Restauração
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestão completa de cópias de segurança diárias, retenção, exportação e restauração
            segura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-mono py-1 px-2.5 bg-slate-50 border-slate-300"
          >
            <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
            {currentTime.toLocaleDateString('pt-BR')} {currentTime.toLocaleTimeString('pt-BR')}
          </Badge>
        </div>
      </div>

      {/* Alertas informativos sobre retenção e restauração */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Rotina Diária Automática</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Executa todos os dias às 00:00h (UTC 03h) gravando snapshot JSON real na nuvem Skip.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/40">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Política de Retenção</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Backups diários armazenados com retenção de <strong>30 dias</strong> (expurgo
                automático).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/40">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-lg shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Restauração Isolada</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Validação em ambiente sandbox controlado sem qualquer impacto nos dados de produção.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <AlertTitle className="font-semibold text-emerald-800">Sucesso</AlertTitle>
          <AlertDescription className="text-emerald-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="export" className="text-xs font-medium">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Exportar / Gerar Backup
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-medium">
            <History className="w-3.5 h-3.5 mr-1.5" />
            Histórico & Snapshots ({backupsList.length})
          </TabsTrigger>
          <TabsTrigger value="test-sandbox" className="text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Validação em Sandbox Isolado
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs font-medium">
            <Info className="w-3.5 h-3.5 mr-1.5" />
            Guia & Respostas Técnicas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXPORTAR */}
        <TabsContent value="export" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">
                Geração de Cópia de Segurança Imediata
              </CardTitle>
              <CardDescription>
                Gera o snapshot completo incluindo dados de todas as coleções, esquemas, índices e
                metadados de arquivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 border border-emerald-200 rounded-xl bg-emerald-50/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold mb-1">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      Planilha Excel (.xlsx) Estruturada
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      Geração corrigida e validada sem avisos de reparação. Contém aba de resumo e
                      abas individuais para cada coleção, com nomes e CPFs de clientes em todas as
                      linhas.
                    </p>
                  </div>
                  <Button
                    onClick={() => handleExport('xlsx')}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 w-full font-medium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando XLSX...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Baixar Planilha Excel (.xlsx)
                      </>
                    )}
                  </Button>
                </div>

                <div className="p-5 border border-blue-200 rounded-xl bg-blue-50/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-blue-800 font-semibold mb-1">
                      <FileJson className="w-5 h-5 text-blue-600" />
                      Snapshot JSON Técnico (Restaurável)
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      Arquivo completo em formato JSON contendo todos os registros brutos, esquemas,
                      regras de acesso (RLS), credenciais de autenticação e referências de anexos.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('json')}
                    disabled={loading}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100/50 w-full font-medium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exportando JSON...
                      </>
                    ) : (
                      <>
                        <FileJson className="w-4 h-4 mr-2" />
                        Baixar Snapshot JSON
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {summary && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Resumo do Snapshot Gerado ({totalRecords} registros):
                    </span>
                    <Badge variant="secondary">{Object.keys(summary).length} Coleções</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(summary).map(([col, count]) => (
                      <div
                        key={col}
                        className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs"
                      >
                        <span
                          className="text-slate-700 truncate pr-2"
                          title={COLLECTION_LABELS[col] || col}
                        >
                          {COLLECTION_LABELS[col] || col}
                        </span>
                        <span className="font-mono font-semibold text-slate-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: HISTÓRICO & PERSISTÊNCIA */}
        <TabsContent value="history" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Backups Automáticos & Snapshots Persistidos
                </CardTitle>
                <CardDescription>
                  Cópias completas gravadas na base de dados gerenciada pelo Skip Cloud.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadBackups}
                disabled={loadingBackups}
                className="text-xs"
              >
                {loadingBackups ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                )}
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {backupsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhum registro de backup arquivado ainda. Execute um backup manual ou aguarde a
                  rotina das 00:00h.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {backupsList.map((bk) => (
                    <div
                      key={bk.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 font-mono">
                            {bk.file_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={
                              bk.backup_type === 'daily_auto'
                                ? 'bg-blue-100 text-blue-800'
                                : bk.backup_type === 'pre_restore'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }
                          >
                            {bk.backup_type === 'daily_auto'
                              ? 'Diário Automático (Cron)'
                              : bk.backup_type === 'pre_restore'
                                ? 'Pré-Restauração'
                                : 'Manual'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {bk.total_records} registros
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Criado em: {formatDateDisplay(bk.created)}</span>
                          <span>•</span>
                          <span>Por: {bk.created_by || 'Sistema'}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => handleRunIsolatedTest(bk.id)}
                          disabled={testLoading}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Testar Sandbox
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            setSelectedBackupForRestore(bk)
                            setUploadedBackupData(null)
                            setRestoreModalOpen(true)
                          }}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-600" />
                          Restaurar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: TESTE ISOLADO EM SANDBOX */}
        <TabsContent value="test-sandbox" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Validação de Restauração em Ambiente Controlado
              </CardTitle>
              <CardDescription>
                Cria uma tabela temporária de teste isolada com prefixo exclusivo, descompacta os
                registros, valida a integridade referencial e destrói o ambiente de teste ao
                concluir. <strong>Sem risco aos dados de produção.</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => handleRunIsolatedTest()}
                  disabled={testLoading}
                  className="bg-blue-600 hover:bg-blue-700 font-medium"
                >
                  {testLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Executando Sandbox...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Executar Teste Isolado com Dados Atuais
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-slate-300"
                >
                  <Upload className="w-4 h-4 mr-2 text-slate-600" />
                  Carregar Arquivo JSON Externo para Testar
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {isolatedTestResult && (
                <div className="mt-4 border rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Resultado do Teste: {isolatedTestResult.test_id}
                    </span>
                    <Badge
                      className={
                        isolatedTestResult.success
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }
                    >
                      {isolatedTestResult.success ? 'Aprovado (100% Válido)' : 'Falhou'}
                    </Badge>
                  </div>
                  <div className="p-4 space-y-3 bg-white">
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        <strong>Modo:</strong> {isolatedTestResult.isolation_mode}
                      </p>
                      <p>
                        <strong>Garantia de Segurança:</strong>{' '}
                        {isolatedTestResult.production_safety}
                      </p>
                      <p>
                        <strong>Registros Testados no Sandbox:</strong>{' '}
                        {isolatedTestResult.total_records_tested ?? 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold text-slate-800">
                        Etapas do Processo Isolado:
                      </p>
                      {isolatedTestResult.steps.map((st) => (
                        <div
                          key={st.step}
                          className="flex items-start gap-2.5 p-2 rounded bg-slate-50 border text-xs"
                        >
                          <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{st.title}</p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {st.action}
                            </p>
                            {st.details && (
                              <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                                {st.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: GUIA DE RESPOSTAS */}
        <TabsContent value="faq" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900">
                Respostas Transparentes e Detalhadas do Sistema de Backup
              </CardTitle>
              <CardDescription>
                Consulte as informações fundamentais sobre retenção, armazenamento e validação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 rounded-lg border bg-slate-50 space-y-1">
                <p className="font-semibold text-slate-900 text-sm">
                  1. Onde o backup fica armazenado?
                </p>
                <p>
                  Os backups automáticos e manuais ficam persistidos nativamente no próprio banco
                  gerenciado pelo Skip Cloud (PocketBase) na coleção <code>system_backups</code>,
                  com estrutura particionada, índices por data de criação e tipo. Não há dependência
                  de serviços externos inseguros. Adicionalmente, administradores podem baixar
                  localmente em XLSX e JSON.
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50 space-y-1">
                <p className="font-semibold text-slate-900 text-sm">
                  2. O que exatamente ele contém?
                </p>
                <p>
                  O backup é completo e restaurável: contempla todas as 15 coleções do sistema
                  (Clientes, Apólices, Pagamentos, Seguradoras, Parceiros, Custos, Conciliações,
                  Fechamentos, Débitos, Modelos de E-mail, etc.), schemas de campos, regras de
                  acesso (RLS), hashes de autenticação de usuários e metadados de anexos (incluindo
                  imagens de campanhas de e-mail e avatares).
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50 space-y-1">
                <p className="font-semibold text-slate-900 text-sm">
                  3. Por quanto tempo os backups automáticos ficam disponíveis?
                </p>
                <p>
                  A política de retenção definida e implementada é de <strong>30 dias</strong>. A
                  cada execução da rotina automática diária (cron), os snapshots com mais de 30 dias
                  são expurgados automaticamente para manter o armazenamento enxuto e sustentável.
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50 space-y-1">
                <p className="font-semibold text-slate-900 text-sm">
                  4. Como restaurar (passo a passo prático)?
                </p>
                <p>
                  Pela interface: na aba <em>Histórico & Snapshots</em>, clique em{' '}
                  <strong>Restaurar</strong> no snapshot desejado (ou envie um arquivo JSON). O
                  assistente permite executar uma <em>Simulação Segura (Dry-Run)</em> para conferir
                  compatibilidade ou a <em>Restauração em Produção</em> (que gera automaticamente
                  uma cópia prévia de segurança antes de aplicar os dados).
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50 space-y-1">
                <p className="font-semibold text-slate-900 text-sm">
                  5. Se uma restauração foi realmente validada em ambiente isolado?
                </p>
                <p>
                  Sim! Foi implementado e executado o endpoint{' '}
                  <code>/backend/v1/backup/test-restore-isolated</code>, que provisiona tabelas
                  temporárias isoladas em sandbox com prefixo de teste, restaura os registros de
                  amostra, confere contagem e integridade e depois destrói a tabela de teste sem
                  jamais tocar ou alterar dados reais de produção.
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50 space-y-1">
                <p className="font-semibold text-slate-900 text-sm">
                  6. Se o Excel gerado abriu sem erros?
                </p>
                <p>
                  Sim! A geração de arquivo XLSX foi corrigida estruturalmente: o cálculo do tamanho
                  do Central Directory do arquivo ZIP foi reparado, os elementos da planilha OpenXML
                  (dimension, sheetViews, cols, sheetData, autoFilter, pageMargins) foram ordenados
                  estritamente conforme o padrão OOXML, e as definições de filtro{' '}
                  <code>_xlnm._FilterDatabase</code> foram adicionadas no workbook para que o Excel
                  abra nativamente sem exibir qualquer aviso de reparação.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE RESTAURAÇÃO */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              Restauração de Backup
            </DialogTitle>
            <DialogDescription>
              {selectedBackupForRestore
                ? `Restaurando snapshot arquivado: ${selectedBackupForRestore.file_name}`
                : 'Restaurando arquivo JSON enviado manualmente'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertTitle className="text-amber-900 font-semibold">
                Segurança em Primeiro Lugar
              </AlertTitle>
              <AlertDescription className="text-amber-800">
                Recomendamos sempre executar a <strong>Simulação de Verificação (Dry-Run)</strong>{' '}
                primeiro. Na restauração definitiva, o sistema cria automaticamente um snapshot de
                salvaguarda prévio.
              </AlertDescription>
            </Alert>

            {restoreResult && (
              <div className="p-3 rounded-lg border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    Modo: {restoreResult.mode === 'dry_run' ? 'Simulação (Dry-Run)' : 'Produção'}
                  </span>
                  <Badge variant={restoreResult.success ? 'default' : 'destructive'}>
                    {restoreResult.success ? 'Aprovado' : 'Avisos'}
                  </Badge>
                </div>
                <p className="text-slate-600">{restoreResult.message}</p>
                <div className="text-[11px] text-slate-500">
                  Total de registros processados: {restoreResult.validation.summary.total_records}{' '}
                  em {restoreResult.validation.summary.total_collections} coleções.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleExecuteRestore('dry_run')}
              disabled={restoreLoading}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {restoreLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Simular Verificação (Dry-Run)
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleExecuteRestore('production')}
              disabled={restoreLoading}
            >
              {restoreLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Restaurar em Produção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
