/// <reference lib="esnext" />
// Endossos editáveis: campos de ano do veículo (fabricação/modelo) para espelhar as apólices,
// além de índices que aceleram a busca por placa e o filtro de organização.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('endorsements')

    if (!col.fields.getByName('ano_fabricacao')) {
      col.fields.add(new NumberField({ name: 'ano_fabricacao', onlyInt: true }))
    }
    if (!col.fields.getByName('ano_modelo')) {
      col.fields.add(new NumberField({ name: 'ano_modelo', onlyInt: true }))
    }

    col.addIndex('idx_endorsements_placa', false, 'placa', '')
    col.addIndex('idx_endorsements_organization', false, 'organization', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('endorsements')
    col.removeIndex('idx_endorsements_placa')
    col.removeIndex('idx_endorsements_organization')
    try {
      col.fields.removeByName('ano_fabricacao')
      col.fields.removeByName('ano_modelo')
    } catch (_) {}
    app.save(col)
  },
)
