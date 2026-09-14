// Migração corretiva NÃO destrutiva para popular o campo `numero_proposta` das apólices legadas.
// Contexto: o usuário digitava o número da proposta no campo `policy_number` antes da separação
// dos campos (migration 0046). Esta migration copia `policy_number` para `numero_proposta`
// quando `numero_proposta` estiver vazio/branco e `policy_number` estiver preenchido.
// Mantém `policy_number` intacto, é idempotente e não altera registros financeiros.

migrate(
  (app) => {
    app
      .db()
      .newQuery(
        `UPDATE policies
         SET numero_proposta = policy_number
         WHERE (numero_proposta IS NULL OR TRIM(numero_proposta) = '')
           AND policy_number IS NOT NULL
           AND TRIM(policy_number) != ''`,
      )
      .execute()
  },
  (app) => {
    // Migration não destrutiva de preenchimento de dados legados.
    // O rollback não apaga para não causar perda de dados acidental.
  },
)
