migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const statusField = col.fields.getByName('status')

    if (statusField) {
      // Garantir que os valores de status aceitem 'Ativa', 'Vencida', 'Expirada', 'Cancelada', 'Renovação Pendente'
      const currentValues = statusField.values || []
      const neededValues = ['Ativa', 'Vencida', 'Expirada', 'Cancelada', 'Renovação Pendente']
      const mergedValues = Array.from(new Set([...currentValues, ...neededValues]))
      statusField.values = mergedValues
      app.save(col)
    }

    // Atualizar apólices cuja data de término seja anterior a hoje e que ainda estejam como 'Ativa'
    const today = new Date().toISOString().split('T')[0]
    app
      .db()
      .newQuery(
        `UPDATE policies SET status = 'Vencida' WHERE status = 'Ativa' AND end_date < {:today}`,
      )
      .bind({ today: today + ' 00:00:00' })
      .execute()
  },
  (app) => {},
)
