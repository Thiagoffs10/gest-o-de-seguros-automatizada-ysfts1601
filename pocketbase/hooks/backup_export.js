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
      'comissao_recebimentos',
      'payments',
      'reminders',
      'communications',
      'seguradoras',
      'parceiros',
      'custos_fixos',
      'tipos_seguro',
      'conciliacoes',
      'parceiro_pagamentos',
      'parceiro_debitos',
      'email_templates',
      'password_resets',
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
        version: '1.2.0',
        source: e.request.host,
        application: 'CRED10MIX Seguros',
      },
      schema: {},
      records: {},
      files: {},
    }

    var totalRecordsCount = 0
    var summaryCounts = {}

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

      summaryCounts[colName] = allRecs.length
      totalRecordsCount += allRecs.length

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
              var fileUrl = baseUrl + '/api/files/' + colName + '/' + rec.id + '/' + fv
              ex[fn] = {
                filename: fv,
                url: fileUrl,
              }
              if (!result.files[colName]) result.files[colName] = []
              result.files[colName].push({
                recordId: rec.id,
                fieldName: fn,
                filename: fv,
                url: fileUrl,
              })
            } else {
              ex[fn] = null
            }
          } else if (ft === 'bool') {
            ex[fn] = rec.getBool(fn)
          } else if (ft === 'number') {
            ex[fn] = rec.getFloat(fn)
          } else if (ft === 'json') {
            try {
              var rawJson = rec.get(fn)
              ex[fn] = rawJson
            } catch (_) {
              ex[fn] = null
            }
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

    result.metadata.summary = summaryCounts
    result.metadata.total_records = totalRecordsCount

    // Salvar registro de auditoria/histórico do backup manual gerado
    try {
      var bkCol = $app.findCollectionByNameOrId('system_backups')
      var bkRec = new Record(bkCol)
      var nowIso = new Date().toISOString()
      var pad = function (n) {
        return (n < 10 ? '0' : '') + n
      }
      var d = new Date()
      var dateSlug =
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        '_' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
      var fileName = 'manual_backup_' + dateSlug + '.json'

      bkRec.set('backup_type', 'manual')
      bkRec.set('status', 'completed')
      bkRec.set('file_name', fileName)
      bkRec.set('total_records', totalRecordsCount)
      bkRec.set('summary_json', summaryCounts)
      bkRec.set('data_json', result)
      bkRec.set('created_by', auth.getString('name') || auth.getString('email') || 'Admin')
      $app.save(bkRec)
    } catch (saveErr) {
      $app.logger().warn('Nao foi possivel salvar log do backup manual', 'error', String(saveErr))
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
