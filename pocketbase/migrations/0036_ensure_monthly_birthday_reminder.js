migrate(
  (app) => {
    const clients = app.findRecordsByFilter('clients', "birth_date != ''", 'name', 0, 0)
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

    let monthClientsCount = 0
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i]
      const bDateStr = c.getString('birth_date')
      if (!bDateStr) continue

      let bMonth = -1
      const rawDateOnly = bDateStr.split('T')[0].split(' ')[0]
      const parts = rawDateOnly.split('-')
      if (parts.length >= 2) {
        bMonth = parseInt(parts[1], 10) - 1
      }
      if (bMonth === -1) {
        const bd = new Date(bDateStr)
        bMonth = bd.getUTCMonth()
      }

      if (bMonth === currentMonthIndex) {
        monthClientsCount++
      }
    }

    if (monthClientsCount > 0) {
      const message =
        'Aniversariantes de ' +
        monthName +
        '/' +
        currentYear +
        ' (' +
        monthClientsCount +
        ' cliente' +
        (monthClientsCount > 1 ? 's' : '') +
        ')'

      let existing = null
      try {
        existing = app.findFirstRecordByFilter(
          'reminders',
          'type = "Aniversário" && client = "" && message ~ "Aniversariantes de ' +
            monthName +
            '/' +
            currentYear +
            '"',
        )
      } catch (_) {
        existing = null
      }

      const remindersCol = app.findCollectionByNameOrId('reminders')
      if (!existing) {
        const newRec = new Record(remindersCol)
        newRec.set('type', 'Aniversário')
        newRec.set('client', '')
        newRec.set('policy', '')
        newRec.set('date', firstDayOfMonthStr)
        newRec.set('message', message)
        newRec.set('sent', false)
        app.save(newRec)
      }
    }
  },
  (app) => {
    // rollback
  },
)
