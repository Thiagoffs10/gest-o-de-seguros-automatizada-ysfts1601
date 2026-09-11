import { useSearchParams, Link } from 'react-router-dom'
import { Building2, Layers, Package, Boxes, ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CadastrosSeguradorasTab } from '@/components/cadastros/CadastrosSeguradorasTab'
import { CadastrosRamosTab } from '@/components/cadastros/CadastrosRamosTab'
import { CadastrosProdutosTab } from '@/components/cadastros/CadastrosProdutosTab'
import { CadastrosModelosRecebimentoTab } from '@/components/cadastros/CadastrosModelosRecebimentoTab'

export function CadastrosSistema() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'seguradoras'

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true })
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/configuracoes">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Configurações
              </Button>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Central de Cadastros
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-blue-600" />
            Cadastros do Sistema
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerenciamento centralizado de Seguradoras, Ramos, Produtos e Modelos de Recebimento de
            Comissão.
          </p>
        </div>
      </div>

      {/* Abas centralizadas */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-4 w-full h-auto gap-1">
          <TabsTrigger
            value="seguradoras"
            className="flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Seguradoras</span>
          </TabsTrigger>

          <TabsTrigger
            value="ramos"
            className="flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>Ramos</span>
          </TabsTrigger>

          <TabsTrigger
            value="produtos"
            className="flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Produtos</span>
          </TabsTrigger>

          <TabsTrigger
            value="modelos"
            className="flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Modelos de Recebimento</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seguradoras" className="focus-visible:outline-none m-0">
          <CadastrosSeguradorasTab />
        </TabsContent>

        <TabsContent value="ramos" className="focus-visible:outline-none m-0">
          <CadastrosRamosTab />
        </TabsContent>

        <TabsContent value="produtos" className="focus-visible:outline-none m-0">
          <CadastrosProdutosTab />
        </TabsContent>

        <TabsContent value="modelos" className="focus-visible:outline-none m-0">
          <CadastrosModelosRecebimentoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
export default CadastrosSistema
