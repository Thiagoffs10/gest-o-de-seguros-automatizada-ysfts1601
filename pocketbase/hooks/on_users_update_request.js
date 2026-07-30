onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth || auth.getString('role') !== 'Admin') {
    if (e.record && e.record.original) {
      var originalRole = e.record.original().getString('role')
      e.record.set('role', originalRole || 'Operador')
    }
  }
  e.next()
}, 'users')
