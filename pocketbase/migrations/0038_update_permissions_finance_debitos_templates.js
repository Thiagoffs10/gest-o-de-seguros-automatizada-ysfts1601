migrate(
  (app) => {
    // 1. Atualizar regras de acesso de parceiro_pagamentos
    // Fechamento financeiro/pagamento: visualização para autenticados; criação/atualização/exclusão apenas Admin, Administrador e Gerente
    var pagamentosCol = app.findCollectionByNameOrId('parceiro_pagamentos')
    pagamentosCol.listRule = "@request.auth.id != ''"
    pagamentosCol.viewRule = "@request.auth.id != ''"
    pagamentosCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    pagamentosCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    pagamentosCol.deleteRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(pagamentosCol)

    // 2. Atualizar regras de acesso de parceiro_debitos
    // Débitos de parceiros: visualização para autenticados; criação/atualização apenas Admin, Administrador e Gerente; exclusão apenas Admin e Administrador
    var debitosCol = app.findCollectionByNameOrId('parceiro_debitos')
    debitosCol.listRule = "@request.auth.id != ''"
    debitosCol.viewRule = "@request.auth.id != ''"
    debitosCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    debitosCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    debitosCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(debitosCol)

    // 3. Atualizar regras de acesso de email_templates
    // Modelos de e-mail: visualização para autenticados; criação/atualização/exclusão apenas Admin, Administrador e Gerente
    var templatesCol = app.findCollectionByNameOrId('email_templates')
    templatesCol.listRule = "@request.auth.id != ''"
    templatesCol.viewRule = "@request.auth.id != ''"
    templatesCol.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    templatesCol.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    templatesCol.deleteRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(templatesCol)
  },
  (app) => {
    var pagamentosCol = app.findCollectionByNameOrId('parceiro_pagamentos')
    pagamentosCol.createRule = "@request.auth.id != ''"
    pagamentosCol.updateRule = "@request.auth.id != ''"
    pagamentosCol.deleteRule = "@request.auth.id != ''"
    app.save(pagamentosCol)

    var debitosCol = app.findCollectionByNameOrId('parceiro_debitos')
    debitosCol.createRule = "@request.auth.id != ''"
    debitosCol.updateRule = "@request.auth.id != ''"
    debitosCol.deleteRule = "@request.auth.id != ''"
    app.save(debitosCol)

    var templatesCol = app.findCollectionByNameOrId('email_templates')
    templatesCol.createRule = "@request.auth.id != ''"
    templatesCol.updateRule = "@request.auth.id != ''"
    templatesCol.deleteRule = "@request.auth.id != ''"
    app.save(templatesCol)
  },
)
