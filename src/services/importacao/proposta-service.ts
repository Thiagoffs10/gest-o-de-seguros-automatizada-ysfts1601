/**
 * Serviço de importação e processamento de Propostas em PDF.
 * - Envia o PDF para a rota /backend/v1/documentos/extrair-proposta ($documents.toMarkdown).
 * - Executa o parser determinístico por seguradora.
 * - Detecta cliente existente por CPF ou Nome + Placa para evitar duplicidades.
 * - Detecta apólice / proposta duplicada (mesmo nº de proposta ou placa com vigência sobreposta).
 */

import pb from '@/lib/pocketbase/client'
import { parsePropostaTexto } from './proposta-parsers'
import { PropostaExtraida } from './proposta-types'
import { Client, Policy, Seguradora } from '@/types'
import { getClients } from '../clients'
import { getPolicies } from '../policies'
import { criarSistemaAlerta } from './sistema-alertas'

export interface PropostaImportadaConferida {
  proposta: PropostaExtraida
  clienteExistente?: Client
  clienteDuplicadoMotivo?: string
  apoliceDuplicada?: Policy
  apoliceDuplicadaMotivo?: string
  seguradoraIdCorrespondente?: string
  renovacaoPolicyCorrespondente?: Policy
}

/**
 * Faz upload do arquivo PDF para o backend, extrai o Markdown e gera a proposta estruturada
 */
export async function extrairPropostaDeArquivoPdf(
  file: File,
  seguradoras: Seguradora[],
): Promise<PropostaImportadaConferida> {
  const formData = new FormData()
  formData.append('arquivo', file)

  let markdown = ''

  try {
    const res = await pb.send<{
      success: boolean
      fileName: string
      markdown: string
      truncated: boolean
      error?: string
    }>('/backend/v1/documentos/extrair-proposta', {
      method: 'POST',
      body: formData,
    })

    if (!res || !res.success) {
      throw new Error(res?.error || 'Não foi possível extrair o texto do PDF.')
    }

    markdown = res.markdown || ''
  } catch (err: any) {
    const msg = err?.data?.error || err?.message || 'Falha ao processar o arquivo PDF.'
    throw new Error(msg)
  }

  // Parse determinístico
  const proposta = parsePropostaTexto(markdown, file.name)

  // 1. Encontrar seguradora cadastrada correspondente
  let seguradoraId = ''
  const segEncontrada = seguradoras.find((s) => {
    const sNome = s.nome.toLowerCase()
    const pNome = proposta.seguradoraNome.toLowerCase()
    return sNome.includes(pNome) || pNome.includes(sNome)
  })
  if (segEncontrada) {
    seguradoraId = segEncontrada.id
  }

  // 2. DETECÇÃO DE CLIENTE EXISTENTE / DUPLICADO
  let clienteExistente: Client | undefined
  let clienteDuplicadoMotivo: string | undefined

  if (proposta.segurado.cpfCnpj) {
    const cpfLimpo = proposta.segurado.cpfCnpj.replace(/\D/g, '')
    if (cpfLimpo) {
      const matchCpf = await getClients('', `cpf = "${cpfLimpo}" || cnpj = "${cpfLimpo}"`)
      if (matchCpf && matchCpf.length > 0) {
        clienteExistente = matchCpf[0]
        clienteDuplicadoMotivo = `Cliente já cadastrado com o CPF/CNPJ ${proposta.segurado.cpfCnpj} (${clienteExistente.name}).`
      }
    }
  }

  // Se não achou por CPF, tenta por Nome exato + Placa
  if (!clienteExistente && proposta.segurado.nome && proposta.veiculo.placa) {
    const matchPlaca = await getPolicies(`placa = "${proposta.veiculo.placa}"`)
    if (matchPlaca && matchPlaca.length > 0) {
      const polComPlaca = matchPlaca[0]
      if (polComPlaca.expand?.client) {
        const clientPlaca = polComPlaca.expand.client
        if (
          clientPlaca.name.toLowerCase().includes(proposta.segurado.nome.toLowerCase()) ||
          proposta.segurado.nome.toLowerCase().includes(clientPlaca.name.toLowerCase())
        ) {
          clienteExistente = clientPlaca
          clienteDuplicadoMotivo = `Cliente encontrado pela placa do veículo ${proposta.veiculo.placa} (${clientPlaca.name}).`
        }
      }
    }
  }

  // 3. DETECÇÃO DE PROPOSTA / APÓLICE DUPLICADA
  let apoliceDuplicada: Policy | undefined
  let apoliceDuplicadaMotivo: string | undefined

  if (proposta.numeroProposta) {
    const existingProp = await getPolicies(`numero_proposta = "${proposta.numeroProposta}"`)
    if (existingProp && existingProp.length > 0) {
      apoliceDuplicada = existingProp[0]
      apoliceDuplicadaMotivo = `Já existe proposta cadastrada com o número ${proposta.numeroProposta}.`
    }
  }

  if (!apoliceDuplicada && proposta.veiculo.placa && proposta.vigenciaInicio) {
    // Mesma placa com vigências sobrepostas na mesma seguradora
    const existingPlaca = await getPolicies(
      `placa = "${proposta.veiculo.placa}" && status = "Ativa"`,
    )
    if (existingPlaca && existingPlaca.length > 0) {
      const pol = existingPlaca[0]
      // Verificar se vigência é sobreposta
      if (pol.end_date && pol.end_date >= proposta.vigenciaInicio) {
        apoliceDuplicada = pol
        apoliceDuplicadaMotivo = `Veículo placa ${proposta.veiculo.placa} já possui apólice ativa com vigência até ${pol.end_date.substring(0, 10)}.`
      }
    }
  }

  // Se detectou duplicidade, registra alerta no sistema
  if (apoliceDuplicada) {
    criarSistemaAlerta({
      modulo: 'APOLICES',
      tipo: 'APOLICE_DUPLICADA',
      nivel: 'ALERTA',
      titulo: `Possível Proposta Duplicada: ${proposta.numeroProposta || proposta.veiculo.placa}`,
      motivo:
        apoliceDuplicadaMotivo || 'Proposta ou veículo com vigência sobreposta já cadastrada.',
      acao_sugerida: 'Verifique se não se trata de uma renovação ou atualização.',
      referencia_id: apoliceDuplicada.id,
      detalhes_json: { proposta, duplicadaCom: apoliceDuplicada.id },
    })
  }

  // 4. VÍNCULO COM APÓLICE ANTERIOR (se for Renovação)
  let renovacaoPolicyCorrespondente: Policy | undefined
  if (proposta.renovacao.isRenovacao) {
    if (proposta.renovacao.apoliceAnterior) {
      const numAntClean = proposta.renovacao.apoliceAnterior.replace(/\D/g, '')
      const prevs = await getPolicies(
        `policy_number = "${proposta.renovacao.apoliceAnterior}" || policy_number = "${numAntClean}" || numero_proposta = "${proposta.renovacao.apoliceAnterior}"`,
      )
      if (prevs && prevs.length > 0) {
        renovacaoPolicyCorrespondente = prevs[0]
      }
    }
    // Se não achou por número mas tem a placa do veículo
    if (!renovacaoPolicyCorrespondente && proposta.veiculo.placa) {
      const prevsPlaca = await getPolicies(`placa = "${proposta.veiculo.placa}"`)
      if (prevsPlaca && prevsPlaca.length > 0) {
        renovacaoPolicyCorrespondente = prevsPlaca[0]
      }
    }
  }

  return {
    proposta,
    clienteExistente,
    clienteDuplicadoMotivo,
    apoliceDuplicada,
    apoliceDuplicadaMotivo,
    seguradoraIdCorrespondente: seguradoraId || undefined,
    renovacaoPolicyCorrespondente,
  }
}
