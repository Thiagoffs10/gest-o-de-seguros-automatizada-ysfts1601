import { useEffect, useState, useCallback } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { getSeguradoras } from '@/services/seguradoras'
import { getParceiros } from '@/services/parceiros'
import { getTiposSeguro } from '@/services/tipos-seguro'
import { getCommunications } from '@/services/communications'
import { getEmailTemplates } from '@/services/email-templates'
import {
  Client,
  Policy,
  Seguradora,
  Parceiro,
  TipoSeguro,
  EmailTemplate,
  Communication as CommType,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IndividualTab } from '@/components/comunicacao/IndividualTab'
import { CampanhasTab } from '@/components/comunicacao/CampanhasTab'
import { CommsHistory } from '@/components/comunicacao/CommsHistory'
import { EmailTemplatesManager } from '@/components/comunicacao/EmailTemplatesManager'
import { useRealtime } from '@/hooks/use-realtime'

export default function Communication() {
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [tiposSeguro, setTiposSeguro] = useState<TipoSeguro[]>([])
  const [comms, setComms] = useState<CommType[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])

  const loadData = useCallback(async () => {
    try {
      const [cls, pols, segs, parcs, tipos, cms, tpls] = await Promise.all([
        getClients(),
        getPolicies(),
        getSeguradoras().catch(() => []),
        getParceiros().catch(() => []),
        getTiposSeguro().catch(() => []),
        getCommunications().catch(() => []),
        getEmailTemplates().catch(() => []),
      ])
      setClients(cls)
      setPolicies(pols)
      setSeguradoras(segs)
      setParceiros(parcs)
      setTiposSeguro(tipos)
      setComms(cms)
      setTemplates(tpls)
    } catch {
      /* intentionally ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('email_templates', () => loadData())

  const exportClientsCSV = () => {
    const headers = ['Nome,Email,Telefone,CPF,CNPJ,Aniversario\n']
    const rows = clients.map(
      (c) =>
        `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.cpf || ''}","${c.cnpj || ''}","${c.birth_date || ''}"\n`,
    )
    const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lista_clientes_comunicacao.csv'
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Comunicação</h1>
          <p className="text-slate-500 text-sm">
            Envie mensagens individuais, crie campanhas em massa e gerencie todo o histórico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportClientsCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Lista de Clientes (CSV)
        </Button>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="individual">Comunicação Individual</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="templates">Modelos de E-mail</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="mt-4">
          <IndividualTab
            clients={clients}
            policies={policies}
            templates={templates}
            onSuccess={loadData}
          />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-4">
          <CampanhasTab
            clients={clients}
            policies={policies}
            seguradoras={seguradoras}
            parceiros={parceiros}
            tiposSeguro={tiposSeguro}
            templates={templates}
            onSuccess={loadData}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <EmailTemplatesManager templates={templates} onTemplatesChange={loadData} />
        </TabsContent>
      </Tabs>

      <CommsHistory communications={comms} />
    </div>
  )
}
