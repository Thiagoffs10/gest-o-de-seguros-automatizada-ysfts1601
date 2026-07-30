migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clients')

    app
      .db()
      .newQuery(
        "DELETE FROM clients WHERE id NOT IN (SELECT MIN(id) FROM clients WHERE cpf != '' GROUP BY cpf) AND cpf != ''",
      )
      .execute()

    app
      .db()
      .newQuery(
        "DELETE FROM clients WHERE id NOT IN (SELECT MIN(id) FROM clients WHERE cnpj != '' GROUP BY cnpj) AND cnpj != ''",
      )
      .execute()

    app.db().newQuery("UPDATE clients SET cpf = NULL WHERE cpf = ''").execute()
    app.db().newQuery("UPDATE clients SET cnpj = NULL WHERE cnpj = ''").execute()

    col.addIndex('idx_clients_cpf_unique', true, 'cpf')
    col.addIndex('idx_clients_cnpj_unique', true, 'cnpj')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('clients')
    col.removeIndex('idx_clients_cpf_unique')
    col.removeIndex('idx_clients_cnpj_unique')
    app.save(col)
  },
)
