import { useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface RowMenuItem {
  key: string
  icon: ReactNode
  label: string
  onSelect: () => void
  danger?: boolean
  /** Kẻ một vạch phân cách TRƯỚC mục này. */
  separated?: boolean
}

/**
 * Menu "⋯" của một dòng tài liệu / thư mục. Bấm không lan lên dòng (dòng bấm được để mở). Popover thay cho
 * DropdownMenu vì dự án chưa có component đó — cùng cách với menu hội thoại K.AI.
 */
export default function RowMenu({ items, label, className }: { items: RowMenuItem[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          onClick={e => e.stopPropagation()}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-control text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            open && 'bg-[var(--color-muted)] text-[var(--color-foreground)]',
            className,
          )}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-56 p-1.5" role="menu" onClick={e => e.stopPropagation()}>
        {items.map(item => (
          <div key={item.key}>
            {item.separated && <div className="my-1.5 h-px bg-[var(--color-border)]" role="separator" />}
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onSelect() }}
              className={cn(
                'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0',
                item.danger
                  ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] focus-visible:bg-[var(--color-error-bg)]'
                  : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]',
              )}
            >
              {item.icon}{item.label}
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
