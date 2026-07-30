onRecordCreate((e) => {
  const count = $app.countRecords('parceiros')
  e.record.set('partner_code', count + 1)
  e.next()
}, 'parceiros')
