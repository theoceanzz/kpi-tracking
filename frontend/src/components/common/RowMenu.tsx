import { useRef, useState, type ReactNode } from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface RowMenuItem {
  key: string
  icon: ReactNode
  label: string
  /** Bỏ trống khi mục chỉ để mở menu con (`children`). */
  onSelect?: () => void
  danger?: boolean
  /** Kẻ một vạch phân cách TRƯỚC mục này. */
  separated?: boolean
  /**
   * Chỉ hiện trên màn hẹp (< sm): mục đã có nút riêng ngoài hàng trên màn rộng — trên điện thoại nút
   * đó bị ẩn nên menu phải gánh. Không có cờ này thì màn rộng thấy cùng một thao tác hai lần.
   */
  mobileOnly?: boolean
  /** Menu con bung sang bên cạnh ("Khác ›") — gom các mục ít dùng cho menu chính ngắn lại. */
  children?: RowMenuItem[]
}

const ITEM_CLS = 'flex h-8 w-full items-center gap-2.5 whitespace-nowrap rounded-control px-2.5 text-left text-sm transition-colors focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0'
const itemTone = (danger?: boolean) => danger
  ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] focus-visible:bg-[var(--color-error-bg)]'
  : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]'

/**
 * Menu "⋯" của một dòng (tài liệu, thư mục, bộ tiêu chí BSC…). Bấm không lan lên dòng (dòng bấm được để mở). Popover thay cho
 * DropdownMenu vì dự án chưa có component đó — cùng cách với menu hội thoại K.AI.
 */
export default function RowMenu({ items, label, className }: { items: RowMenuItem[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState<string | null>(null)
  const changeOpen = (o: boolean) => { setOpen(o); if (!o) setSub(null) }
  if (items.length === 0) return null
  // Màn rộng mà mọi mục đều đã có nút ngoài ⇒ ẩn luôn nút "⋯" (không mở ra một menu rỗng).
  const emptyOnDesktop = items.every(i => i.mobileOnly)
  const run = (item: RowMenuItem) => { changeOpen(false); item.onSelect?.() }
  return (
    <Popover open={open} onOpenChange={changeOpen}>
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
            emptyOnDesktop && 'sm:hidden',
            className,
          )}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      {/* Như Lark: menu mở BÊN CẠNH nút ⋯ và trượt lên / xuống cho vừa màn hình (mở phía dưới thì hàng cuối bảng không đủ
          chỗ, menu bị cắt). Chỉ màn quá thấp mới phải cuộn. */}
      <PopoverContent align="start" side="left" sideOffset={6} collisionPadding={8}
                      className="custom-scrollbar max-h-[var(--radix-popover-content-available-height)] w-auto min-w-52 max-w-80 overflow-y-auto p-1"
                      role="menu" onClick={e => e.stopPropagation()}>
        {items.map((item, index) => (
          <div key={item.key} className={cn(item.mobileOnly && 'sm:hidden')}
               onPointerEnter={() => setSub(item.children?.length ? item.key : null)}>
            {item.separated && (
              // Mọi mục phía trên đều chỉ hiện trên điện thoại ⇒ trên màn rộng vạch này đứng đầu menu: ẩn đi.
              <div role="separator" className={cn('mx-1 my-1 h-px bg-[var(--color-border)]',
                items.slice(0, index).every(i => i.mobileOnly) && 'sm:hidden')} />
            )}
            {item.children?.length
              ? <SubMenu item={item} open={sub === item.key} onOpenChange={o => setSub(o ? item.key : null)} onRun={run} />
              : (
                <button type="button" role="menuitem" onClick={() => run(item)} className={cn(ITEM_CLS, itemTone(item.danger))}>
                  {item.icon}{item.label}
                </button>
              )}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** Một mục "… ›" mở menu con sang bên cạnh: rê chuột hoặc bấm (điện thoại / bàn phím) đều mở. */
function SubMenu({ item, open, onOpenChange, onRun }: {
  item: RowMenuItem; open: boolean; onOpenChange: (open: boolean) => void; onRun: (item: RowMenuItem) => void
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <button ref={anchor} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open}
                onClick={() => onOpenChange(!open)}
                onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onOpenChange(true) } }}
                className={cn(ITEM_CLS, itemTone(), open && 'bg-[var(--color-muted)]')}>
          {item.icon}<span className="flex-1">{item.label}</span>
          <ChevronRight className="ml-2" aria-hidden="true" />
        </button>
      </PopoverAnchor>
      <PopoverContent side="left" align="start" sideOffset={6} collisionPadding={8}
                      className="custom-scrollbar max-h-[var(--radix-popover-content-available-height)] w-auto min-w-48 max-w-80 overflow-y-auto p-1"
                      role="menu" onClick={e => e.stopPropagation()}
                      // Rời khỏi menu con về lại menu chính thì menu chính tự đóng nó (onPointerEnter mục khác);
                      // bấm ra ngoài cả hai thì menu chính đóng luôn.
                      onInteractOutside={e => { if (anchor.current?.contains(e.target as Node)) e.preventDefault() }}>
        {item.children!.map(child => (
          <div key={child.key}>
            {child.separated && <div role="separator" className="mx-1 my-1 h-px bg-[var(--color-border)]" />}
            <button type="button" role="menuitem" onClick={() => onRun(child)} className={cn(ITEM_CLS, itemTone(child.danger))}>
              {child.icon}{child.label}
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
