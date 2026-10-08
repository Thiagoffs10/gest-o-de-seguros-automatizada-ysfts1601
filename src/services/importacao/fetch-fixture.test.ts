/// <reference types="node" />
import { describe, it } from 'vitest'

describe('Salvar dump real do PDF azul', () => {
  it('executa chamada e grava fixture real', async () => {
    const nodeFs = await import('node:fs')
    const nodePath = await import('node:path')

    const pdfPath = nodePath.resolve(
      'src/assets/azulproposta6320779928-0-1-20261007142357535-666dc.pdf',
    )
    if (!nodeFs.existsSync(pdfPath)) {
      console.log('PDF não encontrado!')
      return
    }

    const fileBuffer = nodeFs.readFileSync(pdfPath)
    const blob = new Blob([fileBuffer], { type: 'application/pdf' })
    const file = new File([blob], 'azulproposta6320779928.pdf', { type: 'application/pdf' })

    const b64 = fileBuffer.toString('base64')
    console.log('PDF B64 LEN:', b64.length)
    const backendUrl =
      process.env.VITE_POCKETBASE_URL ||
      'https://gestao-de-seguros-automatizada-1b0a1.shrd00.internal.goskip.dev'

    try {
      const res = await fetch(`${backendUrl}/backend/v1/testes/extrair-b64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: b64, fileName: 'azul_proposta_6320779928.pdf' }),
      })
      console.log('B64 STATUS:', res.status)
      const data: any = await res.json()
      console.log('B64 DATA RES:', data.success, 'MD LEN:', data.markdown?.length)
      if (data.markdown) {
        const fixturesDir = nodePath.resolve('src/services/importacao/__fixtures__')
        if (!nodeFs.existsSync(fixturesDir)) {
          nodeFs.mkdirSync(fixturesDir, { recursive: true })
        }
        nodeFs.writeFileSync(
          nodePath.resolve('src/services/importacao/__fixtures__/azul-real-extracted.md'),
          data.markdown,
          'utf-8',
        )
        nodeFs.writeFileSync(
          nodePath.resolve('src/services/importacao/azul-real-extracted.md'),
          data.markdown,
          'utf-8',
        )
      }
    } catch (e: any) {
      console.log('B64 FETCH ERR:', e.message)
    }
  })
})
