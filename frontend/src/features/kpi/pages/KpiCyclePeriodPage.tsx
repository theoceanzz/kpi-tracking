import { CalendarRange, Layers } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import KpiCyclesPage from './KpiCyclesPage'
import KpiPeriodsPage from './KpiPeriodsPage'

type TabKey = 'cycles' | 'periods'

/**
 * Kỳ và đợt là hai cấp của cùng một thứ — một kỳ gom nhiều đợt — nên đi chung một
 * trang thay vì hai dòng sidebar. Sidebar chỉ render được 3 cấp, mà "Quản lý đợt"
 * nằm dưới "Quản lý kỳ" sẽ là cấp thứ 4, nên đây cũng là cách duy nhất thể hiện
 * đúng quan hệ cha–con đó.
 *
 * Hàng tab không vẽ ở đây mà nằm trên mặt card mở đầu của từng trang con, qua
 * `WorkspaceTabsProvider` — xem `components/common/WorkspaceHeader.tsx`.
 */
export default function KpiCyclePeriodPage() {
  const { hasPermission } = useHasPermission()

  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>([
    { key: 'cycles', label: 'Kỳ đánh giá', icon: CalendarRange, visible: hasPermission('KPI_CYCLE:CREATE') },
    { key: 'periods', label: 'Đợt đánh giá', icon: Layers, visible: hasPermission('KPI_PERIOD:CREATE') },
  ])

  return (
    <WorkspaceTabsProvider
      tabs={visibleTabs}
      activeTab={activeTab}
      setActiveTab={key => setActiveTab(key as TabKey)}
    >
      {activeTab === 'cycles' && <KpiCyclesPage />}
      {activeTab === 'periods' && <KpiPeriodsPage />}
    </WorkspaceTabsProvider>
  )
}
