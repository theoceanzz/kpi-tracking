import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ConductLevelDescriptions } from '../api/conductApi'
import { definedLevels } from '../utils/conductLevels'

/**
 * Bảng "định nghĩa theo mức điểm" của một tiêu chí trên phiếu chấm (V48), cao → thấp. Gập sẵn — mô tả của mức
 * ĐANG chọn đã hiện ngay dưới thang điểm; mở ra khi cần so các mức với nhau. Mức hai phía đã chọn được tô đậm.
 */
export default function ConductLevelGuide({
  levels, min, max, selfScore, managerScore, className,
}: {
  levels?: ConductLevelDescriptions | null
  min: number
  max: number
  selfScore?: number | null
  managerScore?: number | null
  className?: string
}) {
  const { t } = useTranslation('conduct')
  const [open, setOpen] = useState(false)
  const rows = definedLevels(levels, min, max)
  if (!rows.length) return null
  return (
    <div className={cn('mt-1.5', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-caption font-medium hover:text-[var(--color-info)] cursor-pointer"
      >
        {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        {t('ConductInlineSheet.levelGuide', { count: rows.length })}
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {rows.map(({ level, text }) => {
            const self = selfScore === level
            const manager = managerScore === level
            return (
              <li
                key={level}
                className={cn(
                  'flex items-start gap-2 rounded-control px-2 py-1 text-caption leading-relaxed',
                  (self || manager) && 'bg-[var(--color-muted)] text-[var(--color-foreground)]',
                )}
              >
                <span className="w-5 shrink-0 text-center font-semibold tabular-nums">{level}</span>
                <span className="min-w-0 flex-1 whitespace-pre-line">{text}</span>
                {self && <span className="shrink-0 text-eyebrow text-[var(--color-info)]">{t('ConductInlineSheet.self')}</span>}
                {manager && <span className="shrink-0 text-eyebrow text-[var(--color-primary)]">QLTT</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
