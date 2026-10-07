migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    if (!col.fields.getByName('comissao_alerta_60d_ignorado')) {
      col.fields.add(
        new BoolField({
          name: 'comissao_alerta_60d_ignorado',
          required: false,
        }),
      )
    }
    if (!col.fields.getByName('comissao_alerta_60d_ignorado_data')) {
      col.fields.add(
        new DateField({
          name: 'comissao_alerta_60d_ignorado_data',
          required: false,
        }),
      )
    }
    if (!col.fields.getByName('comissao_alerta_60d_ignorado_motivo')) {
      col.fields.add(
        new TextField({
          name: 'comissao_alerta_60d_ignorado_motivo',
          required: false,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    col.fields.removeByName('comissao_alerta_60d_ignorado')
    col.fields.removeByName('comissao_alerta_60d_ignorado_data')
    col.fields.removeByName('comissao_alerta_60d_ignorado_motivo')
    app.save(col)
  },
)
