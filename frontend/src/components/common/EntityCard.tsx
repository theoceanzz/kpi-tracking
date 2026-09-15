import type { ReactNode, KeyboardEvent } from 'react'
import { MoreVertical } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface EntityCardMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  /** Hành động phá huỷ: tô đỏ, tách bằng đường kẻ. */
  destructive?: boolean
}

interface EntityCardProps {
  /** Icon/ảnh đại diện ở góc trái. */
  leading?: ReactNode
  title: string
  description?: string | null
  /** Hàng số liệu nhỏ dưới tiêu đề (vd "12 cột · 340 hàng"). */
  meta?: ReactNode
  /** Dòng cuối: trái (badge trạng thái / đơn vị) và phải (ngày). */
  footerLeft?: ReactNode
  footerRight?: ReactNode
  onOpen?: () => void
  menu?: EntityCardMenuItem[]
  className?: string
}

const menuItem = 'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]'

/**
 * Thẻ một bản ghi trong lưới (nguồn dữ liệu, báo cáo…) — UX_PATTERNS.md §R11.
 * Cả thẻ bấm được để mở; menu "…" luôn hiện (không ẩn chờ hover — trên cảm ứng không có hover)
 * và dừng nổi bọt để không mở thẻ khi bấm menu.
 */
export default function EntityCard({ leading, title, description, meta, footerLeft, footerRight, onOpen, menu, className }: EntityCardProps) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
  }
  const normal = menu?.filter(m => !m.destructive) ?? []
  const danger = menu?.filter(m => m.destructive) ?? []

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onKey}
      className={cn(
        'flex flex-col rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors',
        onOpen && 'cursor-pointer hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] [&_svg]:size-[18px]" aria-hidden="true">
            {leading}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-[var(--color-foreground)]" title={title}>{title}</h3>
          {description
            ? <p className="mt-0.5 truncate text-caption" title={description}>{description}</p>
            : <p className="mt-0.5 text-caption text-[var(--color-subtle-foreground)]">Không có mô tả</p>}
        </div>
        {menu && menu.length > 0 && (
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="-mr-1.5 -mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Thao tác" title="Thao tác"><MoreVertical aria-hidden="true" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-1">
                {normal.map(m => (
                  <button key={m.label} type="button" onClick={m.onClick} className={menuItem}>{m.icon}{m.label}</button>
                ))}
                {normal.length > 0 && danger.length > 0 && <div className="my-1 h-px bg-[var(--color-border)]" role="separator" />}
                {danger.map(m => (
                  <button key={m.label} type="button" onClick={m.onClick} className={cn(menuItem, 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] [&_svg]:text-[var(--color-error)]')}>{m.icon}{m.label}</button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {meta && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption tabular-nums">{meta}</div>}

      {(footerLeft || footerRight) && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-caption">
          <span className="min-w-0 truncate">{footerLeft}</span>
          <span className="shrink-0 tabular-nums">{footerRight}</span>
        </div>
      )}
    </div>
  )
}
