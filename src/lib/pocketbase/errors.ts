import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  const genericFallback =
    'Ocorreu um erro ao processar a solicitação no servidor. Tente novamente em instantes.'

  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error && error.message ? error.message : genericFallback
  }

  // Tratamento específico por status HTTP
  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return 'O servidor está temporariamente indisponível. Por favor, tente novamente em instantes.'
  }

  if (error.status === 403) {
    return 'Seu perfil de usuário não tem permissão para registrar ou atualizar transações financeiras (necessário perfil Gerente ou Administrador).'
  }

  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) {
    return msgs.join(' ')
  }

  if (!error.message || error.message.trim().toLowerCase() === 'something went wrong.') {
    return genericFallback
  }

  return error.message
}
