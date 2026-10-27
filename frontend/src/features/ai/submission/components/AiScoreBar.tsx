import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useFormat } from '@/i18n/useFormat'

/**
 * Điểm AI dạng một thanh: phần tô = điểm / điểm tối đa, chữ "7,5 / 10" nằm trong thanh. Điểm AI chỉ chấm chất lượng bài
 * nộp, trên thang riêng do công ty đặt (13/10), nên thanh nói luôn "chất lượng bài này được mấy phần".
 */
export default function AiScoreBar({ score, max, compact = false, className }: {
  score: number
  max: number
  /** Dòng tóm tắt trên điện thoại: thanh ngắn hơn. */
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const n = (v: number) => fmt.number(v, { maximumFractionDigits: 1 })
  const pct = max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0
  const label = `${n(score)} / ${n(max)}`
  return (
    <span
      role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={score}
      aria-label={t('ScorerColumns.aiScoreAria', { score: n(score), max: n(max) })}
      className={cn('relative inline-flex h-6 shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[var(--color-ai-soft)] ring-1 ring-inset ring-[var(--color-ai-line)]', compact ? 'w-20' : 'w-28', className)}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--color-ai)_28%,transparent)]"
            style={{ width: `${pct}%` }} />
      <span className="relative text-xs font-semibold tabular-nums text-[var(--color-ai)]">{label}</span>
    </span>
  )
}
