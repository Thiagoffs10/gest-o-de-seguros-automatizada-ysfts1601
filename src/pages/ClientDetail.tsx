import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, Calendar, FileText, Plus, Edit } from 'lucide-react'
import { getClient, updateClient } from '@/services/clients'
import { getPolicies, createPolicy } from '@/services/policies'
import { Client, Policy } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [isEditOpen, setIsModalEditOpen] = useState(false)
  const [isNewPolicyOpen, setIsNewPolicyOpen] = useState(false)

  const [editData, setEditData] = useState<Partial<Client>>({})
  const [newPolicyData, setNewPolicyData] = useState({
    policy_number: '',
    insurance_company: '',
    coverage_type: 'Auto' as const,
    premium_amount: 1000,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    commission: 15,
  })

  const loadData = async () => {
    if (!id) return
    try {
      const c = await getClient(id)
      setClient(c)
      setEditData(c)
      const pols = await getPolicies(`client = "${id}"`)
      setPolicies(pols)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await updateClient(id, editData)
      toast({ title: 'Cliente atualizado com sucesso!' })
      setIsModalEditOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const startDate = new Date(newPolicyData.start_date)
      const endDate = new Date(newPolicyData.end_date)
      const renewalDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

      await createPolicy({
        ...newPolicyData,
        client: id,
        renewal_date: renewalDate.toISOString(),
        status: 'Ativa',
      })
      toast({ title: 'Apólice vinculada ao cliente!' })
      setIsNewPolicyOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao criar apólice', description: err.message, variant: 'destructive' })
    }
  }

  if (!client) {
    return <div className="p-8 text-center text-slate-500">Carregando dados do segurado...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/clientes')}
            className="mb-2"
          >
            ← Voltar para Clientes
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsModalEditOpen(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar Dados
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsNewPolicyOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Apólice
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">E-mail</p>
              <p className="font-semibold">{client.email || 'Não informado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Telefone</p>
              <p className="font-semibold">{client.phone || 'Não informado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Endereço</p>
              <p className="font-semibold">{client.address || 'Não informado'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies List */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Apólices do Cliente ({policies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Nenhuma apólice cadastrada para este cliente.
            </p>
          ) : (
            <div className="space-y-3">
              {policies.map((pol) => (
                <div
                  key={pol.id}
                  className="p-3 border rounded-lg bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {pol.policy_number} - {pol.insurance_company}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tipo: {pol.coverage_type} | Vigência:{' '}
                      {new Date(pol.start_date).toLocaleDateString('pt-BR')} a{' '}
                      {new Date(pol.end_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      R$ {pol.premium_amount?.toLocaleString('pt-BR')}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 h-6 p-0"
                      onClick={() => navigate(`/apolices/${pol.id}`)}
                    >
                      Ver Detalhes →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsModalEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateClient} className="space-y-3">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={editData.address || ''}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600">
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Policy Modal */}
      <Dialog open={isNewPolicyOpen} onOpenChange={setIsNewPolicyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Apólice para {client.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePolicy} className="space-y-3">
            <div>
              <Label>Número da Apólice *</Label>
              <Input
                required
                value={newPolicyData.policy_number}
                onChange={(e) =>
                  setNewPolicyData({ ...newPolicyData, policy_number: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Seguradora</Label>
              <Input
                value={newPolicyData.insurance_company}
                onChange={(e) =>
                  setNewPolicyData({ ...newPolicyData, insurance_company: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Tipo de Cobertura</Label>
              <Select
                value={newPolicyData.coverage_type}
                onValueChange={(val: any) =>
                  setNewPolicyData({ ...newPolicyData, coverage_type: val })
                }
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor Prêmio (R$)</Label>
                <Input
                  type="number"
                  value={newPolicyData.premium_amount}
                  onChange={(e) =>
                    setNewPolicyData({ ...newPolicyData, premium_amount: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  value={newPolicyData.commission}
                  onChange={(e) =>
                    setNewPolicyData({ ...newPolicyData, commission: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={newPolicyData.start_date}
                  onChange={(e) =>
                    setNewPolicyData({ ...newPolicyData, start_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={newPolicyData.end_date}
                  onChange={(e) => setNewPolicyData({ ...newPolicyData, end_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewPolicyOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600">
                Vincular Apólice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
