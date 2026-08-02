import pb from '@/lib/pocketbase/client'

export interface BackupSchemaField {
  name: string
  type: string
}

export interface BackupSchema {
  name: string
  type: string
  fields: BackupSchemaField[]
  listRule: string
  viewRule: string
  createRule: string
  updateRule: string
  deleteRule: string
  indexes: string[]
}

export interface BackupData {
  metadata: {
    exported_at: string
    version: string
    source: string
  }
  schema: Record<string, BackupSchema>
  records: Record<string, Array<Record<string, unknown>>>
}

export const exportBackup = async (): Promise<BackupData> => {
  return pb.send('/backend/v1/backup/export', { method: 'GET' })
}
