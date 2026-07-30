import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, FileText, Plus, Edit, Hash, Building2 } from 'lucide-react'
import { getClient, updateClient } from '@/services/clients'
import { getPolicies, createPolicy } from '@/services/policies'
import { getSeguradoras } from '@/services/seguradoras'
import { formatDocumentLabel } from '@/lib/document-validators'
import { Client, Policy, Seguradora } from '@/types'
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
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { BRAZILIAN_STATES, TIPOS_DE_SEGURO } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isNewPolicyOpen, setIsNewPolicyOpen] = useState(false)
  const [newPolicy, setNewPolicy] = useState({
    policy_number: '',
    seguradora: '',
    tipo_de_seguro: 'Auto',
    valor_liquido: 1000,
    commission_percent: 10,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
  })

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const c = await getClient(id)
      setClient(c)
      const [pols, segs] = await Promise.all([getPolicies(`client = "${id}"`), getSeguradoras()])
      setPolicies(pols)
      setSeguradoras(segs)
    } catch {
      /* intentionally ignored */
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateClient = async (formData: any) => {
    if (!id) return
    try {
      await updateClient(id, formData)
      toast({ title: 'Cliente atualizado com sucesso!' })
      setIsEditOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const endDate = new Date(newPolicy.end_date)
      const renewalDate = new Date(endDate.getTime() - 30 * 86400000).toISOString()
      const commission = (newPolicy.commission_percent / 100) * newPolicy.valor_liquido
      await createPolicy({
        ...newPolicy,
        client: id,
        renewal_date: renewalDate,
        commission,
        status: 'Ativa',
        premium_amount: newPolicy.valor_liquido,
        valor_bruto: newPolicy.valor_liquido,
      })
      toast({ title: 'Apólice vinculada ao cliente!' })
      setIsNewPolicyOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao criar apólice', description: err.message, variant: 'destructive' })
    }
  }

  if (!client)
    return <div className="p-8 text-center text-slate-500">Carregando dados do segurado...</div>

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
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Hash className="w-3 h-3" /> Código: {client.client_code || 'N/A'}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {client.tipo_pessoa === 'PJ' ? (
                <>
                  <Building2 className="w-3 h-3" /> PJ
                </>
              ) : (
                <>
                  <User className="w-3 h-3" /> PF
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="w-4 h-4 mr-2" /> Editar Dados
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsNewPolicyOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Apólice
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" /> Informações Pessoais
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
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Documento</p>
              <p className="font-semibold">{formatDocumentLabel(client)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">CEP</p>
              <p className="font-semibold">{client.cep || 'Não informado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Endereço</p>
              <p className="font-semibold">
                {[client.rua, client.numero, client.bairro].filter(Boolean).join(', ') ||
                  client.address ||
                  'Não informado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Cidade/UF</p>
              <p className="font-semibold">
                {[client.cidade, client.estado].filter(Boolean).join('/') || 'Não informado'}
              </p>
            </div>
          </div>
          {client.tipo_pessoa !== 'PJ' && client.birth_date && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Data de Nascimento</p>
                <p className="font-semibold">
                  {new Date(client.birth_date).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Apólices do Cliente ({policies.length})
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
                      {pol.policy_number} -{' '}
                      {pol.expand?.seguradora?.nome || pol.insurance_company || '-'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tipo: {pol.tipo_de_seguro || pol.coverage_type} | Vigência:{' '}
                      {new Date(pol.start_date).toLocaleDateString('pt-BR')} a{' '}
                      {new Date(pol.end_date).toLocaleDateString('pt-BR')}
                    </p>
                    {pol.placa && (
                      <p className="text-xs text-slate-500">
                        Placa: {pol.placa} | Modelo: {pol.modelo_veiculo}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      R$ {(pol.valor_liquido || pol.premium_amount)?.toLocaleString('pt-BR')}
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

      <ClientFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleUpdateClient}
        initialData={client}
        title="Editar Cliente"
      />

      <Dialog open={isNewPolicyOpen} onOpenChange={setIsNewPolicyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Apólice para {client.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePolicy} className="space-y-3">
            <div>
              <Label>Nº da Apólice *</Label>
              <Input
                required
                value={newPolicy.policy_number}
                onChange={(e) => setNewPolicy({ ...newPolicy, policy_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Seguradora</Label>
              <Select
                value={newPolicy.seguradora}
                onValueChange={(v) => setNewPolicy({ ...newPolicy, seguradora: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Seguro</Label>
              <Select
                value={newPolicy.tipo_de_seguro}
                onValueChange={(v: any) => setNewPolicy({ ...newPolicy, tipo_de_seguro: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DE_SEGURO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor Líquido (R$)</Label>
                <Input
                  type="number"
                  value={newPolicy.valor_liquido}
                  onChange={(e) =>
                    setNewPolicy({ ...newPolicy, valor_liquido: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  value={newPolicy.commission_percent}
                  onChange={(e) =>
                    setNewPolicy({ ...newPolicy, commission_percent: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={newPolicy.start_date}
                  onChange={(e) => setNewPolicy({ ...newPolicy, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={newPolicy.end_date}
                  onChange={(e) => setNewPolicy({ ...newPolicy, end_date: e.target.value })}
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
