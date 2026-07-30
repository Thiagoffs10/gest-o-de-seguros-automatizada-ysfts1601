cronAdd('birthday_reminders', '0 8 * * *', () => {
  try {
    const clients = $app.findRecordsByFilter('clients', "birth_date != ''", 'created', 0, 0)
    const now = new Date()

    for (const client of clients) {
      const birthDateStr = client.getString('birth_date')
      if (!birthDateStr) continue

      var birthDate = new Date(birthDateStr)
      var thisYearBirthday = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate())

      if (thisYearBirthday < now) {
        thisYearBirthday = new Date(
          now.getFullYear() + 1,
          birthDate.getMonth(),
          birthDate.getDate(),
        )
      }

      var diffMs = thisYearBirthday.getTime() - now.getTime()
      var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays > 7 || diffDays < 0) continue

      var birthdayDateStr =
        thisYearBirthday.getFullYear() +
        '-' +
        String(thisYearBirthday.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(thisYearBirthday.getDate()).padStart(2, '0')

      try {
        $app.findFirstRecordByFilter(
          'reminders',
          'type = "Aniversário" && client = "' +
            client.id +
            '" && date = "' +
            birthdayDateStr +
            '"',
        )
        continue
      } catch (_) {}

      try {
        var clientName = client.getString('name') || ''
        var clientEmail = client.getString('email') || ''

        var remindersCol = $app.findCollectionByNameOrId('reminders')
        var reminder = new Record(remindersCol)
        reminder.set('type', 'Aniversário')
        reminder.set('client', client.id)
        reminder.set('date', birthdayDateStr)
        reminder.set('message', 'Feliz aniversário, ' + clientName + '!')
        reminder.set('sent', false)
        $app.save(reminder)

        var commsCol = $app.findCollectionByNameOrId('communications')
        var comm = new Record(commsCol)
        comm.set('type', 'Email')
        comm.set('client', client.id)
        comm.set('subject', 'Feliz Aniversário, ' + clientName + '!')
        comm.set(
          'body',
          'Olá ' +
            clientName +
            ',\n\nDesejamos a você um dia repleto de alegrias, saúde e muito sucesso! Conte sempre com nossa equipe para proteger você e sua família.\n\nAtenciosamente,\nEquipe CRED10MIX',
        )
        comm.set('recipient_email', clientEmail)
        comm.set('status', 'Rascunho')
        $app.save(comm)
      } catch (err) {
        $app
          .logger()
          .error('birthday reminder creation failed', 'client', client.id, 'error', String(err))
      }
    }
  } catch (err) {
    $app.logger().error('birthday reminders cron failed', 'error', String(err))
  }
})
