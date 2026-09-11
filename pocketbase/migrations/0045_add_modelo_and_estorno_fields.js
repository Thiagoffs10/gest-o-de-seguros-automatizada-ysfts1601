migrate(
  (app) => {
    const policiesCol = app.findCollectionByNameOrId('policies')
    const modelosCol = app.findCollectionByNameOrId('modelos_comissao')
    const comissaoRecCol = app.findCollectionByNameOrId('comissao_recebimentos')
    const previsoesCol = app.findCollectionByNameOrId('comissoes_previstas')

    // 1. Adicionar campos em `policies` para suporte a modelo e personalização
    if (!policiesCol.fields.getByName('modelo_comissao')) {
      policiesCol.fields.add(
        new RelationField({
          name: 'modelo_comissao',
          collectionId: modelosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!policiesCol.fields.getByName('comissao_personalizada')) {
      policiesCol.fields.add(
        new BoolField({
          name: 'comissao_personalizada',
        }),
      )
    }

    if (!policiesCol.fields.getByName('comissao_personalizada_config')) {
      policiesCol.fields.add(
        new JSONField({
          name: 'comissao_personalizada_config',
        }),
      )
    }

    if (!policiesCol.fields.getByName('historico_alteracao_comissao')) {
      policiesCol.fields.add(
        new JSONField({
          name: 'historico_alteracao_comissao',
        }),
      )
    }

    app.save(policiesCol)

    // 2. Adicionar campos em `comissao_recebimentos` para estorno e vínculo opcional com previsão
    if (!comissaoRecCol.fields.getByName('is_estorno')) {
      comissaoRecCol.fields.add(
        new BoolField({
          name: 'is_estorno',
        }),
      )
    }

    if (!comissaoRecCol.fields.getByName('recebimento_original')) {
      comissaoRecCol.fields.add(
        new RelationField({
          name: 'recebimento_original',
          collectionId: comissaoRecCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!comissaoRecCol.fields.getByName('motivo_estorno')) {
      comissaoRecCol.fields.add(
        new TextField({
          name: 'motivo_estorno',
        }),
      )
    }

    if (!comissaoRecCol.fields.getByName('comissao_prevista')) {
      comissaoRecCol.fields.add(
        new RelationField({
          name: 'comissao_prevista',
          collectionId: previsoesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(comissaoRecCol)
  },
  (app) => {
    try {
      const pol = app.findCollectionByNameOrId('policies')
      const f1 = pol.fields.getByName('modelo_comissao')
      if (f1) pol.fields.remove(f1)
      const f2 = pol.fields.getByName('comissao_personalizada')
      if (f2) pol.fields.remove(f2)
      const f3 = pol.fields.getByName('comissao_personalizada_config')
      if (f3) pol.fields.remove(f3)
      const f4 = pol.fields.getByName('historico_alteracao_comissao')
      if (f4) pol.fields.remove(f4)
      app.save(pol)
    } catch (_) {}

    try {
      const rec = app.findCollectionByNameOrId('comissao_recebimentos')
      const r1 = rec.fields.getByName('is_estorno')
      if (r1) rec.fields.remove(r1)
      const r2 = rec.fields.getByName('recebimento_original')
      if (r2) rec.fields.remove(r2)
      const r3 = rec.fields.getByName('motivo_estorno')
      if (r3) rec.fields.remove(r3)
      const r4 = rec.fields.getByName('comissao_prevista')
      if (r4) rec.fields.remove(r4)
      app.save(rec)
    } catch (_) {}
  },
)
