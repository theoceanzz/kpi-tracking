import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, CheckCircle2, CircleHelp, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AiReviewBasis } from '../api/aiReviewApi'

/** Đoạn gốc dài hơn thế này thì thu gọn 3 dòng, bấm để xem đủ. */
const LONG_EXCERPT = 220

/**
 * Căn cứ của nhận xét AI: dòng bộ tiêu chí hoặc đoạn quy chế, kèm ĐOẠN VĂN GỐC (khách chốt câu C4 — giữ đoạn gốc
 * để trích dẫn khi giải thích điểm). Đoạn gốc do hệ thống tra theo mã AI chọn, không phải chữ AI viết; nhãn
 * "Khớp tài liệu" cho biết đoạn đó đã được đối chiếu với tài liệu thật. Dùng chung cho màn chấm của quản lý và
 * khối tự soi của nhân viên.
 */
export default function AiBasisList({ basis }: { basis?: AiReviewBasis[] | null }) {
  const { t } = useTranslation('submissions')
  if (!basis?.length) return null
  return (
    <div className="space-y-1.5">
      <p className="font-medium text-[var(--color-foreground)]">{t('AiBasisList.basis')}</p>
      <ul className="space-y-1.5">
        {basis.map(b => <BasisItem key={b.ref} basis={b} />)}
      </ul>
    </div>
  )
}

function BasisItem({ basis: b }: { basis: AiReviewBasis }) {
  const { t } = useTranslation('submissions')
  const [open, setOpen] = useState(false)
  const long = (b.excerpt?.length ?? 0) > LONG_EXCERPT
  const Icon = b.kind === 'CRITERIA' ? ListChecks : BookOpen

  return (
    <li className="rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-2">
      <div className="flex items-start gap-2">
        <Icon size={14} className="mt-0.5 shrink-0 text-[var(--color-ai-accent)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--color-foreground)]">
            {b.title || (b.kind === 'CRITERIA' ? t('AiBasisList.criteriaRow') : t('AiBasisList.regulationPassage'))}
          </p>
          {b.source && <p className="truncate text-[11px] text-[var(--color-muted-foreground)]" title={b.source}>{b.source}</p>}
        </div>
        {b.verified ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
            <CheckCircle2 size={10} aria-hidden="true" /> {t('AiBasisList.matchesTheDocument')}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]"
                title={t('AiBasisList.notMatchedHint')}>
            <CircleHelp size={10} aria-hidden="true" /> {t('AiBasisList.notMatched')}
          </span>
        )}
      </div>
      {b.excerpt && (
        <blockquote className={cn(
          'mt-1.5 whitespace-pre-line border-l-2 border-[var(--color-ai-line)] pl-2 text-xs italic text-[var(--color-muted-foreground)]',
          long && !open && 'line-clamp-3',
        )}>
          {b.excerpt}
        </blockquote>
      )}
      {long && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                className="mt-1 rounded text-[11px] font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
          {open ? t('AiBasisList.collapse') : t('AiBasisList.showFullPassage')}
        </button>
      )}
    </li>
  )
}
