import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface PickOption {
  value: string
  label: string
  /** Thụt lề (cây đơn vị). */
  depth?: number
  /** Dòng phụ nhỏ bên dưới nhãn. */
  hint?: string
  /** Tiêu đề nhóm phía trên mục này. */
  group?: string
}

/** Lớp của ô bấm — cùng thang 36px / viền / vòng focus với `SelectTrigger`. */
export const pickerTriggerCls =
  'flex min-h-9 w-full items-center gap-2 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-1 text-left text-sm ' +
  'text-[var(--color-foreground)] transition-colors hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] ' +
  'focus:border-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50'

export function Chip({ children, onRemove, removeLabel, icon }: { children: ReactNode; onRemove?: () => void; removeLabel?: string; icon?: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] py-0.5 pl-2 pr-1 text-xs font-medium">
      {icon && <span className="shrink-0 text-[var(--color-muted-foreground)] [&_svg]:size-3.5">{icon}</span>}
      <span className="truncate">{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label={removeLabel}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRemove() } }}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
        >
          <X size={12} aria-hidden="true" />
        </span>
      )}
    </span>
  )
}

/**
 * Chọn nhiều giá trị trong một danh sách có ô tìm (Select của shadcn không gõ tìm được và chỉ
 * chọn một). Giá trị đã chọn hiện thành chip trong ô bấm; danh sách ở popover z-[1100] nên mở
 * được trên Dialog.
 */
export default function MultiSelectPopover({
  options, value, onChange, placeholder, disabled, invalid, single, maxChips = 3, ariaLabel, className,
}: {
  options: PickOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  disabled?: boolean
  invalid?: boolean
  /** Chọn một: bấm mục là đóng. */
  single?: boolean
  maxChips?: number
  ariaLabel?: string
  className?: string
}) {
  const { t } = useTranslation('approvalProcess')
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return k ? options.filter((o) => o.label.toLowerCase().includes(k)) : options
  }, [options, keyword])
  const selected = new Set(value)

  const toggle = (v: string) => {
    if (single) {
      onChange([v])
      setOpen(false)
      return
    }
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  const shown = value.slice(0, maxChips)
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setKeyword('') }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel ?? placeholder}
          aria-invalid={invalid || undefined}
          className={cn(pickerTriggerCls, invalid && 'border-[var(--color-error)]', className)}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {value.length === 0 && <span className="truncate text-[var(--color-muted-foreground)]">{placeholder}</span>}
            {shown.map((v) => (
              <Chip
                key={v}
                removeLabel={t('pickers.remove', { name: byValue.get(v)?.label ?? v })}
                onRemove={disabled ? undefined : () => onChange(value.filter((x) => x !== v))}
              >
                {byValue.get(v)?.label ?? t('pickers.unknown')}
              </Chip>
            ))}
            {value.length > maxChips && (
              <span className="text-xs font-medium text-[var(--color-muted-foreground)]">+{value.length - maxChips}</span>
            )}
          </span>
          <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        {options.length > 7 && (
          <div className="border-b border-[var(--color-border)] p-2">
            <Input
              autoFocus
              size="sm"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('pickers.search')}
              prefix={<Search size={14} aria-hidden="true" />}
            />
          </div>
        )}
        <div role="listbox" aria-multiselectable={!single} className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && <p className="px-2.5 py-2 text-caption">{t('pickers.noResults')}</p>}
          {filtered.map((o, i) => {
            const on = selected.has(o.value)
            const showGroup = o.group && (i === 0 || filtered[i - 1]?.group !== o.group)
            return (
              <div key={o.value}>
                {showGroup && <p className="px-2.5 pb-1 pt-2 text-eyebrow text-[var(--color-muted-foreground)]">{o.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]',
                    on && 'bg-[var(--color-primary-soft)]',
                  )}
                  style={o.depth ? { paddingLeft: 10 + o.depth * 14 } : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-caption">{o.hint}</span>}
                  </span>
                  {on && <Check size={16} aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />}
                </button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
