cronAdd('backup_daily_cron', '0 3 * * *', () => {
  try {
    const collections = [
      'users',
      'clients',
      'policies',
      'comissao_recebimentos',
      'modelos_comissao',
      'comissoes_previstas',
      'produtos',
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

    const pad = (n) => (n < 10 ? '0' : '') + n
    const now = new Date()
    const dateSlug =
      now.getFullYear() +
      '-' +
      pad(now.getMonth() + 1) +
      '-' +
      pad(now.getDate()) +
      '_' +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    const fileName = `daily_backup_${dateSlug}.json`

    // 1. Obter credenciais de autenticação de usuários
    const userHashes = {}
    try {
      $app
        .db()
        .newQuery('SELECT id, passwordHash, tokenKey, email, verified FROM users')
        .all((row) => {
          userHashes[row.getString('id')] = {
            passwordHash: row.getString('passwordHash'),
            tokenKey: row.getString('tokenKey'),
            email: row.getString('email'),
            verified: row.getBool('verified'),
          }
        })
    } catch (_) {
      try {
        $app
          .db()
          .newQuery('SELECT id, password, tokenKey, email, verified FROM users')
          .all((row) => {
            userHashes[row.getString('id')] = {
              passwordHash: row.getString('password'),
              tokenKey: row.getString('tokenKey'),
              email: row.getString('email'),
              verified: row.getBool('verified'),
            }
          })
      } catch (errAuth) {
        $app.logger().warn('Cron backup: aviso ao coletar dados de auth', 'error', String(errAuth))
      }
    }

    const backupPayload = {
      metadata: {
        exported_at: now.toISOString(),
        version: '1.2.0',
        source: 'cron_daily',
        application: 'CRED10MIX Seguros',
      },
      schema: {},
      records: {},
      files: {},
    }

    let totalRecordsCount = 0
    const summaryCounts = {}

    // 2. Extrair todas as coleções, seus schemas e dados reais completos
    for (let i = 0; i < collections.length; i++) {
      const colName = collections[i]
      let col = null
      try {
        col = $app.findCollectionByNameOrId(colName)
      } catch (colErr) {
        continue
      }

      let schemaFields = []
      let fieldArr = []
      try {
        if (typeof col.fields.all === 'function') {
          fieldArr = col.fields.all()
        } else {
          fieldArr = col.fields || []
        }
      } catch (_) {
        fieldArr = col.fields || []
      }

      for (let j = 0; j < fieldArr.length; j++) {
        const fld = fieldArr[j]
        let fName = ''
        let fType = ''
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

      backupPayload.schema[colName] = {
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

      let allRecs = []
      let page = 0
      const pageSize = 1000
      while (true) {
        const batch = $app.findRecordsByFilter(colName, '', '-created', pageSize, page * pageSize)
        allRecs = allRecs.concat(batch)
        if (batch.length < pageSize) break
        page++
      }

      summaryCounts[colName] = allRecs.length
      totalRecordsCount += allRecs.length

      const exportedRecs = []
      for (let k = 0; k < allRecs.length; k++) {
        const rec = allRecs[k]
        const ex = { id: rec.id }

        for (let m = 0; m < fieldArr.length; m++) {
          const fld2 = fieldArr[m]
          let fn = ''
          let ft = ''
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
            const fv = rec.getString(fn)
            if (fv) {
              const fileUrl = `/api/files/${colName}/${rec.id}/${fv}`
              ex[fn] = {
                filename: fv,
                url: fileUrl,
              }
              if (!backupPayload.files[colName]) backupPayload.files[colName] = []
              backupPayload.files[colName].push({
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
              ex[fn] = rec.get(fn)
            } catch (_) {
              ex[fn] = null
            }
          } else {
            ex[fn] = rec.getString(fn)
          }
        }

        if (colName === 'users') {
          const ux = userHashes[rec.id]
          if (ux) {
            ex.email = ux.email
            ex.verified = ux.verified
            ex.tokenKey = ux.tokenKey
            ex.passwordHash = ux.passwordHash
          }
        }

        exportedRecs.push(ex)
      }

      backupPayload.records[colName] = exportedRecs
    }

    backupPayload.metadata.summary = summaryCounts
    backupPayload.metadata.total_records = totalRecordsCount

    // 3. Persistir o snapshot completo na coleção system_backups
    const bkCol = $app.findCollectionByNameOrId('system_backups')
    const bkRec = new Record(bkCol)
    bkRec.set('backup_type', 'daily_auto')
    bkRec.set('status', 'completed')
    bkRec.set('file_name', fileName)
    bkRec.set('total_records', totalRecordsCount)
    bkRec.set('summary_json', summaryCounts)
    bkRec.set('data_json', backupPayload)
    bkRec.set('created_by', 'Rotina Automática Diária (Cron)')
    $app.save(bkRec)

    // 4. Política de Retenção: manter os últimos 30 dias de backups automáticos
    // Remove registros automáticos diários com mais de 30 dias
    try {
      const retentionDays = 30
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      const cutoffIso = cutoffDate.toISOString().replace('T', ' ').substring(0, 19)

      const oldBackups = $app.findRecordsByFilter(
        'system_backups',
        `backup_type = 'daily_auto' && created < '${cutoffIso}'`,
        'created',
        100,
        0,
      )

      for (let b = 0; b < oldBackups.length; b++) {
        $app.delete(oldBackups[b])
      }

      if (oldBackups.length > 0) {
        $app
          .logger()
          .info(
            `Retenção de backup: ${oldBackups.length} backups com mais de 30 dias foram expurgados`,
          )
      }
    } catch (retentionErr) {
      $app.logger().warn('Erro ao aplicar retenção de backups', 'error', String(retentionErr))
    }

    $app
      .logger()
      .info(
        'Backup diário gerado e persistido com sucesso na coleção system_backups',
        'file',
        fileName,
        'records',
        totalRecordsCount,
      )
  } catch (err) {
    $app.logger().error('Erro ao executar cron backup_daily_cron', 'error', String(err))
  }
})
