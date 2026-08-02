migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('custos_fixos')

    if (!col.fields.getByName('pago')) {
      col.fields.add(new BoolField({ name: 'pago' }))
    }
    if (!col.fields.getByName('data_pagamento')) {
      col.fields.add(new DateField({ name: 'data_pagamento' }))
    }
    if (!col.fields.getByName('forma_pagamento')) {
      col.fields.add(
        new SelectField({
          name: 'forma_pagamento',
          values: ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Boleto', 'Outro'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('recorrente')) {
      col.fields.add(new BoolField({ name: 'recorrente' }))
    }
    if (!col.fields.getByName('frequencia_recorrencia')) {
      col.fields.add(
        new SelectField({
          name: 'frequencia_recorrencia',
          values: ['Mensal', 'Trimestral', 'Semestral', 'Anual'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
    app.db().newQuery('UPDATE custos_fixos SET pago = false WHERE pago IS NULL').execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('custos_fixos')
    const names = [
      'pago',
      'data_pagamento',
      'forma_pagamento',
      'recorrente',
      'frequencia_recorrencia',
    ]
    for (const n of names) {
      const f = col.fields.getByName(n)
      if (f) col.fields.remove(f)
    }
    app.save(col)
  },
)
