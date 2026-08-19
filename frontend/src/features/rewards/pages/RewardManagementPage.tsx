import { Gift, Wallet, Store, PackageCheck, Trophy, CalendarCheck } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { useHasPermission } from '@/components/auth/PermissionGate'
import GrantsTab from '../components/GrantsTab'
import BudgetsTab from '../components/BudgetsTab'
import GiftsTab from '../components/GiftsTab'
import RedemptionsTab from '../components/RedemptionsTab'
import ProgramsTab from '../components/ProgramsTab'
import CheckinConfigTab from '../components/CheckinConfigTab'
import RewardActivityTicker from '../components/RewardActivityTicker'
import { useRewardGrants } from '../hooks/useRewards'
import { useRedemptions } from '../hooks/useGifts'
import { RedemptionStatus, RewardGrantStatus } from '../types'

type TabKey = 'grants' | 'budgets' | 'programs' | 'checkin' | 'gifts' | 'redemptions'

export default function RewardManagementPage() {
  const { hasPermission } = useHasPermission()

  // Chỉ lấy tổng số, không lấy nội dung — size=1 là đủ để có totalElements cho badge.
  const { data: pendingPage } = useRewardGrants({
    status: RewardGrantStatus.PENDING_APPROVAL,
    size: 1,
  })
  const pendingCount = pendingPage?.totalElements ?? 0

  const canFulfill = hasPermission('GIFT:FULFILL')
  const { data: pendingRedemptionPage } = useRedemptions({
    status: RedemptionStatus.PENDING,
    size: 1,
  })
  const pendingRedemptionCount = canFulfill ? (pendingRedemptionPage?.totalElements ?? 0) : 0

  // Tab chỉ hiện khi người dùng có quyền tương ứng — router đã cho vào trang bằng
  // phép OR nhiều quyền, nên bên trong vẫn phải lọc lại từng tab.
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>([
    {
      key: 'grants',
      label: 'Đề nghị thưởng',
      icon: Gift,
      // Số đang chờ duyệt là việc cần làm — đưa lên tab để người duyệt thấy ngay
      // mà không phải bấm vào mới biết.
      badge: pendingCount || undefined,
      visible: hasPermission(['REWARD:GRANT', 'REWARD:APPROVE', 'REWARD:VIEW']),
    },
    { key: 'budgets', label: 'Hạn mức', icon: Wallet, visible: hasPermission('REWARD:CONFIG') },
    { key: 'programs', label: 'Chương trình tự động', icon: Trophy, visible: hasPermission('REWARD:CONFIG') },
    { key: 'checkin', label: 'Điểm danh', icon: CalendarCheck, visible: hasPermission('REWARD:CONFIG') },
    { key: 'gifts', label: 'Quà tặng', icon: Store, visible: hasPermission('GIFT:MANAGE') },
    {
      key: 'redemptions',
      label: 'Yêu cầu đổi quà',
      icon: PackageCheck,
      badge: pendingRedemptionCount || undefined,
      visible: canFulfill,
    },
  ])

  return (
    <WorkspaceTabsProvider
      tabs={visibleTabs}
      activeTab={activeTab}
      setActiveTab={key => setActiveTab(key as TabKey)}
    >
      <div className="space-y-5">
        {/* TRÊN các tab: bảng tin là chuyện của cả tổ chức, không thuộc riêng tab nào. */}
        <RewardActivityTicker />

        <WorkspaceHeader description="Trao điểm cho nhân viên, duyệt đề nghị vượt hạn mức và cấp hạn mức cho quản lý." />

        {activeTab === 'grants' && <GrantsTab />}
        {activeTab === 'budgets' && <BudgetsTab />}
        {activeTab === 'programs' && <ProgramsTab />}
        {activeTab === 'checkin' && <CheckinConfigTab />}
        {activeTab === 'gifts' && <GiftsTab />}
        {activeTab === 'redemptions' && <RedemptionsTab />}
      </div>
    </WorkspaceTabsProvider>
  )
}
