// Endpoint para testes e inspeção do texto extraído sem requerer autenticação interativa
routerAdd('POST', '/backend/v1/testes/extrair-b64', (e) => {
  var data = e.requestInfo().body || {}
  var b64 = data.base64 || ''
  var fileName = data.fileName || 'documento.pdf'
  if (!b64) {
    return e.json(400, { success: false, error: 'base64 ausente' })
  }
  try {
    var file = $filesystem.fileFromBytes(fileName, $security.base64Decode(b64))
    var res = $documents.toMarkdown({ file: file })
    var md = res.markdown || ''

    try {
      var alertaCol = $app.findCollectionByNameOrId('sistema_alertas')
      var rec = new Record(alertaCol)
      rec.set('modulo', 'APOLICES')
      rec.set('tipo', 'OUTRO')
      rec.set('nivel', 'INFO')
      rec.set('titulo', 'EXTRAIR_AZUL_DUMP')
      rec.set('motivo', 'CAPTURA_REAL')
      rec.set('resolvido', false)
      rec.set('detalhes_json', {
        fileName: fileName,
        length: md.length,
        markdown: md,
      })
      $app.save(rec)
    } catch (saveErr) {
      console.log('Erro salvar dump alerta:', saveErr)
    }

    return e.json(200, {
      success: true,
      fileName: fileName,
      markdown: md,
      truncated: Boolean(res.truncated),
    })
  } catch (err) {
    return e.json(500, { success: false, error: String(err.message || err) })
  }
})

routerAdd('POST', '/backend/v1/testes/extrair-documento', (e) => {
  var files = e.findUploadedFiles('arquivo')
  if (!files || files.length === 0) {
    return e.json(400, { success: false, error: 'Nenhum arquivo enviado.' })
  }
  var file = files[0]
  try {
    var res = $documents.toMarkdown({ file: file })
    var md = res.markdown || ''

    // Persistir em um alerta ou log para conferência se necessário
    try {
      var alertaCol = $app.findCollectionByNameOrId('sistema_alertas')
      var rec = new Record(alertaCol)
      rec.set('modulo', 'APOLICES')
      rec.set('tipo', 'OUTRO')
      rec.set('nivel', 'INFO')
      rec.set('titulo', 'EXTRAIR_AZUL_DUMP')
      rec.set('motivo', 'CAPTURA_REAL')
      rec.set('resolvido', false)
      rec.set('detalhes_json', {
        fileName: file.name,
        length: md.length,
        markdown: md,
      })
      $app.save(rec)
    } catch (saveErr) {
      console.log('Erro ao salvar alerta dump:', saveErr)
    }

    return e.json(200, {
      success: true,
      fileName: file.name,
      markdown: md,
      truncated: Boolean(res.truncated),
    })
  } catch (err) {
    return e.json(500, { success: false, error: String(err.message || err) })
  }
})

routerAdd(
  'POST',
  '/backend/v1/documentos/extrair-proposta',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { success: false, error: 'Requer autenticação.' })
    }

    var files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      return e.json(400, { success: false, error: 'Nenhum arquivo enviado.' })
    }

    var file = files[0]
    var fileName = file.name || 'proposta.pdf'

    try {
      var res = $documents.toMarkdown({ file: file })
      var md = res.markdown || ''
      console.log(
        '--- TO_MARKDOWN EXTRACTED --- fileName=' +
          fileName +
          ' len=' +
          md.length +
          ' sample=' +
          md.substring(0, 400).replace(/\n/g, '\\n'),
      )
      // Log chunks so we can see full content in server logs
      for (var ci = 0; ci < md.length; ci += 2000) {
        console.log('--- MD_CHUNK_' + ci / 2000 + ' --- ' + md.substring(ci, ci + 2000))
      }

      return e.json(200, {
        success: true,
        fileName: fileName,
        markdown: md,
        truncated: Boolean(res.truncated),
      })
    } catch (err) {
      var status = err.status || 500
      if (status === 422) {
        return e.json(422, {
          success: false,
          error: 'O documento PDF não possui camada de texto selecionável (OCR necessário).',
        })
      }
      return e.json(status, {
        success: false,
        error: 'Falha ao extrair texto do documento: ' + String(err.message || err),
      })
    }
  },
  $apis.requireAuth(),
)
