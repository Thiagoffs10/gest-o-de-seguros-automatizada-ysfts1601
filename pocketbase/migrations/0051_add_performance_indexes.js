/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const policiesCol = app.findCollectionByNameOrId('policies')
    if (policiesCol) {
      try {
        policiesCol.addIndex('idx_policies_start_date', false, 'start_date', '')
        policiesCol.addIndex('idx_policies_end_date', false, 'end_date', '')
        policiesCol.addIndex('idx_policies_created', false, 'created', '')
        policiesCol.addIndex('idx_policies_seguradora', false, 'seguradora', '')
        policiesCol.addIndex('idx_policies_parceiro', false, 'parceiro', '')
        policiesCol.addIndex('idx_policies_placa', false, 'placa', '')
        app.save(policiesCol)
      } catch {
        /* ignore if already present */
      }
    }

    const custosCol = app.findCollectionByNameOrId('custos_fixos')
    if (custosCol) {
      try {
        custosCol.addIndex('idx_custos_fixos_pago', false, 'pago', '')
        custosCol.addIndex('idx_custos_fixos_data_pagamento', false, 'data_pagamento', '')
        app.save(custosCol)
      } catch {
        /* ignore if already present */
      }
    }

    const comPrevCol = app.findCollectionByNameOrId('comissoes_previstas')
    if (comPrevCol) {
      try {
        comPrevCol.addIndex('idx_com_prev_status', false, 'status', '')
        app.save(comPrevCol)
      } catch {
        /* ignore if already present */
      }
    }
  },
  (app) => {
    const policiesCol = app.findCollectionByNameOrId('policies')
    if (policiesCol) {
      try {
        policiesCol.removeIndex('idx_policies_start_date')
        policiesCol.removeIndex('idx_policies_end_date')
        policiesCol.removeIndex('idx_policies_created')
        policiesCol.removeIndex('idx_policies_seguradora')
        policiesCol.removeIndex('idx_policies_parceiro')
        policiesCol.removeIndex('idx_policies_placa')
        app.save(policiesCol)
      } catch {
        /* ignore */
      }
    }
  },
)
