import { useState } from 'react'
import { History, Store, PackageCheck } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useHasPermission } from '@/components/auth/PermissionGate'
import RewardBalanceCard from '../components/RewardBalanceCard'
import RewardLedgerTable from '../components/RewardLedgerTable'
import GiftShopGrid from '../components/GiftShopGrid'
import MyRedemptionsTable from '../components/MyRedemptionsTable'
import { useMyTransactions, useMyWallet } from '../hooks/useRewards'
import { useMyRedemptions } from '../hooks/useGifts'

type TabKey = 'shop' | 'history' | 'redemptions'

export default function MyRewardsPage() {
  const [tab, setTab] = useState<TabKey>('shop')
  const [page, setPage] = useState(0)
  const size = 20

  const { hasPermission } = useHasPermission()
  const canRedeem = hasPermission('GIFT:REDEEM')

  const { data: wallet, isLoading: walletLoading } = useMyWallet()
  const { data: txPage, isLoading: txLoading } = useMyTransactions(page, size)
  const { data: redemptionPage, isLoading: redemptionsLoading } = useMyRedemptions(0, 50)

  const transactions = txPage?.content ?? []
  const redemptions = redemptionPage?.content ?? []

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number; visible: boolean }[] = [
    { key: 'shop', label: 'Cửa hàng quà', icon: <Store size={16} />, visible: canRedeem },
    {
      key: 'history',
      label: 'Lịch sử điểm',
      icon: <History size={16} />,
      badge: txPage?.totalElements || undefined,
      visible: true,
    },
    {
      key: 'redemptions',
      label: 'Quà đã đổi',
      icon: <PackageCheck size={16} />,
      badge: redemptionPage?.totalElements || undefined,
      visible: canRedeem,
    },
  ]
  const visibleTabs = tabs.filter((t) => t.visible)
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : visibleTabs[0]?.key

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Điểm thưởng của tôi"
        description="Số dư điểm, đổi quà và toàn bộ lịch sử giao dịch điểm"
      />

      <RewardBalanceCard wallet={wallet} loading={walletLoading} />

      {/* Xuống dòng chứ không cuộn ngang — xem ghi chú ở RewardManagementPage. */}
      <div className="mb-6 mt-8 flex flex-wrap gap-1 sm:border-b sm:border-[var(--color-border)]">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:-mb-px sm:gap-2 sm:px-4 sm:py-3 ${
              activeTab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cửa hàng cần số dư để hiện "còn thiếu bao nhiêu điểm" ngay trên từng thẻ quà,
          thay vì để nhân viên tự nhẩm. */}
      {activeTab === 'shop' && <GiftShopGrid balance={wallet?.balance ?? 0} />}

      {activeTab === 'history' &&
        (txLoading ? (
          <LoadingSkeleton type="table" rows={4} />
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
            <EmptyState
              title="Chưa có giao dịch nào"
              description="Mọi lần bạn được thưởng điểm hoặc dùng điểm đổi quà đều được ghi lại đầy đủ ở đây."
            />
          </div>
        ) : (
          <>
            <RewardLedgerTable data={transactions} />
            {(txPage?.totalPages ?? 0) > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={page}
                  totalPages={txPage?.totalPages ?? 0}
                  totalElements={txPage?.totalElements ?? 0}
                  size={size}
                  onPageChange={setPage}
                  itemLabel="giao dịch"
                />
              </div>
            )}
          </>
        ))}

      {activeTab === 'redemptions' &&
        (redemptionsLoading ? (
          <LoadingSkeleton type="table" rows={3} />
        ) : redemptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
            <EmptyState
              title="Bạn chưa đổi quà nào"
              description="Sang tab Cửa hàng quà để xem những gì bạn có thể đổi bằng số điểm đang có."
            />
          </div>
        ) : (
          <MyRedemptionsTable data={redemptions} />
        ))}
    </div>
  )
}
