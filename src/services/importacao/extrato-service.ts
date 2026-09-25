/**
 * Motor de Reconciliação e Baixa de Extratos de Comissões.
 *
 * Funcionalidades:
 * 1. Cruza linhas canônicas do extrato com previsões existentes (comissoes_previstas e policies).
 * 2. Classifica em TRÊS FILAS de conferência:
 *    - ✅ APROVADO (casamento 100% exato de proposta/apólice + parcela + valor)
 *    - ⚠️ DIVERGENTE (valor diferente, parcial, parcela inesperada)
 *    - ❌ SEM PREVISÃO (comissão de apólice/proposta não cadastrada)
 *    - Além de detectar JA_BAIXADO (duplicidade) e IGNORADO (linhas zeradas)
 * 3. Permite baixar em lote (1 clique) passando OBRIGATORIAMENTE pela mesma rotina
 *    transacional `createComissaoRecebimento` do projeto.
 * 4. COMPLETAR Nº DA APÓLICE: se a proposta estava com apólice vazia ("-") e o extrato
 *    traz o número da apólice, atualiza no registro existente registrando a origem.
 *    Se o campo já tiver número diferente, vira alerta ⚠️.
 * 5. Idempotência por lote e por linha (hash único apolice+parcela+data+valor).
 */

import pb from '@/lib/pocketbase/client'
import { ExtratoLinhaCanonica, ExtratoParseResult } from './extrato-types'
import { Policy, ComissaoPrevista, ComissaoRecebimento } from '@/types'
import { createComissaoRecebimento } from '../comissao-recebimentos'
import { criarSistemaAlerta } from './sistema-alertas'

export type FilaStatus = 'APROVADO' | 'DIVERGENTE' | 'SEM_PREVISAO' | 'JA_BAIXADO' | 'IGNORADO'

export interface LinhaConferida {
  linha: ExtratoLinhaCanonica
  fila: FilaStatus
  motivoFila: string
  // Vínculos encontrados
  policyCorrespondente?: Policy
  previsaoCorrespondente?: ComissaoPrevista
  recebimentoDuplicado?: ComissaoRecebimento
  // Preenchimento de apólice
  propostaParaAtualizarApolice?: {
    policyId: string
    novoNumeroApolice: string
    atualNumeroApolice: string
    divergente?: boolean
  }
  // Idempotência
  idempotencyHash: string
  selecionadoParaBaixa: boolean
}

export interface ReconciliacaoExtratoLote {
  formato: string
  seguradoraNome: string
  arquivoNome: string
  totalLinhas: number
  filas: {
    aprovados: LinhaConferida[]
    divergentes: LinhaConferida[]
    semPrevisao: LinhaConferida[]
    jaBaixados: LinhaConferida[]
    ignorados: LinhaConferida[]
  }
  totais: {
    brutoAprovado: number
    liquidoAprovado: number
    brutoGeral: number
    liquidoGeral: number
  }
  checksum: {
    status: 'OK' | 'DIVERGENTE' | 'NAO_APLICAVEL'
    esperadoBruto?: number
    esperadoLiquido?: number
    calculadoBruto: number
    calculadoLiquido: number
  }
}

/**
 * Gera hash idempotente único por linha de extrato
 */
export function gerarIdempotencyHash(linha: ExtratoLinhaCanonica): string {
  const ref = (linha.numeroApolice || linha.numeroProposta || '').trim()
  const data = (linha.dataCredito || '').trim()
  const parc = linha.parcela || 1
  const val = Math.round((linha.liquidoPago || linha.comissaoBruta || 0) * 100)
  return `ext_${linha.seguradoraNome.replace(/\s+/g, '_')}_${ref}_p${parc}_d${data}_v${val}`
}

/**
 * Executa o cruzamento do extrato com o banco de dados
 */
export async function reconciliarExtratoComBanco(
  parseResult: ExtratoParseResult,
  nomeArquivo: string,
): Promise<ReconciliacaoExtratoLote> {
  // 1. Carregar apólices, previsões e recebimentos para conferência em memória
  const [policies, previsoes, recebimentos] = await Promise.all([
    pb.collection('policies').getFullList<Policy>({ expand: 'client,seguradora' }),
    pb.collection('comissoes_previstas').getFullList<ComissaoPrevista>({ expand: 'policy' }),
    pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>(),
  ])

  // Mapas para busca rápida
  const policyByApolice = new Map<string, Policy>()
  const policyByProposta = new Map<string, Policy>()

  for (const p of policies) {
    if (p.policy_number && p.policy_number.trim()) {
      const numClean = p.policy_number.replace(/\D/g, '')
      if (numClean) policyByApolice.set(numClean, p)
      policyByApolice.set(p.policy_number.trim(), p)
    }
    if (p.numero_proposta && p.numero_proposta.trim()) {
      const propClean = p.numero_proposta.replace(/\D/g, '')
      if (propClean) policyByProposta.set(propClean, p)
      policyByProposta.set(p.numero_proposta.trim(), p)
    }
  }

  // Mapa de recebimentos por chave de duplicidade (policy + parcela + data + valor_bruto)
  const recebimentosJaBaixadosSet = new Set<string>()
  for (const r of recebimentos) {
    if (r.idempotency_key) {
      recebimentosJaBaixadosSet.add(r.idempotency_key)
    }
    const valKey = `${r.policy}_${r.parcela || 1}_${r.data_recebimento?.substring(0, 10)}_${Math.round(r.valor_bruto * 100)}`
    recebimentosJaBaixadosSet.add(valKey)
  }

  const aprovados: LinhaConferida[] = []
  const divergentes: LinhaConferida[] = []
  const semPrevisao: LinhaConferida[] = []
  const jaBaixados: LinhaConferida[] = []
  const ignorados: LinhaConferida[] = []

  let brutoAprovado = 0
  let liquidoAprovado = 0
  let brutoGeral = 0
  let liquidoGeral = 0

  // Processar linhas informativas
  for (const info of parseResult.linhasInformativasIgnoradas) {
    ignorados.push({
      linha: info,
      fila: 'IGNORADO',
      motivoFila: info.motivoInformativo || 'Linha informativa ou valor zerado',
      idempotencyHash: gerarIdempotencyHash(info),
      selecionadoParaBaixa: false,
    })
  }

  // Processar linhas válidas
  for (const linha of parseResult.linhasValidasParaBaixa) {
    const hash = gerarIdempotencyHash(linha)
    brutoGeral += linha.comissaoBruta
    liquidoGeral += linha.liquidoPago

    // 1. Procurar apólice correspondente por número de apólice ou proposta
    let targetPolicy: Policy | undefined
    const apoliceNumClean = linha.numeroApolice ? linha.numeroApolice.replace(/\D/g, '') : ''
    const propostaNumClean = linha.numeroProposta ? linha.numeroProposta.replace(/\D/g, '') : ''

    if (linha.numeroApolice && policyByApolice.has(linha.numeroApolice)) {
      targetPolicy = policyByApolice.get(linha.numeroApolice)
    } else if (apoliceNumClean && policyByApolice.has(apoliceNumClean)) {
      targetPolicy = policyByApolice.get(apoliceNumClean)
    } else if (linha.numeroProposta && policyByProposta.has(linha.numeroProposta)) {
      targetPolicy = policyByProposta.get(linha.numeroProposta)
    } else if (propostaNumClean && policyByProposta.has(propostaNumClean)) {
      targetPolicy = policyByProposta.get(propostaNumClean)
    }

    // Se encontrou a apólice mas pelo mapa proposta->apólice o extrato traz número de apólice novo
    let propostaAtualizacao: LinhaConferida['propostaParaAtualizarApolice'] = undefined
    if (targetPolicy && linha.numeroApolice && linha.numeroApolice.trim()) {
      const atual = (targetPolicy.policy_number || '').trim()
      const novo = linha.numeroApolice.trim()
      if (!atual || atual === '-' || atual === targetPolicy.numero_proposta) {
        // Campo vazio aguardando emissão: preenchimento automático desejado
        propostaAtualizacao = {
          policyId: targetPolicy.id,
          novoNumeroApolice: novo,
          atualNumeroApolice: atual,
          divergente: false,
        }
      } else if (atual !== novo && atual.replace(/\D/g, '') !== novo.replace(/\D/g, '')) {
        // Já tem número e é diferente: alerta de divergência
        propostaAtualizacao = {
          policyId: targetPolicy.id,
          novoNumeroApolice: novo,
          atualNumeroApolice: atual,
          divergente: true,
        }
      }
    }

    // 2. Verificar se já foi baixado anteriormente (idempotência e duplicidade)
    const duplKey = targetPolicy
      ? `${targetPolicy.id}_${linha.parcela}_${linha.dataCredito}_${Math.round(linha.comissaoBruta * 100)}`
      : ''
    const isJaBaixado =
      recebimentosJaBaixadosSet.has(hash) || (duplKey && recebimentosJaBaixadosSet.has(duplKey))

    if (isJaBaixado) {
      const conferida: LinhaConferida = {
        linha,
        fila: 'JA_BAIXADO',
        motivoFila: 'Comissão já baixada anteriormente no sistema (duplicidade prevenida).',
        policyCorrespondente: targetPolicy,
        idempotencyHash: hash,
        selecionadoParaBaixa: false,
      }
      jaBaixados.push(conferida)
      continue
    }

    // 3. Se não achou apólice cadastrada -> FILA ❌ SEM PREVISÃO
    if (!targetPolicy) {
      const conferida: LinhaConferida = {
        linha,
        fila: 'SEM_PREVISAO',
        motivoFila: `Apólice/Proposta não cadastrada no sistema (${linha.numeroApolice || linha.numeroProposta || 'Sem número'}).`,
        idempotencyHash: hash,
        selecionadoParaBaixa: false,
      }
      semPrevisao.push(conferida)
      continue
    }

    // 4. Procurar previsão específica vinculada a esta apólice
    const previsoesDestaPolicy = previsoes.filter(
      (p) => p.policy === targetPolicy!.id && p.status !== 'Cancelada',
    )

    let targetPrevisao: ComissaoPrevista | undefined
    if (previsoesDestaPolicy.length > 0) {
      // Tentar casar por parcela_numero
      targetPrevisao = previsoesDestaPolicy.find((p) => p.parcela_numero === linha.parcela)
      // Se não achou por parcela e só tem 1 pendente
      if (!targetPrevisao && previsoesDestaPolicy.length === 1) {
        targetPrevisao = previsoesDestaPolicy[0]
      }
    }

    // 5. Conferência de Valores: Casamento Exato vs Divergente
    const valorEsperadoBruto = targetPrevisao
      ? Number(targetPrevisao.valor_previsto)
      : Number(targetPolicy.commission || 0)
    const diff = Math.abs(linha.comissaoBruta - valorEsperadoBruto)

    // Tolerância de centavos (0.05)
    const isCasamentoExato =
      diff <= 0.05 && (!propostaAtualizacao || !propostaAtualizacao.divergente)

    if (isCasamentoExato) {
      // ✅ APROVADO: Casamento 100% exato pré-aprovado
      const conferida: LinhaConferida = {
        linha,
        fila: 'APROVADO',
        motivoFila: 'Casamento 100% exato de contrato e valor.',
        policyCorrespondente: targetPolicy,
        previsaoCorrespondente: targetPrevisao,
        propostaParaAtualizarApolice: propostaAtualizacao,
        idempotencyHash: hash,
        selecionadoParaBaixa: true,
      }
      aprovados.push(conferida)
      brutoAprovado += linha.comissaoBruta
      liquidoAprovado += linha.liquidoPago
    } else {
      // ⚠️ DIVERGENTE: Valor diferente, saldo parcial ou parcela inesperada
      let motivo = `Valor previsto R$ ${valorEsperadoBruto.toFixed(2)} difere do extrato R$ ${linha.comissaoBruta.toFixed(2)}.`
      if (propostaAtualizacao?.divergente) {
        motivo += ` Nº de apólice diverge: atual "${propostaAtualizacao.atualNumeroApolice}" vs extrato "${propostaAtualizacao.novoNumeroApolice}".`
      }
      const conferida: LinhaConferida = {
        linha,
        fila: 'DIVERGENTE',
        motivoFila: motivo,
        policyCorrespondente: targetPolicy,
        previsaoCorrespondente: targetPrevisao,
        propostaParaAtualizarApolice: propostaAtualizacao,
        idempotencyHash: hash,
        selecionadoParaBaixa: false, // exige decisão explícita do usuário
      }
      divergentes.push(conferida)
    }
  }

  // 6. Conferência de Checksum (quando o extrato traz rodapé ou total consolidado)
  let checksumStatus: 'OK' | 'DIVERGENTE' | 'NAO_APLICAVEL' = 'NAO_APLICAVEL'
  const exp = parseResult.checksumEsperado
  if (exp && (exp.totalLiquido || exp.totalBruto)) {
    const diffBruto = exp.totalBruto ? Math.abs(exp.totalBruto - brutoGeral) : 0
    const diffLiquido = exp.totalLiquido ? Math.abs(exp.totalLiquido - liquidoGeral) : 0
    if (diffBruto < 0.1 && diffLiquido < 0.1) {
      checksumStatus = 'OK'
    } else {
      checksumStatus = 'DIVERGENTE'
      // Registrar alerta de checksum divergente
      criarSistemaAlerta({
        modulo: 'EXTRATO',
        tipo: 'CHECKSUM_DIVERGENTE',
        nivel: 'ALERTA',
        titulo: `Divergência de Checksum no Extrato: ${parseResult.seguradoraNomeSugerida}`,
        motivo: `A soma das linhas analíticas (R$ ${liquidoGeral.toFixed(2)}) não bate com o rodapé/total do arquivo (R$ ${(exp.totalLiquido || exp.totalBruto || 0).toFixed(2)}).`,
        acao_sugerida:
          'Verifique se há linhas adicionais, taxas bancárias ou descontos no arquivo.',
        detalhes_json: { esperado: exp, calculado: { brutoGeral, liquidoGeral } },
      })
    }
  }

  return {
    formato: parseResult.formato,
    seguradoraNome: parseResult.seguradoraNomeSugerida,
    arquivoNome: nomeArquivo,
    totalLinhas: parseResult.totalLinhasArquivo,
    filas: {
      aprovados,
      divergentes,
      semPrevisao,
      jaBaixados,
      ignorados,
    },
    totais: {
      brutoAprovado: Math.round(brutoAprovado * 100) / 100,
      liquidoAprovado: Math.round(liquidoAprovado * 100) / 100,
      brutoGeral: Math.round(brutoGeral * 100) / 100,
      liquidoGeral: Math.round(liquidoGeral * 100) / 100,
    },
    checksum: {
      status: checksumStatus,
      esperadoBruto: exp?.totalBruto,
      esperadoLiquido: exp?.totalLiquido,
      calculadoBruto: Math.round(brutoGeral * 100) / 100,
      calculadoLiquido: Math.round(liquidoGeral * 100) / 100,
    },
  }
}

/**
 * Confirma a Baixa em Lote das linhas selecionadas.
 * - Passa OBRIGATORIAMENTE pela rotina transacional existente `createComissaoRecebimento`.
 * - Atualiza o número de apólice em registros existentes que estavam aguardando emissão.
 * - Registra lote na coleção `import_lots` e guarda o arquivo original para auditoria.
 */
export async function executarBaixaEmLote(
  lote: ReconciliacaoExtratoLote,
  linhasParaBaixar: LinhaConferida[],
  arquivoOriginal?: File,
): Promise<{
  sucessos: number
  falhas: Array<{ linhaId: string; erro: string }>
  apolicesAtualizadas: number
  loteId?: string
}> {
  const user = pb.authStore.record
  const userTag = user?.name || user?.email || 'Sistema'

  let loteRecordId = ''

  // 1. Criar o registro de lote na coleção import_lots
  try {
    const formData = new FormData()
    formData.append('tipo', 'EXTRATO_COMISSAO')
    formData.append('nome_arquivo', lote.arquivoNome)
    formData.append('formato_seguradora', lote.formato)
    formData.append('seguradora_id', lote.seguradoraNome)
    formData.append('total_linhas', String(lote.totalLinhas))
    formData.append('total_sucesso', '0')
    formData.append('total_divergencias', String(lote.filas.divergentes.length))
    formData.append('total_sem_previsao', String(lote.filas.semPrevisao.length))
    formData.append('total_bruto', String(lote.totais.brutoGeral))
    formData.append('total_liquido', String(lote.totais.liquidoGeral))
    formData.append('checksum_status', lote.checksum.status)
    formData.append('usuario_id', user?.id || '')
    formData.append('usuario_nome', userTag)
    formData.append(
      'detalhes_json',
      JSON.stringify({
        totais: lote.totais,
        checksum: lote.checksum,
      }),
    )

    if (arquivoOriginal) {
      formData.append('arquivo', arquivoOriginal)
    }

    const recLote = await pb.collection('import_lots').create(formData)
    loteRecordId = recLote.id
  } catch (err) {
    console.warn('Aviso: erro ao criar lote em import_lots (continua a baixa):', err)
  }

  let sucessos = 0
  let apolicesAtualizadas = 0
  const falhas: Array<{ linhaId: string; erro: string }> = []

  // 2. Processar cada linha individualmente via createComissaoRecebimento
  for (const item of linhasParaBaixar) {
    const p = item.policyCorrespondente
    if (!p) {
      falhas.push({
        linhaId: item.linha.id,
        erro: 'Apólice não identificada para realizar a baixa.',
      })
      continue
    }

    try {
      // A. Se tem atualização de apólice pendente (preenchimento do número que estava em branco)
      if (item.propostaParaAtualizarApolice && !item.propostaParaAtualizarApolice.divergente) {
        const novoNum = item.propostaParaAtualizarApolice.novoNumeroApolice
        try {
          await pb.collection('policies').update(p.id, {
            policy_number: novoNum,
            notes: (p.notes || '').trim()
              ? `${p.notes}\n[Nº Apólice preenchido via extrato ${lote.seguradoraNome} em ${new Date().toLocaleDateString('pt-BR')}]`
              : `[Nº Apólice preenchido via extrato ${lote.seguradoraNome} em ${new Date().toLocaleDateString('pt-BR')}]`,
          })
          apolicesAtualizadas++
        } catch (errUp) {
          console.warn('Erro ao atualizar número de apólice em aberto:', errUp)
        }
      }

      // B. Executar baixa pela rotina oficial do projeto
      const rec = await createComissaoRecebimento({
        policy: p.id,
        data_recebimento: item.linha.dataCredito,
        valor_bruto: item.linha.comissaoBruta,
        descontos_impostos: item.linha.impostos || 0,
        valor_liquido: item.linha.liquidoPago,
        origem: `Extrato ${lote.seguradoraNome}`,
        observacao: `[Baixa Automática Extrato] Ref: ${item.linha.numeroExtrato || lote.arquivoNome} | Parcela ${item.linha.parcela}`,
        parcela: item.linha.parcela,
        comissao_prevista: item.previsaoCorrespondente?.id,
        idempotency_key: item.idempotencyHash,
      })

      sucessos++

      // C. Registrar linha em import_rows para histórico
      if (loteRecordId) {
        try {
          await pb.collection('import_rows').create({
            lote: loteRecordId,
            seguradora_nome: lote.seguradoraNome,
            numero_extrato: item.linha.numeroExtrato,
            tipo_referencia: item.linha.tipoReferencia,
            numero_apolice: item.linha.numeroApolice,
            numero_proposta: item.linha.numeroProposta,
            endosso: item.linha.endosso,
            parcela: item.linha.parcela,
            data_credito: item.linha.dataCredito,
            premio_liquido: item.linha.premioLiquido,
            comissao_bruta: item.linha.comissaoBruta,
            impostos: item.linha.impostos,
            liquido_pago: item.linha.liquidoPago,
            percentual_comissao: item.linha.percentualComissao,
            segurado_nome: item.linha.seguradoNome,
            fila: item.fila,
            motivo_fila: item.motivoFila,
            policy_id: p.id,
            comissao_prevista_id: item.previsaoCorrespondente?.id || '',
            recebimento_id: rec.id,
            baixado: true,
            idempotency_hash: item.idempotencyHash,
          })
        } catch {
          /* intentionally ignored */
        }
      }
    } catch (err: any) {
      falhas.push({
        linhaId: item.linha.id,
        erro: err?.message || 'Erro ao processar baixa transacional',
      })
    }
  }

  // 3. Atualizar contador no lote
  if (loteRecordId) {
    try {
      await pb.collection('import_lots').update(loteRecordId, {
        total_sucesso: sucessos,
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return {
    sucessos,
    falhas,
    apolicesAtualizadas,
    loteId: loteRecordId || undefined,
  }
}
