import { useState } from 'react'
import { Gift, ImageOff, Coins, PackageX, PackageCheck, Zap } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import RedeemGiftModal from './RedeemGiftModal'
import VoucherModal from './VoucherModal'
import { useGiftShop } from '../hooks/useGifts'
import type { GiftItem, Redemption } from '../types'

interface GiftShopGridProps {
  /** Số dư hiện tại, để hiện "thiếu bao nhiêu điểm" ngay trên thẻ quà. */
  balance: number
}

export default function GiftShopGrid({ balance }: GiftShopGridProps) {
  const [redeeming, setRedeeming] = useState<GiftItem | null>(null)
  // Mã quà phải bật lên NGAY sau khi đổi. Bắt nhân viên tự mở lại lịch sử để tìm mã là
  // cách chắc chắn nhất để họ tưởng đổi hụt và gọi cho bộ phận hỗ trợ.
  const [issued, setIssued] = useState<Redemption | null>(null)
  const { data: gifts, isLoading } = useGiftShop()

  if (isLoading) return <LoadingSkeleton type="card" rows={3} />

  if (!gifts || gifts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
        <EmptyState
          title="Cửa hàng chưa có quà nào"
          description="Khi công ty thêm quà vào danh mục, bạn sẽ thấy chúng ở đây và dùng điểm để đổi."
        />
      </div>
    )
  }

  return (
    <>
      <div id="tour-gift-shop-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gifts.map((gift) => {
          const shortBy = gift.pointCost - balance
          // Hai lý do KHÔNG đổi được rất khác nhau — hết hàng thì chờ cũng vô ích, còn
          // thiếu điểm thì tích thêm là đổi được. Phải nói rõ là cái nào.
          const outOfStock = !gift.available
          const cannotAfford = !outOfStock && shortBy > 0

          return (
            <div
              key={gift.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
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
                    Hết hàng
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
                      <span>Trị giá {gift.externalValue.toLocaleString('vi-VN')} ₫</span>
                    )}
                  </div>
                )}
                <h3 className="font-semibold">{gift.name}</h3>
                {gift.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
                    {gift.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-1.5 text-[var(--color-primary)]">
                  <Coins size={16} />
                  <span className="text-lg font-bold">
                    {gift.pointCost.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-sm text-[var(--color-muted-foreground)]">điểm</span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted-foreground)]">
                  {!gift.unlimitedStock && gift.stockQuantity != null && gift.stockQuantity > 0 && (
                    <span>Còn {gift.stockQuantity} phần</span>
                  )}
                  {/* Cho nhân viên biết TRƯỚC khi đổi là phải chờ hay nhận luôn — không
                      nói thì họ đổi xong ngồi đợi mà không biết đợi cái gì. */}
                  <span className="inline-flex items-center gap-1">
                    {gift.requiresDelivery ? (
                      <>
                        <PackageCheck size={11} />
                        Nhận trực tiếp tại công ty
                      </>
                    ) : gift.externalProvider ? (
                      <>
                        <Zap size={11} />
                        Nhận mã voucher ngay
                      </>
                    ) : (
                      <>
                        <Zap size={11} />
                        Nhận ngay khi đổi
                      </>
                    )}
                  </span>
                  {gift.externalExpireText && <span>HSD {gift.externalExpireText}</span>}
                </div>

                <div className="mt-4 flex-1" />

                {cannotAfford ? (
                  <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-center text-sm text-[var(--color-muted-foreground)]">
                    Còn thiếu {shortBy.toLocaleString('vi-VN')} điểm
                  </div>
                ) : (
                  <button
                    onClick={() => setRedeeming(gift)}
                    disabled={outOfStock}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Gift size={16} />
                    {outOfStock ? 'Hết hàng' : 'Đổi quà'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <RedeemGiftModal
        gift={redeeming}
        balance={balance}
        onClose={() => setRedeeming(null)}
        onVoucherIssued={setIssued}
      />

      <VoucherModal redemption={issued} onClose={() => setIssued(null)} />
    </>
  )
}
