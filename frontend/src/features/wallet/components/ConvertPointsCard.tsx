import { intlLocale } from '@/i18n/format'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Coins, Loader2 } from 'lucide-react'
import NumberInput from '@/components/common/NumberInput'
import { formatCurrency } from '@/lib/utils'
import { useConversion } from '../hooks/useWallet'
import type { CashWallet } from '../types'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

interface ConvertPointsCardProps {
  wallet?: CashWallet
}

export default function ConvertPointsCard({ wallet }: ConvertPointsCardProps) {
  const { t } = useTranslation('wallet')
  const [points, setPoints] = useState(0)
  const { convert, isConverting } = useConversion()

  const rate = wallet?.pointExchangeRate ?? 0
  const balance = wallet?.balance ?? 0
  const maxPoints = wallet?.convertiblePoints ?? 0

  // Tính tại chỗ thay vì gọi /convert/quote: công thức là points × rate, chia chẵn
  // và không phụ thuộc gì khác, nên gọi API chỉ thêm độ trễ mà cho ra đúng con số này.
  const cost = useMemo(() => points * rate, [points, rate])
  const affordable = points > 0 && cost <= balance

  /**
   * Sinh mã yêu cầu MỚI mỗi khi số điểm đổi.
   *
   * <p>Sinh lại ở mỗi lần bấm thì lớp chống ghi trùng vô nghĩa — bấm hai lần sẽ
   * trừ tiền hai lần. Giữ cố định suốt vòng đời form thì ngược lại: đổi số điểm
   * rồi bấm sẽ nhận về kết quả của lần đổi trước. Buộc vào giá trị đang nhập là
   * cách duy nhất đúng cả hai chiều.
   */
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  useEffect(() => {
    setRequestId(crypto.randomUUID())
  }, [points])

  const submit = async () => {
    if (blockedByTour()) return
    await convert({ points, requestId })
    setPoints(0)
  }

  return (
    <div className="rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-center gap-2 text-eyebrow">
        <Coins size={14} />
        {t('ConvertPointsCard.convertMoneyIntoRewardPoints')}
      </div>

      <p {...tourAnchor('convert.rate')} className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        {t('ConvertPointsCard.currentRate')} <strong>{formatCurrency(rate)}</strong> {t('ConvertPointsCard.for1PointPointsGoStraight')}
      </p>

      <div className="mt-5 grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div {...tourAnchor('convert.points')}>
          <label className="text-label mb-1.5 block font-medium">{t('ConvertPointsCard.pointsToConvert')}</label>
          <NumberInput
            value={points}
            onChange={setPoints}
            placeholder="0"
            maxDigits={9}
            className="w-full rounded-card border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-right text-xl font-semibold tabular-nums outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <ArrowRight className="mx-auto hidden text-[var(--color-muted-foreground)] sm:block" size={20} />

        <div {...tourAnchor('convert.cost')}>
          <div className="mb-1.5 text-sm font-medium">{t('ConvertPointsCard.amountDeducted')}</div>
          <div
            className={`rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-right text-xl font-semibold tabular-nums ${
              points > 0 && !affordable ? 'text-[var(--color-error)]' : ''
            }`}
          >
            {formatCurrency(cost)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--color-muted-foreground)]">
          {t('ConvertPointsCard.balanceAfterConverting')}{' '}
          <strong className="text-[var(--color-foreground)]">
            {formatCurrency(Math.max(balance - cost, 0))}
          </strong>
        </span>
        <Button {...tourAnchor('convert.max')} variant="ghost" type="button" onClick={() => setPoints(maxPoints)} disabled={maxPoints <= 0}>
          {t('ConvertPointsCard.convertMax')}{maxPoints.toLocaleString(intlLocale())} {t('ConvertPointsCard.points')}
        </Button>
      </div>

      {points > 0 && !affordable && (
        <p className="mt-3 rounded-card bg-[var(--color-error-bg)] px-4 py-2.5 text-sm text-[var(--color-error)]">
          {t('ConvertPointsCard.insufficientBalanceYouAreShortBy')} {formatCurrency(cost - balance)}.
        </p>
      )}

      <Button {...tourAnchor('convert.submit')} className="mt-5 w-full" type="button" onClick={submit} disabled={!affordable || isConverting}>
        {isConverting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Coins aria-hidden="true" />}
        {t('ConvertPointsCard.change')} {points > 0 ? points.toLocaleString(intlLocale()) : ''} {t('ConvertPointsCard.points2')}
      </Button>
    </div>
  )
}
