import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Policy, Endorsement } from '@/types'
import { todayLocalDate, formatDateDisplay, formatDateForInput } from '@/lib/utils'
import { createEndorsement, updateEndorsement } from '@/services/endorsements'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Car, FileText, Info } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy: Policy
  endorsementToEdit?: Endorsement | null
  onSuccess: () => void
}

const TIPOS_ENDOSSO = [
  'Substituição de veículo',
  'Alteração de dados cadastrais',
  'Inclusão/Exclusão de cobertura',
  'Transferência de direitos',
  'Alteração de perfil/endereço',
  'Outro',
]

export function EndorsementFormDialog({
  open,
  onOpenChange,
  policy,
  endorsementToEdit,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const isEditing = Boolean(endorsementToEdit)

  const [tipo, setTipo] = useState('Substituição de veículo')
  const [dataEndosso, setDataEndosso] = useState(todayLocalDate())
  const [numeroProposta, setNumeroProposta] = useState('')
  const [placa, setPlaca] = useState('')
  const [chassi, setChassi] = useState('')
  const [modeloVeiculo, setModeloVeiculo] = useState('')
  const [valorBruto, setValorBruto] = useState<number | ''>('')
  const [valorLiquido, setValorLiquido] = useState<number | ''>('')
  const [observacao, setObservacao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preenche dados ao abrir
  useEffect(() => {
    if (open) {
      if (endorsementToEdit) {
        setTipo(endorsementToEdit.tipo || 'Substituição de veículo')
        setDataEndosso(formatDateForInput(endorsementToEdit.data_endosso) || todayLocalDate())
        setNumeroProposta(endorsementToEdit.numero_proposta || '')
        setPlaca(endorsementToEdit.placa || '')
        setChassi(endorsementToEdit.chassi || '')
        setModeloVeiculo(endorsementToEdit.modelo_veiculo || '')
        setValorBruto(endorsementToEdit.valor_bruto != null ? endorsementToEdit.valor_bruto : '')
        setValorLiquido(
          endorsementToEdit.valor_liquido != null ? endorsementToEdit.valor_liquido : '',
        )
        setObservacao(endorsementToEdit.observacao || '')
      } else {
        setTipo('Substituição de veículo')
        setDataEndosso(todayLocalDate())
        setNumeroProposta('')
        setPlaca('')
        setChassi('')
        setModeloVeiculo('')
        setValorBruto('')
        setValorLiquido('')
        setObservacao('')
      }
      setIsSubmitting(false)
    }
  }, [open, endorsementToEdit])

  // Formatação amigável de placa brasileira (Mercosul ou padrão antigo)
  const formatPlaca = (val: string) => {
    const cleaned = val
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 7)
    if (cleaned.length === 7) {
      // Padrão tradicional LLLNNNN -> LLL-NNNN, ou Mercosul LLLNLNN
      const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleaned)
      if (isMercosul) return cleaned
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    }
    return cleaned
  }

  const handlePlacaChange = (val: string) => {
    setPlaca(formatPlaca(val))
  }

  // Cálculo da comissão estimada baseada na regra da apólice
  const commPercent = Number(policy.commission_percent || 0)
  const numLiquido = valorLiquido === '' ? 0 : Number(valorLiquido)
  const comissaoEstimada = Math.round(((numLiquido * commPercent) / 100) * 100) / 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!tipo || tipo.trim() === '') {
      toast({
        title: 'Tipo obrigatório',
        description: 'Selecione o tipo de endosso.',
        variant: 'destructive',
      })
      return
    }

    if (!dataEndosso) {
      toast({
        title: 'Data obrigatória',
        description: 'Informe a data do endosso.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const vBruto = valorBruto === '' ? 0 : Number(valorBruto)
      const vLiq = valorLiquido === '' ? 0 : Number(valorLiquido)

      if (isEditing && endorsementToEdit) {
        await updateEndorsement(endorsementToEdit.id, {
          tipo,
          data_endosso: dataEndosso,
          numero_proposta: numeroProposta,
          placa,
          chassi,
          modelo_veiculo: modeloVeiculo,
          valor_bruto: vBruto,
          valor_liquido: vLiq,
          observacao,
        })
        toast({ title: 'Endosso atualizado com sucesso!' })
      } else {
        await createEndorsement({
          policy: policy.id,
          tipo,
          data_endosso: dataEndosso,
          numero_proposta: numeroProposta,
          placa,
          chassi,
          modelo_veiculo: modeloVeiculo,
          valor_bruto: vBruto,
          valor_liquido: vLiq,
          observacao,
        })
        toast({
          title: 'Endosso cadastrado com sucesso!',
          description:
            vLiq > 0
              ? `Previsão de comissão de R$ ${comissaoEstimada.toFixed(2)} criada.`
              : vLiq < 0
                ? `Ajuste/estorno de comissão de -R$ ${Math.abs(comissaoEstimada).toFixed(2)} registrado.`
                : 'Registro histórico sem impacto financeiro.',
        })
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar endosso',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fmtMoney = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" />
            <span>{isEditing ? 'Editar Endosso' : 'Cadastrar Endosso na Apólice'}</span>
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Apólice {policy.policy_number || policy.numero_proposta || policy.id} —{' '}
            {policy.expand?.client?.name || 'Cliente'} (
            {policy.expand?.seguradora?.nome || policy.insurance_company || 'Seguradora'})
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Box de herança de dados */}
          <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Dados herdados da apólice original</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Seguradora:</span>
                <span className="font-medium text-slate-800">
                  {policy.expand?.seguradora?.nome || policy.insurance_company || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Ramo / Tipo:</span>
                <span className="font-medium text-slate-800">
                  {policy.tipo_de_seguro || policy.coverage_type || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Regra de Comissão:</span>
                <span className="font-medium text-blue-700">{policy.commission_percent || 0}%</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Parceiro / Venda:</span>
                <span className="font-medium text-slate-800">
                  {policy.expand?.parceiro?.nome || policy.tipo_de_venda || 'Direta'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Tipo de Endosso *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ENDOSSO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Data do Endosso *</Label>
              <Input
                type="date"
                required
                className="mt-1"
                value={dataEndosso}
                onChange={(e) => setDataEndosso(e.target.value)}
              />
              <span className="text-[10px] text-slate-400">
                Usada para histórico e competência financeira
              </span>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Nº da Proposta do Endosso (opcional)</Label>
            <Input
              placeholder="Ex: 889912"
              className="mt-1"
              value={numeroProposta}
              onChange={(e) => setNumeroProposta(e.target.value)}
            />
          </div>

          {/* Dados do veículo (para substituição de veículo) */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-blue-600" />
                Dados do Veículo no Endosso
              </span>
              <span className="text-[11px] text-slate-500">
                O veículo original ({policy.modelo_veiculo || policy.placa || 'Sem veículo'}) será
                preservado no histórico
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Placa</Label>
                <Input
                  placeholder="ABC-1234 ou ABC1D23"
                  className="mt-1 uppercase"
                  value={placa}
                  onChange={(e) => handlePlacaChange(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Chassi</Label>
                <Input
                  placeholder="Número do chassi"
                  className="mt-1 uppercase"
                  value={chassi}
                  onChange={(e) => setChassi(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Modelo do Veículo</Label>
                <Input
                  placeholder="Ex: Corolla XEi 2.0"
                  className="mt-1"
                  value={modeloVeiculo}
                  onChange={(e) => setModeloVeiculo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Valores Financeiros do Endosso */}
          <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              Impacto Financeiro do Endosso
            </span>
            <p className="text-[11px] text-slate-500">
              Aceita valores positivos (aumento de prêmio), zero (sem alteração de prêmio) ou
              negativos (devolução/redução de prêmio).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Valor Bruto do Endosso (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="mt-1"
                  value={valorBruto}
                  onChange={(e) =>
                    setValorBruto(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Líquido do Endosso (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="mt-1 font-semibold"
                  value={valorLiquido}
                  onChange={(e) =>
                    setValorLiquido(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Comissão Calculada ({commPercent}%)
                </Label>
                <div
                  className={`h-9 px-3 py-2 mt-1 rounded-md border text-sm font-bold flex items-center ${
                    comissaoEstimada > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : comissaoEstimada < 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-white text-slate-700'
                  }`}
                >
                  {comissaoEstimada > 0
                    ? `+ R$ ${fmtMoney(comissaoEstimada)}`
                    : comissaoEstimada < 0
                      ? `- R$ ${fmtMoney(Math.abs(comissaoEstimada))}`
                      : 'R$ 0,00 (Sem comissão)'}
                </div>
              </div>
            </div>

            {/* Explicação contextual sobre o impacto */}
            {numLiquido > 0 && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50/60 p-2 rounded border border-emerald-100">
                <strong>Endosso Positivo:</strong> Será criada uma previsão própria de R${' '}
                {fmtMoney(comissaoEstimada)} vinculada exclusivamente a este endosso, a receber no
                fluxo normal.
              </div>
            )}
            {numLiquido < 0 && (
              <div className="text-[11px] text-rose-700 bg-rose-50/60 p-2 rounded border border-rose-100">
                <strong>Endosso Negativo:</strong> Será lançado um ajuste/estorno de comissão de -R${' '}
                {fmtMoney(Math.abs(comissaoEstimada))} preservando a integridade do saldo real da
                apólice.
              </div>
            )}
            {numLiquido === 0 && (
              <div className="text-[11px] text-slate-600 bg-white p-2 rounded border">
                <strong>Endosso Sem Diferença de Prêmio:</strong> Salvo no histórico operacional sem
                gerar lançamentos financeiros.
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Informações adicionais sobre o endosso..."
              className="mt-1 text-xs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Endosso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
