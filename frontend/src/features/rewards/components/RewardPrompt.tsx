import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useState } from 'react'
import { Gift, Loader2, X, Check } from 'lucide-react'
import { useMyBudget, useRewardGrants } from '../hooks/useRewards'
import { useCanPromptReward } from '../hooks/useCanPromptReward'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

interface RewardPromptProps {
  userId: string
  fullName: string
  /** Gợi ý lý do, điền sẵn để người dùng chỉ việc sửa. Ví dụ tên kỳ đánh giá. */
  defaultReason?: string
  /** Gọi khi người dùng bỏ qua hoặc thưởng xong — để màn hình cha đóng/điều hướng tiếp. */
  onDone?: () => void
}

/**
 * Lời mời thưởng điểm ngay sau khi đánh giá xong.
 *
 * <p>Đặt ở đây vì đó là lúc người quản lý còn nhớ rõ nhất vì sao nhân viên xứng đáng —
 * bắt họ nhớ để vào màn hình khác thưởng sau là gần như chắc chắn sẽ quên.
 *
 * <p>Tự ẩn hoàn toàn khi tổ chức tắt tính năng thưởng hoặc người dùng không có quyền
 * trao — không làm phiền bằng một lời mời họ không dùng được. Lúc ẩn thì `onDone` KHÔNG
 * được gọi, nên màn hình cha phải hỏi {@link useCanPromptReward} trước khi chờ prompt này
 * để đóng.
 */
export default function RewardPrompt({
  userId,
  fullName,
  defaultReason,
  onDone,
}: RewardPromptProps) {
  const { t } = useTranslation('rewards')
  const [expanded, setExpanded] = useState(false)
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState<number | ''>('')
  const [reason, setReason] = useState(defaultReason ?? '')

  const canPrompt = useCanPromptReward()
  const { data: budget } = useMyBudget(expanded)
  const { createGrant, isCreating } = useRewardGrants({ size: 1 })

  // Không có quyền hoặc tổ chức tắt tính năng ⇒ biến mất hẳn, không chiếm chỗ.
  if (!canPrompt) return null

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm">
        <Check size={16} className="flex-shrink-0 text-[var(--color-success)]" />
        <span>
          {t('RewardPrompt.rewarded')} <b>{typeof points === 'number' ? points.toLocaleString(intlLocale()) : ''} {t('RewardPrompt.points')}</b> {t('RewardPrompt.to')}{' '}
          {fullName}.
        </span>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (typeof points !== 'number' || points <= 0 || !reason.trim()) return
    await createGrant({
      recipients: [{ userId, points }],
      reason: reason.trim(),
      pointsPerRecipient: points,
    })
    setDone(true)
    onDone?.()
  }

  if (!expanded) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3">
        <span className="flex items-center gap-2 text-sm">
          <Gift size={16} className="text-[var(--color-primary)]" />
          {t('RewardPrompt.rewardPointsTo')} <b>{fullName}</b>?
        </span>
        <div className="flex gap-2">
          <Button size="sm" type="button" onClick={() => setExpanded(true)}>
            {t('RewardPrompt.yes')}
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => onDone?.()}>
            {t('RewardPrompt.skip')}
          </Button>
        </div>
      </div>
    )
  }

  const canSubmit = typeof points === 'number' && points > 0 && reason.trim().length > 0

  return (
    <div className="space-y-3 rounded-card border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Gift size={16} className="text-[var(--color-primary)]" />
          {t('RewardPrompt.rewardPointsTo')} {fullName}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-control p-1 hover:bg-[var(--color-accent)]"
        >
          <X size={15} />
        </button>
      </div>

      {budget && (
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {t('RewardPrompt.budgetRemaining')} {budget.remainingPoints.toLocaleString(intlLocale())} {t('RewardPrompt.points')}
          {budget.maxPerAward != null && t('RewardPrompt.maxPointsPerson', { maxPerAward: budget.maxPerAward })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <LocaleNumberInput
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={t('RewardPrompt.points2')}
          className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm sm:w-32"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('RewardPrompt.rewardReason')}
          className="w-full flex-1 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
        />
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isCreating}>
          {isCreating && <Loader2 aria-hidden="true" className="animate-spin" />}
          {t('RewardPrompt.reward')}
        </Button>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        {t('RewardPrompt.theReasonAppearsInTheEmployees')}
      </p>
    </div>
  )
}
