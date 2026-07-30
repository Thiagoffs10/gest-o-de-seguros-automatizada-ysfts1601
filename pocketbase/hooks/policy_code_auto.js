onRecordCreate((e) => {
  const count = $app.countRecords('policies')
  e.record.set('policy_code', count + 1)
  e.next()
}, 'policies')
