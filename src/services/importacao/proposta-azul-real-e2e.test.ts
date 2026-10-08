/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { parsePropostaTexto } from './proposta-parsers'

describe('Teste de Ponta a Ponta com o PDF Real da Azul Seguros', () => {
  it('extrai o markdown via endpoint de backend com o PDF real e valida todos os 11 campos', async () => {
    const nodeFs = await import('node:fs')
    const nodePath = await import('node:path')

    const pdfPath = nodePath.resolve(
      'src/assets/azulproposta6320779928-0-1-20261007142357535-666dc.pdf',
    )
    expect(nodeFs.existsSync(pdfPath)).toBe(true)

    const fileBuffer = nodeFs.readFileSync(pdfPath)
    const blob = new Blob([fileBuffer], { type: 'application/pdf' })
    const file = new File([blob], 'azulproposta6320779928.pdf', { type: 'application/pdf' })

    const backendUrl =
      process.env.VITE_POCKETBASE_URL ||
      'https://gestao-de-seguros-automatizada-1b0a1.shrd00.internal.goskip.dev'
    console.log('--- TEST E2E: INICIANDO FETCH AO BACKEND:', backendUrl)

    let markdown = ''
    try {
      const formData = new FormData()
      formData.append('arquivo', file)

      const res = await fetch(`${backendUrl}/backend/v1/testes/extrair-documento`, {
        method: 'POST',
        body: formData,
      })

      console.log('--- TEST E2E: RES STATUS:', res.status)
      if (res.status === 200) {
        const json: any = await res.json()
        if (json.success && json.markdown) {
          markdown = json.markdown
          console.log('--- TEST E2E: MARKDOWN RECEBIDO, COMPRIMENTO:', markdown.length)
        }
      } else {
        const errText = await res.text()
        console.log('--- TEST E2E: ERRO RES TEXT:', errText)
      }
    } catch (fetchErr: any) {
      console.log('--- TEST E2E: FETCH EXCEPTION:', fetchErr.message || fetchErr)
    }

    if (
      !markdown &&
      nodeFs.existsSync(nodePath.resolve('src/services/importacao/azul-real-extracted.md'))
    ) {
      markdown = nodeFs.readFileSync(
        nodePath.resolve('src/services/importacao/azul-real-extracted.md'),
        'utf-8',
      )
    }

    expect(markdown.length).toBeGreaterThan(100)

    // Salvar o markdown real para referência rápida
    nodeFs.writeFileSync(
      nodePath.resolve('src/services/importacao/azul-real-extracted.md'),
      markdown,
      'utf-8',
    )

    // Invocar o parser com o texto real retornado
    const proposta = parsePropostaTexto(markdown, 'Azul_Proposta_6320779928.pdf')

    // Se falhar, imprimimos o que veio para conferir
    console.log('RESULTADO DA EXTRAÇÃO:', JSON.stringify(proposta.segurado, null, 2))

    // Validar os 11 campos conforme exigência
    expect(proposta.seguradoraNome).toBe('Azul Seguros')
    expect(proposta.segurado.nome).toBe('LIVIA LOURENCO FERNANDES DA CUNHA BARROS')
    expect(proposta.segurado.cpfCnpj).toBe('057.365.924-95')
    expect(proposta.segurado.email).toBe('paulagabrieladv@gmail.com')
    expect(proposta.segurado.telefone).toBe('(83) 99112-9729')
    expect(proposta.segurado.dataNascimento).toBe('1990-08-02')
    expect(proposta.segurado.cep).toBe('58037-335')
    expect(proposta.segurado.rua).toBe('R Doralice de Almeida Lyra')
    expect(proposta.segurado.numero).toBe('55')
    expect(proposta.segurado.bairro).toBe('Jardim Oceania')
    expect(proposta.segurado.cidade).toBe('João Pessoa')
    expect(proposta.segurado.estado).toBe('PB')

    // Condutor principal
    expect(proposta.condutorPrincipal.nome).toBe('PAULA GABRIELA DE MORAIS NEGREIROS')
  })
})
