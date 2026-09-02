cronAdd('policy_auto_expire', '0 1 * * *', () => {
  try {
    const today = new Date().toISOString().split('T')[0]
    $app
      .db()
      .newQuery(
        `UPDATE policies SET status = 'Vencida' WHERE status = 'Ativa' AND end_date < {:today}`,
      )
      .bind({ today: today + ' 00:00:00' })
      .execute()
    $app.logger().info('Cron policy_auto_expire executado com sucesso')
  } catch (err) {
    $app.logger().error('Erro ao executar cron policy_auto_expire', 'error', String(err))
  }
})
