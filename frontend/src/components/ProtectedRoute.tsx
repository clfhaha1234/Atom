import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const { user, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth().then(() => {
      if (!loading && !user) {
        navigate('/login')
      }
    })
  }, [user, loading, navigate, checkAuth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
