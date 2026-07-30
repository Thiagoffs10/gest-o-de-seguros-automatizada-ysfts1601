import pb from '@/lib/pocketbase/client'
import type { User } from '@/types'

export const getUsers = async (): Promise<User[]> => {
  return pb.send('/backend/v1/users', { method: 'GET' })
}

export const createUser = async (data: {
  name: string
  email: string
  password: string
  passwordConfirm: string
  role: 'Administrador' | 'Gerente' | 'Operador' | 'Visualizador' | 'Admin'
}): Promise<User> => {
  return pb.send('/backend/v1/users', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const verifyOldPassword = async (email: string, password: string): Promise<boolean> => {
  try {
    await pb.collection('users').authWithPassword(email, password)
    return true
  } catch {
    return false
  }
}

export const updatePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  await pb.collection('users').update(userId, {
    oldPassword,
    password: newPassword,
    passwordConfirm: newPassword,
  })
}

export const reauthenticate = async (email: string, password: string): Promise<void> => {
  await pb.collection('users').authWithPassword(email, password)
}

export const updateUser = async (
  id: string,
  data: {
    name?: string
    role?: 'Administrador' | 'Gerente' | 'Operador' | 'Visualizador' | 'Admin'
    password?: string
    passwordConfirm?: string
  },
): Promise<User> => {
  return pb.send(`/backend/v1/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}
