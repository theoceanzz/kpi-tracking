import { useHasPermission } from '@/components/auth/PermissionGate'
import DirectorDashboard from './DirectorDashboard'
import HeadDashboard from './HeadDashboard'
import DeputyDashboard from './DeputyDashboard'
import StaffDashboard from './StaffDashboard'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Building2, UserCircle } from 'lucide-react'

const DashboardPage = () => {
  const { hasPermission } = useHasPermission()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view')
  const user = useAuthStore((s) => s.user)

  if (user?.isPlatformAdmin) {
    return <Navigate to="/admin" replace />
  }

  const canViewOwn = hasPermission('KPI:VIEW_MY')
  /**
   * Role.rank: 0 = trưởng đơn vị, 1 = phó, 2 = nhân viên. Phó có gần hết quyền của
   * trưởng nên nếu chỉ xét quyền thì họ rơi vào bảng trưởng đơn vị và thấy dữ liệu
   * toàn đơn vị — trong khi thực tế họ chỉ phụ trách một mảng.
   */
  const isDeputy = (user?.memberships ?? []).some(m => m.roleRank === 1)
  const isManager = hasPermission(['KPI:APPROVE', 'SUBMISSION:REVIEW', 'ORG:CREATE', 'USER:VIEW_LIST'])
  // Quản lý vừa có bảng đơn vị vừa có bảng cá nhân — trước đây là hai dòng riêng trên
  // sidebar, giờ gộp thành một công tắc ngay trong trang để sidebar bớt một mục cấp 1.
  const showViewSwitch = isManager && canViewOwn

  const setView = (next: 'unit' | 'staff') => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === 'staff') p.set('view', 'staff')
      else p.delete('view')
      return p
    }, { replace: true })
  }

  const isStaffView = view === 'staff' && canViewOwn

  const dashboard = (() => {
    // If explicitly requested 'staff' view and has staff permissions
    if (isStaffView) return <StaffDashboard />

    // 1. Director & Management Level
    if (hasPermission(['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW'], true)) return <DirectorDashboard />

    // 2. Phó đơn vị — xét TRƯỚC trưởng đơn vị vì quyền của hai vai gần như trùng nhau
    if (isDeputy) return <DeputyDashboard />

    // 3. Department Head / Manager Level
    if (hasPermission(['SUBMISSION:REVIEW', 'USER:VIEW_LIST'])) return <HeadDashboard />

    // 4. Staff Level (Default if no manager perms)
    if (canViewOwn) return <StaffDashboard />

    return null
  })()

  // Fallback to profile if no specific dashboard permission
  if (!dashboard) return <Navigate to="/profile" replace />

  if (!showViewSwitch) return dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 w-full sm:w-fit">
        <ViewTab active={!isStaffView} onClick={() => setView('unit')} icon={<Building2 size={16} />} label="Tổng quan đơn vị" />
        <ViewTab active={isStaffView} onClick={() => setView('staff')} icon={<UserCircle size={16} />} label="Dashboard cá nhân" />
      </div>
      {dashboard}
    </div>
  )
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap',
        active
          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export default DashboardPage
