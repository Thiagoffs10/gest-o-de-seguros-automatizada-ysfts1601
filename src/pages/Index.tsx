import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Index() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <span className="text-sm font-medium">Carregando sistema...</span>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
    </ErrorBoundary>
  )
}
