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

export interface BackupFileInfo {
  recordId: string
  fieldName: string
  filename: string
  url: string
}

export interface BackupData {
  metadata: {
    exported_at: string
    version: string
    source: string
    application?: string
    total_records?: number
    summary?: Record<string, number>
  }
  schema: Record<string, BackupSchema>
  records: Record<string, Array<Record<string, unknown>>>
  files?: Record<string, BackupFileInfo[]>
}

export interface SystemBackupRecord {
  id: string
  backup_type: 'manual' | 'daily_auto' | 'pre_restore'
  status: 'completed' | 'failed' | 'running'
  file_name: string
  total_records: number
  summary_json: Record<string, number>
  data_json?: BackupData
  backup_file?: string
  created_by?: string
  created: string
  updated: string
}

export interface RestoreValidationStep {
  step: number
  title: string
  action: string
  status: 'ok' | 'in_progress' | 'failed'
  details?: string
}

export interface IsolatedRestoreResult {
  test_id: string
  started_at: string
  finished_at?: string
  isolation_mode: string
  production_safety: string
  steps: RestoreValidationStep[]
  success: boolean
  error?: string | null
  total_records_tested?: number
}

export interface RestoreResponse {
  success: boolean
  mode: 'dry_run' | 'production'
  message: string
  validation: {
    mode: string
    valid: boolean
    timestamp: string
    tested_collections: Record<
      string,
      {
        name: string
        total_records: number
        compatible_schema: boolean
        schema_fields_count: number
        records_simulated: number
        errors: string[]
      }
    >
    summary: {
      total_collections: number
      total_records: number
      restored_records: number
      errors_count: number
    }
    errors: string[]
  }
}

export const exportBackup = async (): Promise<BackupData> => {
  return pb.send('/backend/v1/backup/export', { method: 'GET' })
}

export const getSystemBackups = async (): Promise<SystemBackupRecord[]> => {
  return pb.collection('system_backups').getFullList<SystemBackupRecord>({
    sort: '-created',
  })
}

export const runIsolatedRestoreTest = async (
  backupId?: string,
  backupData?: BackupData,
): Promise<IsolatedRestoreResult> => {
  return pb.send('/backend/v1/backup/test-restore-isolated', {
    method: 'POST',
    body: { backupId, backupData },
  })
}

export const restoreBackup = async (
  mode: 'dry_run' | 'production',
  backupId?: string,
  backupData?: BackupData,
): Promise<RestoreResponse> => {
  return pb.send('/backend/v1/backup/restore', {
    method: 'POST',
    body: { mode, backupId, backupData },
  })
}
