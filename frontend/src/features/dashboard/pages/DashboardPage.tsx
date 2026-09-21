import { useHasPermission } from '@/components/auth/PermissionGate'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import WorkflowStartCard from '@/features/kpi/workflow/components/WorkflowStartCard'
import { Building2, UserCircle } from 'lucide-react'
import RoleDashboard from './RoleDashboard'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useHomeDashboardScope } from '../hooks/useHomeDashboardScope'

const DashboardPage = () => {
  const { hasPermission } = useHasPermission()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view')
  const user = useAuthStore((s) => s.user)
  /**
   * Vai trò chỉ còn quyết định BỐ CỤC nào được nạp (mỗi vai một bản ghi riêng ở
   * `user_dashboard_layouts`) và widget cấp đơn vị có hiện hay không — cả bốn dùng chung
   * một trang, xem {@link RoleDashboard}. Phép suy vị trí dùng chung với tab Thống kê.
   */
  const scope = useHomeDashboardScope()

  if (user?.isPlatformAdmin) {
    return <Navigate to="/admin" replace />
  }

  const canViewOwn = hasPermission('KPI:VIEW_MY')
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

  // Không có quyền vào bảng nào thì về trang cá nhân
  if (!scope) return <Navigate to="/profile" replace />

  // Thẻ khởi động đứng TRÊN mọi biến thể dashboard: nó tự ẩn với người không có quyền ở bước
  // đầu của luồng, nên không cần lặp lại phép kiểm vai trò ở đây.
  const dashboard = (
    <>
      <WorkflowStartCard />
      <RoleDashboard key={scope} scope={scope} />
    </>
  )

  if (!showViewSwitch) return dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 p-1.5 rounded-card bg-[var(--color-muted)] w-full sm:w-fit">
        <ViewTab active={!isStaffView} onClick={() => setView('unit')} icon={<Building2 size={16} />} label="Tổng quan đơn vị" />
        <ViewTab active={isStaffView} onClick={() => setView('staff')} icon={<UserCircle size={16} />} label="Dashboard cá nhân" />
      </div>
      {dashboard}
    </div>
  )
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <ChoiceChip selected={active} variant="segment" className="flex-1 sm:flex-none py-2.5" onClick={onClick}>
      {icon}
      {label}
    </ChoiceChip>
  )
}

export default DashboardPage
