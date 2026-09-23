import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Thẻ gập được: header luôn hiện (icon, tiêu đề, một dòng tóm tắt, huy hiệu), thân mở ra
 * mới tốn chiều cao. Dùng cho những khối mà 80% thời gian người dùng chỉ cần đọc dòng tóm
 * tắt — mở ra khi thật sự cần làm gì đó bên trong.
 *
 * Header là một <button> nên bấm bất kỳ đâu trên đó cũng gập/mở; phần `actions` đứng ngoài
 * nút để bấm nút hành động không kéo theo việc gập thẻ.
 */
export default function CollapsibleCard({
  id, icon, iconClassName, title, summary, badge, actions, defaultOpen = false, className, children,
}: {
  id?: string
  icon: ReactNode
  iconClassName?: string
  title: ReactNode
  /** Một dòng dưới tiêu đề — phải đủ để người dùng quyết định có cần mở ra không. */
  summary?: ReactNode
  badge?: ReactNode
  /** Nút hành động ở header (không gập thẻ khi bấm). */
  actions?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className={cn('overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] scroll-mt-4', className)}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-card', iconClassName ?? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]')}>
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">{title}</span>
            {summary && <span className="block truncate text-caption">{summary}</span>}
          </span>
        </button>
        {badge && <span className="hidden shrink-0 sm:block">{badge}</span>}
        {actions && <span className="shrink-0">{actions}</span>}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Thu gọn' : 'Mở rộng'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
        >
          <ChevronDown size={16} aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && <div className="border-t border-[var(--color-border)] p-4 sm:p-5">{children}</div>}
    </section>
  )
}
