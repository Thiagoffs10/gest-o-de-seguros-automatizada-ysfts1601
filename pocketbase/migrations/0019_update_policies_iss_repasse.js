migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('iss')) {
      col.fields.add(new NumberField({ name: 'iss' }))
    }

    app.save(col)

    app
      .db()
      .newQuery(
        `UPDATE policies SET iss = ROUND(commission * COALESCE(
          (SELECT imposto_percentual FROM seguradoras WHERE seguradoras.id = policies.seguradora),
          0
        ) / 100.0, 2)
        WHERE commission IS NOT NULL AND commission > 0 AND iss IS NULL`,
      )
      .execute()

    app
      .db()
      .newQuery(
        `UPDATE policies SET valor_repasse = ROUND(
          valor_repasse * COALESCE(NULLIF(valor_liquido, 0), premium_amount, 0) / 100.0, 2
        )
        WHERE valor_repasse IS NOT NULL AND valor_repasse > 0`,
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const field = col.fields.getByName('iss')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
