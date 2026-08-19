import { LayoutGrid, Gauge, GitBranch, Layers } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import BscManagementPage from '../pages/BscManagementPage'
import BscDashboardPage from '../pages/BscDashboardPage'
import BscStrategyMapPage from '../pages/BscStrategyMapPage'

type BscView = 'perspectives' | 'scorecards' | 'dashboard' | 'strategy-map'

/**
 * Bốn màn hình BSC trong một khối, chuyển qua lại bằng `?bsc=` thay vì bốn route riêng.
 *
 * BSC là một mục của trang "Thiết lập công cụ"; nếu vẫn điều hướng bằng route thì bấm
 * sang Dashboard là văng khỏi trang thiết lập. Dùng tham số lồng nên vẫn bookmark được
 * từng màn, và `?section=bsc` bên ngoài không bị mất.
 *
 * "Hạng mục" và "Thẻ điểm" trước đây là tầng tab thứ ba nằm trong màn Thẻ điểm — nghĩa
 * là nhãn "Thẻ điểm" xuất hiện ở hai tầng khác nhau và trỏ tới hai thứ khác nhau. Nay
 * cả bốn nằm ngang hàng, hết tầng thừa lẫn nhãn trùng.
 */
export default function BscWorkspace() {
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<BscView>(
    [
      { key: 'perspectives', label: 'Hạng mục', icon: Layers },
      { key: 'scorecards', label: 'Thẻ điểm', icon: LayoutGrid },
      { key: 'dashboard', label: 'Dashboard', icon: Gauge },
      { key: 'strategy-map', label: 'Bản đồ chiến lược', icon: GitBranch },
    ],
    { param: 'bsc' }
  )

  return (
    <WorkspaceTabsProvider
      tabs={visibleTabs}
      activeTab={activeTab}
      setActiveTab={key => setActiveTab(key as BscView)}
    >
      {(activeTab === 'perspectives' || activeTab === 'scorecards') && (
        <BscManagementPage view={activeTab} />
      )}
      {activeTab === 'dashboard' && <BscDashboardPage />}
      {activeTab === 'strategy-map' && <BscStrategyMapPage />}
    </WorkspaceTabsProvider>
  )
}
