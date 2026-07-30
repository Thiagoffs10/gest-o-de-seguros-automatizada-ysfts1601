onRecordCreate((e) => {
  const count = $app.countRecords('clients')
  e.record.set('client_code', count + 1)
  e.next()
}, 'clients')
