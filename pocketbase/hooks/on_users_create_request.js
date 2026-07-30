onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth || auth.getString('role') !== 'Admin') {
    if (e.record) {
      e.record.set('role', 'Operador')
    }
  }
  e.next()
}, 'users')
