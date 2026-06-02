import { useHasPermission } from '@/components/auth/PermissionGate'
import DirectorDashboard from './DirectorDashboard'
import HeadDashboard from './HeadDashboard'
import StaffDashboard from './StaffDashboard'
import { useSearchParams, Navigate } from 'react-router-dom'

const DashboardPage = () => {
  const { hasPermission } = useHasPermission()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view')

  // If explicitly requested 'staff' view and has staff permissions
  if (view === 'staff' && hasPermission('KPI:VIEW_MY')) {
    return <StaffDashboard />
  }

  // 1. Director & Management Level
  if (hasPermission(['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW'], true)) {
    return <DirectorDashboard />
  }

  // 2. Department Head / Manager Level
  if (hasPermission(['SUBMISSION:REVIEW', 'USER:VIEW_LIST'])) {
    return <HeadDashboard />
  }

  // 3. Staff Level (Default if no manager perms)
  if (hasPermission('KPI:VIEW_MY')) {
    return <StaffDashboard />
  }

  // Fallback to profile if no specific dashboard permission
  return <Navigate to="/profile" replace />
}

export default DashboardPage
