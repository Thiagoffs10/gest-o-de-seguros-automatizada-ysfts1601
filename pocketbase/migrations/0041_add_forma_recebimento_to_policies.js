migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('forma_recebimento')) {
      col.fields.add(
        new SelectField({
          name: 'forma_recebimento',
          values: [
            'Total definido',
            'Parcelada',
            'Recorrente',
            'Por esgotamento',
            'Outra / Manual',
          ],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('qtde_parcelas_esperadas')) {
      col.fields.add(
        new NumberField({
          name: 'qtde_parcelas_esperadas',
          onlyInt: true,
          min: 1,
        }),
      )
    }

    if (!col.fields.getByName('obs_forma_recebimento')) {
      col.fields.add(
        new TextField({
          name: 'obs_forma_recebimento',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const f1 = col.fields.getByName('forma_recebimento')
    if (f1) col.fields.remove(f1)
    const f2 = col.fields.getByName('qtde_parcelas_esperadas')
    if (f2) col.fields.remove(f2)
    const f3 = col.fields.getByName('obs_forma_recebimento')
    if (f3) col.fields.remove(f3)
    app.save(col)
  },
)
