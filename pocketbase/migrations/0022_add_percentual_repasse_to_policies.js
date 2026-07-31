migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('percentual_repasse')) {
      col.fields.add(new NumberField({ name: 'percentual_repasse' }))
    }

    app.save(col)

    app
      .db()
      .newQuery(
        `UPDATE policies SET percentual_repasse = ROUND(
          (valor_repasse * 100.0) / NULLIF(COALESCE(NULLIF(valor_liquido, 0), premium_amount, 0), 0), 2
        )
        WHERE valor_repasse IS NOT NULL AND valor_repasse > 0 AND (percentual_repasse IS NULL OR percentual_repasse = 0)`,
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const field = col.fields.getByName('percentual_repasse')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
