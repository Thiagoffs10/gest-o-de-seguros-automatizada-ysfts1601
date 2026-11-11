import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Pencil, Power, RefreshCw } from 'lucide-react'
import { getOrganizations, createOrganization, updateOrganization } from '@/services/organizations'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function Organizations() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [orgs, setOrgs] = useState<{ id: string; nome: string; ativa: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<{ id: string; nome: string; ativa: boolean } | null>(
    null,
  )
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Administrador'
    if (currentUser && !isAdmin) navigate('/dashboard')
  }, [currentUser, navigate])

  const load = useCallback(async () => {
    try {
      const data = await getOrganizations()
      setOrgs(data)
    } catch (err) {
      toast({
        title: 'Erro ao carregar organizações',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingOrg(null)
    setNome('')
    setIsModalOpen(true)
  }

  const openEdit = (org: { id: string; nome: string; ativa: boolean }) => {
    setEditingOrg(org)
    setNome(org.nome)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    setSaving(true)
    try {
      if (editingOrg) {
        await updateOrganization(editingOrg.id, { nome: nome.trim() })
        toast({ title: 'Organização atualizada com sucesso!' })
      } else {
        await createOrganization(nome.trim())
        toast({ title: 'Organização criada com sucesso!' })
      }
      setIsModalOpen(false)
      load()
    } catch (err) {
      toast({
        title: 'Erro ao salvar organização',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAtiva = async (org: { id: string; nome: string; ativa: boolean }) => {
    try {
      await updateOrganization(org.id, { ativa: !org.ativa })
      toast({ title: org.ativa ? 'Organização desativada.' : 'Organização ativada.' })
      load()
    } catch (err) {
      toast({
        title: 'Erro ao atualizar status',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizações Parceiras</h1>
          <p className="text-slate-500 text-sm">
            Corretoras parceiras com acesso isolado ao sistema (piloto multi-tenant).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nova Organização
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Nome</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Criada em</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center p-6 text-slate-500">
                    Carregando organizações...
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-6 text-slate-500">
                    Nenhuma organização cadastrada ainda.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {org.nome}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        className={
                          org.ativa ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }
                      >
                        {org.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {(org as any).created
                        ? new Date((org as any).created).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={() => openEdit(org)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            org.ativa
                              ? 'text-red-600 hover:text-red-800'
                              : 'text-green-600 hover:text-green-800'
                          }
                          onClick={() => handleToggleAtiva(org)}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? 'Editar Organização' : 'Nova Organização Parceira'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Nome da corretora *</Label>
              <Input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Corretora XYZ Ltda"
              />
            </div>
            <p className="text-xs text-slate-500">
              Depois de criar a organização, cadastre o usuário do parceiro em{' '}
              <strong>Gestão de Usuários</strong>, selecionando esta organização e definindo a senha
              inicial.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600" disabled={saving}>
                {saving ? 'Salvando...' : editingOrg ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
