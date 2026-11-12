// Isolamento multi-tenant das coleções de cadastros compartilhados:
// seguradoras, parceiros e produtos.
//
// Modelo (igual às demais coleções de dados):
// - Usuário SEM organization (admin CRED10MIX): vê e altera TUDO, como hoje.
// - Usuário COM organization (parceiro): lista só registros da própria organização
//   OU registros LEGADOS (sem organization — compartilhados, uso comum a todos);
//   sobre os legados ele NÃO pode editar/excluir (somente leitura/uso).
// - Registros criados por usuário de organização nascem com a org dele
//   (auto-tag no hook server-side; a API rejeita org divergente no create).
//
// Idempotente: só aplica as regras se a coleção existir e tiver o campo
// organization; reexecutar não muda nada.

migrate(
  function (app) {
    var cols = ['seguradoras', 'parceiros', 'produtos']
    for (var i = 0; i < cols.length; i++) {
      var colName = cols[i]
      try {
        var col = app.findCollectionByNameOrId(colName)
        if (!col.fields.getByName('organization')) {
          continue // sem o campo, não isola
        }
        var strictRead =
          "@request.auth.id != '' && " +
          "(@request.auth.organization = '' || organization = @request.auth.organization)"
        var strictWrite =
          "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || " +
          "(@request.auth.organization != '' && organization = @request.auth.organization)"
        col.listRule = strictRead
        col.viewRule = strictRead
        col.createRule = strictRead
        col.updateRule = strictWrite
        col.deleteRule = strictWrite
        app.save(col)
      } catch (err) {
        $app.logger().warn('migracao org cadastros: falha ao isolar ' + colName, 'err', String(err))
      }
    }

    // Índice de nome por organização: mantém a unicidade dentro de cada org
    // (registros legados sem organization continuam com a restrição atual de
    // nome único global — sem tocar neles).
    try {
      var seg = app.findCollectionByNameOrId('seguradoras')
      seg.addIndex('idx_seguradoras_org_nome', true, 'organization,nome', '')
      app.save(seg)
    } catch (err) {
      $app.logger().warn('migracao org cadastros: índice seguradoras', 'err', String(err))
    }
  },
  function (app) {
    var cols = ['seguradoras', 'parceiros', 'produtos']
    for (var i = 0; i < cols.length; i++) {
      var colName = cols[i]
      try {
        var col = app.findCollectionByNameOrId(colName)
        if (!col.fields.getByName('organization')) {
          continue
        }
        var isProdutos = colName === 'produtos'
        var legacyWrite = isProdutos
          ? "@request.auth.id != ''"
          : "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule = legacyWrite
        col.updateRule = legacyWrite
        col.deleteRule = legacyWrite
        app.save(col)
      } catch (err) {
        $app.logger().warn('migracao org cadastros (down): falha em ' + colName, 'err', String(err))
      }
    }
    try {
      var seg2 = app.findCollectionByNameOrId('seguradoras')
      seg2.removeIndex('idx_seguradoras_org_nome')
      app.save(seg2)
    } catch (_) {}
  },
)
