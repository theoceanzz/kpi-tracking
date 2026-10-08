import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MenuEntry =
  | { kind: 'item'; key: string; label: string; icon?: ReactNode; onSelect: () => void; disabled?: boolean; danger?: boolean }
  | { kind: 'submenu'; key: string; label: string; icon?: ReactNode; items: MenuEntry[]; disabled?: boolean }
  | { kind: 'separator'; key: string }

const itemCls =
  'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm outline-none transition-colors ' +
  'focus-visible:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'

/** Một tầng menu; menu con mở sang phải khi rê chuột / bấm / mũi tên phải. */
function MenuPanel({ items, onClose, autoFocus }: { items: MenuEntry[]; onClose: () => void; autoFocus?: boolean }) {
  const [openSub, setOpenSub] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [autoFocus])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > div > button:not(:disabled), :scope > button:not(:disabled)') ?? [])
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length]?.focus() }
  }

  return (
    <div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      className="w-72 rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] p-1 text-[var(--color-popover-foreground)] shadow-lg"
    >
      {items.map((entry) => {
        if (entry.kind === 'separator') {
          return <div key={entry.key} className="my-1 h-px bg-[var(--color-border)]" role="separator" />
        }
        if (entry.kind === 'submenu') {
          const open = openSub === entry.key
          return (
            <div
              key={entry.key}
              className="relative"
              onMouseEnter={() => !entry.disabled && setOpenSub(entry.key)}
              onMouseLeave={() => setOpenSub(null)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={entry.disabled}
                onClick={() => setOpenSub(open ? null : entry.key)}
                onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); setOpenSub(entry.key) } }}
                className={cn(itemCls, 'hover:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]', open && 'bg-[var(--color-muted)]')}
              >
                {entry.icon}
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <ChevronRight aria-hidden="true" />
              </button>
              {open && (
                <div
                  className="absolute left-full top-0 z-10 pl-1"
                  onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.stopPropagation(); setOpenSub(null) } }}
                >
                  <MenuPanel items={entry.items} onClose={onClose} autoFocus />
                </div>
              )}
            </div>
          )
        }
        return (
          <button
            key={entry.key}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => { onClose(); entry.onSelect() }}
            className={cn(
              itemCls,
              entry.danger
                ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)]'
                : 'hover:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]',
            )}
          >
            {entry.icon}
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Khoảng cách từ con trỏ tới góc menu. */
const GAP = 6

/**
 * Menu ngữ cảnh của một node trên khung vẽ, mở cạnh vị trí chuột (bấm trái hoặc phải đều mở).
 * Không có primitive context-menu trong dự án nên tự dựng: portal ra body, z-[1100] như
 * Popover, đóng khi bấm ra ngoài / Esc / cuộn khung vẽ, lật sang trái / lên trên khi sát mép.
 *
 * Menu KHÔNG BAO GIỜ phủ lên đúng điểm vừa bấm: bấm đúp một bước thì cú bấm thứ hai phải rơi vào
 * node (mở cài đặt), không rơi vào mục đầu tiên của menu vừa mở.
 */
export default function NodeMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  // Đo menu rồi đặt lại vị trí thẳng trên DOM (trước khi trình duyệt vẽ) — không cần render lại.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    // Chừa thêm chỗ cho menu con mở sang phải.
    let left = x + GAP
    if (left + rect.width + 288 > window.innerWidth - margin) left = x - rect.width - GAP
    let top = y + GAP
    if (top + rect.height > window.innerHeight - margin) top = y - rect.height - GAP
    el.style.left = `${Math.max(margin, left)}px`
    el.style.top = `${Math.max(margin, top)}px`
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="fixed z-[1100]" style={{ left: x + GAP, top: y + GAP }}>
      <MenuPanel items={items} onClose={onClose} autoFocus />
    </div>,
    document.body,
  )
}
