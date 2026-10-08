migrate(
  (app) => {
    // Busca arquivos no sistema ou tenta processar se tiver função disponível
    try {
      console.log('--- MIGRATION 1770000011 START ---')
    } catch (e) {
      console.log('ERR:', e)
    }
  },
  (app) => {}
)
