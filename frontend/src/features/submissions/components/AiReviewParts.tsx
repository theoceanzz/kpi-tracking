import type { ReactNode } from 'react'
import { FileWarning, Quote, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Mảnh giao diện dùng chung cho mọi khối "AI đọc bài": màn chấm của quản lý (AiReviewPanel) và trang nộp bài của
 * nhân viên (AiSelfCheckPanel) — để hai nơi trông như một tính năng. Chữ luôn nhận qua props, mảnh không tự viết chữ.
 */

const CHIP_TONE = {
  warning: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  neutral: 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
} as const

/** Khung: viền tông AI, đầu khối có biểu tượng + tiêu đề + nhãn, nút hành động bên phải. */
export function AiPanelShell({ title, chip, chipTone = 'warning', action, children, className }: {
  title: string
  chip?: ReactNode
  chipTone?: keyof typeof CHIP_TONE
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-card border border-[var(--color-ai-line)] bg-[var(--color-card)]', className)}
             aria-live="polite">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-ai)]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
          {chip && (
            <span className={cn('inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-xs font-medium',
              CHIP_TONE[chipTone])}>
              {chip}
            </span>
          )}
        </div>
        {action}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

/** Vùng chi tiết của một chỉ tiêu (nền xám nhạt dưới dòng tên chỉ tiêu). */
export function AiItemDetail({ children }: { children: ReactNode }) {
  return <div className="space-y-2 bg-[var(--color-muted)] px-3 py-3 text-sm">{children}</div>
}

export function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="font-medium text-[var(--color-foreground)]">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-[var(--color-muted-foreground)]">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  )
}

/** Câu trích nguyên văn từ bài (chữ người nộp viết hoặc nội dung tệp) — căn cứ của nhận xét. */
export function QuoteList({ quotes }: { quotes: string[] }) {
  if (!quotes.length) return null
  return (
    <div className="space-y-1">
      {quotes.map((q, i) => (
        <p key={i} className="flex items-start gap-1.5 text-xs italic text-[var(--color-muted-foreground)]">
          <Quote size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {q}
        </p>
      ))}
    </div>
  )
}

/** Tệp AI không đọc được — luôn nêu tên, để người đọc tự mở xem. */
export function UnreadableFiles({ label, files }: { label: string; files: string[] }) {
  if (!files.length) return null
  return (
    <div className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
      <FileWarning size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p>{label}</p>
        <ul className="mt-0.5 list-disc pl-4">
          {files.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
    </div>
  )
}
