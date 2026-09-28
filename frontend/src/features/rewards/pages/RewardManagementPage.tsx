import { Gift, Wallet, Store, PackageCheck, Trophy, CalendarCheck, Award } from 'lucide-react'
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
import CertificatesTab from '../components/CertificatesTab'
import { useRewardGrants } from '../hooks/useRewards'
import { useRedemptions } from '../hooks/useGifts'
import { RedemptionStatus, RewardGrantStatus } from '../types'
import { useTranslation } from 'react-i18next'

type TabKey = 'grants' | 'budgets' | 'programs' | 'checkin' | 'certificates' | 'gifts' | 'redemptions'

export default function RewardManagementPage() {
  const { t } = useTranslation('rewards')
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
      label: t('RewardManagementPage.rewardProposals'),
      icon: Gift,
      // Số đang chờ duyệt là việc cần làm — đưa lên tab để người duyệt thấy ngay
      // mà không phải bấm vào mới biết.
      badge: pendingCount || undefined,
      visible: hasPermission(['REWARD:GRANT', 'REWARD:APPROVE', 'REWARD:VIEW']),
    },
    { key: 'budgets', label: t('RewardManagementPage.budgets'), icon: Wallet, visible: hasPermission('REWARD:CONFIG') },
    { key: 'programs', label: t('RewardManagementPage.automaticPrograms'), icon: Trophy, visible: hasPermission('REWARD:CONFIG') },
    { key: 'checkin', label: t('RewardManagementPage.checkIns'), icon: CalendarCheck, visible: hasPermission('REWARD:CONFIG') },
    {
      key: 'certificates',
      label: t('RewardManagementPage.certificateTemplates'),
      icon: Award,
      visible: hasPermission('REWARD:CONFIG'),
    },
    { key: 'gifts', label: t('RewardManagementPage.gifts'), icon: Store, visible: hasPermission('GIFT:MANAGE') },
    {
      key: 'redemptions',
      label: t('RewardManagementPage.giftRedemptionRequests'),
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
        <WorkspaceHeader description={t('RewardManagementPage.givePointsToEmployeesApproveOver')} />

        {activeTab === 'grants' && <GrantsTab />}
        {activeTab === 'budgets' && <BudgetsTab />}
        {activeTab === 'programs' && <ProgramsTab />}
        {activeTab === 'checkin' && <CheckinConfigTab />}
        {activeTab === 'certificates' && <CertificatesTab />}
        {activeTab === 'gifts' && <GiftsTab />}
        {activeTab === 'redemptions' && <RedemptionsTab />}
      </div>
    </WorkspaceTabsProvider>
  )
}
