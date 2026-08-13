import { useEffect, useState } from 'react'
import { Loader2, X, Gift, Minus, Plus, AlertTriangle } from 'lucide-react'
import { useMyRedemptions } from '../hooks/useGifts'
import type { GiftItem } from '../types'

interface RedeemGiftModalProps {
  /** null = đóng. Truyền cả object để modal hiện được ảnh/giá mà không phải fetch lại. */
  gift: GiftItem | null
  balance: number
  onClose: () => void
}

export default function RedeemGiftModal({ gift, balance, onClose }: RedeemGiftModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const { redeem, isRedeeming } = useMyRedemptions()

  useEffect(() => {
    if (!gift) return
    setQuantity(1)
    setNote('')
  }, [gift])

  if (!gift) return null

  // Trần số lượng là giá trị nhỏ hơn giữa "tồn kho còn" và "số điểm mua nổi" — chặn ở
  // đây để người dùng không bấm gửi rồi mới nhận lỗi từ backend.
  const maxByStock = gift.unlimitedStock ? Infinity : (gift.stockQuantity ?? 0)
  const maxByBalance = Math.floor(balance / gift.pointCost)
  const maxQty = Math.max(1, Math.min(maxByStock, maxByBalance))

  const total = gift.pointCost * quantity
  const remaining = balance - total
  const notEnough = total > balance

  const handleSubmit = async () => {
    if (notEnough) return
    await redeem({ giftItemId: gift.id, quantity, note: note.trim() || undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Gift size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">Đổi quà</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex gap-3">
            {gift.imageUrl && (
              <img
                src={gift.imageUrl}
                alt={gift.name}
                className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="font-semibold">{gift.name}</div>
              <div className="mt-0.5 text-sm text-[var(--color-primary)]">
                {gift.pointCost.toLocaleString('vi-VN')} điểm / phần
              </div>
              {!gift.unlimitedStock && gift.stockQuantity != null && (
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  Còn {gift.stockQuantity} phần
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Số lượng</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="rounded-lg border border-[var(--color-border)] p-2 disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-lg font-semibold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                className="rounded-lg border border-[var(--color-border)] p-2 disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
              {maxQty < 2 && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {maxByStock < maxByBalance ? 'Chỉ còn 1 phần' : 'Điểm chỉ đủ 1 phần'}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1 rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Số dư hiện tại</span>
              <span className="tabular-nums">{balance.toLocaleString('vi-VN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Trừ khi đổi</span>
              <span className="tabular-nums text-rose-600">−{total.toLocaleString('vi-VN')}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-semibold">
              <span>Còn lại</span>
              <span className="tabular-nums">{remaining.toLocaleString('vi-VN')}</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Ghi chú <span className="font-normal text-[var(--color-muted-foreground)]">(tuỳ chọn)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: cỡ áo L, giao tại văn phòng Hà Nội"
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {/* Nói trước điều gì sẽ xảy ra sau khi bấm — và hai loại quà cho ra hai kết
              cục khác hẳn nhau, nên không thể dùng chung một câu. */}
          <div className="flex items-start gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-sky-600" />
            <span>
              {gift.requiresDelivery ? (
                <>
                  Điểm được trừ ngay khi gửi yêu cầu, và bạn <b>nhận quà trực tiếp tại công ty</b>.
                  Nếu bị từ chối hoặc bạn tự huỷ, điểm sẽ được hoàn lại đầy đủ.
                </>
              ) : (
                <>
                  Quà này <b>hoàn tất ngay khi đổi</b> — điểm bị trừ và quyền lợi được ghi nhận
                  luôn, không cần chờ ai xử lý.
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={notEnough || isRedeeming}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isRedeeming && <Loader2 size={15} className="animate-spin" />}
            {gift.requiresDelivery ? 'Gửi yêu cầu đổi' : 'Đổi ngay'}
          </button>
        </div>
      </div>
    </div>
  )
}
