import { useState } from 'react'
import { History, Store, PackageCheck, Award } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { useTourTabScope } from '@/hooks/useTourScope'
import PageHeader from '@/components/common/PageHeader'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useHasPermission } from '@/components/auth/PermissionGate'
import CheckinCard from '../components/CheckinCard'
import RewardActivityTicker from '../components/RewardActivityTicker'
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
  useTourTabScope(activeTab)

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Điểm thưởng của tôi"
        description="Số dư điểm, đổi quà và toàn bộ lịch sử giao dịch điểm"
      />

      {/* Nhân viên thường chỉ vào trang này — bảng tin phải có ở đây, nếu không thì
          "để mọi người đều biết" chỉ còn đúng với người có quyền quản lý thưởng. */}
      <RewardActivityTicker className="mb-6" />

      <div id="tour-my-rewards-balance">
        <RewardBalanceCard wallet={wallet} loading={walletLoading} />
      </div>

      {/* Ngay dưới số dư, TRÊN các tab: điểm danh là việc phải làm mỗi ngày, để nó nằm
          trong một tab thì hôm nào nhân viên không mở tab đó là mất chuỗi. Thẻ tự ẩn
          khi tổ chức chưa bật, nên không chiếm chỗ vô ích. */}
      <div id="tour-my-rewards-checkin" className="mt-6">
        <CheckinCard />
      </div>

      {/* Xuống dòng chứ không cuộn ngang — xem ghi chú ở RewardManagementPage. */}
      {/* Neo cho hướng dẫn: hàng tab này tự vẽ chứ không đi qua WorkspaceHeader. */}
      <div id="tour-local-tabs" className="mb-6 mt-8 flex flex-wrap gap-1 sm:border-b sm:border-[var(--color-border)]">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:-mb-px sm:gap-2 sm:px-4 sm:py-3 ${
              activeTab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            <t.icon size={16} />
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

      {activeTab === 'history' && (
        <div id="tour-my-rewards-history">
          {txLoading ? (
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
          )}
        </div>
      )}

      {activeTab === 'certificates' && <MyCertificatesTab />}

      {activeTab === 'redemptions' && (
        <div id="tour-my-rewards-redemptions">
          {redemptionsLoading ? (
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
          )}
        </div>
      )}
    </div>
  )
}
