import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Các khối dùng chung cho FORM CHẤM ĐIỂM (phiếu chốt kỳ, phiếu chấm đợt): nhóm có tiêu đề,
 * hàng "nhãn | ô nhập", thẻ số tham chiếu, dòng trục ma trận, khối gập được. Hai phiếu dùng
 * chung khuôn nên người chấm học một lần dùng cả hai.
 */

/** Một nhóm trong form chấm: tiêu đề nhỏ + gạch ngăn, để phần xem và phần nhập không lẫn nhau. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-[var(--color-border)] pb-1.5">
        <h3 className="text-eyebrow text-[var(--color-foreground)]">{title}</h3>
        {hint && <span className="text-caption">{hint}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/**
 * Một hàng "nhãn | ô nhập" trong khối chấm: nhãn + gợi ý bên trái (cố định 11rem trên màn
 * rộng), ô nhập bên phải. Ba thứ chấm được dùng chung khuôn này nên đọc như một biểu mẫu.
 */
export function ScoreRow({ label, hint, trailing, children }: {
  label: ReactNode; hint?: string; trailing?: ReactNode; children: ReactNode
}) {
  return (
    <div className="grid gap-2 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <div className="flex items-start justify-between gap-2 sm:block">
        <div>
          <p className="text-label">{label}</p>
          {hint && <p className="text-caption mt-0.5">{hint}</p>}
        </div>
        {trailing && <div className="sm:mt-1.5">{trailing}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Một con số tham chiếu trong khối "Cơ sở để chấm". */
export function RefStat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'primary' | 'warning' }) {
  return (
    <div className={cn(
      'rounded-card border px-3 py-2.5',
      tone === 'primary' ? 'border-[var(--color-border)] bg-[var(--color-primary-soft)]'
        : tone === 'warning' ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]'
        : 'border-[var(--color-border)] bg-[var(--color-muted)]'
    )}>
      <span className="text-eyebrow mb-0.5 block truncate" title={label}>{label}</span>
      <span className={cn(
        'block text-xl font-semibold tracking-tighter tabular-nums',
        tone === 'primary' ? 'text-[var(--color-primary)]'
          : tone === 'warning' ? 'text-[var(--color-warning)]'
          : 'text-[var(--color-foreground)]'
      )}>
        {value}
      </span>
    </div>
  )
}

/** Một trục của ma trận kèm nguồn số — "4.5/5 · từ hạnh kiểm" thay vì một con số không rõ ở đâu ra. */
export function AxisLine({ label, value, source }: { label: string; value: string | null; source: string | null }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="font-semibold tabular-nums text-[var(--color-foreground)]">{value ?? '—'}</dd>
      {source && <span className="truncate text-[var(--color-subtle-foreground)]">· từ {source}</span>}
    </div>
  )
}

/** Khối gập được trong modal — mặc định đóng, mở ra mới tốn chiều cao. */
export function Collapsible({ label, count, countLabel, children }: {
  label: string; count: number; countLabel: string; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-muted)]"
      >
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={cn('shrink-0 text-[var(--color-muted-foreground)] transition-transform', !open && '-rotate-90')}
        />
        <span className="text-sm font-medium text-[var(--color-foreground)]">{label}</span>
        <span className="text-caption ml-auto tabular-nums">{count} {countLabel}</span>
      </button>
      {open && <div className="border-t border-[var(--color-border)] p-3">{children}</div>}
    </div>
  )
}

