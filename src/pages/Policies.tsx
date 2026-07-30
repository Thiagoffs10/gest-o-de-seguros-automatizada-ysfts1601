import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FileText } from 'lucide-react'
import { getPolicies, createPolicy } from '@/services/policies'
import { getClients } from '@/services/clients'
import { Policy, Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function Policies() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [formData, setFormData] = useState({
    client: '',
    insurance_company: '',
    policy_number: '',
    coverage_type: 'Auto' as const,
    premium_amount: 1500,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    commission: 15,
    status: 'Ativa' as const,
  })

  const loadData = async () => {
    try {
      const cls = await getClients()
      setClients(cls)
      let filter = ''
      if (statusFilter !== 'ALL') filter = `status = "${statusFilter}"`
      if (search) {
        filter +=
          (filter ? ' && ' : '') +
          `(policy_number ~ "${search}" || insurance_company ~ "${search}")`
      }
      const data = await getPolicies(filter)
      setPolicies(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [search, statusFilter])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' })
      return
    }
    try {
      const endDate = new Date(formData.end_date)
      const renewalDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

      await createPolicy({
        ...formData,
        renewal_date: renewalDate.toISOString(),
      })
      toast({ title: 'Apólice cadastrada!' })
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Apólices</h1>
          <p className="text-slate-500 text-sm">Registro de apólices e coberturas ativas.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Apólice
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nº da apólice ou seguradora..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os Status</SelectItem>
            <SelectItem value="Ativa">Ativa</SelectItem>
            <SelectItem value="Renovação Pendente">Renovação Pendente</SelectItem>
            <SelectItem value="Expirada">Expirada</SelectItem>
            <SelectItem value="Cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Nº Apólice</th>
                <th className="p-3.5">Seguradora</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Cobertura</th>
                <th className="p-3.5">Prêmio</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-slate-500">
                    Nenhuma apólice encontrada.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 cursor-pointer"
                    onClick={() => navigate(`/apolices/${p.id}`)}
                  >
                    <td className="p-3.5 font-bold text-slate-900">{p.policy_number}</td>
                    <td className="p-3.5">{p.insurance_company || '-'}</td>
                    <td className="p-3.5 font-medium">{p.expand?.client?.name || 'Indefinido'}</td>
                    <td className="p-3.5">{p.coverage_type}</td>
                    <td className="p-3.5 font-bold text-slate-900">
                      R$ {p.premium_amount?.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3.5">
                      <Badge
                        className={
                          p.status === 'Ativa'
                            ? 'bg-emerald-500'
                            : p.status === 'Renovação Pendente'
                              ? 'bg-amber-500'
                              : 'bg-slate-500'
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Adicionar Apólice */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Nova Apólice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div>
              <Label>Cliente *</Label>
              <Select
                value={formData.client}
                onValueChange={(val) => setFormData({ ...formData, client: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segurado" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nº da Apólice *</Label>
                <Input
                  required
                  value={formData.policy_number}
                  onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Seguradora</Label>
                <Input
                  value={formData.insurance_company}
                  onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cobertura</Label>
                <Select
                  value={formData.coverage_type}
                  onValueChange={(val: any) => setFormData({ ...formData, coverage_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Vida">Vida</SelectItem>
                    <SelectItem value="Residencial">Residencial</SelectItem>
                    <SelectItem value="Empresarial">Empresarial</SelectItem>
                    <SelectItem value="Saúde">Saúde</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativa">Ativa</SelectItem>
                    <SelectItem value="Renovação Pendente">Renovação Pendente</SelectItem>
                    <SelectItem value="Expirada">Expirada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor Prêmio (R$)</Label>
                <Input
                  type="number"
                  value={formData.premium_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, premium_amount: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600">
                Salvar Apólice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
