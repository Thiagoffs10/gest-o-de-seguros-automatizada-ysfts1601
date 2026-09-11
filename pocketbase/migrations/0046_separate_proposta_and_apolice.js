migrate(
  (app) => {
    const policiesCol = app.findCollectionByNameOrId('policies')

    // 1. Adicionar campo numero_proposta (texto, opcional)
    if (!policiesCol.fields.getByName('numero_proposta')) {
      policiesCol.fields.add(
        new TextField({
          name: 'numero_proposta',
          required: false,
        }),
      )
    }

    // 2. Tornar policy_number opcional (required: false) para permitir salvar proposta sem apólice
    const polNumField = policiesCol.fields.getByName('policy_number')
    if (polNumField) {
      polNumField.required = false
    }

    // 3. O índice único idx_policies_number ON policies (policy_number) deve permitir valores vazios/nulos sem colidir
    // No SQLite, múltiplos NULLs não colidem em UNIQUE, mas se houver string vazia "", pode colidir.
    // Atualizamos o índice único para ser parcial (WHERE policy_number IS NOT NULL AND policy_number != '')
    // Ou usando col.removeIndex e col.addIndex
    try {
      policiesCol.removeIndex('idx_policies_number')
    } catch (_) {}

    policiesCol.addIndex(
      'idx_policies_number',
      true,
      'policy_number',
      "policy_number IS NOT NULL AND policy_number != ''",
    )

    // Adicionar índice para numero_proposta para buscas eficientes
    try {
      policiesCol.addIndex(
        'idx_policies_proposta',
        false,
        'numero_proposta',
        "numero_proposta IS NOT NULL AND numero_proposta != ''",
      )
    } catch (_) {}

    app.save(policiesCol)
  },
  (app) => {
    try {
      const pol = app.findCollectionByNameOrId('policies')
      const f1 = pol.fields.getByName('numero_proposta')
      if (f1) pol.fields.remove(f1)

      const polNumField = pol.fields.getByName('policy_number')
      if (polNumField) {
        polNumField.required = true
      }

      try {
        pol.removeIndex('idx_policies_proposta')
      } catch (_) {}

      try {
        pol.removeIndex('idx_policies_number')
        pol.addIndex('idx_policies_number', true, 'policy_number', '')
      } catch (_) {}

      app.save(pol)
    } catch (_) {}
  },
)
