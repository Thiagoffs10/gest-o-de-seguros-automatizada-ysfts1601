/**
 * Parsers Determinísticos dos 6 formatos de Proposta em PDF:
 * 1. Porto Seguro ("portoproposta...")
 * 2. Allianz ("proposta-26-e1302.pdf") -> NÃO traz nascimento
 * 3. HDI ("proposta-26-b74f6.pdf")
 * 4. Yelum ("proposta-26-5607d.pdf") -> Atenção para parcelamento "1+11" (12x)
 * 5. MAPFRE ("proposta-26-4fc05.pdf")
 * 6. Bradesco ("proposta-25-6a3a0.pdf") -> Segurado vs Condutor (ex: Ana Delia segurado, José Alberto condutor)
 *
 * Todos trazem: nº proposta, segurado, condutor separado, veículo, vigências, prêmios,
 * renovação com apólice/seguradora anterior e apólice vazia ("-").
 */

import {
  PropostaClienteExtraido,
  PropostaCondutorExtraido,
  PropostaExtraida,
  PropostaRenovacaoExtraida,
  PropostaVeiculoExtraido,
  SeguradoraPropostaFormato,
} from './proposta-types'
import { parseDataFlexivel, parseMoeda } from './extrato-types'
import { isValidCpf } from '@/lib/document-validators'
import { BRAZILIAN_STATES } from '@/lib/constants'

/**
 * Sanitiza valores de texto extraídos de PDFs (remove artefatos como '|', barras repetidas,
 * colapsa quebras de linha e múltiplos espaços, e executa trim).
 */
/**
 * Termos negativos que caracterizam seções de risco, coberturas, perfil de pernoite,
 * dados da corretora ou termos institucionais. Qualquer ocorrência de CEP cujo contexto
 * (linhas vizinhas ou células adjacentes) contenha esses termos deve ser descartada como endereço do segurado!
 */
export const TERMOS_NEGATIVOS_ENDERECO = [
  'pernoite',
  'cep de pernoite',
  'dispositivos',
  'antifurto',
  'anti-roubo',
  'anti furto',
  'antiroubo',
  'compreensiva',
  'colisão',
  'colisao',
  'incêndio',
  'incendio',
  'roubo',
  'furto',
  'corretor',
  'corretora',
  'susep',
  'participação',
  'participacao',
  'líder',
  'lider',
  'uso interno',
  'questionário',
  'questionario',
  'avaliação de risco',
  'avaliacao de risco',
  'coberturas',
  'franquia',
  'lmi',
  'rcf-v',
  'danos materiais',
  'danos corporais',
  'custos de defesa',
  'tipo de uso',
  'particular',
  'orçamento',
  'orcamento',
  'versão',
  'versao',
  'oferta',
  'proposta',
  'apólice',
  'apolice',
  'status',
  'vigência',
  'vigencia',
  '24h',
  'das 24h',
]

export function contemTermoNegativoEndereco(str?: string | null): boolean {
  if (!str) return false
  const s = str.toLowerCase()
  return TERMOS_NEGATIVOS_ENDERECO.some((termo) => s.includes(termo))
}

// Cabeçalhos de seções, rótulos de campos, textos de privacidade ou ruídos conhecidos que NUNCA devem ser aceitos como valores (ex: em cidade/bairro/rua/nome)
const VALORES_INVALIDOS_OU_CABECALHOS = [
  'de dados pessoais',
  'dados pessoais',
  'privacidade de dados pessoais',
  'privacidade de dados',
  'processo susep',
  'assinatura do proponente',
  'assinatura do corretor',
  'declaração do proponente',
  'declaração do corretor',
  'informações complementares',
  'informações de pagamento',
  'informações do seguro',
  'informações da renovação',
  'oficinas referenciadas',
  'coberturas',
  'assistência 24h',
  'assistência residencial',
  'oferta escolhida',
  'nascimento',
  'data de nascimento',
  'cpf',
  'cnpj',
  'dados gerais',
  'dados da cotação',
  'canais de atendimento',
  'questionário de avaliação de risco',
  'coberturas e serviços automóvel',
  'segurado(a)',
  'segurado',
  'proponente',
  'condutor(a)',
  'condutor',
  'endereço residencial',
  'endereço',
  'complemento',
  'veículo',
  'cidade',
  'bairro',
  'uf',
  'estado',
  'cep',
  'sexo',
  'profissão',
  'país de nascimento',
  'tipo de operação',
  'segmento',
  'bônus',
  'origem do bônus',
  'sucursal',
  'apólice',
  'item',
  'tipo de envio',
  'enviar correspondência para',
  'cotação',
  'cotacao',
  'kit digital',
  'cotação nº',
  'cotacao nº',
  'período de vigência',
  'periodo de vigencia',
  'período de vigência ( 365 dias)',
  'periodo de vigencia ( 365 dias)',
]

export function isTextoCabecalhoOuInvalido(val?: string | null): boolean {
  if (!val) return true
  const v = val
    .trim()
    .toLowerCase()
    .replace(/[*_#:|-]/g, '')
    .trim()
  if (v.length < 2) return true
  return VALORES_INVALIDOS_OU_CABECALHOS.some((termo) => v === termo || v.startsWith(termo))
}

/**
 * Validador estrito para nomes de pessoa física (segurado e condutor).
 * Descarta:
 * - Nomes de marcas, seguradoras e produtos (Azul, Azul Tradicional, Porto Seguro, Porto Bank, etc.)
 * - Termos de produtos/coberturas/serviços (Seguros, Seguradora, Tradicional, Compreensiva, etc.)
 * - Menções a corretores ou órgãos reguladores
 */
export function isNomePessoaValido(val?: string | null): boolean {
  if (!val) return false
  const clean = sanitizarTextoExtraido(val)
  if (clean.length < 3 || clean.length > 100) return false
  if (isTextoCabecalhoOuInvalido(clean)) return false

  const lower = clean.toLowerCase()

  // Marcas e seguradoras conhecidas
  const marcasProibidas = [
    'azul',
    'azul tradicional',
    'azul seguros',
    'porto seguro',
    'porto bank',
    'allianz',
    'bradesco',
    'hdi',
    'mapfre',
    'tokio',
    'tokio marine',
    'sompo',
    'yelum',
    'liberty',
    'itau',
    'itaú',
    'sulamerica',
    'sul américa',
    'santander',
    'caixa seguradora',
    'bb seguros',
    'banco do brasil',
  ]

  for (const marca of marcasProibidas) {
    if (lower === marca) return false
    // Se começa ou termina com a marca com limites de palavra
    if (new RegExp(`(?:^|\\b)${marca}(?:\\b|$)`, 'i').test(lower)) {
      // Exceção se for um nome próprio real de pessoa que contenha apenas por coincidência substring
      // Mas Azul Tradicional, Porto Seguro, etc. devem ser 100% rejeitados
      if (
        lower.includes('azul tradicional') ||
        lower.includes('azul seguro') ||
        lower.includes('porto seguro') ||
        lower.includes('porto bank') ||
        lower.includes('allianz') ||
        lower.includes('bradesco') ||
        lower.includes('hdi') ||
        lower.includes('mapfre') ||
        lower.includes('tokio') ||
        lower.includes('sompo') ||
        lower.includes('yelum') ||
        lower.includes('liberty') ||
        lower === 'azul'
      ) {
        return false
      }
    }
  }

  // Sufixos e termos de produto/empresa/cobertura
  if (
    /(?:seguros|seguradora|tradicional|compreensiva|ve[íi]culos?|corretora?|susep|assist[êe]ncia|cobertura|franquia|lider|líder|participa[çc][ãa]o|indadimplente|demonstrativo|question[áa]rio)\b/i.test(
      lower,
    )
  ) {
    return false
  }

  // Não pode conter termos de corretor ou uso interno
  if (lower.includes('corretor') || lower.includes('uso interno')) {
    return false
  }

  // Bloquear expressamente linhas de cotação / kits digitais / números de proposta
  if (
    /cota[çc][ãa]o|kit\s*digital/i.test(clean) ||
    /^\s*(?:cota[çc][ãa]o|proposta|ap[oó]lice|or[çc]amento)\b/i.test(clean)
  ) {
    return false
  }

  // Para ser nome de pessoa válido, deve conter ao menos letras e não apenas dígitos/símbolos
  const letrasOnly = clean.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letrasOnly.length < 3) return false

  return true
}

/**
 * Sanitiza valores de texto extraídos de PDFs:
 * - Remove artefatos como '|', barras repetidas, asteriscos duplos ou triplos ('**', '***')
 * - Remove pontuação espúria no início/fim (/,\,-,*)
 * - Colapsa quebras de linha, tabs e múltiplos espaços
 */
export function sanitizarTextoExtraido(val?: string | null): string {
  if (!val) return ''
  return (
    val
      // Colapsar quebras de linha e tabs em espaço
      .replace(/[\r\n\t]+/g, ' ')
      // Remover barras verticais e barras repetidas
      .replace(/\|+/g, ' ')
      // Remover asteriscos (ex: '** IRIS...', 'Cartão de Crédito*')
      .replace(/\*+/g, ' ')
      // Colapsar múltiplos espaços
      .replace(/\s+/g, ' ')
      // Limpeza de pontuação solta, barras, asteriscos, vírgulas residuais nas extremidades
      .replace(/^[\s|/\\,*_~-]+|[\s|/\\,*_~-]+$/g, '')
      .trim()
  )
}

/**
 * Detecta a seguradora a partir do texto extraído
 */
export function detectarFormatoProposta(
  text: string,
  nomeArquivo: string,
): SeguradoraPropostaFormato {
  const t = text.toLowerCase()
  const n = (nomeArquivo || '').toLowerCase()

  // HDI Seguros tem prioridade no início da cascata (evita casar com Porto Seguro citado como seguradora anterior)
  // Detecção por "HDI SEGUROS" / "Hdi Auto Perfil" / SUSEP 6572 / "hdi.com.br"
  if (
    n.includes('hdi') ||
    t.includes('hdi seguros') ||
    t.includes('hdi auto') ||
    t.includes('hdi auto perfil') ||
    t.includes('hdi seguros s.a.') ||
    t.includes('hdi seguros s.a. - 6572') ||
    (t.includes('6572') && t.includes('hdi')) ||
    t.includes('www.hdi.com.br') ||
    t.includes('pacote de servicos hdi') ||
    /\bhdi\b/i.test(t)
  ) {
    return 'HDI'
  }

  // Azul Seguros tem prioridade (mesmo quando emitida via Porto Seguro ou contendo menção a Porto)
  if (
    n.includes('azul') ||
    t.includes('azul tradicional') ||
    t.includes('azul seguros') ||
    t.includes('proposta de seguro auto / azul') ||
    t.includes('proposta de seguro auto\nazul tradicional') ||
    (t.includes('azul') && t.includes('porto seguro'))
  ) {
    return 'AZUL_SEGUROS'
  }

  if (
    n.includes('porto') ||
    t.includes('porto seguro') ||
    t.includes('porto seguro cia de seguros')
  ) {
    return 'PORTO_SEGURO'
  }
  if (n.includes('allianz') || t.includes('allianz seguros') || t.includes('allianz')) {
    return 'ALLIANZ'
  }
  if (
    n.includes('yelum') ||
    t.includes('yelum seguradora') ||
    t.includes('yelum') ||
    t.includes('liberty')
  ) {
    return 'YELUM'
  }
  if (n.includes('mapfre') || t.includes('mapfre seguros') || t.includes('mapfre')) {
    return 'MAPFRE'
  }
  if (n.includes('bradesco') || t.includes('bradesco seguros') || t.includes('bradesco auto')) {
    return 'BRADESCO'
  }

  return 'GENERICA'
}

/**
 * Extrai proposta do texto estruturado
 */
export function parsePropostaTexto(text: string, nomeArquivo: string = ''): PropostaExtraida {
  const formato = detectarFormatoProposta(text, nomeArquivo)

  // Mapeamento de nome oficial da seguradora
  const nomesMap: Record<SeguradoraPropostaFormato, string> = {
    PORTO_SEGURO: 'Porto Seguro',
    AZUL_SEGUROS: 'Azul Seguros',
    ALLIANZ: 'Allianz',
    HDI: 'HDI Seguros',
    YELUM: 'Yelum',
    MAPFRE: 'Mapfre',
    BRADESCO: 'Bradesco',
    GENERICA: 'Seguradora',
  }

  const seguradoraNome = nomesMap[formato]

  // DESPACHO DEDICADO: PORTO CELULAR (Ramo 171 / Modalidade 434)
  // Ativado quando identificado produto Porto Celular, evitando totalmente o leitor de Auto da Porto
  if (isPortoCelular(text, nomeArquivo)) {
    const celularData = extrairPortoCelularProposta(text)
    if (celularData) {
      return celularData
    }
  }

  // Extrações comuns por Regex
  let numeroProposta = extrairNumeroProposta(text, formato)
  let numeroApolice = ''
  let vigencias = extrairVigencias(text)
  let premios = extrairPremios(text)
  let parcelamento = extrairParcelamento(text, formato)
  let tipoSeguro = extrairTipoSeguro(text)
  let veiculo = extrairVeiculo(text)
  let segurado = extrairSegurado(text, formato)
  let condutor = extrairCondutor(text, segurado.nome, segurado.cpfCnpj)
  let renovacao = extrairRenovacao(text)

  // CASCATA ESPECIALIZADA PARA ALLIANZ CONDOMÍNIO (Layout Novo / Direto)
  // Acionado quando o texto contém "allianz condomínio" E ("essa é a proposta do seu seguro" OU "suas informações")
  const tLower = text.toLowerCase()
  if (tLower.includes('allianz condomínio') || tLower.includes('allianz condominio')) {
    if (
      tLower.includes('essa é a proposta do seu seguro') ||
      tLower.includes('essa e a proposta do seu seguro') ||
      tLower.includes('suas informações') ||
      tLower.includes('suas informacoes')
    ) {
      const allianzCond = extrairAllianzCondominioCliente(text)
      if (allianzCond) {
        tipoSeguro = 'Condomínio'
        if (allianzCond.numeroProposta) {
          numeroProposta = allianzCond.numeroProposta
        }
        if (allianzCond.numeroApolice) {
          numeroApolice = allianzCond.numeroApolice
        }
        if (allianzCond.vigenciaInicio && allianzCond.vigenciaFim) {
          vigencias = {
            inicio: allianzCond.vigenciaInicio,
            fim: allianzCond.vigenciaFim,
          }
        }
        if (allianzCond.segurado) {
          segurado = {
            ...segurado,
            ...allianzCond.segurado,
          }
        }
        // Condomínio não tem condutor nem veículo
        condutor = {
          nome: '',
          cpf: undefined,
          dataNascimento: undefined,
          parentesco: undefined,
          mesmoQueSegurado: false,
        }
        veiculo = {
          marcaModelo: '',
          placa: '',
          chassi: '',
          codigoFipe: '',
          anoFabricacao: undefined,
          anoModelo: undefined,
        }
      }
    }
  }

  // CASCATA ESPECIALIZADA PARA HDI SEGUROS AUTO
  if (formato === 'HDI') {
    const hdiData = extrairPropostaHDI(text)
    if (hdiData) {
      if (hdiData.numeroProposta) numeroProposta = hdiData.numeroProposta
      if (hdiData.numeroApolice !== undefined) numeroApolice = hdiData.numeroApolice
      if (hdiData.tipoSeguro) tipoSeguro = hdiData.tipoSeguro
      if (hdiData.vigenciaInicio && hdiData.vigenciaFim) {
        vigencias = { inicio: hdiData.vigenciaInicio, fim: hdiData.vigenciaFim }
      }
      if (hdiData.premioLiquido !== undefined) {
        premios.liquido = hdiData.premioLiquido
      }
      if (hdiData.iof !== undefined) {
        premios.iof = hdiData.iof
      }
      if (hdiData.premioTotal !== undefined) {
        premios.total = hdiData.premioTotal
      }
      if (hdiData.quantidadeParcelas !== undefined) {
        parcelamento.parcelas = hdiData.quantidadeParcelas
      }
      if (hdiData.formaPagamento) {
        parcelamento.forma = hdiData.formaPagamento
      }
      if (hdiData.parcelamentoDescricao) {
        parcelamento.descricao = hdiData.parcelamentoDescricao
      }
      if (hdiData.segurado) {
        segurado = { ...segurado, ...hdiData.segurado }
      }
      if (hdiData.condutorPrincipal) {
        condutor = { ...condutor, ...hdiData.condutorPrincipal }
      }
      if (hdiData.veiculo) {
        veiculo = { ...veiculo, ...hdiData.veiculo }
      }
      if (hdiData.renovacao) {
        renovacao = { ...renovacao, ...hdiData.renovacao }
      }
    }
  }

  // CASCATA ESPECIALIZADA PARA MAPFRE AUTO
  if (formato === 'MAPFRE') {
    const mapfreData = extrairPropostaMapfre(text)
    if (mapfreData) {
      if (mapfreData.numeroProposta) numeroProposta = mapfreData.numeroProposta
      if (mapfreData.numeroApolice !== undefined) numeroApolice = mapfreData.numeroApolice
      if (mapfreData.tipoSeguro) tipoSeguro = mapfreData.tipoSeguro
      if (mapfreData.vigenciaInicio && mapfreData.vigenciaFim) {
        vigencias = { inicio: mapfreData.vigenciaInicio, fim: mapfreData.vigenciaFim }
      }
      if (mapfreData.premioLiquido !== undefined) {
        premios.liquido = mapfreData.premioLiquido
      }
      if (mapfreData.iof !== undefined) {
        premios.iof = mapfreData.iof
      }
      if (mapfreData.premioTotal !== undefined) {
        premios.total = mapfreData.premioTotal
      }
      if (mapfreData.quantidadeParcelas !== undefined) {
        parcelamento.parcelas = mapfreData.quantidadeParcelas
      }
      if (mapfreData.formaPagamento) {
        parcelamento.forma = mapfreData.formaPagamento
      }
      if (mapfreData.parcelamentoDescricao) {
        parcelamento.descricao = mapfreData.parcelamentoDescricao
      }
      if (mapfreData.segurado) {
        segurado = { ...segurado, ...mapfreData.segurado }
      }
      if (mapfreData.condutorPrincipal) {
        condutor = { ...condutor, ...mapfreData.condutorPrincipal }
      }
      if (mapfreData.veiculo) {
        veiculo = { ...veiculo, ...mapfreData.veiculo }
      }
      if (mapfreData.renovacao) {
        renovacao = { ...renovacao, ...mapfreData.renovacao }
      }
    }
  }

  // CASCATA ESPECIALIZADA PARA AZUL SEGUROS / PORTO SEGURO (Leitor Inline de grupos em negrito)
  // Ativado quando o markdown real vem com seções em uma única linha com rótulos em negrito emendados
  if (formato === 'AZUL_SEGUROS' || formato === 'PORTO_SEGURO') {
    const inlineData = extrairPropostaInlineAzul(text)
    if (inlineData) {
      // 1. Segurado inline (se identificou nome válido)
      if (inlineData.segurado) {
        segurado = {
          ...segurado,
          nome: inlineData.segurado.nome || segurado.nome,
          dataNascimento: inlineData.segurado.dataNascimento || segurado.dataNascimento,
          cpfCnpj: inlineData.segurado.cpfCnpj || segurado.cpfCnpj,
          tipoPessoa: inlineData.segurado.tipoPessoa || segurado.tipoPessoa,
          rua: inlineData.segurado.rua || segurado.rua,
          numero: inlineData.segurado.numero || segurado.numero,
          cep: inlineData.segurado.cep || segurado.cep,
          bairro: inlineData.segurado.bairro || segurado.bairro,
          cidade: inlineData.segurado.cidade || segurado.cidade,
          estado: inlineData.segurado.estado || segurado.estado,
          email: inlineData.segurado.email || segurado.email,
          telefone: inlineData.segurado.telefone || segurado.telefone,
        }
      }

      // 2. Condutor inline (se identificou nome válido)
      if (inlineData.condutor && inlineData.condutor.nome) {
        condutor = {
          ...condutor,
          nome: inlineData.condutor.nome,
          cpf: inlineData.condutor.cpf || condutor.cpf,
          dataNascimento: inlineData.condutor.dataNascimento || condutor.dataNascimento,
          mesmoQueSegurado: inlineData.condutor.mesmoQueSegurado,
        }
      }

      // 3. Veículo inline (se identificou marcaModelo sem vazamento de rótulos/profissão)
      if (inlineData.veiculo) {
        veiculo = {
          ...veiculo,
          marcaModelo: inlineData.veiculo.marcaModelo || veiculo.marcaModelo,
          placa: inlineData.veiculo.placa || veiculo.placa,
          chassi: inlineData.veiculo.chassi || veiculo.chassi,
          codigoFipe: inlineData.veiculo.codigoFipe || veiculo.codigoFipe,
          anoFabricacao: inlineData.veiculo.anoFabricacao || veiculo.anoFabricacao,
          anoModelo: inlineData.veiculo.anoModelo || veiculo.anoModelo,
        }
      }

      // 4. Renovação inline
      if (inlineData.renovacao) {
        renovacao = {
          ...renovacao,
          isRenovacao: inlineData.renovacao.isRenovacao,
          seguradoraAnterior:
            inlineData.renovacao.seguradoraAnterior || renovacao.seguradoraAnterior,
          apoliceAnterior: inlineData.renovacao.apoliceAnterior || renovacao.apoliceAnterior,
          classeBonus: inlineData.renovacao.classeBonus || renovacao.classeBonus,
        }
      }
    }
  }

  // Lista de campos faltantes obrigatórios para destaque no formulário
  const camposFaltantes: Array<{ campo: string; label: string; motivo: string }> = []

  // Seguro Condomínio é empresarial/PJ (não exige condutor nem veículo nem birth_date)
  if (tipoSeguro === 'Condomínio') {
    // Para Condomínio, nunca exigir condutor nem veículo
  }

  if (!segurado.dataNascimento && segurado.tipoPessoa === 'PF') {
    camposFaltantes.push({
      campo: 'birth_date',
      label: 'Data de Nascimento',
      motivo:
        formato === 'ALLIANZ'
          ? 'A Allianz não inclui a data de nascimento no PDF da proposta.'
          : 'Não identificada no documento da proposta.',
    })
  }

  if (!segurado.cpfCnpj) {
    camposFaltantes.push({
      campo: 'cpf',
      label: 'CPF / CNPJ do Segurado',
      motivo: 'Documento do segurado não localizado no PDF.',
    })
  }

  if (!segurado.telefone && !segurado.email) {
    camposFaltantes.push({
      campo: 'phone',
      label: 'Telefone ou Contato',
      motivo: 'Nenhum contato identificado no documento da proposta.',
    })
  }

  // Sanitizar todos os campos textuais do segurado
  const seguradoSanitizado: PropostaClienteExtraido = {
    ...segurado,
    nome: sanitizarTextoExtraido(segurado.nome)
      .replace(/^Nome[:\s]*/i, '')
      .replace(/^Segurado[:\s]*/i, '')
      .trim(),
    rua: sanitizarTextoExtraido(segurado.rua) || undefined,
    numero: sanitizarTextoExtraido(segurado.numero) || undefined,
    bairro: sanitizarTextoExtraido(segurado.bairro) || undefined,
    cidade: sanitizarTextoExtraido(segurado.cidade) || undefined,
    estado: sanitizarTextoExtraido(segurado.estado)?.toUpperCase() || undefined,
    cep: sanitizarTextoExtraido(segurado.cep) || undefined,
    email: sanitizarTextoExtraido(segurado.email) || undefined,
    telefone: sanitizarTextoExtraido(segurado.telefone) || undefined,
  }

  // Sanitizar condutor
  const condutorSanitizado: PropostaCondutorExtraido = {
    ...condutor,
    nome: sanitizarTextoExtraido(condutor.nome)
      .replace(/^Nome[:\s]*/i, '')
      .replace(/^Condutor[:\s]*/i, '')
      .trim(),
    parentesco: sanitizarTextoExtraido(condutor.parentesco) || undefined,
  }

  // Sanitizar veículo
  const veiculoSanitizado: PropostaVeiculoExtraido = {
    ...veiculo,
    marcaModelo: sanitizarTextoExtraido(veiculo.marcaModelo),
    placa: sanitizarTextoExtraido(veiculo.placa).toUpperCase(),
    chassi: sanitizarTextoExtraido(veiculo.chassi).toUpperCase(),
    codigoFipe: sanitizarTextoExtraido(veiculo.codigoFipe),
  }

  // Sanitizar renovação
  let apoliceAntLimpa = sanitizarTextoExtraido(renovacao.apoliceAnterior)
  if (apoliceAntLimpa && /^0+$/.test(apoliceAntLimpa)) {
    apoliceAntLimpa = ''
  }

  const renovacaoSanitizada: PropostaRenovacaoExtraida = {
    ...renovacao,
    apoliceAnterior: apoliceAntLimpa || undefined,
    seguradoraAnterior: sanitizarTextoExtraido(renovacao.seguradoraAnterior) || undefined,
    classeBonus: sanitizarTextoExtraido(renovacao.classeBonus) || undefined,
  }

  return {
    formato,
    seguradoraNome,
    numeroProposta: sanitizarTextoExtraido(numeroProposta),
    numeroApolice: sanitizarTextoExtraido(numeroApolice),
    tipoSeguro,
    vigenciaInicio: vigencias.inicio,
    vigenciaFim: vigencias.fim,
    premioLiquido: premios.liquido,
    iof: premios.iof,
    premioTotal: premios.total,
    formaPagamento: parcelamento.forma,
    quantidadeParcelas: parcelamento.parcelas,
    parcelamentoDescricao: sanitizarTextoExtraido(parcelamento.descricao),
    segurado: seguradoSanitizado,
    condutorPrincipal: condutorSanitizado,
    veiculo: veiculoSanitizado,
    renovacao: renovacaoSanitizada,
    camposFaltantes,
    textoBrutoOriginal: text.substring(0, 5000),
  }
}

// =========================================================================
// Funções Auxiliares Determinísticas de Extração
// =========================================================================

function extrairNumeroProposta(text: string, formato: SeguradoraPropostaFormato): string {
  // Caso específico Azul Seguros / Porto Seguro:
  // "Proposta / 03 14696320" ou "Proposta Apólice / 03 14696320" ou "Proposta\n12-31784355" / "Proposta 12-31784355"
  // Na Azul Tradicional:
  // "Orçamento 6320779928 Versão 0 Oferta 1 Proposta 12-31784355 Apólice 03 14696320"
  // Ou "Proposta Apólice / 03 14696320"
  if (formato === 'AZUL_SEGUROS' || formato === 'PORTO_SEGURO') {
    // 1. Procura se tem rótulo "Proposta" seguido diretamente de número (com ou sem hífen)
    // Cuidado com "Proposta de Seguro Auto" - não é o número
    // Padrão específico: "12-31784355" ou "Proposta\n12-31784355" ou "Proposta 12-31784355" ou "Versão 0 12-31784355 Proposta"
    const azulNumHifenMatch = /\b([0-9]{2}-[0-9]{6,10})\b/.exec(text)
    if (azulNumHifenMatch) {
      return azulNumHifenMatch[1]
    }

    const azulPropMatch =
      /(?:^|[|\n\s])proposta\s*(?:ap[oó]lice)?\s*[|:\s/]+([0-9]{2}[\s-]?[0-9]{6,10}|[0-9]{4,12})/i.exec(
        text,
      )
    if (azulPropMatch) {
      const clean = azulPropMatch[1].trim()
      if (clean.replace(/\D/g, '').length >= 6) {
        return clean
      }
    }
  }

  // Padrões comuns: "Proposta: 123456", "Nº da Proposta: 123456", "Proposta nº: 123456"
  const patterns = [
    /n[ºo.]?\s+da\s+proposta[*\s|:]+([0-9\-./\s]{4,20})/i,
    /n[ºo.]?\s+proposta[*\s|:]+([0-9\-./\s]{4,20})/i,
    /c[oó]digo\s+da\s+proposta[*\s|:]+([0-9\-./\s]{4,20})/i,
    // Proposta com número explícito, evitando casar com "Proposta de Seguro"
    /(?:^|[|\n])\s*proposta(?:\s+n[ºo.]|\s+número)?[*\s|:]+([0-9\-./\s]{4,20})/i,
  ]

  for (const regex of patterns) {
    const match = regex.exec(text)
    if (match) {
      const num = match[1].trim()
      const digits = num.replace(/\D/g, '')
      if (digits.length >= 4) return num
    }
  }

  // Fallback por formato específico
  if (formato === 'PORTO_SEGURO') {
    const p = /porto\s+proposta\s+([0-9]+)/i.exec(text)
    if (p) return p[1]
  }

  return ''
}

function extrairVigencias(text: string): { inicio: string; fim: string } {
  let inicio = ''
  let fim = ''

  // 1. Padrão com rótulo "Vigência" colado ou próximo (suporta formato Allianz "das 24H de DD/MM/AAAA às 24H de DD/MM/AAAA")
  const vigMatch =
    /(?:vig[êe]ncia[*\s|:]+)?(?:das?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:do?\s+dia\s+|de\s+))(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})(?:\s+at[ée]\s+(?:as?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:do?\s+dia\s+|de\s+))?|\s+[aààs]\s+(?:as?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:do?\s+dia\s+|de\s+))?|\s+ao?\s+dia\s+)(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    ) ||
    /vig[êe]ncia[:\s]+(?:das?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:do?\s+dia\s+|de\s+)?)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})(?:\s+at[ée]|\s+[aààs]\s+|\s+ao?\s+dia\s+)(?:das?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:do?\s+dia\s+|de\s+)?)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    )

  if (vigMatch) {
    inicio = parseDataFlexivel(vigMatch[1])
    fim = parseDataFlexivel(vigMatch[2])
  } else {
    // 2. Padrão tolerante a "Das 24h do dia/de X até/às as 24h do dia/de Y" mesmo sem rótulo colado
    const das24hMatch =
      /das?\s+24h(?:\s*00)?\s+(?:do\s+dia|de)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+(?:at[ée]|às|as)\s+as?\s*(?:24h(?:\s*00)?\s+(?:do\s+dia|de)\s+)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    if (das24hMatch) {
      inicio = parseDataFlexivel(das24hMatch[1])
      fim = parseDataFlexivel(das24hMatch[2])
    }
  }

  if (!inicio || !fim) {
    // Procura por "Início de vigência" e "Fim de vigência"
    const iniMatch =
      /(?:in[íi]cio\s+da?\s+vig[êe]ncia|vig[êe]ncia\s+in[íi]cio)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    const fimMatch =
      /(?:t[ée]rmino\s+da?\s+vig[êe]ncia|fim\s+da?\s+vig[êe]ncia|vig[êe]ncia\s+fim)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        text,
      )
    if (iniMatch) inicio = parseDataFlexivel(iniMatch[1])
    if (fimMatch) fim = parseDataFlexivel(fimMatch[1])
  }

  // Fallback se faltar fim (+1 ano)
  if (inicio && !fim) {
    const parts = inicio.split('-')
    const y = parseInt(parts[0], 10) + 1
    fim = `${y}-${parts[1]}-${parts[2]}`
  }

  return { inicio, fim }
}

function extrairPremios(text: string): { liquido: number; iof: number; total: number } {
  let liquido = 0
  let iof = 0
  let total = 0

  // 1. Procura na seção "Forma de pagamento" (Azul Seguros / Porto Seguro / Allianz)
  const infoPagSection =
    /(?:#+\s*|\*{0,2})(?:INFORMA[ÇC][ÕO]ES\s+DE\s+PAGAMENTO|Forma\s+de\s+pagamento)\*{0,2}[\s\S]*?(?=(?:DECLARA[ÇC][ÃA]O|OFICINAS|CL[ÁA]USULAS|QUESTION[ÁA]RIO|P[áa]gina|\n{3,}|$))/i.exec(
      text,
    )
  const pagText = infoPagSection ? infoPagSection[0] : ''

  if (pagText) {
    // Caso tabela da Azul / Porto Seguro:
    // "Forma de pagamento Valor líquido IOF Juros Encargos Parcelas Valor parcelas Valor total"
    // "97-Todas Cartão de Crédito Porto Bank (Existente)"
    // "R$ 1.486,42 R$ 109,70 R$ 0,00 R$ 0,00 R$ 1.596,121x R$ 1.596,12" (ou separado por quebras de linha)
    // Extraímos todos os valores monetários na seção
    const regexMoedas = /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g
    const matchesMoeda: number[] = []
    let m: RegExpExecArray | null
    while ((m = regexMoedas.exec(pagText)) !== null) {
      matchesMoeda.push(parseMoeda(m[1]))
    }

    if (matchesMoeda.length >= 3) {
      // Normalmente: [valorLiquido, iof, juros, encargos, ..., valorTotal]
      // Ex: [1486.42, 109.70, 0, 0, 1596.12, 1596.12]
      liquido = matchesMoeda[0]
      iof = matchesMoeda[1]
      total = matchesMoeda[matchesMoeda.length - 1]
    }

    if (!liquido) {
      const pagLiq =
        /(?:pre[çc]o\s+l[íi]quido|pr[êe]mio\s+l[íi]quido|valor\s+l[íi]quido)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
          pagText,
        )
      if (pagLiq) liquido = parseMoeda(pagLiq[1])
    }

    if (!iof) {
      const pagIof = /iof[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(pagText)
      if (pagIof) iof = parseMoeda(pagIof[1])
    }

    if (!total) {
      const pagTot =
        /(?:pre[çc]o\s+total|pr[êe]mio\s+total|total\s+a\s+pagar|valor\s+total)(?:\s*\([^)]*\))?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
          pagText,
        )
      if (pagTot) total = parseMoeda(pagTot[1])
    }
  }

  // 2. Se não encontrou na seção de pagamento, procura no texto global
  if (liquido === 0) {
    const liqMatch =
      /(?:pr[êe]mio|pre[çc]o)\s+l[íi]quido(?:\s+total)?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)
    if (liqMatch) liquido = parseMoeda(liqMatch[1])
  }

  if (iof === 0) {
    const iofMatch = /iof[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)
    if (iofMatch) iof = parseMoeda(iofMatch[1])
  }

  if (total === 0) {
    const totMatch =
      /(?:pr[êe]mio\s+total|pre[çc]o\s+total|valor\s+total\s+do\s+seguro|total\s+a\s+pagar)(?:\s*\([^)]*\))?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
        text,
      )
    if (totMatch) total = parseMoeda(totMatch[1])
  }

  // Se tem líquido e iof mas não tem total
  if (liquido > 0 && total === 0) {
    total = Math.round((liquido + iof) * 100) / 100
  }
  // Se tem total e líquido mas faltou iof
  if (total > 0 && liquido > 0 && iof === 0) {
    iof = Math.max(0, Math.round((total - liquido) * 100) / 100)
  }

  return { liquido, iof, total }
}

function extrairTipoSeguro(text: string): string {
  // 0. PRIORIDADE ABSOLUTA: Proposta de Seguro Auto ou dados explícitos de veículo (placa/chassi)
  // Devem cravar "Auto" ANTES de qualquer menção secundária a "Endereço residencial" ou "assistência residencial"!
  if (
    /proposta\s+de\s+seguro\s+auto|seguro\s+auto\b|\bauto\s+tradicional\b|\bcoberturas\s+e\s+serviços\s+automóvel\b/i.test(
      text,
    )
  ) {
    return 'Auto'
  }

  // Se houver dados de veículo evidentes (placa Mercosul ou antiga com rótulo, ou chassi com 17 chars), é Auto
  const temPlaca =
    /(?:placa[*\s|:/]+)\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/i.test(text) ||
    /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\s+placa\b/i.test(text)
  const temChassi =
    /(?:chassi[*\s|:/]+)\b([A-HJ-NPR-Z0-9]{17})\b/i.test(text) ||
    /\b([A-HJ-NPR-Z0-9]{17})\s+chassi\b/i.test(text)

  if (temPlaca && temChassi) {
    return 'Auto'
  }

  // 1. Procura por menção explícita de Ramo / Produto na proposta
  // Ex: "Produto | Ramo: 16 - Condomínio - Modalidade: Simples" ou "Ramo: 16 - Condomínio"
  const ramoMatch =
    /(?:produto\s*\|\s*)?ramo[:\s]+(?:[0-9]{1,4}\s*-\s*)?([A-Za-zÀ-ÿ\s]+?)(?:\s*-\s*modalidade|\s*\n|$)/i.exec(
      text,
    )
  if (ramoMatch) {
    const rawRamo = ramoMatch[1].trim().toLowerCase()
    if (rawRamo.includes('condom')) return 'Condomínio'
    if (rawRamo.includes('auto') || rawRamo.includes('ve[íi]cul')) return 'Auto'
    if (rawRamo.includes('residenc')) return 'Residencial'
    if (rawRamo.includes('vida')) return 'Vida'
    if (rawRamo.includes('empres')) return 'Empresarial'
    if (rawRamo.includes('sa[úu]de')) return 'Saúde'
    if (rawRamo.includes('viagem')) return 'Viagem'
  }

  // 2. Procura cabeçalhos como "Allianz Condomínio", "Seguro Condomínio"
  if (/allianz\s+condom[íi]nio|seguro\s+condom[íi]nio|\bcondom[íi]nio\b/i.test(text)) {
    // Só assume Condomínio se não for algo secundário (ex: "RC Condomínio" em coberturas)
    if (
      /allianz\s+condom[íi]nio|essa\s+[ée]\s+a\s+proposta\s+do\s+seu\s+seguro\s+allianz\s+condom[íi]nio|proposta\s+condom[íi]nio|ramo.*?condom[íi]nio/i.test(
        text,
      )
    ) {
      return 'Condomínio'
    }
  }

  // 3. Checagem estrita para Residencial: NÃO deve casar com "Endereço residencial" nem "Assistência residencial"
  // Deve haver menção a "Seguro Residencial", "Allianz Residencial", "Proposta Residencial", ou "Ramo Residencial"
  if (
    /seguro\s+residencial|allianz\s+residencial|proposta\s+residencial|ramo\s*[:\s]*residencial/i.test(
      text,
    ) &&
    !/condom[íi]nio/i.test(text) &&
    !temPlaca
  ) {
    return 'Residencial'
  }
  if (/vida|allianz\s+vida/i.test(text)) {
    return 'Vida'
  }
  if (/empresarial|allianz\s+empresa/i.test(text)) {
    return 'Empresarial'
  }

  // Padrão default continua sendo Auto
  return 'Auto'
}

function extrairParcelamento(
  text: string,
  formato: SeguradoraPropostaFormato,
): { forma: string; parcelas: number; descricao: string } {
  let forma = 'Boleto'
  let parcelas = 1
  let descricao = ''

  const textLower = text.toLowerCase()
  // Identificação de Boleto explícita antes de outros
  if (textLower.includes('boleto bancário') || textLower.includes('boleto')) {
    forma = 'Boleto'
  } else if (
    textLower.includes('cartão de crédito') ||
    textLower.includes('cartao de credito') ||
    textLower.includes('cartão') ||
    textLower.includes('cartao') ||
    textLower.includes('crédito')
  ) {
    forma = 'Crédito'
  } else if (
    textLower.includes('débito em conta') ||
    textLower.includes('debito em conta') ||
    textLower.includes('débito automático')
  ) {
    forma = 'Débito em conta'
  }

  // ATENÇÃO ESPECÍFICA: Yelum usa notação "1+11" (1 entrada + 11 parcelas = 12 parcelas)
  const yelumMatch = /(\d{1,2})\s*\+\s*(\d{1,2})/i.exec(text)
  if (yelumMatch) {
    const p1 = parseInt(yelumMatch[1], 10)
    const p2 = parseInt(yelumMatch[2], 10)
    parcelas = p1 + p2
    descricao = `${p1}+${p2} (${parcelas}x)`
  } else {
    // Padrão de cartão explícito: "10x Crédito-Demais Bandeiras" ou "10x Débito"
    // Captura: parcelas=10, forma="Crédito", valor da parcela de "Valor parcelas R$ 185,00"
    const cartaoTipoMatch = /(\d{1,2})x\s*(?:Cr[ée]dito|D[ée]bito)[^\n\r]*/i.exec(text)
    const vlrParcMatch =
      /(?:valor\s+(?:das?\s+)?parcelas?|vlr\s+parcela)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)

    if (cartaoTipoMatch) {
      parcelas = parseInt(cartaoTipoMatch[1], 10)
      if (/d[ée]bito/i.test(cartaoTipoMatch[0])) {
        forma = 'Débito em conta'
      } else {
        forma = 'Crédito'
      }
      const vlr = vlrParcMatch ? vlrParcMatch[1].trim() : ''
      if (vlr) {
        descricao = `${parcelas}x de R$ ${vlr} (${forma})`
      } else {
        descricao = `${parcelas}x (${forma})`
      }
    } else {
      // Procura "Nº. de Parcelas: 10" ou "Valor da Parcela: 233,50" ou "10 parcelas" ou "10x de R$ ..." ou "1x R$ 1.596,12"
      const numParcMatch = /n[ºo.]?\s+de\s+parcelas[*\s|:]+(\d{1,2})/i.exec(text)
      const parcMatch =
        numParcMatch ||
        /(\d{1,2})\s*x\s+R?\$?\s*([0-9.,]+)/i.exec(text) ||
        /(?:parcelas?|parcelamento)[*\s|:]+(\d{1,2})x?/i.exec(text) ||
        /(\d{1,2})\s*(?:x|vezes)\s+de\s+R?\$?/i.exec(text) ||
        /(\d{1,2})\s+parcelas\b/i.exec(text)

      if (parcMatch) {
        parcelas = parseInt(parcMatch[1], 10)
        const vlr = parcMatch[2] || (vlrParcMatch ? vlrParcMatch[1].trim() : '')
        if (vlr) {
          descricao = `${parcelas}x de R$ ${vlr.trim()}`
        } else {
          descricao = `${parcelas}x`
        }
      }
    }
  }

  return { forma, parcelas: parcelas || 1, descricao }
}

function extrairVeiculo(text: string): PropostaVeiculoExtraido {
  let marcaModelo = ''
  let placa = ''
  let chassi = ''
  let codigoFipe = ''
  let anoFab = 0
  let anoMod = 0

  // Placa: 3 letras + 4 números ou padrão Mercosul (3 letras + 1 num + 1 letra + 2 num)
  // Pode vir como "QSI2A04 Placa" ou "Placa: QSI2A04" ou "Placa | QSI2A04" ou "Placa\nQSI2A04"
  const placaMatch =
    /(?:placa[*\s|:/]+)?\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b(?:\s*placa)?/i.exec(text) ||
    /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\s+placa\b/i.exec(text)
  if (placaMatch) {
    placa = placaMatch[1].replace(/[-\s]/g, '').toUpperCase()
  }

  // Chassi: 17 caracteres alfanuméricos (excluindo I, O, Q)
  // Pode vir como "9BGEB48A0LG219020 Chassi" ou "Chassi: 9BGEB48A0LG219020"
  const chassiMatch =
    /(?:chassi[*\s|:/]+)?\b([A-HJ-NPR-Z0-9]{17})\b(?:\s*chassi)?/i.exec(text) ||
    /\b([A-HJ-NPR-Z0-9]{17})\s+chassi\b/i.exec(text)
  if (chassiMatch) {
    chassi = chassiMatch[1].toUpperCase()
  }

  // FIPE: 000000-0 ou código alfanumérico como "N45179 Fipe" ou "45179 N Fipe" ou "Fipe 45179" ou "Cód. FIPE: 005528-0"
  const fipeMatch =
    /(?:fipe|c[oó]digo\s+fipe|c[oó]d\.\s*fipe)[*\s|:]+([A-Za-z0-9-]{5,9})/i.exec(text) ||
    /\b([A-Za-z0-9-]{5,9})\s*(?:[A-Z]\s*)?fipe\b/i.exec(text) ||
    /\b([A-Za-z0-9-]{5,9})\s+fipe\b/i.exec(text)
  if (fipeMatch) {
    codigoFipe = fipeMatch[1].trim()
    // Código FIPE real sempre possui dígitos. Descarta palavras comuns (ex: 'divulgada')
    if (/^[A-Za-z]+$/.test(codigoFipe) || !/\d/.test(codigoFipe)) {
      codigoFipe = ''
    }
  }

  // Ano Fabricação / Modelo (ex: 2020 / 2020 Ano Fabricação / Modelo ou Ano/Modelo: 2022)
  const anoDuploMatch =
    /(?:ano(?:\s+fab(?:\.|\/mod)?)?[:\s]+)?\b(19\d{2}|20\d{2})\s*\/\s*(19\d{2}|20\d{2})\b/i.exec(
      text,
    )
  if (anoDuploMatch) {
    anoFab = parseInt(anoDuploMatch[1], 10)
    anoMod = parseInt(anoDuploMatch[2], 10)
  } else {
    const anoUnicoMatch = /(?:ano\/modelo|ano\s+modelo|ano)[:\s]+(19\d{2}|20\d{2})\b/i.exec(text)
    if (anoUnicoMatch) {
      anoMod = parseInt(anoUnicoMatch[1], 10)
      anoFab = anoMod
    }
  }

  // Termos inválidos para marca/modelo (fotos, inspeção, picasa, etc.)
  const isModeloValido = (m: string): boolean => {
    if (!m || m.length < 3 || m.length > 80) return false
    if (isTextoCabecalhoOuInvalido(m)) return false
    const lower = m.toLowerCase()
    if (
      lower.includes('picasa') ||
      lower.includes('inspeção') ||
      lower.includes('inspecao') ||
      lower.includes('vistoria') ||
      lower.includes('foto') ||
      lower.includes('fotografia') ||
      lower.includes('camera') ||
      lower.includes('câmera')
    ) {
      return false
    }
    return true
  }

  // Marca / Modelo:
  // 1. Prioridade máxima: Linha com código numérico Porto/Azul (\d{3,5}\s*-\s*-?\s*...)
  const azulCodigoMatch =
    /(?:^|[|\n\s])(?:\d{3,5}\s*-\s*-?\s*)([A-Z0-9\s.\-/+]{4,70})(?=(?:\s*[|*]?\s*(?:ve[íi]culo|produto|ano|placa|chassi|c[oó]d|vers[ãa]o|fipe)|\n|\||$))/i.exec(
      text,
    )
  if (azulCodigoMatch) {
    const clean = sanitizarTextoExtraido(azulCodigoMatch[1])
      .replace(/^\d{3,5}\s*-\s*-?\s*/, '')
      .trim()
    if (isModeloValido(clean)) {
      marcaModelo = clean
    }
  }

  // 2. Caso Marca/Modelo conhecido (ONIX, GOL, POLO, etc.)
  if (!marcaModelo) {
    const azulVeicMatch =
      /(?:ve[íi]culo[*\s|:/]+)?(?:\d{3,5}\s*-\s*-?\s*)?([A-Z0-9\s.\-/+]{4,60}?\b(?:ONIX|GOL|POLO|COROLLA|CIVIC|COMPASS|RENEGADE|CRETA|TRACKER|HB20|ARGO|MOBI|T-CROSS|NIVUS|KICKS|DUSTER|KWID|STRADA|TORO|HILUX|S10|RANGER|FIESTA|FOCUS|CRUZE|FIT|CITY|HR-V|WR-V|YARIS|ETIOS|SANDERO|LOGAN|CLIO|208|2008|C3|C4|TAOS|TIGUAN|SW4|BMW|AUDI|MERCEDES)[A-Z0-9\s.\-/+]*?)(?=(?:\s*[|*]?\s*(?:ve[íi]culo|produto|ano|placa|chassi|c[oó]d|vers[ãa]o|fipe)|\n|\||$))/i.exec(
        text,
      )

    if (azulVeicMatch) {
      let clean = sanitizarTextoExtraido(azulVeicMatch[1])
      clean = clean.replace(/^\d{3,5}\s*-\s*-?\s*/, '').trim()
      if (isModeloValido(clean)) {
        marcaModelo = clean
      }
    }
  }

  // 3. Fallback padrão Marca / Modelo
  if (!marcaModelo) {
    const modMatch =
      /(?:ve[íi]culo|modelo|marca\/modelo)[*\s|:]+([A-Za-z0-9\s.\-/+]+?)(?=(?:\s*[|*]?\s*(?:produto|ano|placa|chassi|c[oó]d|vers[ãa]o|fipe)|\n|\||$))/i.exec(
        text,
      )
    if (modMatch) {
      const rawMod = sanitizarTextoExtraido(modMatch[1])
        .replace(/^\d{3,5}\s*-\s*-?\s*/, '')
        .trim()
      if (isModeloValido(rawMod)) {
        marcaModelo = rawMod
      }
    }
  }

  return {
    marcaModelo,
    placa,
    chassi,
    codigoFipe,
    anoFabricacao: anoFab || undefined,
    anoModelo: anoMod || undefined,
  }
}

function parseTabelaGfmLinhas(
  headerRegex: RegExp,
  sourceText: string,
  callback: (headers: string[], values: string[]) => void,
) {
  const lines = sourceText.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine.includes('|')) continue
    if (!headerRegex.test(rawLine)) continue

    // Localizou cabeçalho. Próximas linhas: procurar divisor | --- | e depois primeira linha de dados
    let dividerFound = false
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim()
      if (!nextLine) {
        if (dividerFound) break
        continue
      }
      if (!nextLine.includes('|')) break

      // Linha de divisor: composta por |, -, :, e espaços (ex: | --- | :---: | --- |)
      if (!dividerFound && /^\|?(\s*[-:]+\s*\|?)+$/.test(nextLine)) {
        dividerFound = true
        continue
      }

      if (dividerFound) {
        // Linha de dados encontrada
        const rawHeaders = rawLine.split('|')
        if (rawHeaders.length > 2 && rawLine.startsWith('|') && rawLine.endsWith('|')) {
          rawHeaders.shift()
          rawHeaders.pop()
        }
        const cleanedHeaders = rawHeaders.map((h) => sanitizarTextoExtraido(h).toLowerCase())

        const rawValues = nextLine.split('|')
        if (rawValues.length > 2 && nextLine.startsWith('|') && nextLine.endsWith('|')) {
          rawValues.shift()
          rawValues.pop()
        }
        const cleanedValues = rawValues.map((v) => sanitizarTextoExtraido(v))

        callback(cleanedHeaders, cleanedValues)
        break
      }
    }
  }
}

function extrairSegurado(
  text: string,
  formato: SeguradoraPropostaFormato,
): PropostaClienteExtraido {
  let nome = ''
  let cpfCnpj = ''
  let tipoPessoa: 'PF' | 'PJ' = 'PF'
  let dataNasc = ''
  let email = ''
  let telefone = ''
  let cep = ''
  let rua = ''
  let numero = ''
  let bairro = ''
  let cidade = ''
  let estado = ''

  // Isolar o bloco delimitado "SUAS INFORMAÇÕES" do cliente, quando presente.
  // Suporta marcações markdown como "#", "##", "**", tabelas markdown (|) e espaços.
  const suasInfoSectionMatch =
    /(?:#+\s*|\*{0,2})SUAS\s+INFORMA[ÇC][ÕO]ES\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|$))/i.exec(
      text,
    )
  const suasInfoText = suasInfoSectionMatch ? suasInfoSectionMatch[0] : ''

  // Isolar a seção do Condutor Principal para fallback de documento/nome quando mesmo condutor
  const condPrincipalSectionMatch =
    /(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO\s+CONDUTOR(?:\s+PRINCIPAL)?\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|$))/i.exec(
      text,
    )
  const condPrincipalText = condPrincipalSectionMatch ? condPrincipalSectionMatch[0] : ''

  // CNPJs conhecidos de seguradoras / entidades que NUNCA devem ser atribuídos ao cliente
  const isCnpjSeguradoraOuInvalido = (docLimpo: string): boolean => {
    // Allianz: 06.157.796/0001-66 ou 06157379... ou qualquer 06.157...
    if (docLimpo.startsWith('06157')) return true
    // Porto Seguro Cia de Seguros Gerais / Azul Seguros: 61.198.164/0001-60
    if (docLimpo.startsWith('61198164')) return true
    // Azul Companhia de Seguros Gerais: 33.448.150/0001-11
    if (docLimpo.startsWith('33448150')) return true
    // Porto Seguro Vida e Previdência: 61.884.227/0001-38
    if (docLimpo.startsWith('61884227')) return true
    // Bradesco Auto/RE: 92.682.038/0001-00 ou 92.682...
    if (docLimpo.startsWith('92682038')) return true
    // HDI Seguros: 29.980.149/0001-81
    if (docLimpo.startsWith('29980149')) return true
    // Yelum Seguradora / Liberty Seguros: 61.550.141/0001-72
    if (docLimpo.startsWith('61550141')) return true
    // MAPFRE Seguros Gerais: 61.074.175/0001-38
    if (docLimpo.startsWith('61074175')) return true
    // Tokio Marine: 33.164.021/0001-00
    if (docLimpo.startsWith('33164021')) return true
    // Sompo Seguros: 61.383.493/0001-80
    if (docLimpo.startsWith('61383493')) return true
    // Corretora Cred10mix (CNPJ 17.648.302/0001-73 e SUSEP 202062795...)
    if (docLimpo.startsWith('17648302')) return true
    if (docLimpo.startsWith('202062795')) return true
    return false
  }

  // 1. EXTRAÇÃO DE DOCUMENTO (CPF ou CNPJ) E DETECÇÃO PF vs PJ
  // Truncar o texto no início das declarações/termos contratuais e rodapés ("Canais de atendimento",
  // "Declaração do proponente", "Termos e condições", "Porto Seguro Cia de Seguros", etc.)
  // para evitar que CNPJs institucionais da seguradora cheguem na extração do cliente!
  const idxCorteInstitucional = text.search(
    /(?:declara[çc][ãa]o\s+do\s+proponente|termos\s+e\s+condi[çc][õo]es|canais\s+de\s+atendimento|tratamento\s+de\s+dados\s+pessoais|uso\s+interno\s+da\s+cia)/i,
  )
  const textoUtilCliente =
    idxCorteInstitucional > 0 ? text.substring(0, idxCorteInstitucional) : text

  // Isolar o bloco "Dados Gerais" (Azul Tradicional / Porto Seguro) se presente.
  // Tolerante a qualquer formatação markdown (#, ##, **, negrito, espaços) e delimitação
  // por cabeçalhos conhecidos (Veículo, Questionário, Coberturas, Vigência, Corretor, etc.)
  // ou próxima seção (#/##)
  const dadosGeraisSectionMatch =
    /(?:^|\n)\s*(?:#+\s*)?\*{0,2}\s*Dados\s+Gerais\s*\*{0,2}[\s\S]*?(?=(?:(?:\n\s*#+\s*|\n\s*\*{1,2}\s*)(?:Ve[íi]culo|Question[áa]rio|Coberturas|Vidros|Assist[êe]ncias|Descontos|Forma\s+de\s+pagamento|Declara[çc][ãa]o|Termos|Canais|SAC|Uso\s+interno)|$))/i.exec(
      textoUtilCliente,
    )
  const dadosGeraisText = dadosGeraisSectionMatch ? dadosGeraisSectionMatch[0] : ''

  // =========================================================================
  // PARSER DE BLOCO DO SEGURADO SEQUENCIAL (Azul Seguros / Porto Seguro)
  // Trata layout de fluxo sequencial de colunas:
  // Variante 1 (rótulos empilhados primeiro, depois valores empilhados):
  // Segurado(a)
  // Nascimento
  // CPF
  // LIVIA LOURENCO FERNANDES DA CUNHA BARROS
  // 02/08/1990
  // 057.365.924-95
  //
  // Variante 2 (intercalado):
  // Segurado(a)
  // [NOME]
  // Nascimento
  // [DATA] [CPF]
  // CPF
  // =========================================================================
  const extrairSeguradoSequencial = (fonteTexto: string) => {
    const rawLines = fonteTexto.split(/\r?\n/).map((l) => l.trim())
    const lines = rawLines.filter((l) => l.length > 0)

    const normalizarRotulo = (s: string) =>
      s
        .toLowerCase()
        .replace(/[*_#:|-]/g, '')
        .trim()

    // 1. Procurar Variante 1: Rótulos empilhados "Segurado(a)" -> "Nascimento" -> "CPF"
    for (let i = 0; i < lines.length - 2; i++) {
      const l1 = normalizarRotulo(lines[i])
      const l2 = normalizarRotulo(lines[i + 1])
      const l3 = normalizarRotulo(lines[i + 2])

      const isSegurado = l1 === 'segurado(a)' || l1 === 'segurado' || l1 === 'proponente'
      const isNasc = l2 === 'nascimento' || l2 === 'data de nascimento' || l2.includes('nasc')
      const isCpf = l3 === 'cpf' || l3 === 'cpf/cnpj'

      if (isSegurado && isNasc && isCpf) {
        // Encontrou a pilha de rótulos de 3 campos!
        // As próximas linhas de dados podem ser [NOME], [DATA], [CPF]
        // ou [NOME] e na seguinte [DATA] [CPF] combinados
        let valCursor = i + 3
        const vals: string[] = []
        while (valCursor < lines.length && vals.length < 3) {
          const lVal = lines[valCursor]
          if (!/^\|?(\s*[-:]+\s*\|?)+$/.test(lVal)) {
            vals.push(lVal)
          }
          valCursor++
        }

        if (vals.length >= 2) {
          // Identificar qual linha é a data de nascimento e qual é o CPF
          let foundDate = ''
          let foundCpf = ''
          let foundNomeCand = ''

          // Se vals[1] contiver Data e CPF combinados ("02/08/1990 057.365.924-95")
          const combinedMatch =
            /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i.exec(
              vals[1],
            )
          if (combinedMatch) {
            foundDate = parseDataFlexivel(combinedMatch[1])
            foundCpf = combinedMatch[2].replace(/\D/g, '')
            foundNomeCand = sanitizarTextoExtraido(vals[0])
          } else if (vals.length >= 3) {
            const dMatch = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/.exec(vals[1])
            const cMatch = /([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/.exec(vals[2])
            if (dMatch && cMatch) {
              foundDate = parseDataFlexivel(dMatch[1])
              foundCpf = cMatch[1].replace(/\D/g, '')
              foundNomeCand = sanitizarTextoExtraido(vals[0])
            }
          }

          // Se encontramos o par data + CPF, associamos imediatamente o nome que antecede esse par
          if (foundCpf && isValidCpf(foundCpf)) {
            cpfCnpj = foundCpf
            tipoPessoa = 'PF'
            if (foundDate) dataNasc = foundDate
            if (foundNomeCand && isNomePessoaValido(foundNomeCand)) {
              nome = foundNomeCand
            }
          } else {
            const candNome = sanitizarTextoExtraido(vals[0])
            if (isNomePessoaValido(candNome)) {
              if (!nome) nome = candNome
            }
          }
          if (nome && dataNasc && cpfCnpj) return
        }
      }
    }

    // 2. Procurar Variante 2 (Intercalado):
    // Segurado(a)
    // [NOME]
    // Nascimento
    // [DATA] [CPF] (ou apenas [DATA] e na linha seguinte ou posterior o CPF)
    // CPF
    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = normalizarRotulo(lines[i])
      if (l1 === 'segurado(a)' || l1 === 'segurado' || l1 === 'proponente') {
        const candLinhaNome = lines[i + 1]
        if (candLinhaNome) {
          const candNome = sanitizarTextoExtraido(candLinhaNome)
          if (isNomePessoaValido(candNome)) {
            if (!nome) nome = candNome
          }
        }

        // Olhar as próximas 8 linhas para Nascimento e CPF intercalados
        const janela = lines.slice(i + 1, Math.min(lines.length, i + 10))
        for (const jl of janela) {
          // Procurar data e CPF juntos na mesma linha: "02/08/1990 057.365.924-95"
          const dataCpfMatch =
            /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i.exec(jl)
          if (dataCpfMatch) {
            if (!dataNasc) dataNasc = parseDataFlexivel(dataCpfMatch[1])
            const limpo = dataCpfMatch[2].replace(/\D/g, '')
            if (limpo.length === 11 && isValidCpf(limpo)) {
              if (!cpfCnpj) {
                cpfCnpj = limpo
                tipoPessoa = 'PF'
              }
            }
          } else {
            // Data avulsa se ainda faltar
            if (!dataNasc) {
              const dtM = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})$/.exec(jl.trim())
              if (dtM) {
                dataNasc = parseDataFlexivel(dtM[1])
              }
            }
            // CPF avulso se ainda faltar
            if (!cpfCnpj) {
              const cpfM = /^([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$/.exec(jl.trim())
              if (cpfM) {
                const limpo = cpfM[1].replace(/\D/g, '')
                if (limpo.length === 11 && isValidCpf(limpo)) {
                  cpfCnpj = limpo
                  tipoPessoa = 'PF'
                }
              }
            }
          }
        }
        if (nome && (cpfCnpj || dataNasc)) return
      }
    }
  }

  // Executar prioritariamente o parser sequencial do segurado
  if (dadosGeraisText) {
    extrairSeguradoSequencial(dadosGeraisText)
  }
  if (!nome || !cpfCnpj || !dataNasc) {
    extrairSeguradoSequencial(textoUtilCliente)
  }

  // REGRA DE OURO 1: Buscar primeiro dentro do bloco SUAS INFORMAÇÕES (Allianz)
  if (suasInfoText) {
    const docSuasInfo = /(?:CPF\/CNPJ|CPF|CNPJ)[*\s|:]+([0-9.\-/]{11,18})/i.exec(suasInfoText)
    if (docSuasInfo) {
      const docLimpo = docSuasInfo[1].replace(/\D/g, '')
      if (docLimpo.length === 11) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PF'
      } else if (docLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(docLimpo)) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PJ'
      }
    }
  }

  // REGRA DE OURO 2: Buscar dentro de DADOS GERAIS (Azul Seguros / Porto Seguro)
  // No layout Azul Tradicional:
  // "Nascimento 02/08/1990 057.365.924-95 CPF" ou "057.365.924-95 CPF" ou "CPF 057.365.924-95"
  // E também via tabela GFM (| Segurado(a) | Nascimento | CPF |)
  const extrairCpfCnpjDeTabelaSegurado = (fonteTexto: string) => {
    parseTabelaGfmLinhas(/segurado\s*(?:\(a\))?/i, fonteTexto, (headers, values) => {
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

        if (h.includes('cpf')) {
          const limpo = val.replace(/\D/g, '')
          if (limpo.length === 11 && isValidCpf(limpo)) {
            cpfCnpj = limpo
            tipoPessoa = 'PF'
          }
        } else if (h.includes('cnpj')) {
          const limpo = val.replace(/\D/g, '')
          if (limpo.length === 14 && !isCnpjSeguradoraOuInvalido(limpo)) {
            cpfCnpj = limpo
            tipoPessoa = 'PJ'
          }
        }
      })
    })

    if (!cpfCnpj) {
      const cpfNaLinha =
        /(?:cpf[*\s|:]+([0-9.\-/]{11,14})|([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\s*(?:[|*]*\s*cpf)?)/i.exec(
          fonteTexto,
        )
      if (cpfNaLinha) {
        const docRaw = cpfNaLinha[1] || cpfNaLinha[2]
        const docLimpo = docRaw.replace(/\D/g, '')
        if (docLimpo.length === 11 && isValidCpf(docLimpo)) {
          cpfCnpj = docLimpo
          tipoPessoa = 'PF'
        }
      }
    }
    if (!cpfCnpj) {
      const cnpjNaLinha = /(?:cnpj)[*\s|:]+([0-9.\-/]{14,18})/i.exec(fonteTexto)
      if (cnpjNaLinha) {
        const docLimpo = cnpjNaLinha[1].replace(/\D/g, '')
        if (docLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(docLimpo)) {
          cpfCnpj = docLimpo
          tipoPessoa = 'PJ'
        }
      }
    }
  }

  // 1ª prioridade: no escopo isolado dadosGeraisText
  if (!cpfCnpj && dadosGeraisText) {
    extrairCpfCnpjDeTabelaSegurado(dadosGeraisText)
  }
  // 2ª prioridade (Redundância Decisiva): busca global no texto útil inteiro
  if (!cpfCnpj) {
    extrairCpfCnpjDeTabelaSegurado(textoUtilCliente)
  }

  // Fallback 1: Buscar no bloco INFORMAÇÕES DO CONDUTOR PRINCIPAL
  if (!cpfCnpj && condPrincipalText) {
    const docCond = /(?:CPF\/CNPJ|CPF|CNPJ)[*\s|:]+([0-9.\-/]{11,18})/i.exec(condPrincipalText)
    if (docCond) {
      const docLimpo = docCond[1].replace(/\D/g, '')
      if (docLimpo.length === 11) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PF'
      } else if (docLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(docLimpo)) {
        cpfCnpj = docLimpo
        tipoPessoa = 'PJ'
      }
    }
  }

  // Fallback 2: Buscar em cabeçalhos específicos no textoUtilCliente (antes do corte institucional)
  if (!cpfCnpj) {
    // Atenção: Procura CPF primeiro ou CNPJ apenas se for explicitamente identificado
    const cpfMatch =
      /(?:cpf|c\.p\.f\.?)[*\s|:]+([0-9.\-/]{11,14})/i.exec(textoUtilCliente) ||
      /([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\s*(?:[|*]*\s*cpf)/i.exec(textoUtilCliente)

    if (cpfMatch) {
      const numLimpo = cpfMatch[1].replace(/\D/g, '')
      if (numLimpo.length === 11 && isValidCpf(numLimpo)) {
        cpfCnpj = numLimpo
        tipoPessoa = 'PF'
      }
    }

    if (!cpfCnpj) {
      const cnpjMatch = /(?:cnpj|c\.n\.p\.j\.?)[*\s|:]+([0-9.\-/]{14,18})/i.exec(textoUtilCliente)
      if (cnpjMatch) {
        const numLimpo = cnpjMatch[1].replace(/\D/g, '')
        if (numLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(numLimpo)) {
          cpfCnpj = numLimpo
          tipoPessoa = 'PJ'
        }
      }
    }

    if (!cpfCnpj) {
      const docMatch = /(?:documento)[*\s|:]+([0-9.\-/]{11,18})/i.exec(textoUtilCliente)
      if (docMatch) {
        const numLimpo = docMatch[1].replace(/\D/g, '')
        if (numLimpo.length === 14 && !isCnpjSeguradoraOuInvalido(numLimpo)) {
          cpfCnpj = numLimpo
          tipoPessoa = 'PJ'
        } else if (numLimpo.length === 11) {
          cpfCnpj = numLimpo
          tipoPessoa = 'PF'
        }
      }
    }
  }

  // Fallback 3: Buscar qualquer CPF válido formatado no texto da página 1 (antes de termos contratuais/rodapés)
  if (!cpfCnpj) {
    const cpfsEncontrados = textoUtilCliente.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)
    if (cpfsEncontrados) {
      for (const rawCpf of cpfsEncontrados) {
        const limpo = rawCpf.replace(/\D/g, '')
        if (limpo.length === 11 && isValidCpf(limpo)) {
          cpfCnpj = limpo
          tipoPessoa = 'PF'
          break
        }
      }
    }
  }

  // Caso especial: Condomínio sem CNPJ explícito no label
  if (!cpfCnpj && /condom[íi]nio|residencia[l]?\s+do\s+edif[íi]cio/i.test(textoUtilCliente)) {
    const cnpjsEncontrados = textoUtilCliente.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)
    if (cnpjsEncontrados) {
      for (const rawCnpj of cnpjsEncontrados) {
        const limpo = rawCnpj.replace(/\D/g, '')
        if (!isCnpjSeguradoraOuInvalido(limpo)) {
          cpfCnpj = limpo
          tipoPessoa = 'PJ'
          break
        }
      }
    }
  }

  // 2. NOME DO SEGURADO / RAZÃO SOCIAL
  // (a) Caso Azul Seguros / Porto Seguro (bloco "Dados Gerais"):
  // Em tabelas Markdown (Gfm):
  // | Segurado(a) | Nascimento | CPF |
  // | --- | --- | --- |
  // | LIVIA LOURENCO FERNANDES DA CUNHA BARROS | 02/08/1990 | 057.365.924-95 |
  const extrairNomeDeTabelaSegurado = (fonteTexto: string) => {
    parseTabelaGfmLinhas(/segurado\s*(?:\(a\))?/i, fonteTexto, (headers, values) => {
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

        if (h.includes('segurado')) {
          const raw = sanitizarTextoExtraido(val)
          if (isNomePessoaValido(raw)) {
            nome = raw
          }
        }
      })
    })

    // 1. Linha imediatamente seguinte a "Segurado(a)" ou na mesma linha
    if (!nome) {
      const linhaSeguradoMatch =
        /(?:^|\n)[|* ]*segurado\s*(?:\(a\))?[|* :]*\n+([A-Za-zÀ-ÿ\s.'-]{4,80})(?=\n|$)/i.exec(
          fonteTexto,
        )
      if (linhaSeguradoMatch) {
        const raw = sanitizarTextoExtraido(linhaSeguradoMatch[1])
        if (isNomePessoaValido(raw)) {
          nome = raw
        }
      }
    }

    if (!nome) {
      const nomeAzulMatch =
        /segurado\s*(?:\(a\))?[*\s|:]*\n*([A-Za-zÀ-ÿ\s.'-]{4,80}?)(?=(?:\s*[|*]?\s*(?:nascimento|cpf|cnpj|sexo|profiss[ãa]o|endere[çc]o|pa[íi]s)|\n\s*\n|\||$))/i.exec(
          fonteTexto,
        )
      if (nomeAzulMatch) {
        const raw = sanitizarTextoExtraido(nomeAzulMatch[1])
        if (isNomePessoaValido(raw)) {
          nome = raw
        }
      }
    }
  }

  // 1ª prioridade: no escopo isolado dadosGeraisText
  if (!nome && dadosGeraisText) {
    extrairNomeDeTabelaSegurado(dadosGeraisText)
  }
  // 2ª prioridade (Redundância Decisiva): busca global no texto útil inteiro
  if (!nome) {
    extrairNomeDeTabelaSegurado(textoUtilCliente)
  }

  // (b) Se for proposta Condomínio (PJ) da Allianz, pode ter razão social completa antes de "Essa é a proposta..."
  if (!nome) {
    const allianzCabecalhoMatch =
      /(?:^|\n)\s*([A-Z0-9\s.,'/-]{10,80})\s*\n\s*Essa\s+[ée]\s+a\s+proposta\s+do\s+seu\s+seguro\s+Allianz\s+Condom[íi]nio/i.exec(
        text,
      )
    if (allianzCabecalhoMatch) {
      const cab = allianzCabecalhoMatch[1].trim()
      if (cab.length > 5 && !cab.toLowerCase().includes('corretora')) {
        nome = cab
      }
    }
  }

  // (c) Bloco "SUAS INFORMAÇÕES" (Allianz)
  if (!nome && suasInfoText) {
    const nomeSuasInfo =
      /(?:Nome|Segurado)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)(?=(?:\s*[|*]?\s*(?:CPF|CNPJ|Tel|E-mail|Endere[çc]o|Idade|Estado|Telefone)|\||\n|$))/i.exec(
        suasInfoText,
      )
    if (nomeSuasInfo) {
      const rawNome = sanitizarTextoExtraido(nomeSuasInfo[1])
      if (
        tipoPessoa === 'PJ'
          ? !isTextoCabecalhoOuInvalido(rawNome) && !rawNome.toLowerCase().includes('corretora')
          : isNomePessoaValido(rawNome)
      ) {
        nome = rawNome
      }
    }
  }

  // (d) Saudação da Allianz ("Olá IRIS NOVAES BUDACH MACHADO,")
  if (!nome) {
    const olaMatch =
      /Ol[áa]\s+\*{0,2}([A-ZÀ-ÿ\s]{4,80}?)\*{0,2},\s*(?:Agradecemos|Confira|Essa)/i.exec(text)
    if (olaMatch) {
      const n = sanitizarTextoExtraido(olaMatch[1])
      if (isNomePessoaValido(n)) {
        nome = n
      }
    }
  }

  // Fallback 1: Buscar no bloco INFORMAÇÕES DO CONDUTOR PRINCIPAL (apenas se não houver condutor separado)
  if (!nome && condPrincipalText) {
    const nomeCondSec =
      /(?:Nome|Condutor)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)(?=(?:\s*[|*]?\s*(?:CPF|Idade|Estado|Parentesco)|\||\n|$))/i.exec(
        condPrincipalText,
      )
    if (nomeCondSec) {
      const n = sanitizarTextoExtraido(nomeCondSec[1])
      if (isNomePessoaValido(n)) {
        nome = n
      }
    }
  }

  // Fallback 2: Fallback genérico de nome
  if (!nome) {
    const nomeMatch =
      /(?:nome\s+do\s+segurado|segurado(?:\s*\(a\))?|proponente|raz[ãa]o\s+social)[*\s|:]*\n*([A-Za-zÀ-ÿ0-9\s.-]+?)(?=\s*[|*]?\s*(?:cpf|cnpj|nasc|data|endere[çc]o|telefone|email)|\n|\||$)/i.exec(
        textoUtilCliente,
      )
    if (nomeMatch) {
      const n = sanitizarTextoExtraido(nomeMatch[1])
      if (
        tipoPessoa === 'PJ'
          ? !isTextoCabecalhoOuInvalido(n) && !n.toLowerCase().includes('corretor')
          : isNomePessoaValido(n)
      ) {
        nome = n
      }
    }
  }

  // Fallback 3 (Rede de segurança global): Se ainda não encontrou o nome do segurado,
  // capturar o texto imediatamente ANTES da data de nascimento/CPF do segurado
  // (no fluxo real, o nome do segurado vem adjacente e logo antes de seu nascimento/CPF).
  // Priorizar candidatos com formato de nome de pessoa (2+ palavras em caixa alta) adjacentes ao CPF/nascimento
  if (!nome) {
    const lines = textoUtilCliente
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Se a linha contém o CPF do segurado ou a data de nascimento seguida de CPF
      const hasCpfOuNasc =
        (cpfCnpj && line.replace(/\D/g, '').includes(cpfCnpj)) ||
        /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}).*?(\d{3}\.\d{3}\.\d{3}-\d{2})/.test(line) ||
        /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(line)

      if (hasCpfOuNasc) {
        // Olhar para as linhas imediatamente anteriores
        for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
          let cand = lines[k]
          // Remover pipes de tabelas se houver
          cand = cand.replace(/^\|+|\|+$/g, '').trim()
          const candNorm = cand
            .toLowerCase()
            .replace(/[*_#:|-]/g, '')
            .trim()

          if (
            candNorm === 'segurado' ||
            candNorm === 'segurado(a)' ||
            candNorm === 'proponente' ||
            candNorm === 'nascimento' ||
            candNorm === 'cpf' ||
            candNorm.startsWith('dados') ||
            candNorm.startsWith('corretor') ||
            candNorm.startsWith('vigência') ||
            isTextoCabecalhoOuInvalido(cand)
          ) {
            continue
          }

          const candLimpo = sanitizarTextoExtraido(cand)
          if (isNomePessoaValido(candLimpo)) {
            // Se tem 2+ palavras, excelente candidato a nome de pessoa física
            const palavras = candLimpo.split(/\s+/).filter((w) => w.length > 1)
            if (palavras.length >= 2) {
              nome = candLimpo
              break
            } else if (!nome) {
              nome = candLimpo
            }
          }
        }
        if (nome) break
      }
    }
  }

  // 3. DATA DE NASCIMENTO (Allianz NÃO traz e PJ não possui)
  if (formato !== 'ALLIANZ' && tipoPessoa === 'PF') {
    // Procura primeiro no bloco Dados Gerais / texto útil antes do questionário de risco/condutor
    const extrairNascimentoDeTabela = (fonteTexto: string) => {
      parseTabelaGfmLinhas(/segurado\s*(?:\(a\))?/i, fonteTexto, (headers, values) => {
        headers.forEach((h, idx) => {
          const val = values[idx] || ''
          if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

          if (h.includes('nascimento') || h.includes('nasc')) {
            const dt = parseDataFlexivel(val)
            if (dt) dataNasc = dt
          }
        })
      })
    }

    // 1ª prioridade: tabela GFM em dadosGeraisText
    if (!dataNasc && dadosGeraisText) {
      extrairNascimentoDeTabela(dadosGeraisText)
    }
    // 2ª prioridade: tabela GFM no texto útil global
    if (!dataNasc) {
      extrairNascimentoDeTabela(textoUtilCliente)
    }

    const escopoNasc = dadosGeraisText || textoUtilCliente

    // Fallback regex de tabela de nascimento
    if (!dataNasc) {
      const nascTabelaMatch =
        /\|\s*[^|\n]*\b(?:data\s+de\s+nascimento|nascimento|nasc\.?)\b[^|\n]*\|[^\n]*\n\|(?:\s*[-:]+\s*\|)+\s*\n\|[^|\n]*\|\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*\|/i.exec(
          escopoNasc,
        )
      if (nascTabelaMatch) {
        dataNasc = parseDataFlexivel(nascTabelaMatch[1])
      }
    }

    // 2. Célula markdown em qualquer tabela ou linha: "| 02/08/1990 |" dentro de Dados Gerais ou texto útil
    if (!dataNasc && dadosGeraisText) {
      const dateInDadosGeraisMatch = /\|\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*\|/.exec(
        dadosGeraisText,
      )
      if (dateInDadosGeraisMatch) {
        dataNasc = parseDataFlexivel(dateInDadosGeraisMatch[1])
      }
    }

    // 3. Linhas quebradas ou com dois pontos
    if (!dataNasc) {
      const nascLinhaQuebradaMatch =
        /(?:data\s+de\s+nascimento|nascimento|nasc\.?)[*\s|:]*\n+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
          escopoNasc,
        )
      if (nascLinhaQuebradaMatch) {
        dataNasc = parseDataFlexivel(nascLinhaQuebradaMatch[1])
      } else {
        const nascMatch =
          /(?:data\s+de\s+nascimento|nascimento|nasc\.?)[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
            escopoNasc,
          )
        if (nascMatch) {
          dataNasc = parseDataFlexivel(nascMatch[1])
        }
      }
    }

    // Fallback 4 (Rede de segurança global): extrair a data adjacente aos 11 dígitos do CPF do segurado
    // independente do escopo da seção ("02/08/1990" junto de "057.365.924-95" ou "05736592495")
    if (!dataNasc) {
      // 1) Caso data e CPF na mesma linha ou separados por espaços/pipes
      if (cpfCnpj) {
        const cpfRegexPart =
          cpfCnpj.length === 11
            ? `(?:${cpfCnpj.slice(0, 3)}\\.${cpfCnpj.slice(3, 6)}\\.${cpfCnpj.slice(6, 9)}-${cpfCnpj.slice(9)}|${cpfCnpj})`
            : cpfCnpj
        const adjacenteMatch = new RegExp(
          `(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4})[\\s|*]*${cpfRegexPart}|${cpfRegexPart}[\\s|*]*(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4})`,
          'i',
        ).exec(textoUtilCliente)

        if (adjacenteMatch) {
          const dFound = adjacenteMatch[1] || adjacenteMatch[2]
          if (dFound) {
            dataNasc = parseDataFlexivel(dFound)
          }
        }
      }

      // 2) Caso linhas adjacentes no texto geral (data na linha anterior ou posterior ao CPF do segurado)
      if (!dataNasc) {
        const lines = textoUtilCliente
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const isCpfLine = cpfCnpj
            ? line.replace(/\D/g, '').includes(cpfCnpj)
            : /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(line)

          if (isCpfLine) {
            // Verificar a própria linha
            const dNaLinha = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/.exec(line)
            if (dNaLinha) {
              dataNasc = parseDataFlexivel(dNaLinha[1])
              break
            }
            // Verificar até 3 linhas antes e depois
            for (let k = Math.max(0, i - 3); k <= Math.min(lines.length - 1, i + 3); k++) {
              if (k === i) continue
              const candLine = lines[k]
              if (/vig[êe]ncia|impresso|emiss[ãa]o/i.test(candLine)) continue
              const dCand = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/.exec(candLine)
              if (dCand) {
                const parsed = parseDataFlexivel(dCand[1])
                // Checar se não é ano futuro ou vigente (deve ser nascimento < ano atual - 16)
                const y = parseInt(parsed.split('-')[0], 10)
                if (y > 1920 && y < new Date().getFullYear() - 15) {
                  dataNasc = parsed
                  break
                }
              }
            }
            if (dataNasc) break
          }
        }
      }
    }
  }

  // 4. E-MAIL
  // Priorizar busca no bloco "SUAS INFORMAÇÕES" se houver
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g
  const searchForEmail = (sourceText: string): string => {
    const matches = sourceText.match(emailRegex)
    if (matches) {
      for (const em of matches) {
        const emLower = em.toLowerCase()
        if (
          !emLower.includes('allianz') &&
          !emLower.includes('seguradora') &&
          !emLower.includes('corret') &&
          !emLower.includes('cred10mix')
        ) {
          return em.trim()
        }
      }
    }
    return ''
  }

  // Busca em tabelas GFM contendo "E-mail"
  parseTabelaGfmLinhas(/\be-?mail\b/i, textoUtilCliente, (headers, values) => {
    headers.forEach((h, idx) => {
      const val = values[idx] || ''
      if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

      if (h.includes('e-mail') || h.includes('email')) {
        const em = searchForEmail(val)
        if (em) email = em
      }
    })
  })

  if (!email && suasInfoText) {
    email = searchForEmail(suasInfoText)
  }
  if (!email) {
    email = searchForEmail(text)
  }

  // 5. TELEFONE / CELULAR
  const normalizarTelefoneComDDD = (rawTel: string): string => {
    let clean = rawTel.trim()
    const digitsOnly = clean.replace(/\D/g, '')
    // Se veio no formato "Celular: (83) 99112-9729" já tem DDD
    if (digitsOnly.length === 8 || digitsOnly.length === 9) {
      if (/OLINDA|RECIFE|\bPE\b/i.test(text)) {
        clean = `81${digitsOnly}`
      } else if (/JO[ÃA]O\s+PESSOA|\bPB\b/i.test(text)) {
        clean = `83${digitsOnly}`
      }
    }
    const d = clean.replace(/\D/g, '')
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    }
    return clean
  }

  const isTelefoneInstitucionalOuInvalido = (digits: string): boolean => {
    // 0800 (SACs e Ouvidorias de seguradoras)
    if (
      digits.startsWith('0800') ||
      digits.includes('08007272766') ||
      digits.includes('08007271184')
    )
      return true
    // 0300 (Centrais de atendimento outras regiões)
    if (digits.startsWith('0300') || digits.includes('03003376786')) return true
    // Central 24h Grande São Paulo Porto Seguro: 1133663333 / 33663333
    if (digits.includes('33663333')) return true
    // Matrícula SUSEP / Corretora Cred10mix: telefone 8134939966, 8132240174, 32240174
    if (digits.includes('34939966') || digits.includes('32240174')) return true
    // Linha Direta Allianz: 40901110 / 08007777243
    if (digits.includes('40901110') || digits.includes('08007777243')) return true
    return false
  }

  // Busca prioritária em tabela GFM contendo "Telefone" ou "Celular" (ex: Azul Seguros | E-mail | Telefone | Tipo de envio |)
  parseTabelaGfmLinhas(/\b(?:telefone|celular)\b/i, textoUtilCliente, (headers, values) => {
    headers.forEach((h, idx) => {
      const val = values[idx] || ''
      if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

      if (h.includes('telefone') || h.includes('celular') || h.includes('tel')) {
        const cleanDigits = val.replace(/\D/g, '')
        if (!isTelefoneInstitucionalOuInvalido(cleanDigits) && cleanDigits.length >= 8) {
          telefone = normalizarTelefoneComDDD(val)
        }
      }
    })
  })

  if (!telefone && suasInfoText) {
    // "Tel: 81998747908" ou "**Tel:** 81998747908" ou "| Tel | 81998747908 |"
    const telSuas =
      /(?:Tel|Telefone|Celular)[*\s|:]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/i.exec(
        suasInfoText,
      )
    if (telSuas) {
      const cleanDigits = telSuas[1].replace(/\D/g, '')
      if (!isTelefoneInstitucionalOuInvalido(cleanDigits)) {
        telefone = normalizarTelefoneComDDD(telSuas[1])
      }
    }
  }

  // Busca em Dados Gerais (Azul / Porto)
  if (!telefone && dadosGeraisText) {
    const telAzul =
      /(?:celular|telefone|tel)[*\s|:/]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/i.exec(
        dadosGeraisText,
      )
    if (telAzul) {
      const cleanDigits = telAzul[1].replace(/\D/g, '')
      if (!isTelefoneInstitucionalOuInvalido(cleanDigits)) {
        telefone = normalizarTelefoneComDDD(telAzul[1])
      }
    }
  }

  if (!telefone) {
    // Busca no texto útil do cliente com label (evitando pegar SAC da pág 5)
    const telMatches = textoUtilCliente.matchAll(
      /(?:telefone|celular|tel|fone)[*\s|:/]+(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})/gi,
    )
    for (const match of telMatches) {
      const cleanDigits = match[1].replace(/\D/g, '')
      if (!isTelefoneInstitucionalOuInvalido(cleanDigits) && cleanDigits.length >= 8) {
        telefone = normalizarTelefoneComDDD(match[1])
        break
      }
    }
  }

  // 6. ENDEREÇO COMPLETO E CEP
  // (0) PARSER DE BLOCO DE ENDEREÇO SEQUENCIAL (Azul Seguros / Porto Seguro)
  // Layout real onde a conversão gera fluxo de colunas empilhadas (rótulos em sequência seguidos de valores na mesma ordem):
  // Endereço residencial
  // Complemento
  // CEP
  // UF
  // Bairro
  // Cidade
  // R Doralice de Almeida Lyra, 55
  // -
  // 58037-335
  // PB
  // Jardim Oceania
  // João Pessoa
  const extrairEnderecoSequencial = (fonteTexto: string) => {
    const rawLines = fonteTexto.split(/\r?\n/).map((l) => l.trim())
    const lines = rawLines.filter((l) => l.length > 0)

    const normalizarRotulo = (s: string) =>
      s
        .toLowerCase()
        .replace(/[*_#:|-]/g, '')
        .trim()

    // 1. Detecção baseada na sequência de rótulos seguida por valores
    for (let i = 0; i < lines.length; i++) {
      const lNorm = normalizarRotulo(lines[i])
      if (lNorm === 'endereço residencial' || lNorm === 'endereco residencial') {
        let idxComplemento = -1
        let idxCep = -1
        let idxUf = -1
        let idxBairro = -1
        let idxCidade = -1

        for (let k = i + 1; k < Math.min(lines.length, i + 12); k++) {
          const kNorm = normalizarRotulo(lines[k])
          if (kNorm === 'complemento' && idxComplemento === -1) idxComplemento = k
          else if (kNorm === 'cep' && idxCep === -1) idxCep = k
          else if (kNorm === 'uf' && idxUf === -1) idxUf = k
          else if (kNorm === 'bairro' && idxBairro === -1) idxBairro = k
          else if (kNorm === 'cidade' && idxCidade === -1) {
            idxCidade = k
            break
          }
        }

        if (idxCidade > i) {
          // Os valores começam após idxCidade!
          // 1ª valor = rua e número (ex: "R Doralice de Almeida Lyra, 55")
          // 2ª valor = complemento (ex: "-")
          // 3ª valor = CEP ("58037-335")
          // 4ª valor = UF ("PB")
          // 5ª valor = Bairro ("Jardim Oceania")
          // 6ª valor = Cidade ("João Pessoa")
          const valoresPost = lines
            .slice(idxCidade + 1, idxCidade + 12)
            .filter(
              (v) =>
                !/^\|?(\s*[-:]+\s*\|?)+$/.test(v) && (!isTextoCabecalhoOuInvalido(v) || v === '-'),
            )

          if (valoresPost.length >= 5) {
            const valRua = valoresPost[0]
            let offsetVal = 0
            if (valoresPost[1] === '-' || (valoresPost[1] && valoresPost[1].length < 5)) {
              offsetVal = 1
            }
            const valCep = valoresPost[offsetVal + 1]
            const valUf = valoresPost[offsetVal + 2]
            const valBairro = valoresPost[offsetVal + 3]
            const valCidade = valoresPost[offsetVal + 4]

            if (valRua && valRua !== '-' && !contemTermoNegativoEndereco(valRua)) {
              const pedacos = valRua.split(',').map((p) => p.trim())
              rua = pedacos[0] || valRua
              if (pedacos.length >= 2) {
                numero = pedacos.slice(1).join(', ')
              }
            }
            if (valCep && /^\d{5}-?\d{3}$/.test(valCep.trim())) {
              const cClean = valCep.replace(/\D/g, '')
              cep = `${cClean.slice(0, 5)}-${cClean.slice(5)}`
            }
            if (valUf && /^[A-Za-z]{2}$/.test(valUf.trim())) {
              estado = valUf.trim().toUpperCase()
            }
            if (valBairro && valBairro !== '-' && !contemTermoNegativoEndereco(valBairro)) {
              bairro = sanitizarTextoExtraido(valBairro)
            }
            if (valCidade && valCidade !== '-' && !contemTermoNegativoEndereco(valCidade)) {
              cidade = sanitizarTextoExtraido(valCidade)
            }

            if (rua && cep && cidade) return
          }
        }
      }
    }
    // 2. Detecção resiliente baseada no CEP e UF no fluxo de linhas:
    // A ocorrência só é válida se o bloco circundante contiver os rótulos reais de endereço residencial
    // (Endereço residencial/Complemento/Bairro/Cidade/UF) e NÃO contiver termos negativos
    for (let j = 0; j < lines.length - 1; j++) {
      const lineCep = lines[j].trim()
      const cepMatch = /(?:^|\b)([0-9]{5}-[0-9]{3})\b/.exec(lineCep)
      if (cepMatch) {
        // Verificar se a vizinhança (-8 a +8 linhas) contém rótulos de endereço residencial
        const startViz = Math.max(0, j - 8)
        const endViz = Math.min(lines.length - 1, j + 8)
        const vizinhança = lines.slice(startViz, endViz + 1).join(' ')
        if (contemTermoNegativoEndereco(vizinhança)) {
          // Pular ocorrência espúria de CEP vinculada a coberturas/pernoite/corretor/vigência
          continue
        }

        // Deve conter indicativo real de endereço residencial no bloco
        const temRotuloEndereco = /endere[çc]o\s+residencial|endere[çc]o|bairro|cidade/i.test(
          vizinhança,
        )
        if (!temRotuloEndereco) {
          continue
        }

        // Encontrou CEP em contexto legítimo de endereço! Procurar UF nas próximas 3 linhas
        let ufFound = ''
        let idxUfFound = -1
        for (let u = j + 1; u <= Math.min(lines.length - 1, j + 3); u++) {
          const cand = lines[u]?.trim().toUpperCase()
          if (/^[A-Z]{2}$/.test(cand) && BRAZILIAN_STATES.includes(cand)) {
            ufFound = cand
            idxUfFound = u
            break
          }
        }

        if (ufFound) {
          if (!cep) cep = cepMatch[1]
          if (!estado) estado = ufFound

          // Próximas linhas após a UF podem ser Bairro e Cidade
          const candBairro = lines[idxUfFound + 1]?.trim()
          const candCidade = lines[idxUfFound + 2]?.trim()
          if (
            candBairro &&
            !isTextoCabecalhoOuInvalido(candBairro) &&
            candBairro !== '-' &&
            !contemTermoNegativoEndereco(candBairro) &&
            !bairro
          ) {
            bairro = sanitizarTextoExtraido(candBairro)
          }
          if (
            candCidade &&
            !isTextoCabecalhoOuInvalido(candCidade) &&
            candCidade !== '-' &&
            !contemTermoNegativoEndereco(candCidade) &&
            !cidade
          ) {
            cidade = sanitizarTextoExtraido(candCidade)
          }

          // Procurar rua nas linhas anteriores ao CEP
          if (!rua) {
            for (let k = j - 1; k >= Math.max(0, j - 4); k--) {
              const candRua = lines[k].trim()
              if (
                candRua === '-' ||
                isTextoCabecalhoOuInvalido(candRua) ||
                contemTermoNegativoEndereco(candRua)
              )
                continue
              const candRuaNorm = normalizarRotulo(candRua)
              if (
                candRuaNorm.includes('endereço') ||
                candRuaNorm.includes('complemento') ||
                candRuaNorm.includes('cep') ||
                candRuaNorm.includes('uf')
              ) {
                continue
              }
              if (candRua.length > 3) {
                const pedacos = candRua.split(',').map((p) => p.trim())
                rua = pedacos[0] || candRua
                if (pedacos.length >= 2 && !numero) {
                  numero = pedacos.slice(1).join(', ')
                }
                break
              }
            }
          }
          if (rua && cep && cidade) return
        }
      }
    }
  }

  // Executar prioritariamente o parser sequencial de endereço
  if (dadosGeraisText) {
    extrairEnderecoSequencial(dadosGeraisText)
  }
  if (!rua || !cep || !bairro || !cidade || !estado) {
    extrairEnderecoSequencial(textoUtilCliente)
  }

  // (a) Caso Azul Seguros / Porto Seguro (bloco "Endereço residencial"):
  // Em tabelas Markdown (Gfm) como gerado pelo $documents.toMarkdown:
  // | Endereço residencial | Complemento | CEP | Bairro | Cidade | UF |
  // | --- | --- | --- | --- | --- | --- |
  // | R Doralice de Almeida Lyra, 55 | - | 58037-335 | Jardim Oceania | João Pessoa | PB |
  const extrairEnderecoDeTabela = (fonteTexto: string) => {
    parseTabelaGfmLinhas(/endere[çc]o\s+residencial/i, fonteTexto, (headers, values) => {
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        if (!val || val === '-' || isTextoCabecalhoOuInvalido(val)) return

        if (h.includes('endereço') || h.includes('endereco')) {
          const pedacos = val.split(',').map((p) => p.trim())
          rua = pedacos[0] || val
          if (pedacos.length >= 2 && !numero) {
            numero = pedacos.slice(1).join(', ')
          }
        } else if (h.includes('complemento')) {
          // Mantém complemento se necessário
        } else if (h.includes('cep')) {
          const cClean = val.replace(/\D/g, '')
          if (cClean.length === 8) {
            cep = `${cClean.slice(0, 5)}-${cClean.slice(5)}`
          }
        } else if (h.includes('bairro')) {
          bairro = val
        } else if (h.includes('cidade')) {
          cidade = val
        } else if (h === 'uf' || h.includes('estado')) {
          const u = val.replace(/[^A-Za-z]/g, '').toUpperCase()
          if (u.length === 2) estado = u
        }
      })
    })
  }

  // 1ª prioridade: se dadosGeraisText estiver isolado
  if (dadosGeraisText) {
    extrairEnderecoDeTabela(dadosGeraisText)
  }
  // 2ª prioridade: busca global no texto útil inteiro
  if (!rua || !cep || !bairro || !cidade || !estado) {
    extrairEnderecoDeTabela(textoUtilCliente)
  }

  const parseCampoRotuloValor = (rotulo: string): string => {
    // 1. Procura rótulo em linha própria e valor na linha seguinte
    const regexLinhaSeguinte = new RegExp(
      `(?:^|\\n)[|* ]*${rotulo}[|* :]*\\n+([^\\n|]+?)(?=\\n|$)`,
      'i',
    )
    const matchLinha = regexLinhaSeguinte.exec(textoUtilCliente)
    if (matchLinha) {
      const val = sanitizarTextoExtraido(matchLinha[1])
      if (val && !isTextoCabecalhoOuInvalido(val) && val !== '-') {
        return val
      }
    }
    // 2. Procura rótulo na mesma linha
    const regexMesmaLinha = new RegExp(
      `(?:^|\\n|[|/])[|* ]*${rotulo}[|* :]+([^\\n|/]+?)(?=(?:[|*/]?\\s*(?:complemento|cep|uf|bairro|cidade|e-mail|telefone|ve[íi]culo)|\\n|\\||\\/|$))`,
      'i',
    )
    const matchMesma = regexMesmaLinha.exec(textoUtilCliente)
    if (matchMesma) {
      const val = sanitizarTextoExtraido(matchMesma[1])
      if (val && !isTextoCabecalhoOuInvalido(val) && val !== '-') {
        return val
      }
    }
    return ''
  }

  // Tentar capturar campos estruturados (Azul / Porto) se ainda não capturados via tabela
  if (!rua) {
    const azulRua = parseCampoRotuloValor('endere[çc]o(?:\\s+residencial)?')
    if (azulRua) rua = azulRua
  }
  if (!cep) {
    const azulCep = parseCampoRotuloValor('cep')
    if (azulCep) {
      const cepClean = azulCep.replace(/\D/g, '')
      if (cepClean.length === 8) {
        cep = `${cepClean.slice(0, 5)}-${cepClean.slice(5)}`
      }
    }
  }
  if (!bairro) {
    const azulBairro = parseCampoRotuloValor('bairro')
    if (azulBairro) bairro = azulBairro
  }
  if (!cidade) {
    const azulCidade = parseCampoRotuloValor('cidade')
    if (azulCidade) cidade = azulCidade
  }
  if (!estado) {
    const azulUf = parseCampoRotuloValor('uf')
    if (azulUf && azulUf.length === 2) {
      estado = azulUf.toUpperCase()
    }
  }

  if (!rua) {
    const endResidencialMatch =
      /endere[çc]o\s+residencial[*\s|:/]+\n*([^\n|/]+?)(?=(?:\s*[|*/]?\s*(?:complemento|cep|uf|bairro|cidade|e-mail|telefone)|\n|\||\/|$))/i.exec(
        textoUtilCliente,
      )
    if (endResidencialMatch) {
      const rawEnd = sanitizarTextoExtraido(endResidencialMatch[1])
      if (rawEnd.length > 3 && !isTextoCabecalhoOuInvalido(rawEnd)) {
        rua = rawEnd
      }
    }
  }

  // (b) Caso Auto / Allianz PF: linha única completa no bloco "SUAS INFORMAÇÕES":
  let enderecoLinhaUnica = ''
  if (!rua && suasInfoText) {
    const endSuasMatch = /Endere[çc]o[*\s|:]+([^\n|]+)/i.exec(suasInfoText)
    if (endSuasMatch) {
      enderecoLinhaUnica = endSuasMatch[1].trim()
    }
  }

  if (enderecoLinhaUnica) {
    const partes = enderecoLinhaUnica.split('-').map((p) => p.trim())
    if (partes.length >= 2) {
      const logradouroComp = partes[0]
      const pedacosLogr = logradouroComp.split(',').map((p) => p.trim())
      rua = pedacosLogr[0] || ''
      if (pedacosLogr.length >= 2) {
        numero = pedacosLogr[1]
      }
      if (pedacosLogr.length >= 3) {
        const comp = pedacosLogr.slice(2).join(', ')
        if (numero) {
          numero = `${numero}, ${comp}`
        } else {
          numero = comp
        }
      }

      for (let i = 1; i < partes.length; i++) {
        const parte = partes[i]
        const cepM = /\b([0-9]{5}-?[0-9]{3})\b/.exec(parte)
        if (cepM && !cep) {
          const cRaw = cepM[1].replace(/\D/g, '')
          cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
          continue
        }

        const cidUfM = /([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})\b/.exec(parte)
        if (cidUfM) {
          const candidataCidade = cidUfM[1].trim()
          if (!isTextoCabecalhoOuInvalido(candidataCidade)) {
            cidade = candidataCidade
            estado = cidUfM[2].trim().toUpperCase()
          }
          continue
        }

        if (!bairro && !isTextoCabecalhoOuInvalido(parte)) {
          bairro = parte
        }
      }
    } else {
      rua = enderecoLinhaUnica
    }
  }

  // Se não extraiu endereço em linha única, tentar os campos individuais de Allianz Condomínio
  if (!rua) {
    const endCorrespMatch = /endere[çc]o\s+de\s+correspond[êe]ncia[:\s]+([^\n|]+)/i.exec(
      textoUtilCliente,
    )
    if (endCorrespMatch) {
      rua = endCorrespMatch[1].trim()
    }
  }

  if (!bairro) {
    const bairroMatch =
      /(?:bairro)[*\s|:/]+([A-Za-zÀ-ÿ0-9\s.-]+?)(?=(?:\s*[|*/]?\s*(?:cidade|uf|cep|e-mail|telefone|ve[íi]culo)|\n|\||\/|$))/i.exec(
        textoUtilCliente,
      )
    if (bairroMatch) {
      const b = sanitizarTextoExtraido(bairroMatch[1])
      if (!isTextoCabecalhoOuInvalido(b) && b !== '-') bairro = b
    }
  }

  if (!cidade || !estado) {
    const cidadeUfMatch = /cidade\/uf[:\s/]+([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})/i.exec(textoUtilCliente)
    if (cidadeUfMatch) {
      const candidata = sanitizarTextoExtraido(cidadeUfMatch[1])
      if (!isTextoCabecalhoOuInvalido(candidata)) {
        cidade = candidata
        estado = cidadeUfMatch[2].trim().toUpperCase()
      }
    } else {
      if (!cidade) {
        const cidMatch =
          /(?:cidade)[*\s|:/]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*/]?\s*(?:uf|estado|e-mail|telefone|ve[íi]culo)|\n|\||\/|$))/i.exec(
            textoUtilCliente,
          )
        if (cidMatch) {
          const c = sanitizarTextoExtraido(cidMatch[1])
          if (!isTextoCabecalhoOuInvalido(c) && c !== '-') cidade = c
        }
      }
      if (!estado) {
        const ufMatch = /(?:uf|estado)[*\s|:/]+([A-Z]{2})\b/i.exec(textoUtilCliente)
        if (ufMatch) estado = ufMatch[1].trim().toUpperCase()
      }
    }
  }

  // CEP no texto se ainda faltar: "CEP 58037-335" ou "CEP: 52061-540"
  if (!cep) {
    const cepMatch =
      /(?:cep)[*\s|:]+([0-9]{5}-?[0-9]{3})/i.exec(textoUtilCliente) ||
      /(?:cep\s+pernoite)[*\s|:]+([0-9]{5}-?[0-9]{3})/i.exec(text)
    if (cepMatch) {
      const cRaw = cepMatch[1].replace(/\D/g, '')
      cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
    }
  }

  // Bloco "Endereço do local segurado" (usado em condomínio / residencial)
  if (!numero || !rua) {
    const localSeguradoMatch = /endere[çc]o\s+do\s+local\s+segurado[:\s]+([^\n]+)/i.exec(text)
    if (localSeguradoMatch) {
      const rawLocal = localSeguradoMatch[1].trim()
      const partes = rawLocal.split('-').map((p) => p.trim())
      if (partes.length >= 2) {
        const ruaNum = partes[0]
        const numMatch = /,\s*(\d+[A-Za-z0-9\s/]*)$/.exec(ruaNum)
        if (numMatch) {
          if (!numero) numero = numMatch[1].trim()
          const ruaExtraida = ruaNum.substring(0, numMatch.index).trim()
          if (!rua || rua.length < ruaExtraida.length) {
            rua = ruaExtraida
          }
        } else if (!rua) {
          rua = ruaNum
        }

        if (!bairro && partes[1] && !isTextoCabecalhoOuInvalido(partes[1])) {
          bairro = partes[1]
        }

        for (let i = 1; i < partes.length; i++) {
          const p = partes[i]
          const cMatch = /([0-9]{5}-?[0-9]{3})/.exec(p)
          if (cMatch && !cep) {
            const cRaw = cMatch[1].replace(/\D/g, '')
            cep = `${cRaw.slice(0, 5)}-${cRaw.slice(5)}`
          }
          const cidUf = /([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})/.exec(p)
          if (cidUf) {
            const c = cidUf[1].trim()
            if (!cidade && !isTextoCabecalhoOuInvalido(c)) cidade = c
            if (!estado) estado = cidUf[2].trim().toUpperCase()
          }
        }
      }
    }
  }

  // Se a rua tem número embutido tipo "Rua ..., 55"
  if (rua && !numero) {
    const rNumMatch = /,\s*(\d+[A-Za-z0-9\s/]*)$/.exec(rua)
    if (rNumMatch) {
      numero = rNumMatch[1].trim()
      rua = rua.substring(0, rNumMatch.index).trim()
    }
  }

  // =========================================================================
  // FALLBACK GLOBAL RESILIENTE ANCORADO NO CEP (Rede de segurança final)
  // Localizar o CEP (\d{5}-\d{3}) no texto útil e, a partir dele, capturar:
  // - Rejeitar qualquer ocorrência de CEP cujo contexto contenha termos negativos:
  //   pernoite, coberturas, assistência, cotação, orçamento, vigência, etc.
  // - A ocorrência do CEP só vale se o bloco contiver os rótulos reais de endereço residencial:
  //   (Endereço residencial/Complemento/Bairro/Cidade/UF)
  // =========================================================================
  if (!cep || !rua || !cidade || !estado || !bairro) {
    const normalizarRotulo = (s: string) =>
      s
        .toLowerCase()
        .replace(/[*_#:|-]/g, '')
        .trim()

    const rawLines = textoUtilCliente.split(/\r?\n/).map((l) => l.trim())
    const lines = rawLines.filter((l) => l.length > 0)

    interface CepCandidato {
      lineIndex: number
      cep: string
      temTermoNegativo: boolean
      temRotulosEndereco: boolean
      score: number
      uf: string
      ufIndex: number
      rua: string
      numero: string
      bairro: string
      cidade: string
    }

    const candidatosCep: CepCandidato[] = []

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j]
      const cepMatch = /\b([0-9]{5}-[0-9]{3})\b/.exec(line)
      if (cepMatch) {
        const foundCep = cepMatch[1]

        // Analisar contexto em janela de linhas vizinhas (-8 a +8 linhas)
        const startViz = Math.max(0, j - 8)
        const endViz = Math.min(lines.length - 1, j + 8)
        const janelaViz = lines.slice(startViz, endViz + 1).join(' ')
        const temNegativo = contemTermoNegativoEndereco(janelaViz)
        const temRotulos = /endere[çc]o\s+residencial|endere[çc]o|bairro|cidade/i.test(janelaViz)

        let score = temNegativo ? -100 : 0
        if (temRotulos) score += 30

        let ufFound = ''
        let ufIndex = -1

        // 1. Procurar UF adjacente nas linhas subsequentes ou na própria linha
        const ufNaLinha = /\b([A-Z]{2})\b/.exec(line.replace(foundCep, ''))
        if (ufNaLinha && BRAZILIAN_STATES.includes(ufNaLinha[1])) {
          ufFound = ufNaLinha[1]
          score += 20
        } else {
          for (let u = j + 1; u <= Math.min(lines.length - 1, j + 4); u++) {
            const candUf = lines[u]
              .replace(/[*_#:|-]/g, '')
              .trim()
              .toUpperCase()
            if (/^[A-Z]{2}$/.test(candUf) && BRAZILIAN_STATES.includes(candUf)) {
              ufFound = candUf
              ufIndex = u
              score += 20
              break
            }
          }
        }

        // 2. Bairro e Cidade subsequentes
        let candBairro = ''
        let candCidade = ''
        const startAfter = ufIndex > 0 ? ufIndex : j
        const candSubseq: string[] = []
        for (let s = startAfter + 1; s <= Math.min(lines.length - 1, startAfter + 5); s++) {
          let lSub = lines[s].replace(/^\|+|\|+$/g, '').trim()
          lSub = sanitizarTextoExtraido(lSub)
          const lSubNorm = normalizarRotulo(lSub)
          if (
            !lSub ||
            lSub === '-' ||
            lSubNorm === 'bairro' ||
            lSubNorm === 'cidade' ||
            lSubNorm === 'uf' ||
            lSubNorm === 'e-mail' ||
            lSubNorm === 'email' ||
            lSubNorm === 'telefone' ||
            lSubNorm.startsWith('dados') ||
            lSubNorm.startsWith('veículo') ||
            contemTermoNegativoEndereco(lSub) ||
            isTextoCabecalhoOuInvalido(lSub)
          ) {
            continue
          }
          candSubseq.push(lSub)
        }

        if (candSubseq[0]) {
          candBairro = candSubseq[0]
          score += 10
        }
        if (candSubseq[1]) {
          candCidade = candSubseq[1]
          score += 10
        }

        // 3. Logradouro + número anteriores ao CEP
        let candRua = ''
        let candNumero = ''
        for (let k = j - 1; k >= Math.max(0, j - 5); k--) {
          let lRua = lines[k].replace(/^\|+|\|+$/g, '').trim()
          if (
            lRua === '-' ||
            isTextoCabecalhoOuInvalido(lRua) ||
            contemTermoNegativoEndereco(lRua)
          ) {
            continue
          }
          const candNorm = normalizarRotulo(lRua)
          if (
            candNorm === 'endereço' ||
            candNorm === 'endereco' ||
            candNorm === 'endereço residencial' ||
            candNorm === 'endereco residencial' ||
            candNorm === 'complemento' ||
            candNorm === 'cep' ||
            candNorm === 'uf' ||
            candNorm.startsWith('segurado') ||
            candNorm.startsWith('nascimento') ||
            candNorm.startsWith('cpf')
          ) {
            continue
          }

          if (lRua.length > 3) {
            // Verificar se começa com prefixos de logradouro real
            const isLogradouroReal =
              /^(?:R\s|RUA\s|AV\s|AVENIDA\s|TRAVESSA\s|ALAMEDA\s|RODOVIA\s|ESTRADA\s|PRACA\s|PRAÇA\s)/i.test(
                lRua,
              )
            if (isLogradouroReal) {
              score += 40
            }

            const pedacos = lRua.split(',').map((p) => p.trim())
            candRua = pedacos[0] || lRua
            if (pedacos.length >= 2) {
              candNumero = pedacos.slice(1).join(', ')
              score += 15
            } else {
              // Tentar extrair número no final "Rua Tal 55"
              const numFinalMatch = /\s+(\d+[A-Za-z0-9\s/]*)$/.exec(candRua)
              if (numFinalMatch && !/^\d{4}$/.test(numFinalMatch[1])) {
                candNumero = numFinalMatch[1].trim()
                candRua = candRua.substring(0, numFinalMatch.index).trim()
                score += 10
              }
            }
            break
          }
        }

        candidatosCep.push({
          lineIndex: j,
          cep: foundCep,
          temTermoNegativo: temNegativo,
          temRotulosEndereco: temRotulos,
          score,
          uf: ufFound,
          ufIndex,
          rua: candRua,
          numero: candNumero,
          bairro: candBairro,
          cidade: candCidade,
        })
      }
    }

    // Filtrar candidatos que não tenham termos negativos e que possuam rótulos reais de endereço residencial
    const validos = candidatosCep
      .filter((c) => !c.temTermoNegativo && c.temRotulosEndereco)
      .sort((a, b) => b.score - a.score)

    const melhorCandidato =
      validos[0] ||
      candidatosCep.filter((c) => !c.temTermoNegativo).sort((a, b) => b.score - a.score)[0]

    if (melhorCandidato) {
      if (!cep) cep = melhorCandidato.cep
      if (!estado && melhorCandidato.uf) estado = melhorCandidato.uf
      if (
        !bairro &&
        melhorCandidato.bairro &&
        !contemTermoNegativoEndereco(melhorCandidato.bairro)
      ) {
        bairro = melhorCandidato.bairro
      }
      if (
        !cidade &&
        melhorCandidato.cidade &&
        !contemTermoNegativoEndereco(melhorCandidato.cidade)
      ) {
        cidade = melhorCandidato.cidade
      }
      if (!rua && melhorCandidato.rua && !contemTermoNegativoEndereco(melhorCandidato.rua)) {
        rua = melhorCandidato.rua
      }
      if (!numero && melhorCandidato.numero) {
        numero = melhorCandidato.numero
      }
    }
  }

  // Validação final de sanitização contra títulos conhecidos de privacidade/LGPD
  if (isTextoCabecalhoOuInvalido(cidade)) cidade = ''
  if (isTextoCabecalhoOuInvalido(bairro)) bairro = ''
  if (isTextoCabecalhoOuInvalido(rua)) rua = ''

  return {
    nome,
    cpfCnpj,
    tipoPessoa,
    dataNascimento: dataNasc || undefined,
    email: email || undefined,
    telefone: telefone || undefined,
    cep: cep || undefined,
    rua: rua || undefined,
    numero: numero || undefined,
    bairro: bairro || undefined,
    cidade: cidade || undefined,
    estado: estado || undefined,
  }
}

function extrairCondutor(
  text: string,
  nomeSegurado: string,
  cpfSegurado: string,
): PropostaCondutorExtraido {
  let nomeCondutor = ''
  let cpfCondutor = ''
  let dataNasc = ''
  let parentesco = ''
  let mesmo = true

  // 1. Caso Azul Seguros / Porto Seguro ("Questionário de avaliação de risco"):
  // No layout Azul Tradicional:
  // "PAULA GABRIELA DE MORAIS NEGREIROS 088.181.234-08"
  // "58037-335"
  // "Condutor Nascimento"
  // "15/10/1996"
  // "CPF"
  const questionarioSecMatch =
    /(?:Question[áa]rio\s+de\s+avalia[çc][ãa]o\s+de\s+risco|Perfil\s+do\s+condutor)[\s\S]*?(?=(?:Coberturas|Assist[êe]ncias|Declara[çc][ãa]o|Termos|Uso\s+Interno|\n{3,}|$))/i.exec(
      text,
    )
  const questSec = questionarioSecMatch ? questionarioSecMatch[0] : ''

  if (questSec) {
    // Procura por nome maiúsculo seguido por CPF na mesma linha ou linhas próximas
    const condLinhaMatch = /([A-ZÀ-ÿ\s]{4,80})\s+([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})/i.exec(
      questSec,
    )
    if (condLinhaMatch) {
      const candNome = sanitizarTextoExtraido(condLinhaMatch[1])
      if (isNomePessoaValido(candNome)) {
        nomeCondutor = candNome
        cpfCondutor = condLinhaMatch[2].replace(/\D/g, '')
      }
    }

    // Se achou o bloco mas não por linha direta, procura o nascimento do condutor
    const nascCondQuebradoMatch =
      /(?:condutor\s+nascimento|nascimento\s+condutor|condutor[^\n]*\nnascimento)[*\s|:]*\n+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
        questSec,
      )
    if (nascCondQuebradoMatch) {
      dataNasc = parseDataFlexivel(nascCondQuebradoMatch[1])
    } else {
      const nascCondMatch =
        /(?:condutor\s+nascimento|nascimento\s+condutor|nascimento)[*\s|:]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
          questSec,
        )
      if (nascCondMatch) {
        dataNasc = parseDataFlexivel(nascCondMatch[1])
      }
    }

    // Procurar data de nascimento isolada caso ainda não capturada
    if (!dataNasc) {
      const linesQuest = questSec.split(/\r?\n/)
      for (const lq of linesQuest) {
        const dM = /^\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*$/.exec(lq)
        if (dM) {
          const parsed = parseDataFlexivel(dM[1])
          const y = parseInt(parsed.split('-')[0], 10)
          if (y > 1920 && y < new Date().getFullYear() - 15) {
            dataNasc = parsed
            break
          }
        }
      }
    }
  }

  // 2. Isolar seção "INFORMAÇÕES DO CONDUTOR PRINCIPAL" (Allianz) se houver
  if (!nomeCondutor) {
    const condSectionMatch =
      /INFORMA[ÇC][ÕO]ES\s+DO\s+CONDUTOR(?:\s+PRINCIPAL)?[\s\S]*?(?=(?:INFORMA[ÇC][ÕO]ES\s+DO|INFORMA[ÇC][ÕO]ES\s+DE|INFORMA[ÇC][ÕO]ES\s+DA|COBERTURAS|OFERTA|DECLARA[ÇC][ÃA]O|P[áa]gina|\n\n\n|$))/i.exec(
        text,
      )

    if (condSectionMatch) {
      const condSec = condSectionMatch[0]
      const nomeCondSec =
        /(?:Nome|Condutor)[*\s|:]+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)(?=(?:\s*[|*]?\s*(?:CPF|Idade|Estado|Parentesco)|\||\n|$))/i.exec(
          condSec,
        )
      if (nomeCondSec) {
        const raw = sanitizarTextoExtraido(nomeCondSec[1])
        if (isNomePessoaValido(raw)) {
          nomeCondutor = raw
        }
      }
      const cpfCondSec = /(?:CPF)[*\s|:]+([0-9.\-/]{11,14})/i.exec(condSec)
      if (cpfCondSec) {
        cpfCondutor = cpfCondSec[1].replace(/\D/g, '')
      }
    }
  }

  if (!nomeCondutor) {
    // Procurar por bloco "Condutor Principal", "Principal Condutor", "Condutor habitual"
    const condMatch =
      /(?:condutor\s+principal|principal\s+condutor|condutor\s+habitual|perfil\s+do\s+condutor)[*\s|:]+([A-Za-zÀ-ÿ\s.-]+?)(?=\s*[|*]?\s*(?:cpf|nasc|parentesco|sexo)|\n|\||$)/i.exec(
        text,
      )

    if (condMatch) {
      const cNome = sanitizarTextoExtraido(condMatch[1])
      if (isNomePessoaValido(cNome)) {
        nomeCondutor = cNome
      }
    }
  }

  // CPF do condutor global se não achou na seção
  if (!cpfCondutor) {
    const cpfCondMatch = /condutor.*?(?:cpf)[*\s|:]+([0-9.\-/]{11,14})/i.exec(text)
    if (cpfCondMatch) {
      cpfCondutor = cpfCondMatch[1].replace(/\D/g, '')
    }
  }

  if (nomeCondutor && nomeSegurado) {
    const n1 = nomeCondutor.trim().toLowerCase()
    const n2 = nomeSegurado.trim().toLowerCase()
    if (n1 !== n2 && !n1.includes(n2) && !n2.includes(n1)) {
      mesmo = false
    }
  }

  const nomeSeguradoValido = isNomePessoaValido(nomeSegurado) ? nomeSegurado : ''

  if (!nomeCondutor && nomeSeguradoValido) {
    nomeCondutor = nomeSeguradoValido
    cpfCondutor = cpfSegurado
    mesmo = true
  }

  // Garantir que condutor NUNCA receba "Azul Tradicional" ou qualquer marca/produto
  const condutorFinal = isNomePessoaValido(nomeCondutor) ? nomeCondutor : nomeSeguradoValido || ''

  return {
    nome: condutorFinal,
    cpf: cpfCondutor || undefined,
    dataNascimento: dataNasc || undefined,
    parentesco: parentesco || undefined,
    mesmoQueSegurado: mesmo,
  }
}

function extrairRenovacao(text: string): PropostaRenovacaoExtraida {
  const t = text.toLowerCase()
  const isRenovacao =
    t.includes('renovação') ||
    t.includes('renovacao') ||
    t.includes('apólice anterior') ||
    t.includes('apolice anterior') ||
    t.includes('seguradora anterior')

  let apoliceAnt = ''
  let seguradoraAnt = ''
  let classeBonus = ''

  // 1. Procura na linha da Azul / Porto: "Apólice 12806713" ou "Apólice: 12806713"
  // Na Azul, sob "Tipo de Operação: Renovação da Cia", há "Seguradora: Azul Seguros", "Sucursal 3", "Apólice 12806713", "Bônus Classe 1"
  if (isRenovacao) {
    const azulRenovMatch =
      /(?:ap[oó]lice|ap[oó]lice\s+anterior|n[ºo.]?\s+anterior)[*\s|:]+([0-9]{6,20})\b/i.exec(text)
    if (azulRenovMatch) {
      apoliceAnt = azulRenovMatch[1].trim()
    }
  }

  const antMatch = /(?:ap[oó]lice\s+anterior|n[ºo.]?\s+anterior)[*\s|:]+([0-9.\-/]{4,20})/i.exec(
    text,
  )
  if (antMatch && !apoliceAnt) {
    apoliceAnt = antMatch[1].trim()
  }

  // Seguradora anterior:
  // Se for "Renovação da Cia" e tiver "Seguradora: Azul Seguros" ou "Seguradora Anterior: ..."
  if (t.includes('renovação da cia') || t.includes('renovacao da cia')) {
    const segCiaMatch =
      /(?:seguradora)[:\s]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*]?\s*(?:sucursal|ap[oó]lice|item|b[oó]nus)|\n|\||$))/i.exec(
        text,
      )
    if (segCiaMatch) {
      seguradoraAnt = sanitizarTextoExtraido(segCiaMatch[1])
    }
  }

  if (!seguradoraAnt) {
    const segAntMatch =
      /(?:seguradora\s+anterior|cia\s+anterior)[*\s|:]+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s*[|*]?\s*(?:ap[oó]lice|b[oó]nus|fim)|\n|\||$))/i.exec(
        text,
      )
    if (segAntMatch) {
      seguradoraAnt = sanitizarTextoExtraido(segAntMatch[1])
    }
  }

  const bonusMatch =
    /(?:classe\s+de\s+b[oó]nus|classe\s+b[oó]nus|b[oó]nus\s+classe|b[oó]nus)[*\s|:]+([0-9]{1,2})/i.exec(
      text,
    )
  if (bonusMatch) {
    classeBonus = bonusMatch[1].trim()
  }

  return {
    isRenovacao,
    apoliceAnterior: apoliceAnt || undefined,
    seguradoraAnterior: seguradoraAnt || undefined,
    classeBonus: classeBonus || undefined,
  }
}

// =========================================================================
// EXTRATOR ESPECIALIZADO: ALLIANZ CONDOMÍNIO (Layout Novo / Direto)
// =========================================================================

export function extrairAllianzCondominioCliente(text: string): {
  numeroProposta?: string
  numeroApolice?: string
  vigenciaInicio?: string
  vigenciaFim?: string
  segurado?: Partial<PropostaClienteExtraido>
} | null {
  // 1. Número da Proposta
  // Ex: "Nº. da Proposta: 141342045" ou "Nº. da Proposta: **141342045**"
  let numeroProposta: string | undefined
  const propMatch =
    /n[ºo.]?\s+da\s+proposta[*\s|:]+([0-9]{6,15})\b/i.exec(text) ||
    /n[ºo.]?\s+proposta[*\s|:]+([0-9]{6,15})\b/i.exec(text)
  if (propMatch) {
    numeroProposta = propMatch[1].trim()
  }

  // 2. Número da Apólice
  // Ex: "Nº. da Apólice: 517720262P160080398" ou "Nº. da Apólice: **517720262P160080398**"
  let numeroApolice: string | undefined
  const apoliceMatch =
    /n[ºo.]?\s+da\s+ap[oó]lice[*\s|:]+([A-Za-z0-9]{8,25})\b/i.exec(text) ||
    /ap[oó]lice[*\s|:]+([A-Za-z0-9]{8,25})\b/i.exec(text)
  if (apoliceMatch) {
    const rawApol = apoliceMatch[1].trim()
    // Evita falsos positivos como palavras genéricas
    if (/[0-9]/.test(rawApol) && rawApol.length >= 8) {
      numeroApolice = rawApol
    }
  }

  // 3. Vigência
  // Ex: "Vigência: das 24H de 25/10/2026 às 24H de 25/10/2027"
  let vigenciaInicio: string | undefined
  let vigenciaFim: string | undefined
  const vigMatch =
    /vig[êe]ncia[*\s|:]+das?\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:de|do\s+dia)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+(?:at[ée]|às|as)\s+[0-9]{1,2}h(?:[0-9]{2})?\s+(?:de|do\s+dia)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    )
  if (vigMatch) {
    vigenciaInicio = parseDataFlexivel(vigMatch[1])
    vigenciaFim = parseDataFlexivel(vigMatch[2])
  }

  // 4. Seção SUAS INFORMAÇÕES
  // Isolar de "SUAS INFORMAÇÕES" até "INFORMAÇÕES DO SEGURO" ou "COBERTURAS"
  const suasInfoMatch =
    /(?:#+\s*|\*{0,2})SUAS\s+INFORMA[ÇC][ÕO]ES\*{0,2}[\s\S]*?(?=(?:(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DO\s+SEGURO|(?:#+\s*|\*{0,2})COBERTURAS|(?:#+\s*|\*{0,2})INFORMA[ÇC][ÕO]ES\s+DE\s+PAGAMENTO|$))/i.exec(
      text,
    )

  const sectionText = suasInfoMatch ? suasInfoMatch[0] : ''

  const segurado: Partial<PropostaClienteExtraido> = {
    tipoPessoa: 'PJ',
  }

  const isTermoInvalidoNomeCondominio = (val: string): boolean => {
    const v = val.toLowerCase()
    return (
      v.includes('local de risco') ||
      v.includes('inspeção prévia') ||
      v.includes('inspecao previa') ||
      v.includes('seguradora') ||
      v.includes('proponente') ||
      v.includes('assinatura') ||
      v.includes('corretora') ||
      v.includes('cláusula') ||
      v.includes('clausula') ||
      isTextoCabecalhoOuInvalido(val)
    )
  }

  if (sectionText) {
    // (a) Nome: valor IMEDIATAMENTE após "**Nome:**" ou "Nome:"
    const nomeMatch =
      /(?:^|[|\n\s])\*{0,2}Nome:\*{0,2}\s*([^\n|*]+?)(?=(?:\s+\*{0,2}CNPJ:|\s+\*{0,2}CPF:|\s*\||\n|$))/i.exec(
        sectionText,
      )
    if (nomeMatch) {
      const candNome = sanitizarTextoExtraido(nomeMatch[1])
      if (candNome && !isTermoInvalidoNomeCondominio(candNome)) {
        segurado.nome = candNome
      }
    }

    // (b) CNPJ: "CNPJ: 57.349.112/0001-70"
    const cnpjMatch =
      /\*{0,2}CNPJ:\*{0,2}\s*([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}|[0-9]{14})\b/i.exec(
        sectionText,
      )
    if (cnpjMatch) {
      const cleanCnpj = cnpjMatch[1].replace(/\D/g, '')
      if (cleanCnpj.length === 14) {
        segurado.cpfCnpj = cleanCnpj
        segurado.tipoPessoa = 'PJ'
      }
    }

    // (c) Email: "E-mail: condominio@moriacontadores.com.br"
    const emailMatch =
      /\*{0,2}E-?mail:\*{0,2}\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.exec(sectionText)
    if (emailMatch) {
      segurado.email = emailMatch[1].trim()
    }

    // (d) Telefone: "Tel: 985852935" ou "(81) 98585-2935"
    const telMatch =
      /\*{0,2}(?:Tel|Telefone|Celular):\*{0,2}\s*(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}|[0-9]{8,11})\b/i.exec(
        sectionText,
      )
    if (telMatch) {
      const rawDigits = telMatch[1].replace(/\D/g, '')
      if (rawDigits.length === 8 || rawDigits.length === 9) {
        // Verificar DDD da cidade/UF na seção ou documento (OLINDA/PE -> 81)
        if (/OLINDA|RECIFE|\bPE\b/i.test(text)) {
          const comDdd = `81${rawDigits}`
          if (comDdd.length === 11) {
            segurado.telefone = `(${comDdd.slice(0, 2)}) ${comDdd.slice(2, 7)}-${comDdd.slice(7)}`
          } else if (comDdd.length === 10) {
            segurado.telefone = `(${comDdd.slice(0, 2)}) ${comDdd.slice(2, 6)}-${comDdd.slice(6)}`
          }
        }
      } else if (rawDigits.length === 11) {
        segurado.telefone = `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 7)}-${rawDigits.slice(7)}`
      } else if (rawDigits.length === 10) {
        segurado.telefone = `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 6)}-${rawDigits.slice(6)}`
      }
    }

    // (e) Endereço de correspondência: rua + número
    // Ex: "Endereço de correspondência: R. CORONEL JOÃO RIBEIRO, 1287"
    const endCorrespMatch =
      /\*{0,2}Endere[çc]o\s+de\s+correspond[êe]ncia:\*{0,2}\s*([^\n|]+)/i.exec(sectionText)
    if (endCorrespMatch) {
      const rawEnd = sanitizarTextoExtraido(endCorrespMatch[1])
      const virgulaMatch = /^(.*?),\s*(\d+[A-Za-z0-9\s/]*)$/.exec(rawEnd)
      if (virgulaMatch) {
        segurado.rua = virgulaMatch[1].trim()
        segurado.numero = virgulaMatch[2].trim()
      } else {
        segurado.rua = rawEnd
      }
    }

    // (f) Bairro: "Bairro: BAIRRO NOVO"
    const bairroMatch = /\*{0,2}Bairro:\*{0,2}\s*([^\n|*]+?)(?=(?:\s+\*{0,2}[A-Z]|\n|$))/i.exec(
      sectionText,
    )
    if (bairroMatch) {
      const b = sanitizarTextoExtraido(bairroMatch[1])
      if (b && !isTextoCabecalhoOuInvalido(b)) {
        segurado.bairro = b
      }
    }

    // (g) Cidade/UF e CEP
    // Ex: "Cidade/UF: OLINDA/PE CEP: 53030-040"
    const cidUfMatch = /\*{0,2}Cidade\/UF:\*{0,2}\s*([A-Za-zÀ-ÿ\s.-]+?)\/([A-Z]{2})\b/i.exec(
      sectionText,
    )
    if (cidUfMatch) {
      const c = sanitizarTextoExtraido(cidUfMatch[1])
      if (c && !isTextoCabecalhoOuInvalido(c)) {
        segurado.cidade = c
        segurado.estado = cidUfMatch[2].trim().toUpperCase()
      }
    }

    const cepMatch = /\*{0,2}CEP:\*{0,2}\s*([0-9]{5}-?[0-9]{3})\b/i.exec(sectionText)
    if (cepMatch) {
      const rawCep = cepMatch[1].replace(/\D/g, '')
      segurado.cep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`
    }
  }

  // Fallback para nome: caso no cabeçalho antes de "Essa é a proposta do seu seguro Allianz Condomínio"
  if (!segurado.nome) {
    const cabecalhoMatch =
      /(?:^|\n)\s*([A-Z0-9\s.,'/-]{4,80})\s*\n\s*Essa\s+[ée]\s+a\s+proposta\s+do\s+seu\s+seguro\s+Allianz\s+Condom[íi]nio/i.exec(
        text,
      )
    if (cabecalhoMatch) {
      const cand = sanitizarTextoExtraido(cabecalhoMatch[1])
      if (cand && !isTermoInvalidoNomeCondominio(cand)) {
        segurado.nome = cand
      }
    }
  }

  return {
    numeroProposta,
    numeroApolice,
    vigenciaInicio,
    vigenciaFim,
    segurado,
  }
}

// =========================================================================
// LEITOR INLINE DA VARIANTE AZUL SEGUROS / PORTO SEGURO
// Trata o formato em que cada seção vem em UMA ÚNICA LINHA,
// com grupos de rótulos em negrito ("**Rótulo1 Rótulo2...**") seguidos
// inline pelos seus valores correspondentes.
// =========================================================================

interface SegmentoNegritoInline {
  rotulo: string
  valores: string
}

function parseSegmentosNegrito(linha: string): SegmentoNegritoInline[] {
  const segmentos: SegmentoNegritoInline[] = []
  // Expressão regular que casa cada grupo de negrito e o texto seguinte até o próximo negrito ou fim de linha
  const regex = /\*\*([^*]+)\*\*([^*]*)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(linha)) !== null) {
    segmentos.push({
      rotulo: match[1].trim(),
      valores: match[2].trim(),
    })
  }
  return segmentos
}

export function extrairPropostaInlineAzul(text: string): {
  segurado?: Partial<PropostaClienteExtraido>
  condutor?: Partial<PropostaCondutorExtraido>
  veiculo?: Partial<PropostaVeiculoExtraido>
  renovacao?: Partial<PropostaRenovacaoExtraida>
} | null {
  const linhas = text.split(/\r?\n/)

  let seguradoRes: Partial<PropostaClienteExtraido> | undefined
  let condutorRes: Partial<PropostaCondutorExtraido> | undefined
  let veiculoRes: Partial<PropostaVeiculoExtraido> | undefined
  let renovacaoRes: Partial<PropostaRenovacaoExtraida> | undefined

  for (const rawLinha of linhas) {
    const linha = rawLinha.trim()
    if (!linha || !linha.includes('**')) continue

    const segmentos = parseSegmentosNegrito(linha)
    if (segmentos.length === 0) continue

    // 1. SEÇÃO SEGURADO / PROFISSÃO (Linha 1)
    // Ex: **Dados Gerais** **Segurado(a) Nascimento CPF** LIVIA LOURENCO FERNANDES DA CUNHA BARROS 02/08/1990 057.365.924-95 **Sexo Profissão País de nascimento** Feminino 387-Administradores Brasil
    for (const seg of segmentos) {
      const rotuloLower = seg.rotulo.toLowerCase()

      // SEGURADO(A): grupo cujos rótulos incluem "Segurado(a)" ou "Segurado"
      if (rotuloLower.includes('segurado')) {
        const trecho = seg.valores.trim()
        if (trecho) {
          // Extração dirigida por valor:
          // nome = todos os tokens antes do primeiro token que casa com data dd/mm/aaaa
          // dataNascimento = esse token
          // cpfCnpj = token seguinte (CPF com ou sem máscara)
          const dataMatch = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/.exec(trecho)
          if (dataMatch) {
            const idxData = dataMatch.index
            const rawNome = trecho.substring(0, idxData).trim()
            const dataNascRaw = dataMatch[1]
            const posAposData = idxData + dataNascRaw.length
            const resto = trecho.substring(posAposData).trim()

            const cpfMatch = /([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/.exec(resto)
            const cpfEncontrado = cpfMatch ? cpfMatch[1].replace(/\D/g, '') : ''

            if (isNomePessoaValido(rawNome)) {
              seguradoRes = {
                ...seguradoRes,
                nome: rawNome,
                dataNascimento: parseDataFlexivel(dataNascRaw),
                cpfCnpj: cpfEncontrado || undefined,
                tipoPessoa: 'PF',
              }
            }
          }
        }
      }

      // 2. ENDEREÇO RESIDENCIAL & CONTATO (Linha 2)
      // Ex 1: **Endereço residencial Complemento CEP Bairro Cidade UF** R Doralice de Almeida Lyra, 55-58037-335 Jardim Oceania João Pessoa PB **E-mail Telefone Tipo de envio Enviar correspondência para** paulagabrieladv@gmail.com Celular: (83) 99112-9729 DIGITAL SEGURADO
      // Ex 2: **Endereço residencial Complemento CEP Bairro Cidade UF** Av Norte Miguel Arraes de Alencar, AP207BL4 52051-000 Tamarineira Recife PE 3533 **E-mail Telefone Tipo de envio Enviar correspondência para** NATHANFIGUEIREDO04@GMAIL.CO Celular: (81) 99706-6092 DIGITAL SEGURADO M
      if (
        rotuloLower.includes('endereço residencial') ||
        rotuloLower.includes('endereco residencial')
      ) {
        const trechoEnd = seg.valores.trim()
        if (trechoEnd) {
          // 1. CEP: regex /\b(\d{5}-\d{3})\b/ ou /\b(\d{5}-?\d{3})\b/ (suporta colado ao número tipo 55-58037-335)
          const cepMatch = /\b(\d{5}-\d{3})\b/.exec(trechoEnd) || /(\d{5}-?\d{3})/.exec(trechoEnd)
          if (cepMatch) {
            const rawCep = cepMatch[1].replace(/\D/g, '')
            const cepFormatado = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`
            const idxCep = cepMatch.index

            // 1. Tudo ANTES do CEP é o logradouro (manter rua como está, removendo apenas hífen terminal colado se houver)
            let textoAntes = trechoEnd.substring(0, idxCep).trim()
            textoAntes = textoAntes.replace(/-+$/, '').trim()

            let rua = textoAntes
            let numero = ''

            // Se houver número com vírgula padrão "Rua Tal, 55", separar
            // Mas se for formato completo como "Av Norte Miguel Arraes de Alencar, AP207BL4", manter a rua intacta conforme especificação
            // Regra: rua = "Av Norte Miguel Arraes de Alencar, AP207BL4"
            // Se o texto antes do CEP contém identificador de complemento/apartamento/bloco tipo "AP207BL4"
            // manter rua intacta ("Av Norte Miguel Arraes de Alencar, AP207BL4")
            const temComplementoColado = /\b(?:AP|BL|APTO|BLOCO|CASA|LOTE|QD)\d+/i.test(textoAntes)

            if (!temComplementoColado) {
              // Se o texto antes do CEP contém vírgula seguida de número simples: "Rua Tal, 55"
              // Se tiver letras complexas como AP207BL4 ou for especificação inline, mantém tudo em rua
              const numVirgulaSimplesMatch = /,\s*(\d{1,5}[A-Za-z]?)$/.exec(textoAntes)
              if (numVirgulaSimplesMatch) {
                numero = numVirgulaSimplesMatch[1].trim()
                rua = textoAntes.substring(0, numVirgulaSimplesMatch.index).trim()
              } else {
                const numEspacoMatch = /\s+(\d{1,5}[A-Za-z]?)$/.exec(textoAntes)
                if (numEspacoMatch && !/^\d{4}$/.test(numEspacoMatch[1])) {
                  numero = numEspacoMatch[1].trim()
                  rua = textoAntes.substring(0, numEspacoMatch.index).trim()
                }
              }
            }

            // Texto APÓS o CEP: ex "Tamarineira Recife PE 3533" ou "Jardim Oceania João Pessoa PB"
            const textoApos = trechoEnd.substring(idxCep + cepMatch[0].length).trim()

            // 2. UF: no trecho após o CEP, só aceitar token presente na lista canônica de UFs (BRAZILIAN_STATES).
            // "AV" e qualquer outra coisa NÃO é UF — rejeitar e deixar estado vazio.
            // 3. Descartar tokens puramente numéricos residuais ("3533") nesse trecho.
            // 4. Miolo entre CEP e UF = "Tamarineira Recife": separar bairro="Tamarineira" e cidade="Recife".
            // Se não der para discernir com certeza, atribuir o primeiro token ao bairro e deixar cidade vazia (campo faltante).
            // Nunca concatenar cidade no bairro nem inventar cidade.
            // 5. Cidade nunca termina em número, nunca é sigla de UF, nunca contém sigla de UF no final.
            const tokensApos = textoApos.split(/\s+/).filter(Boolean)

            // Localizar token canônico de UF no trecho após o CEP
            let idxUf = -1
            let estado = ''
            for (let i = 0; i < tokensApos.length; i++) {
              const tokU = tokensApos[i].toUpperCase()
              if (/^[A-Z]{2}$/.test(tokU) && BRAZILIAN_STATES.includes(tokU)) {
                estado = tokU
                idxUf = i
                break
              }
            }

            // Tokens entre o CEP e a UF (miolo)
            const tokensMiolo = (idxUf !== -1 ? tokensApos.slice(0, idxUf) : tokensApos).filter(
              (tok) => !/^\d+$/.test(tok),
            ) // descartar puramente numéricos residuais

            let bairro = ''
            let cidade = ''

            const cidadesConhecidas = [
              'joão pessoa',
              'joao pessoa',
              'são paulo',
              'sao paulo',
              'rio de janeiro',
              'belo horizonte',
              'porto alegre',
              'salvador',
              'curitiba',
              'recife',
              'fortaleza',
              'brasília',
              'brasilia',
              'campina grande',
              'jaboatão dos guararapes',
              'olinda',
              'paulista',
            ]

            if (tokensMiolo.length === 1) {
              // Se há apenas um token no miolo: atribuir ao bairro e deixar cidade vazia (campo faltante)
              bairro = tokensMiolo[0]
            } else if (tokensMiolo.length >= 2) {
              const ultimas3 = tokensMiolo.length >= 3 ? tokensMiolo.slice(-3).join(' ') : ''
              const ultimas2 = tokensMiolo.slice(-2).join(' ')
              const ultima1 = tokensMiolo[tokensMiolo.length - 1]

              if (ultimas3 && cidadesConhecidas.includes(ultimas3.toLowerCase())) {
                cidade = ultimas3
                bairro = tokensMiolo.slice(0, -3).join(' ')
              } else if (cidadesConhecidas.includes(ultimas2.toLowerCase())) {
                cidade = ultimas2
                bairro = tokensMiolo.slice(0, -2).join(' ')
              } else if (cidadesConhecidas.includes(ultima1.toLowerCase())) {
                cidade = ultima1
                bairro = tokensMiolo.slice(0, -1).join(' ')
              } else if (tokensMiolo.length === 2) {
                bairro = tokensMiolo[0]
                cidade = tokensMiolo[1]
              } else if (tokensMiolo.length === 3) {
                bairro = tokensMiolo[0]
                cidade = tokensMiolo.slice(1).join(' ')
              } else {
                // Se não der para discernir com certeza: atribuir o primeiro token ao bairro e deixar cidade vazia
                bairro = tokensMiolo[0]
                cidade = ''
              }
            }

            // 5. Validações estritas de cidade:
            // Cidade nunca termina em número, nunca é sigla de UF, nunca contém sigla de UF no final.
            if (cidade) {
              cidade = cidade.replace(/\s+\d+$/, '').trim()
              if (/^[A-Z]{2}$/i.test(cidade) && BRAZILIAN_STATES.includes(cidade.toUpperCase())) {
                cidade = ''
              }
              const ufFinalMatch = new RegExp(`\\s+(${BRAZILIAN_STATES.join('|')})$`, 'i')
              cidade = cidade.replace(ufFinalMatch, '').trim()
              if (/^\d+$/.test(cidade)) {
                cidade = ''
              }
            }

            // Validações de bairro: nunca termina em número residual nem sigla de UF
            if (bairro) {
              bairro = bairro.replace(/\s+\d+$/, '').trim()
              const ufFinalBairro = new RegExp(`\\s+(${BRAZILIAN_STATES.join('|')})$`, 'i')
              bairro = bairro.replace(ufFinalBairro, '').trim()
            }

            seguradoRes = {
              ...seguradoRes,
              cep: cepFormatado,
              rua: rua || undefined,
              numero: numero || undefined,
              bairro: bairro || undefined,
              cidade: cidade || undefined,
              estado: estado || undefined,
            }
          }
        }
      }

      // E-MAIL & TELEFONE (Linha 2 segundo grupo)
      // **E-mail Telefone Tipo de envio Enviar correspondência para** paulagabrieladv@gmail.com Celular: (83) 99112-9729 DIGITAL SEGURADO
      if (rotuloLower.includes('e-mail') && rotuloLower.includes('telefone')) {
        const trechoCont = seg.valores.trim()
        if (trechoCont) {
          const emMatch = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/.exec(trechoCont)
          if (emMatch) {
            seguradoRes = {
              ...seguradoRes,
              email: emMatch[1],
            }
          }
          const telMatch =
            /(?:celular|tel|telefone)?[:\s]*(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i.exec(
              trechoCont,
            )
          if (telMatch) {
            seguradoRes = {
              ...seguradoRes,
              telefone: telMatch[1].trim(),
            }
          }
        }
      }

      // 3. VEÍCULO (Linha 3)
      // Ex: **Veículo** **Placa Chassi Veículo Ano Fabricação / Modelo** QSI2A04 9BGEB48A0LG219020 6140 - - NOVO ONIX HATCH LT 1.0 12V FLEX 2020 / 2020 **Fipe Zero km Câmbio Blindado Kit Gás Pessoa com deficiência Isenção Fiscal Portas** 45179 N Manual Não Não Não Sem Isenção 5 **Combustível Categoria** GASOLINA/ALCOOL 10 - VEICULOS DE PASSEIO
      if (
        rotuloLower.includes('placa') &&
        rotuloLower.includes('chassi') &&
        rotuloLower.includes('veículo')
      ) {
        const trechoVeic = seg.valores.trim()
        if (trechoVeic) {
          // Placa
          let placa = ''
          const placaM = /\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/.exec(trechoVeic)
          if (placaM) placa = placaM[1]

          // Chassi
          let chassi = ''
          const chassiM = /\b([A-HJ-NPR-Z0-9]{17})\b/.exec(trechoVeic)
          if (chassiM) chassi = chassiM[1]

          // Anos
          let anoFab = 0
          let anoMod = 0
          const anoM = /\b(19\d{2}|20\d{2})\s*\/\s*(19\d{2}|20\d{2})\b/.exec(trechoVeic)
          if (anoM) {
            anoFab = parseInt(anoM[1], 10)
            anoMod = parseInt(anoM[2], 10)
          }

          // marcaModelo = tokens entre o padrão "6140 - -" (código numérico seguido de hífens isolados) e o padrão "2020 / 2020"
          let marcaModelo = ''
          const modeloPattern =
            /(?:\d{3,5}\s*-\s*-?\s*)([A-Za-z0-9\s.\-/+]+?)(?=\s*\b(?:19\d{2}|20\d{2})\s*\/\s*(?:19\d{2}|20\d{2})\b|$)/i.exec(
              trechoVeic,
            )
          if (modeloPattern) {
            marcaModelo = modeloPattern[1].trim()
          } else {
            // Fallback caso não tenha código "6140 - -": remove placa, chassi e anos
            let cleaned = trechoVeic
            if (placa) cleaned = cleaned.replace(placa, '')
            if (chassi) cleaned = cleaned.replace(chassi, '')
            if (anoM) cleaned = cleaned.replace(anoM[0], '')
            cleaned = cleaned.replace(/^\s*\d{3,5}\s*-\s*-?\s*/, '').trim()
            if (cleaned.length > 3) {
              marcaModelo = cleaned
            }
          }

          veiculoRes = {
            ...veiculoRes,
            placa: placa || undefined,
            chassi: chassi || undefined,
            marcaModelo: marcaModelo || undefined,
            anoFabricacao: anoFab || undefined,
            anoModelo: anoMod || undefined,
          }
        }
      }

      // FIPE no grupo seguinte: **Fipe Zero km Câmbio...** 45179 N Manual...
      if (rotuloLower.startsWith('fipe')) {
        const trechoFipe = seg.valores.trim()
        if (trechoFipe) {
          // Primeiro número/token: "45179"
          const fipeM = /^([A-Za-z0-9-]{4,9})/.exec(trechoFipe)
          if (fipeM) {
            veiculoRes = {
              ...veiculoRes,
              codigoFipe: fipeM[1],
            }
          }
        }
      }

      // 4. CONDUTOR PRINCIPAL (Linha 4)
      // Ex: **Questionário de avaliação de risco¹** **Condutor Nascimento CPF** PAULA GABRIELA DE MORAIS NEGREIROS 15/10/1996 088.181.234-08
      // IMPORTANTE: ancorar estritamente no grupo de negrito cujos rótulos incluem "Condutor" + "Nascimento" + "CPF"
      if (
        rotuloLower.includes('condutor') &&
        rotuloLower.includes('nascimento') &&
        rotuloLower.includes('cpf')
      ) {
        const trechoCond = seg.valores.trim()
        if (trechoCond) {
          const dataMatch = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/.exec(trechoCond)
          if (dataMatch) {
            const idxData = dataMatch.index
            const rawNome = trechoCond.substring(0, idxData).trim()
            const dataNascRaw = dataMatch[1]
            const posAposData = idxData + dataNascRaw.length
            const resto = trechoCond.substring(posAposData).trim()

            const cpfMatch = /([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/.exec(resto)
            const cpfEncontrado = cpfMatch ? cpfMatch[1].replace(/\D/g, '') : ''

            if (isNomePessoaValido(rawNome)) {
              condutorRes = {
                nome: rawNome,
                dataNascimento: parseDataFlexivel(dataNascRaw),
                cpf: cpfEncontrado || undefined,
                mesmoQueSegurado: false,
              }
            }
          }
        }
      }

      // 5. RENOVAÇÃO & SEGURADORA ANTERIOR (Linha 6)
      // Ex: **Tipo de Operação Segmento Bônus Origem do bônus** Renovação da Cia Azul Classe 1- Tradicional **Seguradora Sucursal Apólice Item** Azul Seguros 3 12806713 1
      if (rotuloLower.includes('tipo de operação') || rotuloLower.includes('tipo de operacao')) {
        const trechoOperacao = seg.valores.trim()
        const isRenovacao = /renova[çc][ãa]o/i.test(trechoOperacao)
        let classeBonus = ''
        const bonusM = /classe\s*(\d{1,2})/i.exec(trechoOperacao)
        if (bonusM) classeBonus = bonusM[1]

        renovacaoRes = {
          ...renovacaoRes,
          isRenovacao: isRenovacao || true,
          classeBonus: classeBonus || undefined,
        }
      }

      if (
        rotuloLower.includes('seguradora') &&
        rotuloLower.includes('sucursal') &&
        rotuloLower.includes('apólice')
      ) {
        const trechoSeg = seg.valores.trim()
        if (trechoSeg) {
          // seguradoraAnterior = tokens alfabéticos antes do primeiro token numérico -> "Azul Seguros"
          // numeroApolice = o número de 8 dígitos -> "12806713"
          const tokens = trechoSeg.split(/\s+/).filter(Boolean)
          const seguradoraTokens: string[] = []
          let apoliceEncontrada = ''

          for (const tok of tokens) {
            // Se o token for inteiramente numérico
            if (/^\d+$/.test(tok)) {
              // Se tiver 6 a 12 dígitos, é forte candidato a número de apólice (ex: 12806713)
              if (tok.length >= 6 && !apoliceEncontrada) {
                apoliceEncontrada = tok
              }
            } else if (!apoliceEncontrada && seguradoraTokens.length < 4) {
              // Se ainda não encontrou número longo de apólice e o token é textual
              seguradoraTokens.push(tok)
            }
          }

          const seguradoraNome = seguradoraTokens.join(' ').trim()

          renovacaoRes = {
            ...renovacaoRes,
            isRenovacao: true,
            seguradoraAnterior: seguradoraNome || undefined,
            apoliceAnterior: apoliceEncontrada || undefined,
          }
        }
      }
    }
  }

  if (!seguradoRes && !condutorRes && !veiculoRes && !renovacaoRes) {
    return null
  }

  return {
    segurado: seguradoRes,
    condutor: condutorRes,
    veiculo: veiculoRes,
    renovacao: renovacaoRes,
  }
}

// =========================================================================
// LEITOR DEDICADO: PORTO CELULAR (RAMO 171 / MODALIDADE 434)
// =========================================================================

export function isPortoCelular(text: string, nomeArquivo: string = ''): boolean {
  const t = text.toLowerCase()
  const n = (nomeArquivo || '').toLowerCase()

  if (n.includes('celular') && (n.includes('porto') || t.includes('porto'))) {
    return true
  }

  // Menção explícita de Porto Celular
  if (t.includes('porto celular') || t.includes('porto seguro celular')) {
    return true
  }

  // Ramo 171 / Modalidade 434 da Porto Seguro
  if (
    (t.includes('ramo: 171') || t.includes('ramo 171') || t.includes('171')) &&
    (t.includes('modalidade: 434') ||
      t.includes('modalidade 434') ||
      t.includes('434 - porto celular'))
  ) {
    return true
  }

  // Palavras-chave inequívocas de proposta de celular na Porto Seguro
  if (
    (t.includes('porto seguro') || t.includes('porto seguro cia de seguros')) &&
    t.includes('imei') &&
    (t.includes('aparelho') || t.includes('equipamento'))
  ) {
    return true
  }

  return false
}

export function extrairPortoCelularProposta(text: string): PropostaExtraida {
  // 1. Número da Proposta
  // Ex: "NÚMERO DO ORÇAMENTO PROPOSTA DE SEGURO 117861487" ou "PROPOSTA DE SEGURO 117861487"
  let numeroProposta = ''
  const propMatch =
    /(?:proposta\s+de\s+seguro|n[úu]mero\s+do\s+or[çc]amento\s+proposta\s+de\s+seguro)[*\s|:]+([0-9]{6,15})\b/i.exec(
      text,
    ) || /proposta[*\s|:]+([0-9]{7,12})\b/i.exec(text)
  if (propMatch) {
    numeroProposta = propMatch[1].trim()
  }

  // 2. Vigência
  // No texto real da Porto Celular:
  // "## 15/10/2026 NOVO" e "## 15/10/2027 ..." ou próximo a:
  // "VIGÊNCIA DAS 00:01 DO DIA / ATE AS 23:59 DO DIA"
  let vigenciaInicio = ''
  let vigenciaFim = ''

  // Padrão 1: "VIGÊNCIA DAS 00:01 DO DIA ... ATÉ AS 23:59 DO DIA ..."
  const vigExtMatch =
    /vig[êe]ncia\s+das\s+00:01\s+do\s+dia\s*[:/]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})?\s*(?:at[ée]|a)\s*(?:as?\s+23:59\s+do\s+dia)?\s*[:/]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})?/i.exec(
      text,
    )
  if (vigExtMatch && vigExtMatch[1] && vigExtMatch[2]) {
    vigenciaInicio = parseDataFlexivel(vigExtMatch[1])
    vigenciaFim = parseDataFlexivel(vigExtMatch[2])
  }

  // Padrão 2: cabeçalho com ## DD/MM/AAAA NOVO e ## DD/MM/AAAA
  if (!vigenciaInicio || !vigenciaFim) {
    const datasHashMatches: string[] = []
    const hashRegex = /##\s*(\d{1,2}\/\d{1,2}\/\d{4})/g
    let hm: RegExpExecArray | null
    while ((hm = hashRegex.exec(text)) !== null) {
      datasHashMatches.push(hm[1])
    }
    if (datasHashMatches.length >= 2) {
      vigenciaInicio = parseDataFlexivel(datasHashMatches[0])
      vigenciaFim = parseDataFlexivel(datasHashMatches[1])
    }
  }

  // Fallback vigências gerais se ainda faltar
  if (!vigenciaInicio || !vigenciaFim) {
    const vigGen = extrairVigencias(text)
    if (vigGen.inicio) vigenciaInicio = vigGen.inicio
    if (vigGen.fim) vigenciaFim = vigGen.fim
  }

  // 3. PRÊMIOS — REGRA DE OURO (PEGADINHA DO ITEM vs GERAL):
  // Há um "DEMONSTRATIVO DE PRÊMIO DO ITEM" e um "DEMONSTRATIVO DE PRÊMIO GERAL"
  // Usar SEMPRE o DEMONSTRATIVO DE PRÊMIO GERAL!
  let premioLiquido = 0
  let iof = 0
  let premioTotal = 0

  const demonstrativoGeralMatch =
    /(?:DEMONSTRATIVO\s+DE\s+PR[ÊE]MIO\s+GERAL|PR[ÊE]MIO\s+GERAL)[\s\S]*?(?=(?:DEMONSTRATIVO\s+DE\s+PR[ÊE]MIO\s+DO\s+ITEM|FORMA\s+DE\s+PAGAMENTO|INFORMA[ÇC][ÕO]ES\s+DE\s+PAGAMENTO|CL[ÁA]USULAS|CONDI[ÇC][ÕO]ES|P[áa]gina|\n{4,}|$))/i.exec(
      text,
    )
  const textoGeral = demonstrativoGeralMatch ? demonstrativoGeralMatch[0] : ''

  if (textoGeral) {
    const liqM =
      /(?:pr[êe]mio\s+l[íi]quido(?:\s+total)?|valor\s+l[íi]quido)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
        textoGeral,
      )
    if (liqM) premioLiquido = parseMoeda(liqM[1])

    const iofM = /i\.?o\.?f\.?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(textoGeral)
    if (iofM) iof = parseMoeda(iofM[1])

    const totM =
      /(?:pr[êe]mio\s+total|valor\s+total|total\s+a\s+pagar)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
        textoGeral,
      )
    if (totM) premioTotal = parseMoeda(totM[1])
  }

  // Se não achou na seção isolada, busca por "PRÊMIO LÍQUIDO TOTAL" no texto inteiro
  if (!premioLiquido) {
    const liqTotGlob = /pr[êe]mio\s+l[íi]quido\s+total[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)
    if (liqTotGlob) premioLiquido = parseMoeda(liqTotGlob[1])
  }
  if (!iof) {
    const iofGlob = /i\.?o\.?f\.?[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(text)
    if (iofGlob) iof = parseMoeda(iofGlob[1])
  }
  if (!premioTotal) {
    const totGlob = /(?:pr[êe]mio\s+total|total\s+da\s+proposta)[*\s|:]+R?\$?\s*([0-9.,]+)/i.exec(
      text,
    )
    if (totGlob) premioTotal = parseMoeda(totGlob[1])
  }
  if (premioLiquido > 0 && premioTotal === 0 && iof > 0) {
    premioTotal = Math.round((premioLiquido + iof) * 100) / 100
  }

  // 4. PARCELAMENTO & FORMA DE PAGAMENTO
  // Ex: "21 - 1 x BOLETO BANCARIO", "1ª PARCELA R$ 3.551,51"
  let formaPagamento = 'Boleto'
  let quantidadeParcelas = 1
  let parcelamentoDescricao = ''

  if (/boleto/i.test(text)) {
    formaPagamento = 'Boleto'
  } else if (/cart[ãa]o/i.test(text)) {
    formaPagamento = 'Crédito'
  } else if (/d[ée]bito/i.test(text)) {
    formaPagamento = 'Débito em conta'
  }

  const parcRegex =
    /(?:(\d{1,2})\s*x\s*(?:de\s*)?boleto|(\d{1,2})\s*x\s*de\s*R?\$?\s*([0-9.,]+)|(\d{1,2})\s+parcelas)/i.exec(
      text,
    )
  if (parcRegex) {
    quantidadeParcelas = parseInt(parcRegex[1] || parcRegex[2] || parcRegex[4] || '1', 10)
  }

  if (premioTotal > 0 && quantidadeParcelas > 0) {
    const vlrParc = (premioTotal / quantidadeParcelas).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    parcelamentoDescricao = `${quantidadeParcelas}x de R$ ${vlrParc}`
  }

  // 5. SEGURADO PJ / PF
  // No texto bruto real da Porto Celular:
  // formato: "**DADOS GERAIS** PROPONENTE TIPO DE PESSOA CNPJ <NOME> JURÍDICA <CNPJ>"
  // Ex: "CNPJ ALMERINDAS EMPREENDIMENTOS SOCIOAMBIENTAIS LTDA JURÍDICA 51364609/0001-80"
  let nome = ''
  let cpfCnpj = ''
  let tipoPessoa: 'PF' | 'PJ' = 'PJ'
  let email = ''
  let telefone = ''
  let cep = ''
  let rua = ''
  let numero = ''
  let bairro = ''
  let cidade = ''
  let estado = ''

  // Detecção do Bloco Proponente / Dados Gerais
  // CNPJ em proponente PJ da Porto Celular
  const pjMatch =
    /cnpj\s+([A-Z0-9\s.,'/-]{4,100}?)\s+jur[íi]dica\s+([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2}|[0-9]{8}\/?[0-9]{4}-?[0-9]{2})/i.exec(
      text,
    ) ||
    /proponente[^\n]*?cnpj\s+([A-Z0-9\s.,'/-]{4,100}?)\s+jur[íi]dica\s+([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2}|[0-9]{8}\/?[0-9]{4}-?[0-9]{2})/i.exec(
      text,
    )

  if (pjMatch) {
    tipoPessoa = 'PJ'
    const candNome = pjMatch[1].trim()
    // Limpeza de possíveis resíduos de rótulos
    const limpo = candNome
      .replace(/^TIPO\s+DE\s+PESSOA\s*/i, '')
      .replace(/^PROPONENTE\s*/i, '')
      .replace(/^CNPJ\s*/i, '')
      .trim()
    nome = limpo
    cpfCnpj = pjMatch[2].replace(/\D/g, '')
  } else {
    // Proponente PF (se houver caso PF de Porto Celular)
    const pfMatch =
      /proponente[^\n]*?cpf\s+([A-Z0-9\s.,'/-]{4,80}?)\s+f[íi]sica\s+([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/i.exec(
        text,
      ) ||
      /cpf\s+([A-Z0-9\s.,'/-]{4,80}?)\s+f[íi]sica\s+([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})/i.exec(
        text,
      )
    if (pfMatch) {
      tipoPessoa = 'PF'
      nome = pfMatch[1]
        .replace(/^TIPO\s+DE\s+PESSOA\s*/i, '')
        .replace(/^PROPONENTE\s*/i, '')
        .trim()
      cpfCnpj = pfMatch[2].replace(/\D/g, '')
    }
  }

  // Fallback de CNPJ do segurado se não capturou acima (evitar CNPJ da Porto 61198164000160)
  if (!cpfCnpj) {
    const allCnpjs = text.match(
      /\b([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}|[0-9]{8}\/[0-9]{4}-[0-9]{2})\b/g,
    )
    if (allCnpjs) {
      for (const c of allCnpjs) {
        const dig = c.replace(/\D/g, '')
        if (
          !dig.startsWith('61198164') &&
          !dig.startsWith('06157') &&
          !dig.startsWith('33448150') &&
          dig.length === 14
        ) {
          cpfCnpj = dig
          tipoPessoa = 'PJ'
          break
        }
      }
    }
  }

  // Email: "ENVIAR APÓLICE FÍSICA PARA FINANCEIRO@ALMERINDAS.COM SIM" ou emails gerais
  const emailMatch =
    /(?:enviar\s+ap[oó]lice(?:\s+f[íi]sica)?\s+para|e-?mail(?:\s+comercial|\s+do\s+proponente)?)[*\s|:]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.exec(
      text,
    ) || /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.exec(text)
  if (emailMatch) {
    email = emailMatch[1].trim()
  }

  // Telefone: "TELEFONE COMERCIAL (11)924930875" ou "(11)924930875"
  const telMatch =
    /telefone(?:\s+comercial|\s+celular|\s+residencial)?\s*[:\s]*(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i.exec(
      text,
    )
  if (telMatch) {
    telefone = telMatch[1].trim()
  }

  // Endereço: bloco "**ENDEREÇO DO PROPONENTE**" ou "ENDEREÇO EMPRESARIAL"
  // Formato: "CEP CIDADE ESTADO ENDEREÇO 52050-310 RECIFE PE R. ABELARDO NÚMERO COMPLEMENTO BAIRRO 45 GRACAS"
  const endBlocoMatch =
    /(?:\*{0,2}ENDERE[ÇC]O\s+DO\s+PROPONENTE\*{0,2}|\*{0,2}ENDERE[ÇC]O\s+EMPRESARIAL\*{0,2})[\s\S]*?(?=(?:\*{0,2}ENDERE[ÇC]O\s+DE\s+COBRAN[ÇC]A|\*{0,2}TELEFONE|\*{0,2}DADOS\s+DO\s+CORRETOR|CL[ÁA]USULAS|DEMONSTRATIVO|\n{3,}|$))/i.exec(
      text,
    )
  const textoEndereco = endBlocoMatch ? endBlocoMatch[0] : text

  // Padrão estruturado Porto:
  // "CEP CIDADE ESTADO ENDEREÇO <cep> <cidade> <uf> <rua> NÚMERO COMPLEMENTO BAIRRO <numero> <bairro>"
  const portoEndEstruturado =
    /(?:cep\s+cidade\s+estado\s+endere[çc]o)\s+([0-9]{5}-?[0-9]{3})\s+([A-Za-zÀ-ÿ\s.-]+?)\s+([A-Z]{2})\s+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)\s+n[úu]mero\s+(?:complemento\s+)?bairro\s+(\d+[A-Za-z0-9/]*)\s+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s+telefone|\s+dados|\s+cep|\n|$))/i.exec(
      textoEndereco,
    ) ||
    /([0-9]{5}-?[0-9]{3})\s+([A-Za-zÀ-ÿ\s.-]+?)\s+([A-Z]{2})\s+([A-Za-zÀ-ÿ0-9\s.,'/-]+?)\s+n[úu]mero\s+(?:complemento\s+)?bairro\s+(\d+[A-Za-z0-9/]*)\s+([A-Za-zÀ-ÿ\s.-]+?)(?=(?:\s+telefone|\s+dados|\s+cep|\n|$))/i.exec(
      textoEndereco,
    )

  if (portoEndEstruturado) {
    const rawCep = portoEndEstruturado[1].replace(/\D/g, '')
    cep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`
    cidade = portoEndEstruturado[2].trim()
    estado = portoEndEstruturado[3].trim().toUpperCase()
    rua = portoEndEstruturado[4].trim()
    numero = portoEndEstruturado[5].trim()
    bairro = portoEndEstruturado[6].trim()
  } else {
    // Extração fallback dos campos no bloco de endereço
    const cepM = /([0-9]{5}-?[0-9]{3})/.exec(textoEndereco)
    if (cepM) {
      const rawCep = cepM[1].replace(/\D/g, '')
      cep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`
    }
    const ufM = /\b([A-Z]{2})\b/.exec(textoEndereco)
    if (ufM && BRAZILIAN_STATES.includes(ufM[1])) {
      estado = ufM[1]
    }
  }

  // 6. ITENS / EQUIPAMENTOS (CELULARES E IMEIs)
  // Extrair aparelhos e seus IMEIs
  // Ex: "Samsung-GALAXY S25 ULTRA 256GB, IMEIs 357445726540186 e 357445726548353"
  const imeisEncontrados: string[] = []
  const imeiRegex = /\b([0-9]{15})\b/g
  let imeiMatch: RegExpExecArray | null
  while ((imeiMatch = imeiRegex.exec(text)) !== null) {
    if (!imeisEncontrados.includes(imeiMatch[1])) {
      imeisEncontrados.push(imeiMatch[1])
    }
  }

  // Modelos de celular no texto
  const aparelhosEncontrados: string[] = []
  const celRegex =
    /(?:SAMSUNG|APPLE|MOTOROLA|XIAOMI)[-\s]*([A-Za-z0-9\s+]+?(?:ULTRA|PLUS|PRO|MAX|LITE|FE)?\s*\d{2,4}\s*GB)/gi
  let celM: RegExpExecArray | null
  while ((celM = celRegex.exec(text)) !== null) {
    const apar = celM[0].trim()
    if (!aparelhosEncontrados.includes(apar)) {
      aparelhosEncontrados.push(apar)
    }
  }

  const observacoesItens: string[] = []
  if (aparelhosEncontrados.length > 0) {
    observacoesItens.push(`Aparelho: ${aparelhosEncontrados.join(', ')}`)
  }
  if (imeisEncontrados.length > 0) {
    observacoesItens.push(`IMEI(s): ${imeisEncontrados.join(', ')}`)
  }

  const seguradoSanitizado: PropostaClienteExtraido = {
    nome: sanitizarTextoExtraido(nome)
      .replace(/^Nome[:\s]*/i, '')
      .replace(/^Proponente[:\s]*/i, '')
      .replace(/^CNPJ[:\s]*/i, '')
      .trim(),
    tipoPessoa,
    cpfCnpj: cpfCnpj || undefined,
    email: email || undefined,
    telefone: telefone || undefined,
    cep: cep || undefined,
    rua: rua || undefined,
    numero: numero || undefined,
    bairro: bairro || undefined,
    cidade: cidade || undefined,
    estado: estado || undefined,
  }

  const condutorSanitizado: PropostaCondutorExtraido = {
    nome: '',
    cpf: undefined,
    dataNascimento: undefined,
    parentesco: undefined,
    mesmoQueSegurado: false,
  }

  const veiculoSanitizado: PropostaVeiculoExtraido = {
    marcaModelo: '',
    placa: '',
    chassi: '',
    codigoFipe: '',
    anoFabricacao: undefined,
    anoModelo: undefined,
  }

  const renovacaoSanitizada: PropostaRenovacaoExtraida = {
    isRenovacao: false,
  }

  return {
    formato: 'PORTO_SEGURO',
    seguradoraNome: 'Porto Seguro',
    numeroProposta: sanitizarTextoExtraido(numeroProposta),
    numeroApolice: '',
    tipoSeguro: 'Porto Celular',
    vigenciaInicio,
    vigenciaFim,
    premioLiquido,
    iof,
    premioTotal,
    formaPagamento,
    quantidadeParcelas,
    parcelamentoDescricao: sanitizarTextoExtraido(parcelamentoDescricao),
    segurado: seguradoSanitizado,
    condutorPrincipal: condutorSanitizado,
    veiculo: veiculoSanitizado,
    renovacao: renovacaoSanitizada,
    camposFaltantes: [],
    textoBrutoOriginal: text.substring(0, 5000),
    observacoesApolice: observacoesItens.join(' | ') || undefined,
  }
}

// =========================================================================
// EXTRATOR ESPECIALIZADO: HDI SEGUROS AUTO (Hdi Auto Perfil)
// =========================================================================

export function extrairPropostaHDI(text: string): {
  numeroProposta?: string
  numeroApolice?: string
  tipoSeguro?: string
  vigenciaInicio?: string
  vigenciaFim?: string
  premioLiquido?: number
  iof?: number
  premioTotal?: number
  formaPagamento?: string
  quantidadeParcelas?: number
  parcelamentoDescricao?: string
  segurado?: Partial<PropostaClienteExtraido>
  condutorPrincipal?: Partial<PropostaCondutorExtraido>
  veiculo?: Partial<PropostaVeiculoExtraido>
  renovacao?: Partial<PropostaRenovacaoExtraida>
} | null {
  const tLower = text.toLowerCase()
  if (!tLower.includes('hdi')) {
    return null
  }

  // Helper para normalizar telefone/celular:
  // Remove "00" espúrio no DDD caso venha ex: (0081)996032454 -> (81) 99603-2454 ou (81) 996032454
  const normalizarTelefone = (telRaw: string): string => {
    let clean = telRaw.trim().replace(/^[:\s]+/, '')
    clean = clean.replace(/\(00(\d{2})\)/, '($1) ')
    clean = clean.replace(/\b00(\d{2})\b/, '($1) ')
    return clean.trim()
  }

  // 1. NÚMERO DA PROPOSTA
  // Ex: "Especificação da Proposta 01.145.431.1236385811" ou "## Especificação da Proposta 01.145.431.1236385811"
  let numeroProposta: string | undefined
  const propMatch =
    /(?:especifica[çc][ãa]o\s+da\s+proposta|proposta)[\s*|:#]+([0-9]{2}\.[0-9]{3}\.[0-9]{3}\.[0-9]{6,14}|[0-9.-]{8,25})\b/i.exec(
      text,
    )
  if (propMatch) {
    numeroProposta = propMatch[1].trim()
  }

  // 2. VIGÊNCIA
  // Ex: "Das 24 h do dia 22/10/2026 às 24 h do dia 22/10/2027"
  let vigenciaInicio: string | undefined
  let vigenciaFim: string | undefined
  const vigHdiMatch =
    /das\s+24\s*h\s+do\s+dia\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*(?:[àa]s|ate|at[ée])\s+24\s*h\s+do\s+dia\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    ) ||
    /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*[àa]s?\s*24\s*h\s*do\s*dia\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    )
  if (vigHdiMatch) {
    vigenciaInicio = parseDataFlexivel(vigHdiMatch[1])
    vigenciaFim = parseDataFlexivel(vigHdiMatch[2])
  }

  // 3. SEGURADO E DADOS CADASTRAIS
  const segurado: Partial<PropostaClienteExtraido> = {
    tipoPessoa: 'PF',
  }

  // Tabela GFM ou linha: |Nome de Registro Segurado|: Juliana Soares de Oliveira Rego|CPF|: 050.905.424-22|
  const nomeSegMatch =
    /nome\s+de\s+registro\s+segurado[|:\s*#]+([^|\n]+?)(?=\s*(?:\||\n|\*{2}|CPF|RG|Endere[çc]o))/i.exec(
      text,
    ) ||
    /nome\s+social\s+segurado[|:\s*#]+([^|\n]+?)(?=\s*(?:\||\n|\*{2}|CPF|RG|Endere[çc]o))/i.exec(
      text,
    )

  if (nomeSegMatch) {
    const rawNome = sanitizarTextoExtraido(nomeSegMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    if (
      rawNome &&
      isNomePessoaValido(rawNome) &&
      !rawNome.toLowerCase().includes('registro segurado')
    ) {
      segurado.nome = rawNome
    }
  }

  // CPF do Segurado (no bloco inicial antes do Questionário de Risco / Condutor)
  const idxCond = text.toLowerCase().indexOf('condutor')
  const blocoSegurado = idxCond > 0 ? text.substring(0, idxCond) : text

  const cpfSegMatch = /(?:cpf|c\.p\.f)[|:\s*#]+([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2})\b/i.exec(
    blocoSegurado,
  )
  if (cpfSegMatch) {
    const limpo = cpfSegMatch[1].replace(/\D/g, '')
    if (limpo.length === 11 && isValidCpf(limpo)) {
      segurado.cpfCnpj = limpo
    }
  }

  // Data de nascimento do segurado (se houver no bloco segurado, ou herda do condutor se for o mesmo)
  const nascSegMatch =
    /(?:data\s+(?:de\s+)?nasc(?:imento)?)[|:\s*#]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/i.exec(
      blocoSegurado,
    )
  if (nascSegMatch) {
    segurado.dataNascimento = parseDataFlexivel(nascSegMatch[1])
  }

  // Endereço / Celular / Bairro / Cidade / CEP
  // Ex: |Endereço|: Avenida Boa Viagem 5212, 5212|Celular|: (0081)996032454|
  const endMatch =
    /endere[çc]o[|:\s*#]+([^|\n]+?)(?=\s*(?:\||celular|telefone|bairro|cidade|cep|\n))/i.exec(
      blocoSegurado,
    )
  if (endMatch) {
    const rawEnd = sanitizarTextoExtraido(endMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    if (rawEnd && !isTextoCabecalhoOuInvalido(rawEnd)) {
      // Separar rua e número se houver vírgula
      const virgulaIdx = rawEnd.lastIndexOf(',')
      if (virgulaIdx > 0) {
        const parteRua = rawEnd.substring(0, virgulaIdx).trim()
        const parteNum = rawEnd.substring(virgulaIdx + 1).trim()
        segurado.rua = parteRua
        segurado.numero = parteNum
      } else {
        segurado.rua = rawEnd
      }
    }
  }

  // Celular / Telefone
  // Ex: |Celular|: (0081)996032454| ou Celular : (0081)996032454
  const celMatch =
    /(?:celular|telefone|tel)[|:\s*#]+(\(?\d{2,4}\)?\s*\d{4,5}[-\s]?\d{4})\b/i.exec(text) ||
    /(?:celular|telefone|tel)[|:\s*#]+(\(?\d{2,4}\)?\s*\d{8,11})\b/i.exec(text)
  if (celMatch) {
    segurado.telefone = normalizarTelefone(celMatch[1])
  }

  // Bairro
  // Ex: Bairro : Boa Viagem
  const bairroMatch = /bairro[|:\s*#]+([^|\n]+?)(?=\s*(?:\||cidade|cep|estado|uf|\n))/i.exec(
    blocoSegurado,
  )
  if (bairroMatch) {
    const rawBairro = sanitizarTextoExtraido(bairroMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    if (rawBairro && !isTextoCabecalhoOuInvalido(rawBairro)) {
      segurado.bairro = rawBairro
    }
  }

  // Cidade e UF
  // Ex: |Cidade Período de Vigência|: Recife-PE|CEP|: 51030-900| ou Cidade : Recife - PE
  // Notar que a tabela GFM às vezes quebra o rótulo como "Cidade Período de Vigência"
  // mas o VALOR é "Recife-PE" ou "Recife - PE"
  const cidUfMatch =
    /(?:cidade(?:\s+per[íi]odo\s+de\s+vig[êe]ncia)?)[|:\s*#]+([A-Za-zÀ-ÿ\s]+?)\s*-\s*([A-Za-z]{2})\b/i.exec(
      blocoSegurado,
    ) ||
    /cidade[|:\s*#]+([A-Za-zÀ-ÿ\s]+?)(?:\s*-\s*([A-Za-z]{2}))?(?=\s*(?:\||cep|\n|per[íi]odo))/i.exec(
      blocoSegurado,
    )

  if (cidUfMatch) {
    let rawCid = sanitizarTextoExtraido(cidUfMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    const rawUf = cidUfMatch[2] ? cidUfMatch[2].trim().toUpperCase() : ''
    // Proteção estrita: nunca aceitar texto de cabeçalho como cidade
    if (rawCid && !isTextoCabecalhoOuInvalido(rawCid)) {
      // Se a regex engoliu parte do rótulo, limpa
      rawCid = rawCid
        .replace(/per[íi]odo\s+de\s+vig[êe]ncia/gi, '')
        .replace(/vig[êe]ncia/gi, '')
        .trim()
      if (rawCid.length >= 2) {
        segurado.cidade = rawCid
      }
    }
    if (rawUf && BRAZILIAN_STATES.includes(rawUf)) {
      segurado.estado = rawUf
    }
  }

  // CEP
  // Ex: |CEP|: 51030-900| ou CEP : 51030-900
  const cepMatch = /cep[|:\s*#]+([0-9]{5}-?[0-9]{3})\b/i.exec(blocoSegurado)
  if (cepMatch) {
    const rawCep = cepMatch[1].replace(/\D/g, '')
    segurado.cep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`
  }

  // 4. CONDUTOR PRINCIPAL
  // Ex:
  // Nome Social do Condutor:
  // Condutor : Juliana Soares de Oliveira Rego CPF: 05090542422 Data de Nasc.: 11/10/1997
  const condutorPrincipal: Partial<PropostaCondutorExtraido> = {}

  const blocoCondutorMatch =
    /(?:nome\s+social\s+do\s+condutor:[\s\S]*?)?condutor\s*[:|#]+\s*([A-Za-zÀ-ÿ\s]+?)(?=\s*(?:cpf|data|faixa|sexo|\n|\|))/i.exec(
      text,
    )
  if (blocoCondutorMatch) {
    const cNome = sanitizarTextoExtraido(blocoCondutorMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    if (cNome && isNomePessoaValido(cNome)) {
      condutorPrincipal.nome = cNome
    }
  }

  const condCpfMatch =
    /condutor[\s\S]{0,100}?cpf[|:\s*#]+([0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}|[0-9]{11})\b/i.exec(
      text,
    )
  if (condCpfMatch) {
    const limpo = condCpfMatch[1].replace(/\D/g, '')
    if (limpo.length === 11 && isValidCpf(limpo)) {
      condutorPrincipal.cpf = limpo
    }
  }

  const condNascMatch =
    /condutor[\s\S]{0,120}?data\s+(?:de\s+)?nasc\.?[|:\s*#]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/i.exec(
      text,
    ) || /data\s+de\s+nasc\.:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})[\s\S]{0,100}?condutor/i.exec(text)
  if (condNascMatch) {
    condutorPrincipal.dataNascimento = parseDataFlexivel(condNascMatch[1])
  }

  if (condutorPrincipal.nome && segurado.nome) {
    condutorPrincipal.mesmoQueSegurado =
      condutorPrincipal.nome.trim().toLowerCase() === segurado.nome.trim().toLowerCase()
  } else if (!condutorPrincipal.nome && segurado.nome) {
    // Se não achou bloco de condutor separado, assume mesmo que segurado
    condutorPrincipal.nome = segurado.nome
    condutorPrincipal.cpf = segurado.cpfCnpj
    condutorPrincipal.mesmoQueSegurado = true
  }

  // Se o segurado não tinha data de nascimento no seu bloco mas o condutor tem e é a mesma pessoa
  if (
    !segurado.dataNascimento &&
    condutorPrincipal.dataNascimento &&
    condutorPrincipal.mesmoQueSegurado
  ) {
    segurado.dataNascimento = condutorPrincipal.dataNascimento
  }

  // 5. VEÍCULO
  // No documento HDI:
  // "Modelo : 0005677 - Chery Tiggo 5x Txs 1.5 16v Turbo Flex Aut."
  // "Código FIPE : 073022-0"
  // "Ano Fabr./Modelo : 2021/2022 Combustível : 5-Bi-combustivel"
  // E na tabela GFM que perdeu os rótulos da primeira coluna:
  // |: RZJ0E33 - PE|Chassi|: 95PBCK51DNB030915|
  // |: 22-Pick-ups Pesadas (pessoas) : 05-Compreensiva-Valor de Mercado|Passageiros : 5|
  // |: 030-Recife I Franquia : 04-Facultativa 50%|
  // |Placa/UF|Categoria|Cobertura|Região|CEP Pernoite|CEP Circulação|Sist.Proteção|...
  const veiculo: Partial<PropostaVeiculoExtraido> = {}

  // Modelo
  const modeloMatch =
    /modelo[|:\s*#]+(?:[0-9]{4,8}\s*-\s*)?([A-Za-z0-9\s.\-/+]+?)(?=\s*(?:\||c[oó]digo\s+fipe|ano|combust[íi]vel|\n))/i.exec(
      text,
    )
  if (modeloMatch) {
    let mClean = sanitizarTextoExtraido(modeloMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    mClean = mClean.replace(/^[0-9]{4,8}\s*-\s*/, '').trim()
    if (mClean && !isTextoCabecalhoOuInvalido(mClean) && !mClean.toLowerCase().includes('recife')) {
      veiculo.marcaModelo = mClean
    }
  }

  // Código FIPE
  const fipeMatch = /c[oó]digo\s+fipe[|:\s*#]+([0-9]{6}-[0-9]|[0-9]{6,8})\b/i.exec(text)
  if (fipeMatch) {
    veiculo.codigoFipe = fipeMatch[1].trim()
  }

  // Ano Fabr. / Modelo
  const anoMatch =
    /ano\s+fabr?\.?\s*\/\s*modelo[|:\s*#]+(19\d{2}|20\d{2})\s*\/\s*(19\d{2}|20\d{2})\b/i.exec(text)
  if (anoMatch) {
    veiculo.anoFabricacao = parseInt(anoMatch[1], 10)
    veiculo.anoModelo = parseInt(anoMatch[2], 10)
  }

  // Placa
  // Ex: |: RZJ0E33 - PE|Chassi|: 95PBCK51DNB030915| ou Placa/UF : RZJ0E33 - PE
  const placaMatch =
    /(?:placa(?:\/uf)?[|:\s*#]+|[|:]\s*)\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b(?:\s*-\s*[A-Z]{2})?/i.exec(
      text,
    )
  if (placaMatch) {
    veiculo.placa = placaMatch[1].toUpperCase()
  }

  // Chassi
  // Ex: Chassi|: 95PBCK51DNB030915| ou Chassi : 95PBCK51DNB030915
  const chassiMatch = /chassi[|:\s*#]+([A-HJ-NPR-Z0-9]{17})\b/i.exec(text)
  if (chassiMatch) {
    veiculo.chassi = chassiMatch[1].toUpperCase()
  }

  // 6. CÁLCULO DO PRÊMIO
  // No documento HDI, tabela GFM "Cálculo do Prêmio":
  // |Prêmio Líquido|:|2.306,13|
  // |Adicional de Parcelamento|:|0,00|
  // |Custo de Apólice|:|0,00|
  // |I.O.F.|:|170,19|
  // |Prêmio Total|:|2.476,32|
  // NUNCA pegar as franquias dos textos explicativos (*1/*2/*3/*4)
  let premioLiquido: number | undefined
  let iof: number | undefined
  let premioTotal: number | undefined

  // Padrão 1: Bloco Cálculo do Prêmio em tabela GFM ou linhas dedicadas
  const blocoCalcMatch =
    /c[áa]lculo\s+do\s+pr[êe]mio[\s\S]*?(?=na\s+condi[çc][ãa]o\s+de\s+proponente|declara[çc][ãa]o|impress[ãa]o\s+dos\s+textos|\n{3,}|$)/i.exec(
      text,
    )
  const calcText = blocoCalcMatch ? blocoCalcMatch[0] : text

  const liqMatch = /pr[êe]mio\s+l[íi]quido[|:\s*#]+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/i.exec(
    calcText,
  )
  if (liqMatch) {
    premioLiquido = parseMoeda(liqMatch[1])
  }

  const iofMatch = /(?:i\.?o\.?f\.?)[|:\s*#]+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/i.exec(calcText)
  if (iofMatch) {
    iof = parseMoeda(iofMatch[1])
  }

  const totMatch = /pr[êe]mio\s+total[|:\s*#]+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/i.exec(
    calcText,
  )
  if (totMatch) {
    premioTotal = parseMoeda(totMatch[1])
  }

  // 7. DADOS DE COBRANÇA / PARCELAMENTO
  // Ex: "Banco : 901 Tipo de Cobrança : Cartão de Crédito Parcela : 247,63 Forma de Pagamento : 10 x Juros parcelamento : 0,00% a.m."
  let quantidadeParcelas: number | undefined
  let formaPagamento: string | undefined
  let parcelamentoDescricao: string | undefined

  const formaPgtoMatch =
    /tipo\s+de\s+cobran[çc]a[|:\s*#]+([^|\n]+?)(?=\s*(?:\||parcela|forma\s+de\s+pagamento|\n))/i.exec(
      text,
    )
  if (formaPgtoMatch) {
    const fStr = formaPgtoMatch[1].toLowerCase()
    if (fStr.includes('cartão') || fStr.includes('cartao') || fStr.includes('crédito')) {
      formaPagamento = 'Crédito'
    } else if (fStr.includes('débito') || fStr.includes('debito')) {
      formaPagamento = 'Débito em conta'
    } else if (fStr.includes('boleto')) {
      formaPagamento = 'Boleto'
    }
  }

  // Forma de Pagamento : 10 x
  const parcelasMatch =
    /forma\s+de\s+pagamento[|:\s*#]+(\d{1,2})\s*x\b/i.exec(text) ||
    /parcelamento[|:\s*#]+(\d{1,2})\s*x\b/i.exec(text)
  if (parcelasMatch) {
    quantidadeParcelas = parseInt(parcelasMatch[1], 10)
  }

  const valorParcelaMatch = /parcela[|:\s*#]+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/i.exec(text)
  if (quantidadeParcelas) {
    if (valorParcelaMatch) {
      parcelamentoDescricao = `${quantidadeParcelas}x de R$ ${valorParcelaMatch[1]} sem juros`
    } else {
      parcelamentoDescricao = `${quantidadeParcelas}x sem juros`
    }
  }

  // 8. RENOVAÇÃO
  // Ex:
  // Cia Anterior : 5886-PORTO SEGURO CIA DE SEGUROS GERAIS
  // Apólice Anterior : 0000000000000000
  // Fim Vigência Anterior : 22/10/2026
  // Classe de Bônus : 10 - 30,00%
  const renovacao: Partial<PropostaRenovacaoExtraida> = {}

  const ciaAntMatch =
    /cia\s+anterior[|:\s*#]+([^|\n]+?)(?=\s*(?:\||ap[oó]lice\s+anterior|fim\s+vig[êe]ncia|\n))/i.exec(
      text,
    )
  if (ciaAntMatch) {
    const rawCia = sanitizarTextoExtraido(ciaAntMatch[1])
      .replace(/^[:\s]+/, '')
      .trim()
    if (rawCia && !isTextoCabecalhoOuInvalido(rawCia) && rawCia !== '-') {
      renovacao.isRenovacao = true
      renovacao.seguradoraAnterior = rawCia
    }
  }

  const apoliceAntMatch = /ap[oó]lice\s+anterior[|:\s*#]+([0-9A-Za-z.-]{6,25})\b/i.exec(text)
  if (apoliceAntMatch) {
    const rawApol = apoliceAntMatch[1].trim()
    // Tratar apólice toda de zeros como vazia
    if (!/^0+$/.test(rawApol)) {
      renovacao.apoliceAnterior = rawApol
      renovacao.isRenovacao = true
    }
  }

  const bonusMatch = /classe\s+de\s+b[oó]nus[|:\s*#]+(\d{1,2})/i.exec(text)
  if (bonusMatch) {
    renovacao.classeBonus = bonusMatch[1].trim()
    renovacao.isRenovacao = true
  }

  return {
    numeroProposta,
    numeroApolice: '',
    tipoSeguro: 'Auto',
    vigenciaInicio,
    vigenciaFim,
    premioLiquido,
    iof,
    premioTotal,
    formaPagamento: formaPagamento || 'Crédito',
    quantidadeParcelas,
    parcelamentoDescricao,
    segurado,
    condutorPrincipal,
    veiculo,
    renovacao,
  }
}

// =========================================================================
// EXTRATOR ESPECIALIZADO: MAPFRE AUTO (Propostas e Renovações)
// =========================================================================

export function extrairPropostaMapfre(text: string): {
  numeroProposta?: string
  numeroApolice?: string
  tipoSeguro?: string
  vigenciaInicio?: string
  vigenciaFim?: string
  premioLiquido?: number
  iof?: number
  premioTotal?: number
  formaPagamento?: string
  quantidadeParcelas?: number
  parcelamentoDescricao?: string
  segurado?: Partial<PropostaClienteExtraido>
  condutorPrincipal?: Partial<PropostaCondutorExtraido>
  veiculo?: Partial<PropostaVeiculoExtraido>
  renovacao?: Partial<PropostaRenovacaoExtraida>
} | null {
  // Confere se o texto realmente pertence ao ecossistema MAPFRE
  if (!/mapfre/i.test(text)) {
    return null
  }

  // 1. NÚMERO DA PROPOSTA
  // Ex: "**Proposta:** 2310313139328 **Data Proposta-Hora** 20/10/2026 - 00:00:00"
  // ou "Proposta: 2310313139328"
  let numeroProposta: string | undefined
  const propMatch =
    /\*{0,2}Proposta:\*{0,2}\s*([0-9]{6,20})\b/i.exec(text) ||
    /(?:^|[|\n\s])\*{0,2}Proposta\*{0,2}[:\s]+([0-9]{6,20})\b/i.exec(text)
  if (propMatch) {
    numeroProposta = propMatch[1].trim()
  }

  // 2. VIGÊNCIA
  // Ex: "**Dados do Seguro Vigência: das 24 horas do dia** 22/10/2026 **até as 24 horas do dia** 22/10/2027"
  // ou "Vigência: das 24 horas do dia 22/10/2026 até as 24 horas do dia 22/10/2027"
  let vigenciaInicio: string | undefined
  let vigenciaFim: string | undefined
  const vigMapfreMatch =
    /das\s+24\s+horas\s+do\s+dia\*{0,2}\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*\*{0,2}(?:at[ée]|as)\s+(?:as\s+)?24\s+horas\s+do\s+dia\*{0,2}\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    )
  if (vigMapfreMatch) {
    vigenciaInicio = parseDataFlexivel(vigMapfreMatch[1])
    vigenciaFim = parseDataFlexivel(vigMapfreMatch[2])
  }

  // 3. SEGURADO & ENDEREÇO RESIDENCIAL
  // Ex: "**Nome do Segurado:** JOSE CALIXTO DA SILVA NETO **Tipo Pessoa:** FISICA **CPF:** 082.831.014-98"
  // "**Data Nasc.:** 26/02/1994 **Sexo:** MASCULINO ... **E-mail:** JCALIXTOSN@GMAIL.COM ... **Tel.Celular:** (83) 99177-6469 ... **Endereço:** RUA JURACY DE CARVALHO LUNA **Nº** 68 ... **Bairro:** BRISAMAR **Cidade:** JOAO PESSOA **UF:** PB **CEP:** 58034-240"
  const segurado: Partial<PropostaClienteExtraido> = {
    tipoPessoa: 'PF',
  }

  const nomeSeguradoMatch =
    /\*{0,2}Nome\s+do\s+Segurado:\*{0,2}\s*([^\n*|]+?)(?=\s*\*{0,2}(?:Tipo\s+Pessoa|CPF|CNPJ|Data|Sexo|Tel|Endere[çc]o|E-mail)|\||\n|$)/i.exec(
      text,
    )
  if (nomeSeguradoMatch) {
    const rawNome = sanitizarTextoExtraido(nomeSeguradoMatch[1])
    if (isNomePessoaValido(rawNome)) {
      segurado.nome = rawNome
    }
  }

  const tipoPessoaMatch = /\*{0,2}Tipo\s+Pessoa:\*{0,2}\s*([A-Za-z]+)/i.exec(text)
  if (tipoPessoaMatch) {
    const tp = tipoPessoaMatch[1].toUpperCase()
    if (tp.includes('JURIDICA') || tp.includes('JURÍDICA') || tp === 'PJ') {
      segurado.tipoPessoa = 'PJ'
    } else {
      segurado.tipoPessoa = 'PF'
    }
  }

  // CPF do Segurado (na mesma linha do nome do segurado ou rotulado como CPF logo a seguir)
  const cpfSeguradoMatch =
    /\*{0,2}Nome\s+do\s+Segurado:[\s\S]*?\*{0,2}CPF:\*{0,2}\s*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{11})\b/i.exec(
      text,
    ) || /\*{0,2}CPF:\*{0,2}\s*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{11})\b/i.exec(text)
  if (cpfSeguradoMatch) {
    const limpo = cpfSeguradoMatch[1].replace(/\D/g, '')
    if (limpo.length === 11 && isValidCpf(limpo)) {
      segurado.cpfCnpj = limpo
    }
  }

  // Data Nasc do Segurado
  const nascSeguradoMatch = /\*{0,2}Data\s+Nasc\.:\*{0,2}\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
    text,
  )
  if (nascSeguradoMatch) {
    segurado.dataNascimento = parseDataFlexivel(nascSeguradoMatch[1])
  }

  // E-mail do Segurado
  const emailSeguradoMatch =
    /\*{0,2}E-?mail:\*{0,2}\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.exec(text)
  if (emailSeguradoMatch) {
    segurado.email = emailSeguradoMatch[1].trim()
  }

  // Celular / Telefone do Segurado
  const celSeguradoMatch =
    /\*{0,2}Tel\.Celular:\*{0,2}\s*(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i.exec(text) ||
    /\*{0,2}Tel\.Res\.:\*{0,2}\s*(\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4})/i.exec(text)
  if (celSeguradoMatch) {
    segurado.telefone = celSeguradoMatch[1].trim()
  }

  // Fallback genérico para Celular / Telefone se segurado.telefone ainda estiver vazio
  if (!segurado.telefone) {
    const fallbackCelMatch =
      /(?:celular|telefone|tel)[|:\s*#]+(\(?\d{2,4}\)?\s*\d{4,5}[-\s]?\d{4})\b/i.exec(text) ||
      /(?:celular|telefone|tel)[|:\s*#]+(\(?\d{2,4}\)?\s*\d{8,11})\b/i.exec(text)
    if (fallbackCelMatch) {
      let fClean = fallbackCelMatch[1].trim().replace(/^[:\s]+/, '')
      fClean = fClean
        .replace(/\(00(\d{2})\)/, '($1) ')
        .replace(/\b00(\d{2})\b/, '($1) ')
        .trim()
      segurado.telefone = fClean
    }
  }
  // Endereço (Rua, Número, Bairro, Cidade, UF, CEP) no bloco do segurado
  const endMatch =
    /\*{0,2}Endere[çc]o:\*{0,2}\s*([^\n*|]+?)(?=\s*\*{0,2}(?:N[ºo.]|Compl|Bairro|Cidade|UF|CEP)|\||\n|$)/i.exec(
      text,
    )
  if (endMatch) {
    const r = sanitizarTextoExtraido(endMatch[1])
    if (r && !isTextoCabecalhoOuInvalido(r)) {
      segurado.rua = r
    }
  }

  const numMatch =
    /\*{0,2}N[ºo.]\*{0,2}\s*([0-9A-Za-z\s/]+?)(?=\s*\*{0,2}(?:Compl|Bairro|Cidade|UF|CEP)|\||\n|$)/i.exec(
      text,
    )
  if (numMatch) {
    const n = sanitizarTextoExtraido(numMatch[1])
    if (n && n !== '-' && !isTextoCabecalhoOuInvalido(n)) {
      segurado.numero = n
    }
  }

  const bairroMatch =
    /\*{0,2}Bairro:\*{0,2}\s*([^\n*|]+?)(?=\s*\*{0,2}(?:Cidade|UF|CEP)|\||\n|$)/i.exec(text)
  if (bairroMatch) {
    const b = sanitizarTextoExtraido(bairroMatch[1])
    if (b && !isTextoCabecalhoOuInvalido(b)) {
      segurado.bairro = b
    }
  }

  const cidadeMatch = /\*{0,2}Cidade:\*{0,2}\s*([^\n*|]+?)(?=\s*\*{0,2}(?:UF|CEP)|\||\n|$)/i.exec(
    text,
  )
  if (cidadeMatch) {
    const c = sanitizarTextoExtraido(cidadeMatch[1])
    if (c && !isTextoCabecalhoOuInvalido(c)) {
      segurado.cidade = c
    }
  }

  const ufMatch = /\*{0,2}UF:\*{0,2}\s*([A-Z]{2})\b/i.exec(text)
  if (ufMatch && BRAZILIAN_STATES.includes(ufMatch[1].toUpperCase())) {
    segurado.estado = ufMatch[1].toUpperCase()
  }

  // CEP no bloco do segurado: buscar antes do bloco de questionário de risco
  const idxQuest = text.toLowerCase().indexOf('questionário de avaliação de risco')
  const textoAntesQuest = idxQuest > 0 ? text.substring(0, idxQuest) : text
  const cepMatch = /\*{0,2}CEP:\*{0,2}\s*([0-9]{5}-?[0-9]{3})\b/i.exec(textoAntesQuest)
  if (cepMatch) {
    const rawCep = cepMatch[1].replace(/\D/g, '')
    segurado.cep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`
  }

  // 4. CONDUTOR PRINCIPAL
  // Ex: "**- Nome do Principal Condutor:** JOSE CALIXTO DA SILVA NETO **CPF:** 082.831.014-98"
  // e "**- Data de Nascimento Condutor:** 26/02/1994"
  // ou sem negrito: "- Nome do Principal Condutor: JOSE CALIXTO DA SILVA NETO"
  const condutorPrincipal: Partial<PropostaCondutorExtraido> = {}
  const condNomeMatch =
    /(?:-\s*)?\*{0,2}Nome\s+do\s+Principal\s+Condutor:\*{0,2}\s*([^\n*|]+?)(?=\s*\*{0,2}(?:CPF|Data|Sexo|Estado)|\||\n|$)/i.exec(
      text,
    )
  if (condNomeMatch) {
    const cNome = sanitizarTextoExtraido(condNomeMatch[1])
    if (isNomePessoaValido(cNome)) {
      condutorPrincipal.nome = cNome
    }
  }

  const condCpfMatch =
    /(?:Nome\s+do\s+Principal\s+Condutor:[\s\S]*?)\*{0,2}CPF:\*{0,2}\s*([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{11})\b/i.exec(
      text,
    )
  if (condCpfMatch) {
    const limpo = condCpfMatch[1].replace(/\D/g, '')
    if (limpo.length === 11 && isValidCpf(limpo)) {
      condutorPrincipal.cpf = limpo
    }
  }

  const condNascMatch =
    /(?:-\s*)?\*{0,2}Data\s+de\s+Nascimento\s+Condutor:\*{0,2}\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(
      text,
    )
  if (condNascMatch) {
    condutorPrincipal.dataNascimento = parseDataFlexivel(condNascMatch[1])
  }

  if (condutorPrincipal.nome && segurado.nome) {
    condutorPrincipal.mesmoQueSegurado =
      condutorPrincipal.nome.trim().toLowerCase() === segurado.nome.trim().toLowerCase()
  }

  // 5. VEÍCULO
  // Ex: "**Veículo:** 68;159;1; PI400603 VOLKSWAGEN - TAOS COMFORTLINE 250 1.4 TSI TB AT6 (Flex) A/G 4p"
  // Placa e Chassi em células de tabela GFM ou soltos:
  // "|Chassi: 8AWBJ6B29RA824716|Placa: SLE7G82||"
  // Ano Modelo / Fabricação: "|Ano Modelo: 2024|0Km: NÃO||"
  const veiculo: Partial<PropostaVeiculoExtraido> = {
    codigoFipe: '',
  }

  const veicLinhaMatch =
    /\*{0,2}Ve[íi]culo:\*{0,2}\s*([^\n|*]+?)(?=\s*\*{0,2}(?:Ano|Chassi|Placa|0Km|Uso)|\||\n|$)/i.exec(
      text,
    )
  if (veicLinhaMatch) {
    let rawVeic = sanitizarTextoExtraido(veicLinhaMatch[1])
    // Limpar prefixo de grid interno da MAPFRE, ex: "68;159;1; PI400603 VOLKSWAGEN-TAOS..."
    // Expressão regular: remover códigos separados por ponto-e-vírgula e código alfanumérico PI...
    rawVeic = rawVeic
      .replace(/^[\d\s;]+\s*(?:[A-Z]{1,3}\d{4,10}\s*)?/i, '')
      .replace(/^[A-Z]{1,3}\d{4,10}\s+/i, '')
      .trim()

    // Se o modelo ficou com hífen sem espaços (VOLKSWAGEN-TAOS), normalizar para espaço " - "
    rawVeic = rawVeic.replace(/\b([A-Za-z]+)-([A-Za-z]+)\b/g, '$1 - $2')

    if (rawVeic.length > 3 && !isTextoCabecalhoOuInvalido(rawVeic)) {
      veiculo.marcaModelo = rawVeic
    }
  }

  // Placa
  const placaMapfreMatch = /(?:placa[:\s*|]+)\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/i.exec(text)
  if (placaMapfreMatch) {
    veiculo.placa = placaMapfreMatch[1].replace(/[-\s]/g, '').toUpperCase()
  }

  // Chassi
  const chassiMapfreMatch = /(?:chassi[:\s*|]+)\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(text)
  if (chassiMapfreMatch) {
    veiculo.chassi = chassiMapfreMatch[1].toUpperCase()
  }

  // Ano Modelo e Ano Fabricação
  const anoModMatch = /(?:ano\s+modelo|ano\/modelo)[:\s*|]+(19\d{2}|20\d{2})\b/i.exec(text)
  const anoFabMatch = /(?:ano\s+fab(?:rica[çc][ãa]o)?|ano\/fab)[:\s*|]+(19\d{2}|20\d{2})\b/i.exec(
    text,
  )
  if (anoModMatch) {
    veiculo.anoModelo = parseInt(anoModMatch[1], 10)
    veiculo.anoFabricacao = anoFabMatch ? parseInt(anoFabMatch[1], 10) : veiculo.anoModelo
  }

  // Código FIPE: na proposta Mapfre analisada, não há código FIPE numérico limpo
  // Manter expressamente vazio para não pegar "divulgada"
  veiculo.codigoFipe = ''

  // 6. PRÊMIOS
  // Ex: "## Prêmios ... ## Prêmio Líquido Encargos IOF Prêmio Total ... 1.992,41 0,00 147,04 2.139,45"
  // Os quatro valores vêm NUMA linha, nessa ordem: Líquido, Encargos, IOF, Total.
  let premioLiquido: number | undefined
  let iof: number | undefined
  let premioTotal: number | undefined

  const quatroPremiosMatch =
    /(?:pr[êe]mio\s+l[íi]quido[\s\S]{1,60}?encargos[\s\S]{1,60}?iof[\s\S]{1,60}?pr[êe]mio\s+total[\s\S]*?)([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i.exec(
      text,
    )
  if (quatroPremiosMatch) {
    premioLiquido = parseMoeda(quatroPremiosMatch[1])
    iof = parseMoeda(quatroPremiosMatch[3])
    premioTotal = parseMoeda(quatroPremiosMatch[4])
  } else {
    // Tentar linha de 4 valores numéricos soltos após cabeçalho de prêmios
    const secPremiosMatch =
      /pr[êe]mios[\s\S]*?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i.exec(
        text,
      )
    if (secPremiosMatch) {
      premioLiquido = parseMoeda(secPremiosMatch[1])
      iof = parseMoeda(secPremiosMatch[3])
      premioTotal = parseMoeda(secPremiosMatch[4])
    }
  }

  // 7. PARCELAMENTO & FORMA DE PAGAMENTO
  // Ex: "|Condições de Pagamento: Código do Plano:|2310 - CR - 10 parc (Sem Juros)|Valor da Primeira:|213,94|"
  // e "|Taxa de Juros pactuada:||Valor das demais:|213,99|"
  let quantidadeParcelas: number | undefined
  let formaPagamento: string | undefined
  let parcelamentoDescricao: string | undefined

  const planoMatch =
    /(?:c[oó]digo\s+do\s+plano[*\s|:]+)([0-9A-Za-z\s\-()]+?)(?=\s*[|*]?\s*(?:valor\s+da\s+primeira|taxa|cart[ãa]o)|\n|\||$)/i.exec(
      text,
    )
  if (planoMatch) {
    const planoStr = planoMatch[1].trim()
    const parcMatch = /(\d{1,2})\s*parc/i.exec(planoStr)
    if (parcMatch) {
      quantidadeParcelas = parseInt(parcMatch[1], 10)
    }

    if (/\bCR\b/i.test(planoStr) || /cart[ãa]o/i.test(text)) {
      formaPagamento = 'Crédito'
    }

    const vlrPrimMatch =
      /(?:valor\s+da\s+primeira)[*\s|:]+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i.exec(text)
    const vlrDemaisMatch =
      /(?:valor\s+das\s+demais)[*\s|:]+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i.exec(text)

    if (quantidadeParcelas) {
      if (vlrPrimMatch && vlrDemaisMatch) {
        parcelamentoDescricao = `${quantidadeParcelas}x sem juros (1ª R$ ${vlrPrimMatch[1]}; demais R$ ${vlrDemaisMatch[1]})`
      } else if (vlrPrimMatch) {
        parcelamentoDescricao = `${quantidadeParcelas}x de R$ ${vlrPrimMatch[1]}`
      } else {
        parcelamentoDescricao = `${quantidadeParcelas}x sem juros`
      }
    }
  }

  // 8. RENOVAÇÃO
  // Ex: "|Tipo de Seguro: RENOVAÇÃO MAPFRE|Sinistro na Última Vigência: NÃO|Classe de Bônus: 10|"
  // "|Seguradora Anterior: 6238 - MAPFRE SEGUROS|Nr. da Apólice Anterior: 60519629931|Nro. Item: 1|"
  const renovacao: Partial<PropostaRenovacaoExtraida> = {}
  if (/renova[çc][ãa]o/i.test(text)) {
    renovacao.isRenovacao = true
    const apoliceAntMatch =
      /(?:nr\.?\s*da\s*ap[oó]lice\s*anterior|ap[oó]lice\s*anterior)[*\s|:]+([0-9]{6,20})\b/i.exec(
        text,
      )
    if (apoliceAntMatch) {
      renovacao.apoliceAnterior = apoliceAntMatch[1].trim()
    }

    const segAntMatch =
      /(?:seguradora\s*anterior)[*\s|:]+([0-9A-Za-zÀ-ÿ\s.\-/]+?)(?=(?:\s*[|*]?\s*(?:nr\.|ap[oó]lice|item|nro\.))|\n|\||$)/i.exec(
        text,
      )
    if (segAntMatch) {
      renovacao.seguradoraAnterior = sanitizarTextoExtraido(segAntMatch[1])
    }

    const bonusMatch = /(?:classe\s*de\s*b[oó]nus)[*\s|:]+([0-9]{1,2})\b/i.exec(text)
    if (bonusMatch) {
      renovacao.classeBonus = bonusMatch[1].trim()
    }
  }

  return {
    numeroProposta,
    numeroApolice: '', // proposta de renovação não traz nova apólice emitida ainda
    tipoSeguro: 'Auto',
    vigenciaInicio,
    vigenciaFim,
    premioLiquido,
    iof,
    premioTotal,
    formaPagamento,
    quantidadeParcelas,
    parcelamentoDescricao,
    segurado,
    condutorPrincipal,
    veiculo,
    renovacao,
  }
}
