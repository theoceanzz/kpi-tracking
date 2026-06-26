import { cn } from '@/lib/utils'

type RelationType = 'DELEGATION' | 'DECOMPOSITION' | null | undefined

export interface KpiTypeTagsProps {
  isReverseKpi?: boolean | null
  isBonusKpi?: boolean | null
  /** Quan hệ của chính KPI với cha (DECOMPOSITION = KPI con, DELEGATION = KPI con thác nước). */
  parentRelationType?: RelationType
  /** Loại con của KPI (DECOMPOSITION = KPI cha, DELEGATION = KPI thác nước). */
  childRelationType?: RelationType
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
  parentRelationType,
  childRelationType,
  className,
}: KpiTypeTagsProps) {
  const tags: Tag[] = []

  if (isBonusKpi) {
    tags.push({ label: 'KPI thưởng', className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' })
  }
  if (isReverseKpi) {
    tags.push({ label: 'KPI ngược', className: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' })
  }
  if (childRelationType === 'DECOMPOSITION') {
    tags.push({ label: 'KPI cha', className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' })
  } else if (childRelationType === 'DELEGATION') {
    tags.push({ label: 'KPI thác nước', className: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' })
  }
  if (parentRelationType === 'DECOMPOSITION') {
    tags.push({ label: 'KPI con', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' })
  } else if (parentRelationType === 'DELEGATION') {
    tags.push({ label: 'KPI thác nước', className: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' })
  }

  // Loại bỏ tag trùng nhãn (vd "KPI thác nước" có thể xuất hiện cả từ child lẫn parent).
  const seen = new Set<string>()
  const uniqueTags = tags.filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true)))

  if (uniqueTags.length === 0) {
    uniqueTags.push({ label: 'KPI thường', className: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {uniqueTags.map((t) => (
        <span
          key={t.label}
          className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase', t.className)}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

export default KpiTypeTags
