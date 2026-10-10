import { intlLocale } from '@/i18n/format'
import { useState } from 'react'
import { Gift, ImageOff, Coins, PackageX, PackageCheck, Zap, Wallet } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import RedeemGiftModal from './RedeemGiftModal'
import VoucherModal from './VoucherModal'
import { useGiftShop } from '../hooks/useGifts'
import type { GiftItem, Redemption } from '../types'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourAction } from '@/components/common/tours/actions'

interface GiftShopGridProps {
  /** Số dư hiện tại, để hiện "thiếu bao nhiêu điểm" ngay trên thẻ quà. */
  balance: number
}

export default function GiftShopGrid({ balance }: GiftShopGridProps) {
  const { t } = useTranslation('rewards')
  const [redeeming, setRedeeming] = useState<GiftItem | null>(null)
  useTourAction('myrewards.redeem.close', () => setRedeeming(null))
  // Mã quà phải bật lên NGAY sau khi đổi. Bắt nhân viên tự mở lại lịch sử để tìm mã là
  // cách chắc chắn nhất để họ tưởng đổi hụt và gọi cho bộ phận hỗ trợ.
  const [issued, setIssued] = useState<Redemption | null>(null)
  const { data: gifts, isLoading } = useGiftShop()

  // Thiếu điểm chỉ là ngõ cụt khi tổ chức KHÔNG bật ví tiền. Bật rồi thì nhân viên mua
  // thêm điểm ngay trong hộp thoại đổi quà, nên thẻ quà đắt hơn số dư vẫn phải bấm được.
  const { hasPermission, user } = useHasPermission()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const canTopUp = !!org?.enableCashWallet && hasPermission('WALLET:VIEW_MY')

  if (isLoading) return <LoadingSkeleton type="card" rows={3} />

  if (!gifts || gifts.length === 0) {
    return (
      <div {...tourAnchor('myrewards.shop')} className="rounded-card border border-dashed border-[var(--color-border)]">
        <EmptyState
          title={t('GiftShopGrid.theShopHasNoGiftsYet')}
          description={t('GiftShopGrid.whenTheCompanyAddsGiftsTo')}
        />
      </div>
    )
  }

  return (
    <>
      <div {...tourAnchor('myrewards.shop')} id="tour-gift-shop-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gifts.map((gift) => {
          const shortBy = gift.pointCost - balance
          // Hai lý do KHÔNG đổi được rất khác nhau — hết hàng thì chờ cũng vô ích, còn
          // thiếu điểm thì tích thêm là đổi được. Phải nói rõ là cái nào.
          const outOfStock = !gift.available
          const cannotAfford = !outOfStock && shortBy > 0
          // Thiếu điểm mà bù được thì không chặn nút — chỉ báo trước là sẽ phải nạp thêm.
          const blockedByPoints = cannotAfford && !canTopUp

          return (
            <div
              key={gift.id}
              className="flex flex-col overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]"
            >
              <div className="relative aspect-[4/3] bg-[var(--color-muted)]">
                {gift.imageUrl ? (
                  <img
                    src={gift.imageUrl}
                    alt={gift.name}
                    className={`h-full w-full object-cover ${outOfStock ? 'opacity-40 grayscale' : ''}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--color-muted-foreground)]">
                    <ImageOff size={28} />
                  </div>
                )}
                {outOfStock && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--color-card)] px-2.5 py-1 text-xs font-medium shadow-sm">
                    <PackageX size={12} />
                    {t('GiftShopGrid.outOfStock')}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                {/* Thương hiệu và mệnh giá của voucher là thứ nhân viên nhìn trước tiên
                    để biết món này đáng bao nhiêu — UrBox cũng yêu cầu hiện mệnh giá
                    trước khi đổi. */}
                {gift.externalProvider && (
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted-foreground)]">
                    {gift.externalBrand && <span className="font-medium">{gift.externalBrand}</span>}
                    {gift.externalValue != null && (
                      <span>{t('GiftShopGrid.value')} {gift.externalValue.toLocaleString(intlLocale())} ₫</span>
                    )}
                  </div>
                )}
                <h3 className="text-section-title">{gift.name}</h3>
                {gift.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
                    {gift.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-1.5 text-[var(--color-primary)]">
                  <Coins size={16} />
                  <span className="text-lg font-semibold">
                    {gift.pointCost.toLocaleString(intlLocale())}
                  </span>
                  <span className="text-sm text-[var(--color-muted-foreground)]">{t('GiftShopGrid.points')}</span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted-foreground)]">
                  {!gift.unlimitedStock && gift.stockQuantity != null && gift.stockQuantity > 0 && (
                    <span>{t('GiftShopGrid.remaining')} {gift.stockQuantity} {t('GiftShopGrid.units')}</span>
                  )}
                  {/* Cho nhân viên biết TRƯỚC khi đổi là phải chờ hay nhận luôn — không
                      nói thì họ đổi xong ngồi đợi mà không biết đợi cái gì. */}
                  <span className="inline-flex items-center gap-1">
                    {gift.requiresDelivery ? (
                      <>
                        <PackageCheck size={11} />
                        {t('GiftShopGrid.pickUpAtTheCompany')}
                      </>
                    ) : gift.externalProvider ? (
                      <>
                        <Zap size={11} />
                        {t('GiftShopGrid.getAVoucherCodeInstantly')}
                      </>
                    ) : (
                      <>
                        <Zap size={11} />
                        {t('GiftShopGrid.receivedAsSoonAsRedeemed')}
                      </>
                    )}
                  </span>
                  {gift.externalExpireText && <span>{t('GiftShopGrid.expires', { date: gift.externalExpireText })}</span>}
                </div>

                <div className="mt-4 flex-1" />

                {blockedByPoints ? (
                  <div className="rounded-control bg-[var(--color-muted)] px-3 py-2 text-center text-sm text-[var(--color-muted-foreground)]">
                    {t('GiftShopGrid.shortBy')} {shortBy.toLocaleString(intlLocale())} {t('GiftShopGrid.points')}
                  </div>
                ) : (
                  <>
                    {cannotAfford && (
                      <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-[var(--color-warning)]">
                        <Wallet size={12} />
                        {t('GiftShopGrid.short')} {shortBy.toLocaleString(intlLocale())} {t('GiftShopGrid.pointsTopUpWhenRedeeming')}
                      </p>
                    )}
                    <Button {...tourAnchor('myrewards.redeem')} className="w-full" onClick={() => setRedeeming(gift)} disabled={outOfStock}>
                      <Gift aria-hidden="true" />
                      {outOfStock ? t('GiftShopGrid.outOfStock') : t('GiftShopGrid.giftRedemption')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <RedeemGiftModal
        gift={redeeming}
        balance={balance}
        canTopUp={canTopUp}
        onClose={() => setRedeeming(null)}
        onVoucherIssued={setIssued}
      />

      <VoucherModal redemption={issued} onClose={() => setIssued(null)} />
    </>
  )
}
