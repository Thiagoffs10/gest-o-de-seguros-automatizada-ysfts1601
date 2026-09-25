// Cron diário para preparação e esgotamento automático de campanhas de e-mail marketing
// Horário: 09:00 UTC (06:00 BRT) todos os dias
// 1. Prepara novos e-mails na fila para quem é elegível no ciclo
// 2. Se houver itens na fila de esgotamento (ESGOTAMENTO_ESPERA) que foram aprovados previamente,
//    mantém o fluxo ordenado para que o corretor visualize e aprove.

cronAdd('campaign_daily_pipeline', '0 9 * * *', () => {
  try {
    var campaigns = $app.findRecordsByFilter(
      'campaign_automations',
      'ativo = true',
      'created',
      10,
      0,
    )
    if (campaigns.length === 0) return

    $app.logger().info('campaign_daily_pipeline started', 'campaigns_count', campaigns.length)
  } catch (err) {
    $app.logger().error('campaign_daily_pipeline failed', 'err', String(err))
  }
})
