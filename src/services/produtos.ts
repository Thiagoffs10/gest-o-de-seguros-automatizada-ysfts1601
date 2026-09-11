import pb from '@/lib/pocketbase/client'
import { Produto } from '@/types'

export const getProdutos = async (filter?: string, sort = 'nome'): Promise<Produto[]> => {
  return pb.collection('produtos').getFullList<Produto>({
    filter,
    sort,
    expand: 'seguradora,ramo',
  })
}

export const getActiveProdutos = async (
  seguradoraId?: string,
  ramoId?: string,
): Promise<Produto[]> => {
  const filters: string[] = ['ativo = true']
  if (seguradoraId) {
    filters.push(`seguradora = "${seguradoraId}"`)
  }
  if (ramoId) {
    filters.push(`ramo = "${ramoId}"`)
  }
  return pb.collection('produtos').getFullList<Produto>({
    filter: filters.join(' && '),
    sort: 'nome',
    expand: 'seguradora,ramo',
  })
}

export const getProduto = async (id: string): Promise<Produto> => {
  return pb.collection('produtos').getOne<Produto>(id, {
    expand: 'seguradora,ramo',
  })
}

export interface CreateProdutoPayload {
  nome: string
  seguradora?: string | null
  ramo?: string | null
  codigo_comercial?: string
  descricao?: string
  ativo?: boolean
}

export const createProduto = async (data: CreateProdutoPayload): Promise<Produto> => {
  const payload: Record<string, any> = {
    nome: data.nome.trim(),
    seguradora: data.seguradora && data.seguradora.trim() !== '' ? data.seguradora.trim() : null,
    ramo: data.ramo && data.ramo.trim() !== '' ? data.ramo.trim() : null,
    codigo_comercial: data.codigo_comercial ? data.codigo_comercial.trim() : '',
    descricao: data.descricao ? data.descricao.trim() : '',
    ativo: data.ativo !== false,
  }
  return pb.collection('produtos').create<Produto>(payload)
}

export const updateProduto = async (
  id: string,
  data: Partial<CreateProdutoPayload>,
): Promise<Produto> => {
  const payload: Record<string, any> = {}
  if (data.nome !== undefined) payload.nome = data.nome.trim()
  if (data.seguradora !== undefined) {
    payload.seguradora =
      data.seguradora && data.seguradora.trim() !== '' ? data.seguradora.trim() : null
  }
  if (data.ramo !== undefined) {
    payload.ramo = data.ramo && data.ramo.trim() !== '' ? data.ramo.trim() : null
  }
  if (data.codigo_comercial !== undefined) {
    payload.codigo_comercial = data.codigo_comercial ? data.codigo_comercial.trim() : ''
  }
  if (data.descricao !== undefined) {
    payload.descricao = data.descricao ? data.descricao.trim() : ''
  }
  if (data.ativo !== undefined) payload.ativo = data.ativo

  return pb.collection('produtos').update<Produto>(id, payload)
}

export const deleteProduto = async (id: string): Promise<boolean> => {
  return pb.collection('produtos').delete(id)
}
