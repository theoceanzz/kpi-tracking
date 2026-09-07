import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { reportApi } from '@/features/reports/api/reportApi'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { DashboardToolbarPortal } from '@/components/common/dashboard/DashboardToolbarSlot'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import { useTourScope } from '@/hooks/useTourScope'
import type { DashboardScope } from '../api/dashboardLayoutApi'
import { DashboardFilterProvider } from '../context/DashboardFilterContext'
import { PinnedWidgetsSection } from '../components/PinnedWidgetsSection'
import CompletedPeriodEvaluationPrompt from '../components/CompletedPeriodEvaluationPrompt'
import {
  getAnalyticsCatalog, getAnalyticsDefaultLayout, getAnalyticsPresets, getAnalyticsWidgets,
  renderAnalyticsWidget, type OrgFlags, type ViewerScope,
} from '../widgets/analyticsCatalog'

/** Vai trò → mục hướng dẫn tương ứng (mỗi vai một bài, đánh dấu đã-xem riêng). */
const TOUR_SECTION: Record<DashboardScope, string> = {
  DIRECTOR: 'director',
  HEAD: 'head',
  DEPUTY: 'deputy',
  STAFF: 'staff',
}

/**
 * Trang chủ của mọi vai trò: một lưới widget tuỳ chỉnh được, không gì khác.
 *
 * <p>Trước đây mỗi vai trò có một trang riêng với thẻ header (lời chào, nút hành động) và một
 * danh mục widget tự dựng lại số liệu bằng nguồn riêng. Nay cả bốn dùng chung lưới này, và
 * widget lấy thẳng từ trang Phân tích & Thống kê — xem `analyticsCatalog`.
 *
 * <p>Khác nhau giữa các vai trò chỉ còn hai thứ: `scope` (bố cục lưu riêng cho từng vai ở
 * `user_dashboard_layouts`) và quyền xem dữ liệu cấp đơn vị.
 *
 * <p>Cụm nút tuỳ chỉnh nằm trên thanh tiêu đề của app chứ không nằm trong trang — xem
 * {@link DashboardToolbarPortal}.
 */
export default function RoleDashboard({ scope }: { scope: DashboardScope }) {
  useTourScope('dashboard', TOUR_SECTION[scope])

  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: organization, isLoading: isOrgLoading } = useOrganization(organizationId)

  /*
    Phải CHỜ cờ tổ chức rồi mới dựng lưới. `enableOkr` chọn hẳn một nửa danh mục (cặp KPI hay
    cặp Mục tiêu), mà `useDashboardLayout` chỉ đọc bố cục đúng một lần khi mount — dựng bằng
    giá trị mặc định `false` rồi mới nhận cờ thật sẽ để lại một lưới widget KPI trong khi thư
    viện chỉ còn widget Mục tiêu, và người dùng không cách nào thêm lại thứ đang hiện.
    `organizationId` rỗng (tài khoản chưa thuộc tổ chức nào) thì query không chạy, cứ đi tiếp.
  */
  if (organizationId && isOrgLoading) return <DashboardSkeleton />

  return (
    <DashboardFilterProvider>
      <RoleDashboardGrid scope={scope} organization={organization} />
    </DashboardFilterProvider>
  )
}

function RoleDashboardGrid({ scope, organization }: {
  scope: DashboardScope
  organization: ReturnType<typeof useOrganization>['data']
}) {
  const { hasPermission } = useHasPermission()
  const [searchParams, setSearchParams] = useSearchParams()

  const flags = useMemo<OrgFlags>(() => ({
    enableOkr: organization?.enableOkr ?? false,
    enableBsc: organization?.enableBsc ?? false,
    enableReward: organization?.enableReward ?? false,
    enableQualitative: organization?.enableQualitative ?? false,
    enableConduct: organization?.enableConduct ?? false,
    enableCashWallet: organization?.enableCashWallet ?? false,
    enableAi: organization?.enableAi ?? false,
  }), [organization])

  // Cùng quyền mà cây nav đặt cho hai mục "KPI đơn vị" / "Mục tiêu đơn vị" bên trang Phân tích,
  // nên trang chủ không bao giờ mời thêm một widget mà bấm vào là 403.
  const canViewUnit = hasPermission(['KPI:VIEW', 'SUBMISSION:REVIEW'])
  const canManageBsc = hasPermission('BSC:MANAGE')
  const viewer = useMemo<ViewerScope>(() => ({ canViewUnit, canManageBsc }), [canViewUnit, canManageBsc])

  const availableWidgets = useMemo(() => getAnalyticsWidgets(flags, viewer), [flags, viewer])
  const defaultWidgets = useMemo(() => getAnalyticsDefaultLayout(scope, flags, viewer), [scope, flags, viewer])
  const catalog = useMemo(() => getAnalyticsCatalog(flags, viewer), [flags, viewer])
  const presets = useMemo(() => getAnalyticsPresets(flags, viewer), [flags, viewer])

  const dash = useDashboardLayout({ scope, defaultWidgets, availableWidgets })

  // Cho phép mở thẳng chế độ tuỳ chỉnh bằng URL (?edit=1)
  useEffect(() => {
    if (searchParams.get('edit') === '1' && !dash.isEditMode) {
      dash.setIsEditMode(true)
      setSearchParams(prev => {
        const p = new URLSearchParams(prev)
        p.delete('edit')
        return p
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { data: pinnedWidgets, refetch: refetchPinned } = useQuery({
    queryKey: ['reports', 'widgets', 'pinned'],
    queryFn: () => reportApi.getPinnedWidgets(),
  })

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <DashboardToolbarPortal>
        <div id="tour-dashboard-customize" className="flex items-center">
          <DashboardEditToolbar api={dash} />
        </div>
      </DashboardToolbarPortal>

      <div id="tour-dashboard-grid">
        <DashboardCustomizeChrome
          api={dash}
          catalog={catalog}
          presets={presets}
          ready={!dash.isLoading}
          renderWidget={w => renderAnalyticsWidget(w.i, flags, viewer)}
        />
      </div>

      {/* Biểu đồ ghim từ trang Thống kê — giữ nguyên để người đang ghim không mất gì */}
      <PinnedWidgetsSection widgets={pinnedWidgets} onUnpin={refetchPinned} />

      {/* Luồng bắt buộc, không phải widget: nhắc tự đánh giá khi một kỳ vừa hoàn tất */}
      {scope === 'STAFF' && <CompletedPeriodEvaluationPrompt />}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải trang chủ</span>
      <div className="h-[420px] rounded-[28px] bg-[var(--color-muted)]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-[28px] bg-[var(--color-muted)]" />
        <div className="h-56 rounded-[28px] bg-[var(--color-muted)]" />
      </div>
    </div>
  )
}
