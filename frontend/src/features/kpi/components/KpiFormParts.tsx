import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'

/**
 * Khối nhỏ dùng chung cho các form CHỈ TIÊU (tạo/sửa, việc khẩn): ô có nhãn, dòng nhắc, thẻ
 * nguồn (hạng mục BSC / KR), công tắc KPI ngược / thưởng. Hai form dùng chung để người dùng
 * thấy một kiểu ở mọi chỗ tạo KPI.
 */

export function Field({ label, required, hint, error, trailing, prefilled, children }: {
  label: ReactNode; required?: boolean; hint?: string; error?: string; trailing?: ReactNode; prefilled?: boolean; children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-label flex items-center gap-1.5">
          {label}{required && <span className="text-[var(--color-error)]">*</span>}
          {prefilled && <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-info)]">từ nguồn</span>}
        </label>
        {trailing}
      </div>
      {children}
      {error ? <p className="text-xs font-medium text-[var(--color-error)]">{error}</p>
        : hint ? <p className="text-caption">{hint}</p> : null}
    </div>
  )
}

export function Hint({ tone, icon, children }: { tone: 'warning' | 'success' | 'info'; icon?: ReactNode; children: ReactNode }) {
  const cls = tone === 'warning' ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
    : tone === 'success' ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
    : 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info)]'
  return (
    <p className={cn('flex items-start gap-2 rounded-card border px-3 py-2 text-xs font-medium leading-relaxed', cls)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span>{children}</span>
    </p>
  )
}

/** Thẻ tóm tắt nguồn (hạng mục BSC / KR): tên + vài con số để đối chiếu với ô nhập bên dưới. */
export function SourceCard({ color, title, subtitle, children }: { color: string; title: string; subtitle?: string | null; children: ReactNode }) {
  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">{title}</span>
        {subtitle && <span className="truncate text-caption">· {subtitle}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">{children}</dl>
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption truncate" title={label}>{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-[var(--color-foreground)]">{value}</dd>
      {hint && <dd className="text-caption truncate" title={hint}>{hint}</dd>}
    </div>
  )
}

export function ToggleCard({ on, onToggle, tone, title, desc }: { on: boolean; onToggle: () => void; tone: 'warning' | 'success'; title: string; desc: string }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on}
      className={cn('flex min-w-[240px] flex-1 items-center justify-between gap-3 rounded-card border px-3 py-2 text-left transition-colors',
        on ? (tone === 'warning' ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]' : 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]')
          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]')}>
      <span className="min-w-0">
        <span className={cn('block text-sm font-medium', on && (tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'))}>{title}</span>
        <span className="text-caption block">{desc}</span>
      </span>
      <Switch checked={on} onCheckedChange={onToggle} size="sm" tabIndex={-1} />
    </button>
  )
}

