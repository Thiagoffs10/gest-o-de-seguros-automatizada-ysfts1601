migrate(
  (app) => {
    // 1. Adicionar campo chave_estavel em comissoes_previstas
    const prevCol = app.findCollectionByNameOrId('comissoes_previstas')
    if (!prevCol.fields.getByName('chave_estavel')) {
      prevCol.fields.add(
        new TextField({
          name: 'chave_estavel',
        }),
      )
    }

    // Regras de RLS da comissoes_previstas:
    // Criação e atualização permitidas para Admin, Administrador e Gerente
    // Exclusão restrita a Admin e Administrador (protegendo histórico financeiro)
    prevCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    prevCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    prevCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"

    app.save(prevCol)

    // Preencher chave_estavel para registros existentes que eventualmente não possuam
    app
      .db()
      .newQuery(
        `UPDATE comissoes_previstas
         SET chave_estavel = 'prev_' || policy || '_' || COALESCE(parcela_numero, 1) || '_' || REPLACE(competencia, '/', '_')
         WHERE chave_estavel IS NULL OR chave_estavel = ''`,
      )
      .execute()

    // Deduplicar caso houvesse duplicatas antigas antes de criar índice único
    app
      .db()
      .newQuery(
        `DELETE FROM comissoes_previstas WHERE id NOT IN (
           SELECT MIN(id) FROM comissoes_previstas GROUP BY chave_estavel
         ) AND chave_estavel IS NOT NULL AND chave_estavel != ''`,
      )
      .execute()

    // Adicionar índice único seguro para chave_estavel
    prevCol.addIndex('idx_com_prev_chave_estavel', true, 'chave_estavel', 'chave_estavel != ""')
    app.save(prevCol)

    // 2. Reforçar modelos_comissao:
    // Leitura por qualquer autenticado; criação e atualização por Admin/Administrador/Gerente; exclusão por Admin/Administrador
    const modelosCol = app.findCollectionByNameOrId('modelos_comissao')
    modelosCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    modelosCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    modelosCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(modelosCol)
  },
  (app) => {
    try {
      const prevCol = app.findCollectionByNameOrId('comissoes_previstas')
      prevCol.removeIndex('idx_com_prev_chave_estavel')
      const f = prevCol.fields.getByName('chave_estavel')
      if (f) prevCol.fields.remove(f)
      prevCol.createRule = "@request.auth.id != ''"
      prevCol.updateRule = "@request.auth.id != ''"
      prevCol.deleteRule = "@request.auth.id != ''"
      app.save(prevCol)
    } catch (_) {}

    try {
      const modelosCol = app.findCollectionByNameOrId('modelos_comissao')
      modelosCol.createRule = "@request.auth.id != ''"
      modelosCol.updateRule = "@request.auth.id != ''"
      modelosCol.deleteRule = "@request.auth.id != ''"
      app.save(modelosCol)
    } catch (_) {}
  },
)
