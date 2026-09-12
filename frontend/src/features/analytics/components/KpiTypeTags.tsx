import { cn } from '@/lib/utils'

type RelationType = 'DELEGATION' | 'DECOMPOSITION' | null | undefined

export interface KpiTypeTagsProps {
  isReverseKpi?: boolean | null
  isBonusKpi?: boolean | null
  /** KPI định tính (chấm theo mức, không có mục tiêu số). */
  isQualitative?: boolean | null
  /** Quan hệ của chính KPI với cha (DECOMPOSITION = KPI con, DELEGATION = KPI con thác nước). */
  parentRelationType?: RelationType
  /** Loại con của KPI (DECOMPOSITION = KPI cha, DELEGATION = KPI thác nước). */
  childRelationType?: RelationType
  /** KPI này thay thế một KPI cũ đã bị dừng. */
  isReplacement?: boolean | null
  className?: string
}

interface Tag {
  label: string
  className: string
}

/**
 * Render các tag loại KPI: KPI thường / thưởng / ngược / cha / con / thác nước.
 * Một KPI có thể mang nhiều tag (vd ngược + cha). Nếu không rơi vào loại đặc biệt nào → "KPI thường".
 */
export function KpiTypeTags({
  isReverseKpi,
  isBonusKpi,
  isQualitative,
  parentRelationType,
  childRelationType,
  isReplacement,
  className,
}: KpiTypeTagsProps) {
  const tags: Tag[] = []

  if (isQualitative) {
    tags.push({ label: 'KPI định tính', className: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' })
  }
  if (isBonusKpi) {
    tags.push({ label: 'KPI thưởng', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' })
  }
  if (isReverseKpi) {
    tags.push({ label: 'KPI ngược', className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]' })
  }
  if (childRelationType === 'DECOMPOSITION') {
    tags.push({ label: 'KPI cha', className: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' })
  } else if (childRelationType === 'DELEGATION') {
    tags.push({ label: 'KPI thác nước', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' })
  }
  if (isReplacement) {
    tags.push({ label: 'KPI thay thế', className: 'bg-[var(--color-border)] text-[var(--color-foreground)]' })
  }
  if (parentRelationType === 'DECOMPOSITION') {
    tags.push({ label: 'KPI con', className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]' })
  } else if (parentRelationType === 'DELEGATION') {
    tags.push({ label: 'KPI thác nước', className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' })
  }

  // Loại bỏ tag trùng nhãn (vd "KPI thác nước" có thể xuất hiện cả từ child lẫn parent).
  const seen = new Set<string>()
  const uniqueTags = tags.filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true)))

  if (uniqueTags.length === 0) {
    uniqueTags.push({ label: 'KPI thường', className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]' })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {uniqueTags.map((t) => (
        <span
          key={t.label}
          className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', t.className)}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

export default KpiTypeTags
