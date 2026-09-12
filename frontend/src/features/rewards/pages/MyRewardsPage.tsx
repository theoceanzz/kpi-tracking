import { useState } from 'react'
import { History, Store, PackageCheck, Award } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useHasPermission } from '@/components/auth/PermissionGate'
import CheckinCard from '../components/CheckinCard'
import RewardBalanceCard from '../components/RewardBalanceCard'
import RewardLedgerTable from '../components/RewardLedgerTable'
import GiftShopGrid from '../components/GiftShopGrid'
import MyRedemptionsTable from '../components/MyRedemptionsTable'
import MyCertificatesTab from '../components/MyCertificatesTab'
import { useMyTransactions, useMyWallet } from '../hooks/useRewards'
import { useMyRedemptions } from '../hooks/useGifts'
import { useMyAwards } from '../hooks/useCertificates'

type TabKey = 'shop' | 'history' | 'certificates' | 'redemptions'

export default function MyRewardsPage() {
  const [page, setPage] = useState(0)
  const size = 20

  const { hasPermission } = useHasPermission()
  const canRedeem = hasPermission('GIFT:REDEEM')

  const { data: wallet, isLoading: walletLoading } = useMyWallet()
  const { data: txPage, isLoading: txLoading } = useMyTransactions(page, size)
  const { data: redemptionPage, isLoading: redemptionsLoading } = useMyRedemptions(0, 50)
  // Chỉ lấy tổng số cho badge, không lấy nội dung — `MyCertificatesTab` tự tải danh sách
  // đầy đủ của nó. size=1 là đủ để có totalElements, giống cách RewardManagementPage đếm
  // đề nghị đang chờ duyệt.
  const { data: certificateCountPage } = useMyAwards(0, 1)

  const transactions = txPage?.content ?? []
  const redemptions = redemptionPage?.content ?? []

  /**
   * Tab lưu ở URL thay vì state cục bộ: nhờ vậy F5 không mất chỗ, gửi link cho đồng
   * nghiệp thì họ mở đúng tab, và hệ hướng dẫn có tab để bám vào.
   *
   * Dùng `?rewards=` chứ không phải `?tab=` để không đụng tham số của các mục khác
   * trong cùng trang "Của tôi" — cùng lý do như `?scoring=` ở trang Thiết lập công cụ.
   */
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>(
    [
      { key: 'shop', label: 'Cửa hàng quà', icon: Store, visible: canRedeem },
      {
        key: 'history',
        label: 'Lịch sử điểm',
        icon: History,
        badge: txPage?.totalElements || undefined,
      },
      {
        key: 'certificates',
        label: 'Chứng nhận',
        icon: Award,
        badge: certificateCountPage?.totalElements || undefined,
      },
      {
        key: 'redemptions',
        label: 'Quà đã đổi',
        icon: PackageCheck,
        badge: redemptionPage?.totalElements || undefined,
        visible: canRedeem,
      },
    ],
    { param: 'rewards' }
  )
  return (
    <WorkspaceTabsProvider tabs={visibleTabs} activeTab={activeTab} setActiveTab={key => setActiveTab(key as TabKey)}>
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-my-rewards-header"
        title="Điểm thưởng của tôi"
        description="Số dư điểm, điểm danh mỗi ngày, đổi quà và toàn bộ lịch sử giao dịch điểm."
      />

      <div id="tour-my-rewards-balance">
        <RewardBalanceCard wallet={wallet} loading={walletLoading} />
      </div>

      {/* Ngay dưới số dư, TRÊN nội dung tab: điểm danh là việc phải làm mỗi ngày, để nó nằm
          trong một tab thì hôm nào nhân viên không mở tab đó là mất chuỗi. Thẻ tự ẩn
          khi tổ chức chưa bật, nên không chiếm chỗ vô ích. */}
      <div id="tour-my-rewards-checkin">
        <CheckinCard />
      </div>

      {/* Cửa hàng cần số dư để hiện "còn thiếu bao nhiêu điểm" ngay trên từng thẻ quà,
          thay vì để nhân viên tự nhẩm. */}
      {activeTab === 'shop' && <GiftShopGrid balance={wallet?.balance ?? 0} />}

      {activeTab === 'history' && (
        <div id="tour-my-rewards-history">
          {txLoading ? (
            <LoadingSkeleton type="table" rows={4} />
          ) : transactions.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)]">
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
          )}
        </div>
      )}

      {activeTab === 'certificates' && <MyCertificatesTab />}

      {activeTab === 'redemptions' && (
        <div id="tour-my-rewards-redemptions">
          {redemptionsLoading ? (
            <LoadingSkeleton type="table" rows={3} />
          ) : redemptions.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)]">
              <EmptyState
                title="Bạn chưa đổi quà nào"
                description="Sang tab Cửa hàng quà để xem những gì bạn có thể đổi bằng số điểm đang có."
              />
            </div>
          ) : (
            <MyRedemptionsTable data={redemptions} />
          )}
        </div>
      )}
    </div>
    </WorkspaceTabsProvider>
  )
}
