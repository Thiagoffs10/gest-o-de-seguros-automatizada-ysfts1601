onRecordAfterUpdateSuccess((e) => {
  const record = e.record
  const oldStatus = record.original().getString('status')
  const newStatus = record.getString('status')

  if (newStatus !== 'Renovação Pendente' || oldStatus === 'Renovação Pendente') {
    return e.next()
  }

  try {
    $app.findFirstRecordByFilter('reminders', 'type = "Renovação" && policy = "' + record.id + '"')
  } catch (_) {
    try {
      const renewalDate = record.getString('renewal_date') || record.getString('end_date') || ''
      const policyNumber = record.getString('policy_number') || ''
      const clientId = record.getString('client') || ''

      const remindersCol = $app.findCollectionByNameOrId('reminders')
      const reminder = new Record(remindersCol)
      reminder.set('type', 'Renovação')
      reminder.set('client', clientId)
      reminder.set('policy', record.id)
      reminder.set('date', renewalDate)
      reminder.set(
        'message',
        'Apólice ' +
          policyNumber +
          ' vence em ' +
          renewalDate +
          '. Entre em contato com o cliente para renovação.',
      )
      reminder.set('sent', false)
      $app.save(reminder)

      if (clientId) {
        const client = $app.findRecordById('clients', clientId)
        const clientName = client.getString('name') || ''
        const clientEmail = client.getString('email') || ''

        const commsCol = $app.findCollectionByNameOrId('communications')
        const comm = new Record(commsCol)
        comm.set('type', 'Email')
        comm.set('client', clientId)
        comm.set('subject', 'Aviso de Renovação - Apólice ' + policyNumber)
        comm.set(
          'body',
          'Olá ' +
            clientName +
            ',\n\nSua apólice ' +
            policyNumber +
            ' está próxima do vencimento. Entre em contato conosco para garantir a renovação do seu plano sem interrupção de cobertura.\n\nAtenciosamente,\nEquipe CRED10MIX',
        )
        comm.set('recipient_email', clientEmail)
        comm.set('status', 'Rascunho')
        $app.save(comm)
      }
    } catch (err) {
      $app.logger().error('policy update reminder hook failed', 'error', String(err))
    }
  }

  return e.next()
}, 'policies')
