import { intlLocale } from '@/i18n/format'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRedeemGiftSchema, type RedeemGiftFormData } from '../schemas/redeemGiftSchema'
import { Loader2, Minus, Plus, AlertTriangle, Wallet } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import TopupModal from '@/features/wallet/components/TopupModal'
import {
  useConversion,
  useMyCashWallet,
  useMyTopups,
  useTopupConfig,
} from '@/features/wallet/hooks/useWallet'
import { TopupOrderStatus } from '@/features/wallet/types'
import { useMyRedemptions } from '../hooks/useGifts'
import { htmlToText } from '../utils/html'
import type { GiftItem, Redemption } from '../types'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

interface RedeemGiftModalProps {
  /** null = đóng. Truyền cả object để modal hiện được ảnh/giá mà không phải fetch lại. */
  gift: GiftItem | null
  balance: number
  onClose: () => void
  /**
   * Tổ chức có bật ví tiền và người dùng có quyền xem ví của mình hay không. Bật thì
   * thiếu điểm không còn là ngõ cụt: mua thêm điểm bằng tiền ngay trong hộp thoại này.
   */
  canTopUp?: boolean
  /**
   * Gọi khi vừa đổi xong một món có mã voucher. Người đổi phải thấy mã NGAY — bắt họ tự
   * tìm lại trong lịch sử là cách chắc chắn nhất để có một cuộc gọi cho bộ phận hỗ trợ.
   */
  onVoucherIssued?: (redemption: Redemption) => void
}

/** Đơn nạp làm tròn lên tới bội số này cho dễ chuyển khoản. */
const TOPUP_ROUNDING = 1_000

/**
 * Trần số lượng cho quà không giới hạn tồn kho KHI có thể mua thêm điểm — lúc đó số dư
 * không còn chặn gì nữa, mà một cặp nút +/- không có trần thì không dùng được.
 */
const MAX_QTY_UNLIMITED = 99

export default function RedeemGiftModal({
  gift,
  balance,
  onClose,
  canTopUp = false,
  onVoucherIssued,
}: RedeemGiftModalProps) {
  const { t } = useTranslation('rewards')
  const { redeem, isRedeeming } = useMyRedemptions()

  // Ví tiền chỉ đọc khi thực sự dùng được — không thì mỗi lần mở hộp thoại là một cú 403.
  const { data: cashWallet } = useMyCashWallet(canTopUp && !!gift)
  const { convert, isConverting } = useConversion()
  const topupConfig = useTopupConfig(cashWallet)
  // Vài đơn nạp gần nhất, để mở lại đơn còn dở thay vì đẻ thêm đơn treo mỗi lần bấm.
  const { data: recentTopups } = useMyTopups(0, 5, canTopUp && !!gift)
  const [topupOpen, setTopupOpen] = useState(false)

  const rate = cashWallet?.pointExchangeRate ?? 0
  const cashBalance = cashWallet?.balance ?? 0
  /** Mua thêm điểm bằng tiền chỉ có nghĩa khi đã biết tỉ giá. */
  const canBuyPoints = canTopUp && rate > 0

  // Trần số lượng: tồn kho luôn là trần cứng. Số điểm đang có CHỈ là trần khi không mua
  // thêm điểm được — mua được thì chặn ở đây là chặn nhầm, vì thiếu bao nhiêu cũng bù được.
  const maxByStock = gift?.unlimitedStock ? Infinity : (gift?.stockQuantity ?? 0)
  const maxByBalance = gift ? Math.floor(balance / gift.pointCost) : 0
  const maxQty = Math.max(
    1,
    canBuyPoints ? Math.min(maxByStock, MAX_QTY_UNLIMITED) : Math.min(maxByStock, maxByBalance),
  )

  const schema = useMemo(
    () =>
      createRedeemGiftSchema({
        maxQty,
        maxAffordable: canBuyPoints ? maxQty : maxByBalance,
      }),
    [maxQty, maxByBalance, canBuyPoints],
  )

  const formApi = useForm<RedeemGiftFormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, note: '' },
  })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `redeem-gift:${gift?.id ?? ''}`, enabled: !!gift })

  // Số lượng chỉnh bằng hai nút +/- chứ không phải ô nhập.
  const quantity = watch('quantity')

  const total = (gift?.pointCost ?? 0) * quantity
  const remaining = balance - total
  const notEnough = total > balance
  /** Số điểm còn thiếu và số tiền tương ứng theo tỉ giá của tổ chức. */
  const shortPoints = Math.max(0, total - balance)
  const cashNeeded = shortPoints * rate
  const cashShort = Math.max(0, cashNeeded - cashBalance)
  const topupAmount = Math.max(
    topupConfig.topupMinAmount,
    Math.ceil(cashShort / TOPUP_ROUNDING) * TOPUP_ROUNDING,
  )

  /**
   * Đơn nạp đang chờ, đúng số tiền cần và còn hạn: mở lại chính nó.
   *
   * <p>Không có bước này thì mỗi lần người dùng đóng hộp thoại giữa chừng rồi bấm lại là
   * một đơn treo mới, và backend chỉ cho tối đa 5 đơn chờ mỗi người trước khi chặn.
   */
  const resumableTopup =
    recentTopups?.content.find(
      (o) =>
        o.status === TopupOrderStatus.PENDING &&
        o.amount === topupAmount &&
        Date.parse(o.expiresAt) > Date.now(),
    ) ?? null

  /**
   * Sinh mã yêu cầu MỚI mỗi khi số điểm cần mua đổi — xem ghi chú cùng loại ở
   * ConvertPointsCard. Sinh lại ở mỗi lần bấm thì lớp chống ghi trùng vô nghĩa, còn giữ
   * cố định thì đổi số lượng rồi bấm sẽ nhận về kết quả của lần quy đổi trước.
   */
  const [convertRequestId, setConvertRequestId] = useState(() => crypto.randomUUID())
  useEffect(() => {
    setConvertRequestId(crypto.randomUUID())
  }, [shortPoints])

  useEffect(() => {
    if (!gift) return
    reset({ quantity: 1, note: '' })
    setTopupOpen(false)
  }, [gift, reset])

  if (!gift) return null

  const isVoucher = !!gift.externalProvider
  const busy = isRedeeming || isConverting

  const onSubmit = async (data: RedeemGiftFormData) => {
    if (blockedByTour()) return
    const result = await redeem({
      giftItemId: gift.id,
      quantity: data.quantity,
      note: data.note.trim() || undefined,
    })
    onClose()
    if (result.vouchers?.length) onVoucherIssued?.(result)
  }

  /**
   * Tiền trong ví đã đủ bù phần thiếu: quy đổi rồi đổi quà luôn trong một nhịp — người
   * dùng vừa xác nhận cả hai việc trên cùng một nút.
   */
  const buyPointsAndRedeem = async () => {
    if (blockedByTour()) return
    try {
      await convert({ points: shortPoints, requestId: convertRequestId })
    } catch {
      return // useConversion đã báo lỗi bằng toast
    }
    await handleSubmit(onSubmit)()
  }

  /**
   * Tiền vừa về ví. Quy đổi đúng số điểm còn thiếu — đó là việc người dùng đã bấm xác
   * nhận — nhưng KHÔNG tự đổi quà: tiền về là do webhook, lúc đó họ có thể đã rời máy,
   * nên cú bấm tiêu điểm cuối cùng vẫn phải là của họ.
   */
  const onTopupPaid = async () => {
    setTopupOpen(false)
    try {
      await convert({ points: shortPoints, requestId: convertRequestId })
    } catch {
      // useConversion đã báo lỗi bằng toast; tiền vẫn nằm trong ví nên không mất gì.
    }
  }

  return (
    <>
      <Dialog {...tourAnchor('redeem.dialog')}
        open
        onClose={onClose}
        size="md"
        dismissible={!busy}
        title={t('RedeemGiftModal.giftRedemption')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('RedeemGiftModal.cancel')}</Button>}
            primary={notEnough && canBuyPoints ? (
              <Button onClick={cashShort <= 0 ? buyPointsAndRedeem : () => setTopupOpen(true)} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
                {cashShort <= 0
                  ? t('RedeemGiftModal.useRedeem', { cashNeeded: formatCurrency(cashNeeded) })
                  : t('RedeemGiftModal.topUpRedeem', { topupAmount: formatCurrency(topupAmount) })}
              </Button>
            ) : (
              <Button {...tourAnchor('redeem.submit')} onClick={handleSubmit(onSubmit)} disabled={notEnough || busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {gift.requiresDelivery ? t('RedeemGiftModal.sendRedemptionRequest') : isVoucher ? t('RedeemGiftModal.redeemGetCode') : t('RedeemGiftModal.redeemNow')}
              </Button>
            )}
          />
        }
      >
        <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-5">
          <div {...tourAnchor('redeem.gift')} className="flex gap-3">
            {gift.imageUrl && (
              <img
                src={gift.imageUrl}
                alt={gift.name}
                className="h-20 w-20 flex-shrink-0 rounded-card object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="font-semibold">{gift.name}</div>
              <div className="mt-0.5 text-sm text-[var(--color-primary)]">
                {gift.pointCost.toLocaleString(intlLocale())} {t('RedeemGiftModal.pointsUnit')}
              </div>
              {/* UrBox yêu cầu hiện tên quà, MỆNH GIÁ và điều kiện sử dụng trước khi
                  người dùng bấm đổi — thiếu là nguồn khiếu nại lúc mang mã đi dùng. */}
              {gift.externalValue != null && (
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {t('RedeemGiftModal.value')} {gift.externalValue.toLocaleString(intlLocale())} ₫
                  {gift.externalBrand && ` · ${gift.externalBrand}`}
                </div>
              )}
              {gift.externalExpireText && (
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {t('RedeemGiftModal.validUntil')} {gift.externalExpireText}
                </div>
              )}
              {!gift.unlimitedStock && gift.stockQuantity != null && (
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {t('RedeemGiftModal.remaining')} {gift.stockQuantity} {t('RedeemGiftModal.units')}
                </div>
              )}
            </div>
          </div>

          {gift.externalTerms && (
            <details className="rounded-card border border-[var(--color-border)]">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
                {t('RedeemGiftModal.termsOfUse')}
              </summary>
              <p className="max-h-56 overflow-y-auto whitespace-pre-line border-t border-[var(--color-border)] px-4 py-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                {htmlToText(gift.externalTerms)}
              </p>
            </details>
          )}

          <div {...tourAnchor('redeem.quantity')}>
            <label className="text-label mb-1.5 block font-medium">{t('RedeemGiftModal.quantity')}</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setValue('quantity', Math.max(1, quantity - 1), { shouldValidate: true })}
                disabled={quantity <= 1}
                className="rounded-control border border-[var(--color-border)] p-2 disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-lg font-semibold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setValue('quantity', Math.min(maxQty, quantity + 1), { shouldValidate: true })}
                disabled={quantity >= maxQty}
                className="rounded-control border border-[var(--color-border)] p-2 disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
              {maxQty < 2 && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {canBuyPoints || maxByStock < maxByBalance ? t('RedeemGiftModal.only1UnitLeft') : t('RedeemGiftModal.pointsAreEnoughForOnly1')}
                </span>
              )}
            </div>
            {errors.quantity && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{errors.quantity.message}</p>
            )}
          </div>

          <div {...tourAnchor('redeem.balance')} className="space-y-1 rounded-card bg-[var(--color-muted)] px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">{t('RedeemGiftModal.currentBalance')}</span>
              <span className="tabular-nums">{balance.toLocaleString(intlLocale())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">{t('RedeemGiftModal.deductedOnRedemption')}</span>
              <span className="tabular-nums text-[var(--color-error)]">−{total.toLocaleString(intlLocale())}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-semibold">
              {notEnough ? (
                <>
                  <span>{t('RedeemGiftModal.shortBy')}</span>
                  <span className="tabular-nums text-[var(--color-warning)]">
                    {shortPoints.toLocaleString(intlLocale())}
                  </span>
                </>
              ) : (
                <>
                  <span>{t('RedeemGiftModal.remaining2')}</span>
                  <span className="tabular-nums">{remaining.toLocaleString(intlLocale())}</span>
                </>
              )}
            </div>
          </div>

          <div {...tourAnchor('redeem.notes')}>
            <label className="text-label mb-1.5 block font-medium">
              {t('RedeemGiftModal.notes')} <span className="font-normal text-[var(--color-muted-foreground)]">{t('RedeemGiftModal.optional')}</span>
            </label>
            <input
              {...register('note')}
              placeholder={t('RedeemGiftModal.eGTShirtSizeL')}
              className="w-full rounded-control border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {/* Thiếu điểm không còn là ngõ cụt — nói thẳng cần bù bao nhiêu tiền và bù
              bằng đường nào, TRƯỚC khi người dùng bấm. */}
          {notEnough && canBuyPoints ? (
            <div className="space-y-1.5 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-[var(--color-warning)]">
                <Wallet size={16} />
                {t('RedeemGiftModal.youAreShortBy')} {shortPoints.toLocaleString(intlLocale())} {t('RedeemGiftModal.points')}
              </div>
              {cashShort <= 0 ? (
                <p>
                  {t('RedeemGiftModal.yourWalletHas')} <b>{formatCurrency(cashBalance)}</b>{t('RedeemGiftModal.use')}{' '}
                  <b>{formatCurrency(cashNeeded)}</b> {t('RedeemGiftModal.toGet')}{' '}
                  {shortPoints.toLocaleString(intlLocale())} {t('RedeemGiftModal.pointsAndRedeemThisGiftRight')}
                </p>
              ) : (
                <p>
                  {t('RedeemGiftModal.topUp')} <b>{formatCurrency(topupAmount)}</b> {t('RedeemGiftModal.toYourWalletAndConvertIt')}{' '}
                  {shortPoints.toLocaleString(intlLocale())} {t('RedeemGiftModal.pointsToRedeemThisGiftThe')}{' '}
                  {formatCurrency(rate)} {t('RedeemGiftModal.for1Point')}
                  {cashBalance > 0 && t('RedeemGiftModal.yourWalletHas2', { cashBalance: formatCurrency(cashBalance) })}.
                </p>
              )}
            </div>
          ) : (
            /* Nói trước điều gì sẽ xảy ra sau khi bấm — và hai loại quà cho ra hai kết
               cục khác hẳn nhau, nên không thể dùng chung một câu. */
            <div className="flex items-start gap-2 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-info)]" />
              <span>
                {gift.requiresDelivery ? (
                  <>
                    {t('RedeemGiftModal.pointsAreDeductedAsSoonAs')} <b>{t('RedeemGiftModal.receiveTheGiftInPersonAt')}</b>{t('RedeemGiftModal.ifItIsRejectedOrYou')}
                  </>
                ) : isVoucher ? (
                  <>
                    {t('RedeemGiftModal.theVoucherCodeIsIssued')} <b>{t('RedeemGiftModal.asSoonAsYouClickRedeem')}</b> {t('RedeemGiftModal.andShownOnScreenIfThe')}
                  </>
                ) : (
                  <>
                    {t('RedeemGiftModal.thisGift')} <b>{t('RedeemGiftModal.isCompletedAsSoonAsIt')}</b> {t('RedeemGiftModal.pointsAreDeductedAndTheBenefit')}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </Dialog>

      {/* Nằm sau hộp thoại đổi quà trong cây nên vẽ đè lên trên nó dù cùng z-index. */}
      <TopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        config={topupConfig}
        presetAmount={topupAmount}
        resumeOrder={resumableTopup}
        onPaid={onTopupPaid}
      />
    </>
  )
}
