import { Redirect } from 'react-router-dom'
import { useAuth } from '../auth/use-auth'
import { PageLoader } from '../../shared/components/PageLoader'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <PageLoader label="Checking admin session..." />
  }

  if (!user || user.role !== 'admin') {
    return <Redirect to="/login" />
  }

  return children
}
