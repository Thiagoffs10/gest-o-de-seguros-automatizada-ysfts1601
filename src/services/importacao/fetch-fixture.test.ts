/// <reference types="node" />
import { describe, it, expect } from 'vitest'

describe('Obter markdown real do endpoint backend', () => {
  it('faz fetch no endpoint e grava o arquivo fixture', async () => {
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

    const formData = new FormData()
    formData.append('arquivo', file)

    const res = await fetch(`${backendUrl}/backend/v1/testes/extrair-documento`, {
      method: 'POST',
      body: formData,
    })

    console.log('STATUS:', res.status)
    const json: any = await res.json()
    console.log('JSON SUCCESS:', json.success, 'MD LEN:', json.markdown?.length)
    expect(json.success).toBe(true)
    expect(json.markdown?.length).toBeGreaterThan(100)

    nodeFs.writeFileSync(
      nodePath.resolve('src/services/importacao/azul-real-extracted.md'),
      json.markdown,
      'utf-8',
    )
  })
})
