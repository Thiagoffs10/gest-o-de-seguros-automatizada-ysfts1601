/* 404 Page - Displays when a user attempts to access a non-existent route */
import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-slate-600">Oops! Página não encontrada</p>
        <Link to="/" className="text-blue-500 underline hover:text-blue-700">
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}

export default NotFound
