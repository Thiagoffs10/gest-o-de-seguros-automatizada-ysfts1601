cronAdd('backup_daily_cron', '0 3 * * *', () => {
  try {
    const collections = [
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
      'conciliacoes',
      'parceiro_pagamentos',
      'parceiro_debitos',
      'email_templates',
      'password_resets',
    ]

    const counts = {}
    for (let i = 0; i < collections.length; i++) {
      const colName = collections[i]
      try {
        counts[colName] = $app.countRecords(colName)
      } catch (e) {
        counts[colName] = 0
      }
    }

    $app
      .logger()
      .info('Cron backup_daily_cron verificado com sucesso', 'counts', JSON.stringify(counts))
  } catch (err) {
    $app.logger().error('Erro ao executar cron backup_daily_cron', 'error', String(err))
  }
})
