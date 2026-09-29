import { intlLocale } from '@/i18n/format'
import { ArrowDownToLine, Coins, Sparkles } from 'lucide-react'
import BalanceHero from '@/components/common/BalanceHero'
import { formatCurrency } from '@/lib/utils'
import type { CashWallet } from '../types'
import { useTranslation } from 'react-i18next'

interface CashBalanceCardProps {
  wallet?: CashWallet
  loading?: boolean
}

export default function CashBalanceCard({ wallet, loading }: CashBalanceCardProps) {
  const { t } = useTranslation('wallet')
  const balance = wallet?.balance ?? 0
  const rate = wallet?.pointExchangeRate ?? 0
  const isEmpty = balance === 0 && (wallet?.lifetimeTopup ?? 0) === 0

  return (
    <BalanceHero
      loading={loading}
      label={t('CashBalanceCard.walletCashBalance')}
      value={formatCurrency(balance)}
      hint={isEmpty
        ? t('CashBalanceCard.topUpYourWalletToConvert')
        : <>{t('CashBalanceCard.canConvertUpTo')} <strong className="font-medium text-[var(--color-foreground)] tabular-nums">{(wallet?.convertiblePoints ?? 0).toLocaleString(intlLocale())} {t('CashBalanceCard.points')}</strong> {t('CashBalanceCard.atTheCurrentRate')}</>}
      tiles={[
        { label: t('CashBalanceCard.totalToppedUp'), value: formatCurrency(wallet?.lifetimeTopup), icon: ArrowDownToLine, tone: 'success' },
        { label: t('CashBalanceCard.convertedToPoints'), value: formatCurrency(wallet?.lifetimeConverted), icon: Coins, tone: 'info' },
        { label: t('CashBalanceCard.exchangeRate'), value: `${formatCurrency(rate)}/điểm`, hint: t('CashBalanceCard.setByTheCompanyMayChange'), icon: Sparkles, tone: 'neutral' },
      ]}
    />
  )
}
