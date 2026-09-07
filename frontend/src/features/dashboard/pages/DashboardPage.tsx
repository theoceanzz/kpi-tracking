import { useHasPermission } from '@/components/auth/PermissionGate'
import DirectorDashboard from './DirectorDashboard'
import HeadDashboard from './HeadDashboard'
import StaffDashboard from './StaffDashboard'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import WorkflowStartCard from '@/features/kpi/workflow/components/WorkflowStartCard'

const DashboardPage = () => {
  const { hasPermission } = useHasPermission()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view')
  const user = useAuthStore((s) => s.user)

  if (user?.isPlatformAdmin) {
    return <Navigate to="/admin" replace />
  }

  const dashboard = pickDashboard()

  if (!dashboard) {
    // Fallback to profile if no specific dashboard permission
    return <Navigate to="/profile" replace />
  }

  // Thẻ khởi động đứng trên mọi biến thể dashboard: nó tự ẩn với người không có quyền ở bước đầu
  // của luồng, nên không cần lặp lại phép kiểm vai trò ở đây.
  return (
    <div className="space-y-6">
      <WorkflowStartCard />
      {dashboard}
    </div>
  )

  function pickDashboard() {
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

    return null
  }
}

export default DashboardPage
