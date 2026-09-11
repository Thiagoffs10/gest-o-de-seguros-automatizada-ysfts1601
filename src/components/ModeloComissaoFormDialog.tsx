import { useState, useEffect } from 'react'
import { Plus, Trash2, HelpCircle } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ModeloComissao,
  TipoModeloComissao,
  Seguradora,
  TipoSeguro,
  Produto,
  FaseModelo,
  ParcelaModelo,
} from '@/types'
import { createModeloComissao, updateModeloComissao } from '@/services/modelos-comissao'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { formatDateForInput, todayLocalDate } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: ModeloComissao | null
  seguradoras: Seguradora[]
  tiposSeguro: TipoSeguro[]
  produtos?: Produto[]
  onSuccess: () => void
}

export function ModeloComissaoFormDialog({
  open,
  onOpenChange,
  initialData,
  seguradoras,
  tiposSeguro,
  produtos = [],
  onSuccess,
}: Props) {
  const { toast } = useToast()

  const [nome, setNome] = useState('')
  const [tipoModelo, setTipoModelo] = useState<TipoModeloComissao>('A_VISTA')
  const [seguradora, setSeguradora] = useState('')
  const [tipoSeguro, setTipoSeguro] = useState('')
  const [percentualPadrao, setPercentualPadrao] = useState<number | ''>(20)
  const [validoAPartirDe, setValidoAPartirDe] = useState(todayLocalDate())
  const [descricao, setDescricao] = useState('')

  // Campos específicos de PARCELADA
  const [qtdCompetencias, setQtdCompetencias] = useState<number>(7)
  const [parcelasCustomizadas, setParcelasCustomizadas] = useState<ParcelaModelo[]>([])

  // Campos específicos de RECORRENTE
  const [horizonteMeses, setHorizonteMeses] = useState<number>(12)
  const [percentualRecorrente, setPercentualRecorrente] = useState<number>(5)

  // Campos específicos de POR_FASES
  const [fases, setFases] = useState<FaseModelo[]>([
    { mes_inicio: 1, mes_fim: 3, percentual: 100 },
    { mes_inicio: 4, mes_fim: null, percentual: 2 },
  ])

  // Campos específicos de POR_ESGOTAMENTO
  const [saldoTotal, setSaldoTotal] = useState<number | ''>(1000)
  const [valorParcelaEstimada, setValorParcelaEstimada] = useState<number | ''>(250)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialData) {
        setNome(initialData.nome || '')
        setTipoModelo(initialData.tipo_modelo || 'A_VISTA')
        setSeguradora(initialData.seguradora || '')
        setTipoSeguro(initialData.tipo_seguro || '')
        setPercentualPadrao(
          initialData.percentual_padrao != null ? Number(initialData.percentual_padrao) : 20,
        )
        setValidoAPartirDe(formatDateForInput(initialData.valido_a_partir_de) || todayLocalDate())
        setDescricao(initialData.descricao || '')

        const cfg = initialData.config_json || {}
        if (cfg.quantidade_competencias) setQtdCompetencias(Number(cfg.quantidade_competencias))
        if (cfg.parcelas) setParcelasCustomizadas(cfg.parcelas)
        if (cfg.recorrencia_meses_horizonte)
          setHorizonteMeses(Number(cfg.recorrencia_meses_horizonte))
        if (cfg.percentual_recorrente != null)
          setPercentualRecorrente(Number(cfg.percentual_recorrente))
        if (cfg.fases && cfg.fases.length > 0) setFases(cfg.fases)
        if (cfg.saldo_total != null) setSaldoTotal(Number(cfg.saldo_total))
        if (cfg.valor_estimado_parcela != null)
          setValorParcelaEstimada(Number(cfg.valor_estimado_parcela))
      } else {
        setNome('')
        setTipoModelo('A_VISTA')
        setSeguradora('')
        setTipoSeguro('')
        setPercentualPadrao(20)
        setValidoAPartirDe(todayLocalDate())
        setDescricao('')
        setQtdCompetencias(7)
        setParcelasCustomizadas([])
        setHorizonteMeses(12)
        setPercentualRecorrente(5)
        setFases([
          { mes_inicio: 1, mes_fim: 3, percentual: 100 },
          { mes_inicio: 4, mes_fim: null, percentual: 2 },
        ])
        setSaldoTotal(1000)
        setValorParcelaEstimada(250)
      }
    }
  }, [open, initialData])

  const handleAddFase = () => {
    const lastFase = fases[fases.length - 1]
    const proxInicio = lastFase
      ? lastFase.mes_fim
        ? lastFase.mes_fim + 1
        : lastFase.mes_inicio + 1
      : 1
    setFases([...fases, { mes_inicio: proxInicio, mes_fim: null, percentual: 5 }])
  }

  const handleRemoveFase = (index: number) => {
    if (fases.length <= 1) return
    setFases(fases.filter((_, i) => i !== index))
  }

  const handleFaseChange = (index: number, field: keyof FaseModelo, value: any) => {
    setFases(fases.map((f, i) => (i === index ? { ...f, [field]: value } : f)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do modelo de recebimento.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    // Montar config específica do modelo selecionado (sem poluir o payload)
    const config_json: any = {}
    if (tipoModelo === 'PARCELADA') {
      config_json.quantidade_competencias = Number(qtdCompetencias || 1)
      if (parcelasCustomizadas.length > 0) {
        config_json.parcelas = parcelasCustomizadas
      }
    } else if (tipoModelo === 'RECORRENTE') {
      config_json.recorrencia_meses_horizonte = Number(horizonteMeses || 12)
      config_json.percentual_recorrente = Number(percentualRecorrente || 0)
    } else if (tipoModelo === 'POR_FASES') {
      config_json.fases = fases
      config_json.recorrencia_meses_horizonte = 12
    } else if (tipoModelo === 'POR_ESGOTAMENTO') {
      config_json.saldo_total = saldoTotal !== '' ? Number(saldoTotal) : null
      config_json.valor_estimado_parcela =
        valorParcelaEstimada !== '' ? Number(valorParcelaEstimada) : null
    }

    try {
      const payload = {
        nome: nome.trim(),
        tipo_modelo: tipoModelo,
        seguradora: seguradora || null,
        tipo_seguro: tipoSeguro || null,
        percentual_padrao: percentualPadrao !== '' ? Number(percentualPadrao) : 0,
        config_json,
        valido_a_partir_de: validoAPartirDe || todayLocalDate(),
        descricao: descricao.trim() || undefined,
        ativo: true,
      }

      if (initialData?.id) {
        await updateModeloComissao(initialData.id, payload)
        toast({ title: 'Modelo atualizado com sucesso!' })
      } else {
        await createModeloComissao(payload)
        toast({ title: 'Modelo de recebimento cadastrado!' })
      }

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Erro ao salvar modelo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Modelo de Recebimento' : 'Novo Modelo de Recebimento'}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Configure de forma simples como as comissões serão previstas e faturadas pela
            seguradora.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome do modelo */}
          <div>
            <Label className="text-xs font-semibold">Nome do Modelo *</Label>
            <Input
              required
              placeholder="Ex: Comissão Saúde — Bradesco, Auto Padrão 20%, etc."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Seguradora e Produto (para sugestão automática) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Seguradora (opcional)</Label>
              <Select
                value={seguradora || 'none'}
                onValueChange={(v) => setSeguradora(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas / Sem vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas / Nenhuma específica</SelectItem>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-slate-400">
                Sugere ao selecionar esta seguradora
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold">Produto / Tipo de Seguro (opcional)</Label>
              <Select
                value={tipoSeguro || 'none'}
                onValueChange={(v) => setTipoSeguro(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos / Qualquer produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos os produtos / ramos</SelectItem>
                  {tiposSeguro.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Ramos Principais
                    </div>
                  )}
                  {tiposSeguro.map((t) => (
                    <SelectItem key={`ramo-${t.id || t.nome}`} value={t.nome}>
                      {t.nome} (Ramo)
                    </SelectItem>
                  ))}
                  {produtos.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t mt-1">
                      Produtos Comerciais
                    </div>
                  )}
                  {produtos.map((p) => (
                    <SelectItem key={`prod-${p.id}`} value={p.nome}>
                      {p.nome}
                      {p.expand?.seguradora?.nome ? ` (${p.expand.seguradora.nome})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-slate-400">
                Sugere ao selecionar este produto comercial ou ramo
              </span>
            </div>
          </div>

          {/* Modelo de Recebimento (os 5 modelos) */}
          <div>
            <Label className="text-xs font-semibold">Modelo de Recebimento *</Label>
            <Select
              value={tipoModelo}
              onValueChange={(v) => setTipoModelo(v as TipoModeloComissao)}
              disabled={loading}
            >
              <SelectTrigger className="font-medium bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A_VISTA">1. À Vista (pagamento único)</SelectItem>
                <SelectItem value="PARCELADA">2. Parcelada (em N competências)</SelectItem>
                <SelectItem value="RECORRENTE">3. Recorrente (mensal contínuo)</SelectItem>
                <SelectItem value="POR_FASES">
                  4. Por Fases (percentual muda após período)
                </SelectItem>
                <SelectItem value="POR_ESGOTAMENTO">
                  5. Por Saldo / Esgotamento (até consumir)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CAMPOS CONDICIONAIS CONFORME O MODELO SELECIONADO */}
          <div className="p-3.5 bg-slate-50 rounded-lg border space-y-3">
            {tipoModelo === 'A_VISTA' && (
              <div>
                <Label className="text-xs font-semibold">% de Comissão Padrão</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="20"
                    className="max-w-[140px] bg-white"
                    value={percentualPadrao}
                    onChange={(e) =>
                      setPercentualPadrao(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    % sobre o prêmio líquido
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  A seguradora paga uma única vez na primeira competência da apólice. Ex.: Prêmio R$
                  1.000, 20% → R$ 200.
                </p>
              </div>
            )}

            {tipoModelo === 'PARCELADA' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Quantidade de Competências *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="36"
                      className="bg-white"
                      value={qtdCompetencias}
                      onChange={(e) =>
                        setQtdCompetencias(Math.max(1, parseInt(e.target.value || '1', 10)))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">% Total Padrão</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="bg-white"
                      value={percentualPadrao}
                      onChange={(e) =>
                        setPercentualPadrao(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Ex: 20"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  A comissão será distribuída nas {qtdCompetencias} competências seguintes da
                  vigência.
                </p>
              </div>
            )}

            {tipoModelo === 'RECORRENTE' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">% Mensal Recorrente *</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        className="bg-white"
                        value={percentualRecorrente}
                        onChange={(e) => setPercentualRecorrente(Number(e.target.value))}
                      />
                      <span className="text-xs text-slate-500">% /mês</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Horizonte de Previsão</Label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        type="number"
                        min="1"
                        max="36"
                        className="bg-white"
                        value={horizonteMeses}
                        onChange={(e) => setHorizonteMeses(parseInt(e.target.value || '12', 10))}
                      />
                      <span className="text-xs text-slate-500">meses</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Gera uma previsão futura de {horizonteMeses} meses (evitando previsões infinitas).
                  Pode ser estendido depois.
                </p>
              </div>
            )}

            {tipoModelo === 'POR_FASES' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800">Fases do Recebimento</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={handleAddFase}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Fase
                  </Button>
                </div>

                <div className="space-y-2">
                  {fases.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded border flex items-center gap-2 text-xs"
                    >
                      <span className="font-bold text-slate-500 w-12 shrink-0">
                        Fase {idx + 1}:
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">Mês</span>
                        <Input
                          type="number"
                          min="1"
                          className="w-16 h-7 text-xs"
                          value={f.mes_inicio}
                          onChange={(e) =>
                            handleFaseChange(idx, 'mes_inicio', parseInt(e.target.value || '1', 10))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">ao</span>
                        <Input
                          type="number"
                          min={f.mes_inicio}
                          placeholder="Em diante"
                          className="w-20 h-7 text-xs"
                          value={f.mes_fim ?? ''}
                          onChange={(e) =>
                            handleFaseChange(
                              idx,
                              'mes_fim',
                              e.target.value === '' ? null : parseInt(e.target.value, 10),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-slate-500">%</span>
                        <Input
                          type="number"
                          step="0.1"
                          className="w-18 h-7 text-xs font-bold text-emerald-700"
                          value={f.percentual}
                          onChange={(e) =>
                            handleFaseChange(idx, 'percentual', Number(e.target.value))
                          }
                        />
                      </div>
                      {fases.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveFase(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  Exemplo: Mês 1 ao 3: 100%; A partir do mês 4: 2%.
                </p>
              </div>
            )}

            {tipoModelo === 'POR_ESGOTAMENTO' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Saldo Total Previsto (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-white"
                      placeholder="1000,00"
                      value={saldoTotal}
                      onChange={(e) =>
                        setSaldoTotal(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Valor Estimado por Parcela (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-white"
                      placeholder="250,00"
                      value={valorParcelaEstimada}
                      onChange={(e) =>
                        setValorParcelaEstimada(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Existe um total de comissão e os pagamentos continuarão até consumir totalmente o
                  saldo.
                </p>
              </div>
            )}
          </div>

          {/* Versionamento simples: "Nova condição válida a partir de:" */}
          <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-lg">
            <Label className="text-xs font-semibold text-slate-800">
              Nova condição válida a partir de:
            </Label>
            <div className="flex items-center gap-3 mt-1">
              <Input
                type="date"
                required
                className="bg-white max-w-[200px]"
                value={validoAPartirDe}
                onChange={(e) => setValidoAPartirDe(e.target.value)}
              />
              <span className="text-[11px] text-slate-500">
                O sistema preserva comissões e apólices anteriores a esta data intactas.
              </span>
            </div>
          </div>

          {/* Observações / Descrição opcional */}
          <div>
            <Label className="text-xs text-slate-600">Observações (opcional)</Label>
            <Input
              placeholder="Notas sobre este modelo ou condições de contrato"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Cadastrar Modelo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
