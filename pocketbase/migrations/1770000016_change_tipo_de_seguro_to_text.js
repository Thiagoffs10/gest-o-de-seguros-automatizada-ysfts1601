migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const field = col.fields.getByName('tipo_de_seguro')
    if (field) {
      col.fields.removeByName('tipo_de_seguro')
    }
    col.fields.add(
      new TextField({
        name: 'tipo_de_seguro',
        required: false,
      }),
    )
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const field = col.fields.getByName('tipo_de_seguro')
    if (field) {
      col.fields.removeByName('tipo_de_seguro')
    }
    col.fields.add(
      new SelectField({
        name: 'tipo_de_seguro',
        values: [
          'Auto',
          'Vida',
          'Residencial',
          'Empresarial',
          'Saúde',
          'Outros',
          'Condomínio',
          'Viagem',
        ],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
