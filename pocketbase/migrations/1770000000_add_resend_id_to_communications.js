/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const commsCol = app.findCollectionByNameOrId('communications')
      if (commsCol) {
        const existing = commsCol.fields.getByName('resend_id')
        if (!existing) {
          commsCol.fields.add(
            new TextField({
              name: 'resend_id',
              required: false,
            }),
          )
          app.save(commsCol)
        }
      }
    } catch (err) {
      console.log('Error adding resend_id to communications:', err)
    }
  },
  (app) => {
    try {
      const commsCol = app.findCollectionByNameOrId('communications')
      if (commsCol) {
        commsCol.fields.removeByName('resend_id')
        app.save(commsCol)
      }
    } catch (_e) {}
  },
)
