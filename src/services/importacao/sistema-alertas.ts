import pb from '@/lib/pocketbase/client'

export interface SistemaAlerta {
  id: string
  modulo: 'FINANCEIRO' | 'APOLICES' | 'CLIENTES' | 'EXTRATO'
  tipo:
    | 'COMISSAO_JA_BAIXADA'
    | 'SEM_PREVISAO'
    | 'VALOR_DIVERGENTE'
    | 'CHECKSUM_DIVERGENTE'
    | 'APOLICE_DUPLICADA'
    | 'CLIENTE_DUPLICADO'
    | 'OUTRO'
  nivel: 'INFO' | 'ALERTA' | 'CRITICO'
  titulo: string
  motivo: string
  acao_sugerida?: string
  resolvido: boolean
  data_resolucao?: string
  resolvido_por?: string
  referencia_id?: string
  detalhes_json?: any
  created?: string
}

export async function getSistemaAlertas(filter?: string): Promise<SistemaAlerta[]> {
  try {
    const list = await pb.collection('sistema_alertas').getFullList<SistemaAlerta>({
      filter: filter || 'resolvido = false',
      sort: '-created',
    })
    return list
  } catch (err) {
    console.warn('Erro ao buscar alertas do sistema:', err)
    return []
  }
}

export async function criarSistemaAlerta(
  alerta: Omit<SistemaAlerta, 'id' | 'resolvido' | 'created'>,
): Promise<SistemaAlerta | null> {
  try {
    const rec = await pb.collection('sistema_alertas').create<SistemaAlerta>({
      ...alerta,
      resolvido: false,
    })
    return rec
  } catch (err) {
    console.warn('Erro ao criar alerta do sistema:', err)
    return null
  }
}

export async function resolverSistemaAlerta(id: string): Promise<boolean> {
  try {
    const user = pb.authStore.record
    await pb.collection('sistema_alertas').update(id, {
      resolvido: true,
      data_resolucao: new Date().toISOString().split('T')[0],
      resolvido_por: user?.name || user?.email || 'Sistema',
    })
    return true
  } catch (err) {
    console.warn('Erro ao resolver alerta:', err)
    return false
  }
}
