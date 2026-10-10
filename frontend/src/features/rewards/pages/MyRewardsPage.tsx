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
import { useTranslation } from 'react-i18next'
import { tourAnchor } from '@/components/common/tours/anchors'

type TabKey = 'shop' | 'history' | 'certificates' | 'redemptions'

export default function MyRewardsPage() {
  const { t } = useTranslation('rewards')
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
      { key: 'shop', label: t('MyRewardsPage.giftShop'), icon: Store, visible: canRedeem },
      {
        key: 'history',
        label: t('MyRewardsPage.pointHistory'),
        icon: History,
        badge: txPage?.totalElements || undefined,
      },
      {
        key: 'certificates',
        label: t('MyRewardsPage.certificates'),
        icon: Award,
        badge: certificateCountPage?.totalElements || undefined,
      },
      {
        key: 'redemptions',
        label: t('MyRewardsPage.redeemedGifts'),
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
        title={t('MyRewardsPage.myRewardPoints')}
        description={t('MyRewardsPage.pointBalanceDailyCheckInGift')}
      />

      <div {...tourAnchor('myrewards.balance')} id="tour-my-rewards-balance">
        <RewardBalanceCard wallet={wallet} loading={walletLoading} />
      </div>

      {/* Ngay dưới số dư, TRÊN nội dung tab: điểm danh là việc phải làm mỗi ngày, để nó nằm
          trong một tab thì hôm nào nhân viên không mở tab đó là mất chuỗi. Thẻ tự ẩn
          khi tổ chức chưa bật, nên không chiếm chỗ vô ích. */}
      <div {...tourAnchor('myrewards.checkin')} id="tour-my-rewards-checkin">
        <CheckinCard />
      </div>

      {/* Cửa hàng cần số dư để hiện "còn thiếu bao nhiêu điểm" ngay trên từng thẻ quà,
          thay vì để nhân viên tự nhẩm. */}
      {activeTab === 'shop' && <GiftShopGrid balance={wallet?.balance ?? 0} />}

      {activeTab === 'history' && (
        <div {...tourAnchor('myrewards.history')} id="tour-my-rewards-history">
          {txLoading ? (
            <LoadingSkeleton type="table" rows={4} />
          ) : transactions.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)]">
              <EmptyState
                title={t('MyRewardsPage.noTransactionsYet')}
                description={t('MyRewardsPage.everyTimeYouReceiveRewardPoints')}
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
                    itemLabel={t('MyRewardsPage.transactions')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'certificates' && <MyCertificatesTab />}

      {activeTab === 'redemptions' && (
        <div {...tourAnchor('myrewards.redemptions')} id="tour-my-rewards-redemptions">
          {redemptionsLoading ? (
            <LoadingSkeleton type="table" rows={3} />
          ) : redemptions.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)]">
              <EmptyState
                title={t('MyRewardsPage.youHaveNotRedeemedAnyGifts')}
                description={t('MyRewardsPage.goToTheGiftShopTab')}
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
