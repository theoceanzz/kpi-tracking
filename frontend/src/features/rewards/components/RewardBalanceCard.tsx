import { intlLocale } from '@/i18n/format'
import { TrendingUp, ShoppingBag, AlertTriangle } from 'lucide-react'
import BalanceHero from '@/components/common/BalanceHero'
import type { RewardWallet } from '../types'
import { useTranslation } from 'react-i18next'
import AnimatedNumber from '../celebration/AnimatedNumber'
import { BALANCE_TARGET } from '../celebration/pointsFly'

interface RewardBalanceCardProps {
  wallet?: RewardWallet
  loading?: boolean
}

const fmt = (n?: number) => (n ?? 0).toLocaleString(intlLocale())

export default function RewardBalanceCard({ wallet, loading }: RewardBalanceCardProps) {
  const { t } = useTranslation('rewards')
  const balance = wallet?.balance ?? 0
  const isEmpty = balance === 0 && (wallet?.lifetimeEarned ?? 0) === 0

  return (
    <div className="space-y-3">
      <BalanceHero
        loading={loading}
        label={t('RewardBalanceCard.rewardPointBalance')}
        // Số dư tăng (điểm danh, được thưởng) thì chạy số sau khi "+N" bay tới; đây cũng là đích bay.
        value={<AnimatedNumber value={balance} format={fmt} celebrateTarget={BALANCE_TARGET} className="inline-block" />}
        unit={t('RewardBalanceCard.points')}
        negative={balance < 0}
        hint={isEmpty ? t('RewardBalanceCard.youGetPointsWhenYourManager') : undefined}
        tiles={[
          { label: t('RewardBalanceCard.totalReceived'), value: fmt(wallet?.lifetimeEarned), icon: TrendingUp, tone: 'success' },
          { label: t('RewardBalanceCard.totalUsed'), value: fmt(wallet?.lifetimeSpent), icon: ShoppingBag, tone: 'info' },
        ]}
      />

      {/* Số dư âm là dữ liệu thật (thưởng bị thu hồi sau khi đã tiêu), không phải lỗi —
          nói thẳng lý do thay vì để nhân viên hoang mang vì thấy số âm. */}
      {!loading && wallet?.negative && (
        <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {t('RewardBalanceCard.theBalanceIsNegativeBecauseA')}
          </span>
        </div>
      )}
    </div>
  )
}
