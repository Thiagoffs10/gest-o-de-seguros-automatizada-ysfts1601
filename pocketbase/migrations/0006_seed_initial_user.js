migrate(
  (app) => {
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'thiaguinhoffs@gmail.com')
      return
    } catch (_) {}

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const record = new Record(users)
    record.setEmail('thiaguinhoffs@gmail.com')
    const adminPassword = $os.getenv('ADMIN_SEED_PASSWORD') || $security.randomString(24)
    record.setPassword(adminPassword)
    record.setVerified(true)
    record.set('name', 'Corretor Principal')
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'thiaguinhoffs@gmail.com')
      app.delete(record)
    } catch (_) {}
  },
)
