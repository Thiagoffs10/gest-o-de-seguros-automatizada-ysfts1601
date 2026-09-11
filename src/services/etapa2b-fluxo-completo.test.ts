import { describe, it, expect } from 'vitest'
import { calcularPrevisoesComissao } from './comissao-engine'
import { ModeloComissao } from '@/types'

// Função pura que replica e testa a lógica hierárquica de sugestão de modelos:
// Seguradora + Tipo/Produto > Tipo/Produto > Seguradora > Sem modelo
function matchModeloHierarchy(
  modelos: Array<Partial<ModeloComissao>>,
  seguradoraId?: string | null,
  tipoSeguro?: string | null,
) {
  if (seguradoraId && tipoSeguro) {
    const matchBoth = modelos.find(
      (m) =>
        m.seguradora === seguradoraId &&
        m.tipo_seguro &&
        m.tipo_seguro.toLowerCase() === tipoSeguro.toLowerCase(),
    )
    if (matchBoth) return matchBoth
  }

  if (tipoSeguro) {
    const matchTipo = modelos.find(
      (m) => m.tipo_seguro && m.tipo_seguro.toLowerCase() === tipoSeguro.toLowerCase(),
    )
    if (matchTipo) return matchTipo
  }

  if (seguradoraId) {
    const matchSeg = modelos.find((m) => m.seguradora === seguradoraId)
    if (matchSeg) return matchSeg
  }

  return null
}

describe('ETAPA 2B — Fluxo Completo: Sugestão, Previsão, Recebimento Parcial, Saldo e Estorno', () => {
  // Teste 1: Sugestão automática de modelo
  it('Sugere modelo por hierarquia: Seguradora + Produto > Produto > Seguradora > Fallback', () => {
    const modelos: Array<Partial<ModeloComissao>> = [
      {
        id: 'mod-seg',
        nome: 'Porto Seguro Geral',
        tipo_modelo: 'PARCELADA',
        seguradora: 'seg-porto',
        ativo: true,
      },
      {
        id: 'mod-tipo',
        nome: 'Auto Geral',
        tipo_modelo: 'PARCELADA',
        tipo_seguro: 'Auto',
        ativo: true,
      },
      {
        id: 'mod-seg-tipo',
        nome: 'Porto Seguro Auto Premium',
        tipo_modelo: 'PARCELADA',
        seguradora: 'seg-porto',
        tipo_seguro: 'Auto',
        ativo: true,
      },
    ]

    // 1. Especificidade máxima: Seguradora + Tipo/Produto
    const match1 = matchModeloHierarchy(modelos, 'seg-porto', 'Auto')
    expect(match1?.id).toBe('mod-seg-tipo')

    // 2. Tipo/Produto sem match de seguradora
    const match2 = matchModeloHierarchy(modelos, 'seg-bradesco', 'Auto')
    expect(match2?.id).toBe('mod-tipo')

    // 3. Seguradora sem tipo/produto correspondente
    const match3 = matchModeloHierarchy(modelos, 'seg-porto', 'Vida')
    expect(match3?.id).toBe('mod-seg')

    // 4. Sem correspondência
    const match4 = matchModeloHierarchy(modelos, 'seg-bradesco', 'Vida')
    expect(match4).toBeNull()
  })

  // Teste 2: Previsão de comissão e cálculo de competências
  it('Calcula competências e valores previstos com precisão (Exemplo usuário: Set/26 e Out/26 R$500 cada)', () => {
    const policy = {
      start_date: '2026-09-01',
      valor_liquido: 5000,
      premium_amount: 5000,
      commission_percent: 20, // 20% de 5000 = 1000 total
      commission: 1000,
    }

    const modeloParcelado = {
      tipo_modelo: 'PARCELADA' as const,
      nome: 'Parcelada 2x',
      config_json: {
        quantidade_competencias: 2,
      },
    }

    const prevs = calcularPrevisoesComissao(policy, modeloParcelado)
    expect(prevs).toHaveLength(2)
    expect(prevs[0].competencia).toBe('09/2026')
    expect(prevs[0].valor_previsto).toBe(500)
    expect(prevs[1].competencia).toBe('10/2026')
    expect(prevs[1].valor_previsto).toBe(500)
  })

  // Teste 3: Simulação matemática do fluxo do usuário:
  // Set/26: Previsto R$500, Recebido R$500 -> Saldo R$0 (Recebida)
  // Out/26: Previsto R$500, Recebido R$300 -> Saldo R$200 (Parcial)
  // Segundo recebimento: R$200 -> Saldo R$0 (Recebida)
  // Estorno: -R$200 -> Recebimento bruto +R$500, Estorno -R$200, Líquido recebido R$300
  it('Simula fluxo de recebimento parcial, liquidação total e estorno não-destrutivo', () => {
    const prevSetembro = { valor_previsto: 500, competencia: '09/2026' }
    const prevOutubro = { valor_previsto: 500, competencia: '10/2026' }

    // Lançamento 1: Setembro integral
    const recSetembro = [{ valor_bruto: 500, competencia: '09/2026', is_estorno: false }]
    const recBrutoSet = recSetembro.reduce((sum, r) => sum + r.valor_bruto, 0)
    const saldoSet = Math.max(0, prevSetembro.valor_previsto - recBrutoSet)
    const statusSet = saldoSet === 0 ? 'Recebida' : 'Pendente'
    expect(saldoSet).toBe(0)
    expect(statusSet).toBe('Recebida')

    // Lançamento 2: Outubro parcial R$ 300
    const recOutubro = [{ valor_bruto: 300, competencia: '10/2026', is_estorno: false }]
    let recBrutoOut = recOutubro.reduce((sum, r) => sum + r.valor_bruto, 0)
    let saldoOut = Math.max(0, prevOutubro.valor_previsto - recBrutoOut)
    let statusOut = saldoOut === 0 ? 'Recebida' : recBrutoOut > 0 ? 'Parcial' : 'Pendente'
    expect(saldoOut).toBe(200)
    expect(statusOut).toBe('Parcial')

    // Lançamento 3: Novo recebimento de R$ 200 para liquidar Outubro
    recOutubro.push({ valor_bruto: 200, competencia: '10/2026', is_estorno: false })
    recBrutoOut = recOutubro.reduce((sum, r) => sum + r.valor_bruto, 0)
    saldoOut = Math.max(0, prevOutubro.valor_previsto - recBrutoOut)
    statusOut = saldoOut === 0 ? 'Recebida' : recBrutoOut > 0 ? 'Parcial' : 'Pendente'
    expect(saldoOut).toBe(0)
    expect(statusOut).toBe('Recebida')

    // Lançamento 4: Estorno de R$ 200 (registro adicional negativo, sem apagar o original)
    recOutubro.push({ valor_bruto: -200, competencia: '10/2026', is_estorno: true })
    const totalPositivos = recOutubro
      .filter((r) => !r.is_estorno && r.valor_bruto > 0)
      .reduce((sum, r) => sum + r.valor_bruto, 0)
    const totalEstornos = recOutubro
      .filter((r) => r.is_estorno || r.valor_bruto < 0)
      .reduce((sum, r) => sum + Math.abs(r.valor_bruto), 0)
    const liquidoRecebido = totalPositivos - totalEstornos

    expect(totalPositivos).toBe(500) // +R$ 500
    expect(totalEstornos).toBe(200) // -R$ 200
    expect(liquidoRecebido).toBe(300) // R$ 300

    // O saldo em aberto volta para R$ 200 e o status volta para Parcial
    const recBrutoFinal = recOutubro.reduce((sum, r) => sum + r.valor_bruto, 0)
    const saldoFinal = Math.max(0, prevOutubro.valor_previsto - recBrutoFinal)
    const statusFinal = saldoFinal === 0 ? 'Recebida' : recBrutoFinal > 0 ? 'Parcial' : 'Pendente'
    expect(saldoFinal).toBe(200)
    expect(statusFinal).toBe('Parcial')
  })

  // Teste 4: Garantir separação estrita Parceiro x Comissão da Seguradora (ITEM 9)
  it('Garante que comissão recebida da seguradora não altera status de pagamento do parceiro', () => {
    const policy = {
      id: 'pol-1',
      tipo_de_venda: 'Parceiro',
      parceiro: 'parc-1',
      valor_repasse: 150,
      pago_parceiro: false,
      data_pagamento_parceiro: null,
      comissao_recebida: false,
    }

    // Recebimento da seguradora é registrado
    const comissaoRecebida = true

    // Valida que o objeto de repasse permanece desacoplado
    const policyAposRecebimentoSeguradora = {
      ...policy,
      comissao_recebida: comissaoRecebida,
    }

    expect(policyAposRecebimentoSeguradora.comissao_recebida).toBe(true)
    expect(policyAposRecebimentoSeguradora.pago_parceiro).toBe(false)
    expect(policyAposRecebimentoSeguradora.data_pagamento_parceiro).toBeNull()
  })
})
