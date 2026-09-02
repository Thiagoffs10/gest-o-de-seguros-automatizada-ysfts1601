cronAdd('birthday_reminders', '0 8 * * *', () => {
  try {
    const clients = $app.findRecordsByFilter('clients', "birth_date != ''", 'created', 0, 0)
    const now = new Date()
    const currentMonthIndex = now.getMonth() // 0-11
    const currentYear = now.getFullYear()

    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]

    const monthName = monthNames[currentMonthIndex]
    const monthNumStr = String(currentMonthIndex + 1).padStart(2, '0')
    const firstDayOfMonthStr = currentYear + '-' + monthNumStr + '-01'

    var monthClients = []
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i]
      var birthDateStr = client.getString('birth_date')
      if (!birthDateStr) continue

      var bMonth = -1
      var rawDateOnly = birthDateStr.split('T')[0].split(' ')[0]
      var parts = rawDateOnly.split('-')
      if (parts.length >= 2) {
        bMonth = parseInt(parts[1], 10) - 1
      }
      if (bMonth === -1) {
        var bd = new Date(birthDateStr)
        bMonth = bd.getUTCMonth()
      }

      if (bMonth === currentMonthIndex) {
        monthClients.push(client)
      }
    }

    if (monthClients.length === 0) {
      return
    }

    var reminderMessage =
      'Aniversariantes de ' +
      monthName +
      '/' +
      currentYear +
      ' (' +
      monthClients.length +
      ' cliente' +
      (monthClients.length > 1 ? 's' : '') +
      ')'

    // Procurar se já existe o lembrete agrupado do mês
    var existingGroupReminder = null
    try {
      existingGroupReminder = $app.findFirstRecordByFilter(
        'reminders',
        'type = "Aniversário" && client = "" && message ~ "Aniversariantes de ' +
          monthName +
          '/' +
          currentYear +
          '"',
      )
    } catch (_) {
      existingGroupReminder = null
    }

    var remindersCol = $app.findCollectionByNameOrId('reminders')
    if (existingGroupReminder) {
      existingGroupReminder.set('message', reminderMessage)
      $app.save(existingGroupReminder)
    } else {
      var newReminder = new Record(remindersCol)
      newReminder.set('type', 'Aniversário')
      newReminder.set('client', '')
      newReminder.set('policy', '')
      newReminder.set('date', firstDayOfMonthStr)
      newReminder.set('message', reminderMessage)
      newReminder.set('sent', false)
      $app.save(newReminder)
    }
  } catch (err) {
    $app.logger().error('birthday reminders monthly cron failed', 'error', String(err))
  }
})
