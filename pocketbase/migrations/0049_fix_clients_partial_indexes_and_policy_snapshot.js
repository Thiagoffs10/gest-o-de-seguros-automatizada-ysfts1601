// Migração corretiva:
// 1. Garante que os índices únicos parciais em clients (CPF e CNPJ) estejam rigorosamente aplicados
//    com WHERE seguro (WHERE cpf IS NOT NULL AND cpf != '' / WHERE cnpj IS NOT NULL AND cnpj != '')
//    para viabilizar bootstrap limpo e importação de bases sem conflito com vazios.
// 2. Proteção de integridade referencial: adiciona modelo_comissao_snapshot em policies se não existir,
//    e previne orfandade de comissao_prevista por remapeamento antes de qualquer deduplicação.

migrate(
  (app) => {
    // 1. Correção e garantia de índices parciais de clients (Item 14)
    const clientsCol = app.findCollectionByNameOrId('clients')
    try {
      clientsCol.removeIndex('idx_clients_cpf_unique')
    } catch (_) {}
    try {
      clientsCol.removeIndex('idx_clients_cnpj_unique')
    } catch (_) {}

    clientsCol.addIndex('idx_clients_cpf_unique', true, 'cpf', "cpf IS NOT NULL AND cpf != ''")
    clientsCol.addIndex('idx_clients_cnpj_unique', true, 'cnpj', "cnpj IS NOT NULL AND cnpj != ''")
    app.save(clientsCol)

    // 2. Campo modelo_comissao_snapshot em policies (Item 12: preservação da condição histórica)
    const policiesCol = app.findCollectionByNameOrId('policies')
    if (!policiesCol.fields.getByName('modelo_comissao_snapshot')) {
      policiesCol.fields.add(
        new JSONField({
          name: 'modelo_comissao_snapshot',
        }),
      )
      app.save(policiesCol)
    }

    // 3. Integridade comissoes_previstas e comissao_recebimentos (Item 6):
    // Se existirem previsões duplicadas pela mesma chave estável, REMAPEAR recebimentos vinculados
    // para a previsão que será mantida antes de qualquer exclusão!
    try {
      const duplicatas = app
        .db()
        .newQuery(`
        SELECT chave_estavel, COUNT(*) as qtd
        FROM comissoes_previstas
        WHERE chave_estavel IS NOT NULL AND chave_estavel != ''
        GROUP BY chave_estavel
        HAVING COUNT(*) > 1
      `)
        .all()

      if (duplicatas && duplicatas.length > 0) {
        for (let i = 0; i < duplicatas.length; i++) {
          const ch = duplicatas[i].chave_estavel
          const rows = app
            .db()
            .newQuery(`
            SELECT id, status,
                   (SELECT COUNT(*) FROM comissao_recebimentos WHERE comissao_recebimentos.comissao_prevista = comissoes_previstas.id) as rec_count
            FROM comissoes_previstas
            WHERE chave_estavel = {:chave}
            ORDER BY rec_count DESC, id ASC
          `)
            .bind({ chave: ch })
            .all()

          if (rows && rows.length > 1) {
            const idParaManter = rows[0].id
            for (let r = 1; r < rows.length; r++) {
              const idParaRemover = rows[r].id
              // Remapear recebimentos vinculados para idParaManter
              app
                .db()
                .newQuery(`
                UPDATE comissao_recebimentos
                SET comissao_prevista = {:idManter}
                WHERE comissao_prevista = {:idRemover}
              `)
                .bind({ idManter: idParaManter, idRemover: idParaRemover })
                .execute()

              // Excluir apenas a previsão redundante após remapeamento
              app
                .db()
                .newQuery(`
                DELETE FROM comissoes_previstas WHERE id = {:idRemover}
              `)
                .bind({ idRemover: idParaRemover })
                .execute()
            }
          }
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const polCol = app.findCollectionByNameOrId('policies')
      const f = polCol.fields.getByName('modelo_comissao_snapshot')
      if (f) polCol.fields.remove(f)
      app.save(polCol)
    } catch (_) {}
  },
)
