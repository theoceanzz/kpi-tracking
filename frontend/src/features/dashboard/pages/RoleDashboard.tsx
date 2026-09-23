import { useMemo, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { DashboardToolbarPortal } from '@/components/common/dashboard/DashboardToolbarSlot'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import { useTourScope } from '@/hooks/useTourScope'
import { POSITION_LABEL } from '../hooks/useViewerPosition'
import type { DashboardScope } from '../api/dashboardLayoutApi'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { DashboardFilterProvider } from '../context/DashboardFilterContext'
import CompletedPeriodEvaluationPrompt from '../components/CompletedPeriodEvaluationPrompt'
import AiShortcutButton from '@/features/analytics/components/AiShortcutButton'
import { aiShortcuts } from '@/features/analytics/aiShortcuts'
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
  // Ô của bố cục mặc định theo vai = ô "gợi ý cho bạn" trong thư viện, cùng ngôn ngữ với tab Thống kê.
  const recommendedIds = useMemo(() => new Set(defaultWidgets.map(w => w.i)) as ReadonlySet<string>, [defaultWidgets])

  const dash = useDashboardLayout({ scope, defaultWidgets, availableWidgets })
  // Giữ định danh: lưới cache phần tử từng ô theo hàm này.
  const renderWidget = useCallback((w: DashboardWidget) => renderAnalyticsWidget(w.i, flags, viewer), [flags, viewer])

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <DashboardToolbarPortal>
        <div id="tour-dashboard-customize" className="flex items-center gap-2">
          <AiShortcutButton size="sm" label="Việc cần làm" prompt={aiShortcuts.myTasks()} title="K.AI gom việc đang chờ bạn: bài nộp, chỉ tiêu, điều chỉnh, người chưa nộp, đợt chưa chốt" />
          <DashboardEditToolbar api={dash} />
        </div>
      </DashboardToolbarPortal>

      {/* Luồng bắt buộc, không phải widget: nhắc tự đánh giá khi một kỳ vừa hoàn tất.
          Đứng TRÊN lưới widget vì nó là việc đang chờ người dùng, không phải số liệu để ngắm. */}
      {scope === 'STAFF' && <CompletedPeriodEvaluationPrompt />}

      <div id="tour-dashboard-grid">
        <DashboardCustomizeChrome
          api={dash}
          catalog={catalog}
          presets={presets}
          recommendedIds={recommendedIds}
          recommendedLabel={`Gợi ý cho ${POSITION_LABEL[scope]}`}
          ready={!dash.isLoading}
          renderWidget={renderWidget}
        />
      </div>

    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải trang chủ</span>
      <div className="h-[420px] rounded-card bg-[var(--color-muted)]"/>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-card bg-[var(--color-muted)]"/>
        <div className="h-56 rounded-card bg-[var(--color-muted)]"/>
      </div>
    </div>
  )
}
