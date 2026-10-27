import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { AiConfidenceReason, AiReviewConfidence } from '../api/aiReviewApi'

const ORDER: AiReviewConfidence[] = ['THAP', 'TRUNG_BINH', 'CAO']
const TONE: Record<AiReviewConfidence, string> = {
  THAP: 'var(--color-error)',
  TRUNG_BINH: 'var(--color-warning)',
  CAO: 'var(--color-success)',
}
const HEIGHTS = { sm: [6, 10, 14], md: [8, 14, 20] } as const
const WIDTH = { sm: 4, md: 6 } as const

/**
 * Mức tin cậy của AI dạng ba cột cao dần (như vạch sóng): số cột được tô là mức hiện tại. Mức đi theo CHẤT LƯỢNG AI
 * chấm (07/10): dưới 50% thang chất lượng là Thấp, 50–74% Trung bình, từ 75% Cao. `sm` cho ô bảng (chỉ có cột, chữ
 * nằm ở title); `md` cho hộp chi tiết, kèm tên mức và lý do.
 */
export default function AiConfidenceBars({ level, size = 'sm', title, reasons, qualityLevel, className }: {
  level?: AiReviewConfidence | null
  size?: 'sm' | 'md'
  /** Nhãn đứng trước cột ở cỡ `md` — mặc định "Tin cậy". */
  title?: string
  reasons?: AiConfidenceReason[]
  /** Mức chất lượng AI chấm — ghép vào câu lý do "AI chấm chất lượng ở mức …". */
  qualityLevel?: string | null
  className?: string
}) {
  const { t, i18n } = useTranslation('submissions')
  if (!level) return null
  // Mã lý do không có khoá dịch (backend và giao diện lệch bản) thì bỏ qua — không bao giờ in mã thô ra màn hình.
  const shownReasons = (reasons ?? []).filter(r => i18n.exists(`submissions:AiConfidence.reasons.${r}`))
  const rank = ORDER.indexOf(level) + 1
  const name = t(`AiConfidence.levels.${level}`)
  const label = t('AiConfidence.aria', { level: name, rank, total: ORDER.length })

  const bars = (
    <span role="img" aria-label={label} title={label} className={cn('inline-flex shrink-0 items-end gap-0.5', size === 'sm' && className)}>
      {HEIGHTS[size].map((h, i) => (
        <span
          key={i}
          className="rounded-sm"
          style={{ width: WIDTH[size], height: h, backgroundColor: i < rank ? TONE[level] : 'var(--color-border)' }}
        />
      ))}
    </span>
  )
  if (size === 'sm') return bars

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-end gap-2">
        <span className="text-xs text-[var(--color-muted-foreground)]">{title ?? t('AiConfidence.label')}</span>
        {bars}
        <span className="text-sm font-semibold leading-none" style={{ color: TONE[level] }}>{name}</span>
      </div>
      {!!shownReasons.length && (
        <div>
          <p className="text-xs font-medium text-[var(--color-foreground)]">{t('AiConfidence.why')}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-xs text-[var(--color-muted-foreground)]">
            {shownReasons.map(r => (
              <li key={r}>{t(`AiConfidence.reasons.${r}`, { level: qualityLevel ?? '-' })}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
