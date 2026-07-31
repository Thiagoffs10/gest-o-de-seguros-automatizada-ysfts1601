import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { getPolicies } from '@/services/policies'
import { Policy } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRealtime } from '@/hooks/use-realtime'

const STORAGE_KEY = 'pipeline_stages'
type Stage = 'arenovar' | 'emcontato' | 'renovada'
const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'arenovar', label: 'A Renovar', color: 'border-t-amber-400' },
  { id: 'emcontato', label: 'Em Contato', color: 'border-t-blue-400' },
  { id: 'renovada', label: 'Renovada', color: 'border-t-emerald-400' },
]

function loadStages(): Record<string, Stage> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}
function saveStages(s: Record<string, Stage>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export default function Pipeline() {
  const navigate = useNavigate()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [stages, setStages] = useState<Record<string, Stage>>(loadStages())

  const loadData = useCallback(async () => {
    try {
      const now = new Date()
      const future = new Date(now.getTime() + 30 * 86400000)
      const nowStr = now.toISOString().split('T')[0]
      const futureStr = future.toISOString().split('T')[0]
      const filter = `status = "Renovação Pendente" || (status = "Ativa" && end_date >= "${nowStr}" && end_date <= "${futureStr}")`
      const data = await getPolicies(filter)
      setPolicies(data)
    } catch {
      /* intentionally ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => loadData())

  const getStage = (policyId: string): Stage => stages[policyId] || 'arenovar'

  const moveCard = (policyId: string, direction: 1 | -1) => {
    const current = getStage(policyId)
    const idx = STAGES.findIndex((s) => s.id === current)
    const newIdx = Math.max(0, Math.min(STAGES.length - 1, idx + direction))
    const newStages = { ...stages, [policyId]: STAGES[newIdx].id }
    setStages(newStages)
    saveStages(newStages)
  }

  const now = new Date()
  const future = new Date(now.getTime() + 30 * 86400000)
  const periodLabel = `${now.toLocaleDateString('pt-BR')} a ${future.toLocaleDateString('pt-BR')}`

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline de Renovações</h1>
          <p className="text-slate-500 text-sm">
            Gerencie o fluxo de renovação de apólices. Período: {periodLabel}
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map((stage) => {
          const stagePolicies = policies.filter((p) => getStage(p.id) === stage.id)
          return (
            <div
              key={stage.id}
              className={`bg-slate-50 rounded-lg border-t-4 ${stage.color} min-h-[400px]`}
            >
              <div className="p-3 border-b bg-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-700">{stage.label}</h3>
                  <Badge variant="secondary">{stagePolicies.length}</Badge>
                </div>
              </div>
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                {stagePolicies.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Nenhuma apólice</p>
                ) : (
                  stagePolicies.map((p) => (
                    <Card
                      key={p.id}
                      className="p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/apolices/${p.id}`)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-bold text-xs text-slate-900 truncate">
                          {p.policy_number}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        {p.expand?.client?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Renovação:{' '}
                        {p.renewal_date
                          ? new Date(p.renewal_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>
                      <div
                        className="flex items-center justify-between mt-2 pt-2 border-t"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          disabled={getStage(p.id) === 'arenovar'}
                          onClick={() => moveCard(p.id, -1)}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-[10px] text-slate-400">
                          {STAGES.find((s) => s.id === getStage(p.id))?.label}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          disabled={getStage(p.id) === 'renovada'}
                          onClick={() => moveCard(p.id, 1)}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
