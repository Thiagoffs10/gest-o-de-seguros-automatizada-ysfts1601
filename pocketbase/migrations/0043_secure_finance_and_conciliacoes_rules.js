migrate(
  (app) => {
    // 1. Conciliações mensais: criação e atualização restrita a Administradores e Gerentes; exclusão (reabertura) restrita a Admin/Administrador
    var concCol = app.findCollectionByNameOrId('conciliacoes')
    concCol.listRule = "@request.auth.id != ''"
    concCol.viewRule = "@request.auth.id != ''"
    concCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    concCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    concCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(concCol)

    // 2. Custos fixos: despesas e custos mensais
    var custosCol = app.findCollectionByNameOrId('custos_fixos')
    custosCol.listRule = "@request.auth.id != ''"
    custosCol.viewRule = "@request.auth.id != ''"
    custosCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    custosCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    custosCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(custosCol)

    // 3. Comissao Recebimentos: baixa de comissões
    var recCol = app.findCollectionByNameOrId('comissao_recebimentos')
    recCol.listRule = "@request.auth.id != ''"
    recCol.viewRule = "@request.auth.id != ''"
    recCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    recCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    recCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(recCol)
  },
  (app) => {
    var concCol = app.findCollectionByNameOrId('conciliacoes')
    concCol.createRule = "@request.auth.id != ''"
    concCol.updateRule = "@request.auth.id != ''"
    concCol.deleteRule = "@request.auth.id != ''"
    app.save(concCol)

    var custosCol = app.findCollectionByNameOrId('custos_fixos')
    custosCol.createRule = "@request.auth.id != ''"
    custosCol.updateRule = "@request.auth.id != ''"
    custosCol.deleteRule = "@request.auth.id != ''"
    app.save(custosCol)

    var recCol = app.findCollectionByNameOrId('comissao_recebimentos')
    recCol.createRule = "@request.auth.id != ''"
    recCol.updateRule = "@request.auth.id != ''"
    recCol.deleteRule = "@request.auth.id != ''"
    app.save(recCol)
  },
)
