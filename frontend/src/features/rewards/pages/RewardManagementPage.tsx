import { useState } from 'react'
import { Gift, Wallet, Store, PackageCheck, Trophy } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useHasPermission } from '@/components/auth/PermissionGate'
import GrantsTab from '../components/GrantsTab'
import BudgetsTab from '../components/BudgetsTab'
import GiftsTab from '../components/GiftsTab'
import RedemptionsTab from '../components/RedemptionsTab'
import ProgramsTab from '../components/ProgramsTab'
import { useRewardGrants } from '../hooks/useRewards'
import { useRedemptions } from '../hooks/useGifts'
import { RedemptionStatus, RewardGrantStatus } from '../types'

type TabKey = 'grants' | 'budgets' | 'programs' | 'gifts' | 'redemptions'

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
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number; visible: boolean }[] = [
    {
      key: 'grants',
      label: 'Đề nghị thưởng',
      icon: <Gift size={16} />,
      // Số đang chờ duyệt là việc cần làm — đưa lên tab để người duyệt thấy ngay
      // mà không phải bấm vào mới biết.
      badge: pendingCount || undefined,
      visible: hasPermission(['REWARD:GRANT', 'REWARD:APPROVE', 'REWARD:VIEW']),
    },
    {
      key: 'budgets',
      label: 'Hạn mức',
      icon: <Wallet size={16} />,
      visible: hasPermission('REWARD:CONFIG'),
    },
    {
      key: 'programs',
      label: 'Chương trình tự động',
      icon: <Trophy size={16} />,
      visible: hasPermission('REWARD:CONFIG'),
    },
    {
      key: 'gifts',
      label: 'Quà tặng',
      icon: <Store size={16} />,
      visible: hasPermission('GIFT:MANAGE'),
    },
    {
      key: 'redemptions',
      label: 'Yêu cầu đổi quà',
      icon: <PackageCheck size={16} />,
      badge: pendingRedemptionCount || undefined,
      visible: canFulfill,
    },
  ]
  const visibleTabs = tabs.filter((t) => t.visible)
  const [active, setActive] = useState<TabKey>(visibleTabs[0]?.key ?? 'grants')

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Quản lý thưởng điểm"
        description="Trao điểm cho nhân viên, duyệt đề nghị vượt hạn mức và cấp hạn mức cho quản lý"
      />

      {/* Xuống dòng chứ KHÔNG cuộn ngang: tab nằm ngoài khung nhìn thì người dùng không
          biết là có. Bỏ đường kẻ dưới của khung ở mobile vì khi tab xuống nhiều hàng,
          gạch chân của hàng trên sẽ lệch khỏi đường kẻ đó và nhìn như lỗi. */}
      <div className="mb-6 flex flex-wrap gap-1 sm:border-b sm:border-[var(--color-border)]">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:-mb-px sm:gap-2 sm:px-4 sm:py-3 ${
              active === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge != null && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {active === 'grants' && <GrantsTab />}
      {active === 'budgets' && <BudgetsTab />}
      {active === 'programs' && <ProgramsTab />}
      {active === 'gifts' && <GiftsTab />}
      {active === 'redemptions' && <RedemptionsTab />}
    </div>
  )
}
