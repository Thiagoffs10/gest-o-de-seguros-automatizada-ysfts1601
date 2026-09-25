migrate(
  (app) => {
    // 1. Contabilizar antes da deduplicação
    // Os lembretes são do tipo Aniversário duplicados gerados diariamente com a mesma data e mensagem para o mesmo cliente.
    // Manteremos o mais antigo (ou com sent=true se houver) e removeremos as duplicatas exatas.
    // Duplicata exata: mesmo type, mesmo client, mesmo policy (vazio ou igual), mesma date, mesma message.

    try {
      // Remover duplicatas exatas mantendo o primeiro registro criado (menor id / menor created)
      // SQLite query segura:
      app
        .db()
        .newQuery(`
        DELETE FROM reminders
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM reminders
          GROUP BY type, IFNULL(client, ''), IFNULL(policy, ''), IFNULL(date, ''), IFNULL(message, '')
        )
      `)
        .execute()
    } catch (err) {
      console.log('Erro na deduplicação de reminders:', err)
    }
  },
  (app) => {
    // Rollback não recupera registros excluídos intencionalmente, mantido vazio
  },
)
