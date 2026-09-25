import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  Car,
  Calendar,
  DollarSign,
  ShieldAlert,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Seguradora, Client, Policy } from '@/types'
import {
  extrairPropostaDeArquivoPdf,
  PropostaImportadaConferida,
} from '@/services/importacao/proposta-service'
import { formatCurrency, formatBRDate } from '@/lib/utils'

interface ImportarPropostaPdfModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seguradoras: Seguradora[]
  onPropostaImportada: (conferida: PropostaImportadaConferida) => void
}

export const ImportarPropostaPdfModal: React.FC<ImportarPropostaPdfModalProps> = ({
  open,
  onOpenChange,
  seguradoras,
  onPropostaImportada,
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [carregando, setCarregando] = useState(false)
  const [conferida, setConferida] = useState<PropostaImportadaConferida | null>(null)

  const resetState = () => {
    setCarregando(false)
    setConferida(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCarregando(true)
    try {
      const resultado = await extrairPropostaDeArquivoPdf(file, seguradoras)
      setConferida(resultado)
      toast({
        title: 'Proposta lida com sucesso!',
        description: `Seguradora: ${resultado.proposta.seguradoraNome} • Proposta: ${resultado.proposta.numeroProposta || 'Não informada'}`,
      })
    } catch (err: any) {
      toast({
        title: 'Falha na leitura da proposta',
        description: err.message || 'Não foi possível extrair os dados do PDF.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  const handleAplicar = () => {
    if (!conferida) return
    onPropostaImportada(conferida)
    onOpenChange(false)
    resetState()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg text-blue-700 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Importar Proposta de Seguro (PDF)
              </DialogTitle>
              <DialogDescription>
                Extração inteligente e preenchimento automático de cliente, condutor, veículo e
                valores.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!conferida ? (
          <div className="py-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                carregando
                  ? 'border-blue-300 bg-blue-50/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={carregando}
              />
              {carregando ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Lendo arquivo PDF e analisando dados da seguradora...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400">
                    <Upload className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      Clique para selecionar a Proposta em PDF
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Calibrado para: Porto Seguro, Allianz, HDI, Yelum, MAPFRE e Bradesco
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
            {/* Alertas de Duplicidade */}
            {conferida.apoliceDuplicada && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <span className="font-bold">Aviso de Proposta/Veículo Duplicado:</span>{' '}
                  {conferida.apoliceDuplicadaMotivo}
                </div>
              </div>
            )}

            {/* Detecção de Cliente Existente */}
            {conferida.clienteExistente ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-start gap-2">
                <UserCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <span className="font-bold">Cliente Existente Detectado:</span>{' '}
                  {conferida.clienteDuplicadoMotivo}
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    O formulário vinculará automaticamente a este cadastro em vez de duplicar.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border rounded-lg text-slate-700 flex items-start gap-2">
                <UserX className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
                <div>
                  <span className="font-bold">Novo Cliente:</span> Nenhum cadastro com este CPF/CNPJ
                  localizado. Os dados serão preenchidos para revisão.
                </div>
              </div>
            )}

            {/* Destaque de Campos Faltantes (ex: Allianz sem data de nascimento) */}
            {conferida.proposta.camposFaltantes.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Campos obrigatórios faltantes no PDF (destacados para preenchimento manual):
                </div>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-amber-800">
                  {conferida.proposta.camposFaltantes.map((cf, i) => (
                    <li key={i}>
                      <strong>{cf.label}:</strong> {cf.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resumo dos Dados Extraídos */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3 space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" /> Segurado & Condutor
                  </div>
                  <div>
                    <span className="text-slate-500">Segurado:</span>{' '}
                    <strong>{conferida.proposta.segurado.nome || 'Não identificado'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">CPF/CNPJ:</span>{' '}
                    {conferida.proposta.segurado.cpfCnpj || '-'}
                  </div>
                  <div>
                    <span className="text-slate-500">Condutor Principal:</span>{' '}
                    <strong>{conferida.proposta.condutorPrincipal.nome || '-'}</strong>
                    {!conferida.proposta.condutorPrincipal.mesmoQueSegurado && (
                      <Badge
                        variant="outline"
                        className="ml-1 text-[10px] text-blue-600 border-blue-200"
                      >
                        Condutor distinto do segurado
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" /> Veículo & Vigência
                  </div>
                  <div>
                    <span className="text-slate-500">Modelo:</span>{' '}
                    {conferida.proposta.veiculo.marcaModelo || '-'}
                  </div>
                  <div>
                    <span className="text-slate-500">Placa / Chassi:</span>{' '}
                    <strong>{conferida.proposta.veiculo.placa || '-'}</strong> •{' '}
                    {conferida.proposta.veiculo.chassi || '-'}
                  </div>
                  <div>
                    <span className="text-slate-500">Vigência:</span>{' '}
                    {formatBRDate(conferida.proposta.vigenciaInicio)} até{' '}
                    {formatBRDate(conferida.proposta.vigenciaFim)}
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardContent className="p-3 space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" /> Prêmios e Condições Comerciais
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <div>
                      <span className="text-slate-500 block">Seguradora</span>
                      <strong>{conferida.proposta.seguradoraNome}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Prêmio Líquido</span>
                      <strong>{formatCurrency(conferida.proposta.premioLiquido)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Prêmio Total</span>
                      <strong>{formatCurrency(conferida.proposta.premioTotal)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Parcelamento</span>
                      <strong>
                        {conferida.proposta.parcelamentoDescricao ||
                          `${conferida.proposta.quantidadeParcelas}x`}
                      </strong>
                    </div>
                  </div>
                  {conferida.proposta.renovacao.isRenovacao && (
                    <div className="pt-2 text-[11px] text-blue-700">
                      ℹ️ Renovação identificada (Apólice anterior:{' '}
                      {conferida.proposta.renovacao.apoliceAnterior || '-'} • Cia anterior:{' '}
                      {conferida.proposta.renovacao.seguradoraAnterior || '-'}).
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t">
          {conferida ? (
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={resetState}>
                Trocar arquivo
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleAplicar}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Preencher Formulário de Cadastro
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
