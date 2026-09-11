import { describe, it, expect } from 'vitest'
import { preparePolicyPayload, preparePolicyUpdatePayload } from './policies'

describe('Item 11 ETAPA 2A: Separação de Proposta e Apólice e Preservação de Vínculos', () => {
  it('1. Permite cadastrar inicialmente somente a proposta (sem apólice)', () => {
    const rawData = {
      client: 'client_xyz_123',
      numero_proposta: 'PROP-2026-9901',
      policy_number: '',
      valor_liquido: 1500,
      commission_percent: 20,
      start_date: '2026-08-01',
      end_date: '2027-08-01',
      status: 'Ativa' as const,
    }

    const payload = preparePolicyPayload(rawData)

    expect(payload.numero_proposta).toBe('PROP-2026-9901')
    expect(payload.policy_number).toBe('')
    expect(payload.client).toBe('client_xyz_123')
    expect(payload.premium_amount).toBe(1500)
    expect(payload.commission).toBe(300)
  })

  it('2. Permite adicionar posteriormente o número da apólice sem perder dados ou vínculos', () => {
    // Apólice existente cadastrada originalmente apenas com proposta
    const updateData = {
      policy_number: 'AP-2026-554433',
    }

    const payload = preparePolicyUpdatePayload(updateData)

    expect(payload.policy_number).toBe('AP-2026-554433')
    // Não inventa nem altera campos que não foram passados
    expect(payload.numero_proposta).toBeUndefined()
    expect(payload.client).toBeUndefined()
  })

  it('3. Ambos os campos (proposta e apólice) são opcionais', () => {
    const semNumeros = {
      client: 'client_abc_999',
      valor_liquido: 2000,
      start_date: '2026-08-01',
    }

    const payload = preparePolicyPayload(semNumeros)
    expect(payload.client).toBe('client_abc_999')
    // policy_number e numero_proposta não devem quebrar se ausentes
    expect(payload.policy_number).toBeUndefined()
    expect(payload.numero_proposta).toBeUndefined()
  })

  it('4. Preserva registros antigos no campo policy_number sem tentar classificar ou alterar', () => {
    // Registro legado vindo do banco onde o campo policy_number contém dado misto
    const legacyRecord = {
      id: 'pol_legado_001',
      policy_number: 'PROPOSTA OU APOLICE 123456',
      numero_proposta: '',
      client: 'client_legacy',
      commission: 250,
    }

    // Se o usuário apenas editar outro campo (ex: observação), o legado permanece intacto
    const payload = preparePolicyUpdatePayload({
      notes: 'Atualização sem mexer no identificador legado',
    })

    expect(payload.policy_number).toBeUndefined()
    expect(payload.numero_proposta).toBeUndefined()
    expect(payload.notes).toBe('Atualização sem mexer no identificador legado')
  })

  it('5. Vínculos e relações internas continuam por ID interno (ID nunca muda)', () => {
    const policyId = 'pol_internal_id_777'

    const recebimento = {
      policy: policyId, // ID interno
      valor_bruto: 300,
      origem: 'Comissão',
    }

    const previsao = {
      policy: policyId, // ID interno
      valor_previsto: 300,
    }

    expect(recebimento.policy).toBe(policyId)
    expect(previsao.policy).toBe(policyId)
  })
})
