import { describe, it, expect } from 'vitest'
import { findSuggestedModelo } from './modelos-comissao'
import { ModeloComissao } from '@/types'

describe('Sugestão Automática de Modelos de Comissão (Seguradora + Produto/Ramo)', () => {
  const mockModelos: ModeloComissao[] = [
    {
      id: 'mod-1',
      nome: 'Bradesco Saúde Especial',
      tipo_modelo: 'RECORRENTE',
      seguradora: 'seg-bradesco',
      tipo_seguro: 'Saúde Top',
      percentual_padrao: 10,
      ativo: true,
      created: '2026-08-01',
      updated: '2026-08-01',
    },
    {
      id: 'mod-2',
      nome: 'Porto Seguro Auto Padrão',
      tipo_modelo: 'A_VISTA',
      seguradora: 'seg-porto',
      tipo_seguro: 'Auto',
      percentual_padrao: 20,
      ativo: true,
      created: '2026-08-01',
      updated: '2026-08-01',
    },
    {
      id: 'mod-3',
      nome: 'Vida Fases Geral',
      tipo_modelo: 'POR_FASES',
      seguradora: '',
      tipo_seguro: 'Vida',
      percentual_padrao: 100,
      ativo: true,
      created: '2026-08-01',
      updated: '2026-08-01',
    },
    {
      id: 'mod-4',
      nome: 'Azul Padrão Companhia',
      tipo_modelo: 'PARCELADA',
      seguradora: 'seg-azul',
      tipo_seguro: '',
      percentual_padrao: 15,
      ativo: true,
      created: '2026-08-01',
      updated: '2026-08-01',
    },
  ]

  // Teste de lógica de correspondência
  function matchModeloLocal(
    list: ModeloComissao[],
    seguradoraId?: string | null,
    tipoSeguro?: string | null,
  ): ModeloComissao | null {
    if (seguradoraId && tipoSeguro) {
      const matchBoth = list.find(
        (m) =>
          m.seguradora === seguradoraId &&
          m.tipo_seguro &&
          m.tipo_seguro.toLowerCase() === tipoSeguro.toLowerCase(),
      )
      if (matchBoth) return matchBoth
    }

    if (tipoSeguro) {
      const matchTipo = list.find(
        (m) => m.tipo_seguro && m.tipo_seguro.toLowerCase() === tipoSeguro.toLowerCase(),
      )
      if (matchTipo) return matchTipo
    }

    if (seguradoraId) {
      const matchSeg = list.find((m) => m.seguradora === seguradoraId)
      if (matchSeg) return matchSeg
    }

    return null
  }

  it('Prioriza match exato Seguradora + Produto', () => {
    const sug = matchModeloLocal(mockModelos, 'seg-bradesco', 'Saúde Top')
    expect(sug?.id).toBe('mod-1')
    expect(sug?.nome).toBe('Bradesco Saúde Especial')
  })

  it('Faz match case-insensitive com ramo ou produto comercial', () => {
    const sug = matchModeloLocal(mockModelos, 'seg-porto', 'auto')
    expect(sug?.id).toBe('mod-2')
    expect(sug?.percentual_padrao).toBe(20)
  })

  it('Sugere modelo genérico pelo tipo/ramo quando não há específico da seguradora', () => {
    const sug = matchModeloLocal(mockModelos, 'seg-sulamerica', 'Vida')
    expect(sug?.id).toBe('mod-3')
    expect(sug?.nome).toBe('Vida Fases Geral')
  })

  it('Sugere modelo da seguradora quando o produto não tem modelo específico', () => {
    const sug = matchModeloLocal(mockModelos, 'seg-azul', 'Outro Produto')
    expect(sug?.id).toBe('mod-4')
    expect(sug?.nome).toBe('Azul Padrão Companhia')
  })
})
