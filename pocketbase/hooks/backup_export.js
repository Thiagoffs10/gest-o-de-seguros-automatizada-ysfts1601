routerAdd(
  'GET',
  '/backend/v1/backup/export',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticacao necessaria')
    var role = auth.getString('role')
    if (role !== 'Admin' && role !== 'Administrador') {
      return e.forbiddenError('Acesso restrito a administradores')
    }

    var collections = [
      'users',
      'clients',
      'policies',
      'payments',
      'reminders',
      'communications',
      'seguradoras',
      'parceiros',
      'custos_fixos',
      'tipos_seguro',
    ]

    var headers = e.requestInfo().headers || {}
    var proto = headers['x_forwarded_proto'] || 'https'
    if (Array.isArray(proto)) proto = proto[0]
    var baseUrl = proto + '://' + e.request.host

    var userHashes = {}
    try {
      $app
        .db()
        .newQuery('SELECT id, passwordHash, tokenKey, email, verified FROM users')
        .all(function (row) {
          userHashes[row.getString('id')] = {
            passwordHash: row.getString('passwordHash'),
            tokenKey: row.getString('tokenKey'),
            email: row.getString('email'),
            verified: row.getBool('verified'),
          }
        })
    } catch (err1) {
      try {
        $app
          .db()
          .newQuery('SELECT id, password, tokenKey, email, verified FROM users')
          .all(function (row) {
            userHashes[row.getString('id')] = {
              passwordHash: row.getString('password'),
              tokenKey: row.getString('tokenKey'),
              email: row.getString('email'),
              verified: row.getBool('verified'),
            }
          })
      } catch (err2) {
        $app.logger().error('backup: failed to get user auth data', 'error', String(err2))
      }
    }

    var result = {
      metadata: {
        exported_at: new Date().toISOString(),
        version: '1.0.0',
        source: e.request.host,
      },
      schema: {},
      records: {},
    }

    for (var i = 0; i < collections.length; i++) {
      var colName = collections[i]
      var col = $app.findCollectionByNameOrId(colName)

      var schemaFields = []
      var fieldArr = []
      try {
        if (typeof col.fields.all === 'function') {
          fieldArr = col.fields.all()
        } else {
          fieldArr = col.fields || []
        }
      } catch (_) {
        fieldArr = col.fields || []
      }

      for (var j = 0; j < fieldArr.length; j++) {
        var fld = fieldArr[j]
        var fName = ''
        var fType = ''
        try {
          fName = typeof fld.name === 'function' ? fld.name() : fld.name || ''
        } catch (_) {
          fName = fld.name || ''
        }
        try {
          fType = typeof fld.type === 'function' ? fld.type() : fld.type || ''
        } catch (_) {
          fType = fld.type || ''
        }
        schemaFields.push({ name: fName, type: fType })
      }

      result.schema[colName] = {
        name: colName,
        type: col.type,
        fields: schemaFields,
        listRule: col.listRule || '',
        viewRule: col.viewRule || '',
        createRule: col.createRule || '',
        updateRule: col.updateRule || '',
        deleteRule: col.deleteRule || '',
        indexes: col.indexes || [],
      }

      var allRecs = []
      var page = 0
      var pageSize = 1000
      while (true) {
        var batch = $app.findRecordsByFilter(colName, '', '-created', pageSize, page * pageSize)
        allRecs = allRecs.concat(batch)
        if (batch.length < pageSize) break
        page++
      }

      var exportedRecs = []
      for (var k = 0; k < allRecs.length; k++) {
        var rec = allRecs[k]
        var ex = { id: rec.id }

        for (var m = 0; m < fieldArr.length; m++) {
          var fld2 = fieldArr[m]
          var fn = ''
          var ft = ''
          try {
            fn = typeof fld2.name === 'function' ? fld2.name() : fld2.name || ''
          } catch (_) {
            fn = fld2.name || ''
          }
          try {
            ft = typeof fld2.type === 'function' ? fld2.type() : fld2.type || ''
          } catch (_) {
            ft = fld2.type || ''
          }

          if (ft === 'file') {
            var fv = rec.getString(fn)
            if (fv) {
              ex[fn] = {
                filename: fv,
                url: baseUrl + '/api/files/' + colName + '/' + rec.id + '/' + fv,
              }
            } else {
              ex[fn] = null
            }
          } else if (ft === 'bool') {
            ex[fn] = rec.getBool(fn)
          } else if (ft === 'number') {
            ex[fn] = rec.getFloat(fn)
          } else {
            ex[fn] = rec.getString(fn)
          }
        }

        if (colName === 'users') {
          var ux = userHashes[rec.id]
          if (ux) {
            ex.email = ux.email
            ex.verified = ux.verified
            ex.tokenKey = ux.tokenKey
            ex.passwordHash = ux.passwordHash
          }
        }

        exportedRecs.push(ex)
      }

      result.records[colName] = exportedRecs
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
