import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchableOption {
  value: string
  label: string
}

/** Bỏ dấu + đ→d + chữ thường: gõ "ba dinh" vẫn ra "Ba Đình". */
function foldVietnamese(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
}

/**
 * Ô chọn MỘT giá trị có ô tìm ở đầu danh sách — cho danh sách dài (tỉnh/thành, phường/xã…).
 * Không dùng `Select` của Radix vì nó chiếm phím gõ (typeahead) và kéo focus khỏi ô tìm. Khung cùng
 * cỡ với `SelectTrigger`; danh sách nằm trong `PopoverContent` (portal, z-[1100]) nên mở được
 * bên trong Dialog/Drawer.
 */
export default function SearchableSelect({
  value, onChange, options, placeholder, searchPlaceholder, emptyText, disabled, className, clearLabel,
}: {
  value: string | null | undefined
  onChange: (value: string | null) => void
  options: SearchableOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  disabled?: boolean
  className?: string
  /** Có thì thêm dòng đầu danh sách để bỏ chọn (trả về null). */
  clearLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = useMemo(() => {
    const q = foldVietnamese(query)
    return q ? options.filter(o => foldVietnamese(o.label).includes(q)) : options
  }, [options, query])

  const choose = (v: string | null) => {
    onChange(v)
    setOpen(false)
  }

  const move = (delta: number) => {
    const next = Math.max(0, Math.min(filtered.length - 1, active + delta))
    setActive(next)
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o)
        if (o) { setQuery(''); setActive(0) }
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm transition-colors hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
            selected ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]',
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-2">
        <Input
          autoFocus
          size="sm"
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
            else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active].value) }
          }}
          placeholder={searchPlaceholder}
          prefix={<Search className="h-3.5 w-3.5" aria-hidden="true" />}
          className="mb-2"
        />
        {clearLabel && !query && (
          <button
            type="button"
            onClick={() => choose(null)}
            className="mb-1 w-full rounded-control px-2 py-1.5 text-left text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          >
            {clearLabel}
          </button>
        )}
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-caption">{emptyText}</p>
        ) : (
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm',
                    i === active && 'bg-[var(--color-muted)]',
                    o.value === value && 'font-medium text-[var(--color-primary)]',
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
