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
      return e.json(200, {
        success: true,
        fileName: fileName,
        markdown: res.markdown || '',
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
