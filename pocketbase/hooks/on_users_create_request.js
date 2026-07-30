onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth || auth.getString('role') !== 'admin') {
    if (e.record) {
      e.record.set('role', 'user')
    }
  }
  e.next()
}, 'users')
