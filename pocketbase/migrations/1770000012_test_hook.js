migrate(
  (app) => {
    try {
      const alertaCol = app.findCollectionByNameOrId('sistema_alertas')
      const rec = new Record(alertaCol)
      rec.set('modulo', 'APOLICES')
      rec.set('tipo', 'OUTRO')
      rec.set('nivel', 'INFO')
      rec.set('titulo', 'EXTRAIR_AZUL_TESTE')
      rec.set('motivo', 'TESTE_EXTRACAO')
      rec.set('resolvido', false)
      app.save(rec)
    } catch (e) {
      console.log('Error creating test alert:', e)
    }
  },
  (app) => {},
)
