migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const seguradorasCol = app.findCollectionByNameOrId('seguradoras')
    const parceirosCol = app.findCollectionByNameOrId('parceiros')

    if (!col.fields.getByName('policy_code')) {
      col.fields.add(new NumberField({ name: 'policy_code' }))
    }
    if (!col.fields.getByName('tipo_de_seguro')) {
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
    }
    if (!col.fields.getByName('seguradora')) {
      col.fields.add(
        new RelationField({ name: 'seguradora', collectionId: seguradorasCol.id, maxSelect: 1 }),
      )
    }
    if (!col.fields.getByName('placa')) {
      col.fields.add(new TextField({ name: 'placa' }))
    }
    if (!col.fields.getByName('modelo_veiculo')) {
      col.fields.add(new TextField({ name: 'modelo_veiculo' }))
    }
    if (!col.fields.getByName('valor_bruto')) {
      col.fields.add(new NumberField({ name: 'valor_bruto' }))
    }
    if (!col.fields.getByName('valor_liquido')) {
      col.fields.add(new NumberField({ name: 'valor_liquido' }))
    }
    if (!col.fields.getByName('commission_percent')) {
      col.fields.add(new NumberField({ name: 'commission_percent' }))
    }
    if (!col.fields.getByName('tipo_de_venda')) {
      col.fields.add(
        new SelectField({
          name: 'tipo_de_venda',
          values: ['Produção Própria', 'Parceiro', 'Indicação'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('observacao_indicacao')) {
      col.fields.add(new TextField({ name: 'observacao_indicacao' }))
    }
    if (!col.fields.getByName('parceiro')) {
      col.fields.add(
        new RelationField({ name: 'parceiro', collectionId: parceirosCol.id, maxSelect: 1 }),
      )
    }
    if (!col.fields.getByName('valor_repasse')) {
      col.fields.add(new NumberField({ name: 'valor_repasse' }))
    }
    if (!col.fields.getByName('data_pagamento_parceiro')) {
      col.fields.add(new DateField({ name: 'data_pagamento_parceiro' }))
    }
    if (!col.fields.getByName('pago_parceiro')) {
      col.fields.add(new BoolField({ name: 'pago_parceiro' }))
    }
    if (!col.fields.getByName('data_recebimento_comissao')) {
      col.fields.add(new DateField({ name: 'data_recebimento_comissao' }))
    }
    if (!col.fields.getByName('comissao_recebida')) {
      col.fields.add(new BoolField({ name: 'comissao_recebida' }))
    }

    app.save(col)

    app
      .db()
      .newQuery(
        'UPDATE policies SET commission_percent = commission WHERE commission_percent IS NULL OR commission_percent = 0',
      )
      .execute()
    app
      .db()
      .newQuery(
        'UPDATE policies SET valor_bruto = premium_amount WHERE valor_bruto IS NULL OR valor_bruto = 0',
      )
      .execute()
    app
      .db()
      .newQuery(
        'UPDATE policies SET valor_liquido = premium_amount WHERE valor_liquido IS NULL OR valor_liquido = 0',
      )
      .execute()

    try {
      const records = app.findRecordsByFilter('policies', '', 'created', 0, 0)
      for (let i = 0; i < records.length; i++) {
        if (!records[i].get('policy_code')) {
          records[i].set('policy_code', i + 1)
          app.save(records[i])
        }
      }
    } catch (_) {}
  },
  (app) => {},
)
