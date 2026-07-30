import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

export default function Index() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }
  }, [isAuthenticated, loading, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <p className="text-sm font-medium">Redirecionando...</p>
    </div>
  )
}
