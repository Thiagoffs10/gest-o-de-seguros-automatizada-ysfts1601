migrate(
  (app) => {
    try {
      const clients = app.findRecordsByFilter('clients', "birth_date != ''", 'created', 0, 0)
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

      if (monthClients.length === 0) return

      monthClients.sort((a, b) => {
        var dayA = 0
        var dayB = 0
        try {
          var strA = a.getString('birth_date').split('T')[0].split(' ')[0]
          var pA = strA.split('-')
          if (pA.length >= 3) dayA = parseInt(pA[2], 10)
        } catch (_) {}
        try {
          var strB = b.getString('birth_date').split('T')[0].split(' ')[0]
          var pB = strB.split('-')
          if (pB.length >= 3) dayB = parseInt(pB[2], 10)
        } catch (_) {}
        return dayA - dayB
      })

      var clientDetails = []
      for (var j = 0; j < monthClients.length; j++) {
        var c = monthClients[j]
        var cName = (c.getString('name') || 'Cliente').trim()
        var bStr = c.getString('birth_date').split('T')[0].split(' ')[0]
        var bParts = bStr.split('-')
        var dayStr = bParts.length >= 3 ? bParts[2] : ''
        if (dayStr) {
          clientDetails.push(cName + ' (dia ' + dayStr + ')')
        } else {
          clientDetails.push(cName)
        }
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
        '): ' +
        clientDetails.join(', ')

      var existingGroupReminder = null
      try {
        existingGroupReminder = app.findFirstRecordByFilter(
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

      if (existingGroupReminder) {
        existingGroupReminder.set('message', reminderMessage)
        app.save(existingGroupReminder)
      }
    } catch (err) {
      console.log('Error updating birthday reminder with client names:', err)
    }
  },
  (app) => {
    // no-op revert
  },
)
