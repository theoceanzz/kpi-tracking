import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import type { TaskOption } from '../types'

interface Props {
  options: TaskOption[]
  value?: string | null
  onChange: (id: string | null) => void
  placeholder: string
  searchPlaceholder: string
  /** Người: hiện avatar. */
  people?: boolean
  /**
   * KPI: chỉ hiện nhóm ĐANG DIỄN RA (đợt hiện tại); các nhóm khác nằm sau nút "Hiện thêm". Đang tìm kiếm thì hiện hết.
   */
  collapseNonCurrent?: boolean
  /** Thứ tự nhóm theo {@code groupSort}: KPI mới trước (desc), đơn vị theo cây (asc). */
  groupOrder?: 'asc' | 'desc'
  moreLabel?: (count: number) => string
  emptyLabel?: string
  loading?: boolean
  disabled?: boolean
  /** Cho phép bỏ chọn (bộ lọc). */
  clearable?: boolean
  clearLabel?: string
  /** Chú thích thêm sau tên (vd. "(tôi)"). */
  labelOf?: (o: TaskOption) => string
  className?: string
  size?: 'sm' | 'default'
  align?: 'start' | 'end'
}

interface Group {
  key: string
  label: string
  current: boolean
  sort: string
  items: TaskOption[]
}

/**
 * Ô chọn có nhóm và ô tìm kiếm: người nhóm theo đơn vị, KPI nhóm theo đợt (đợt hiện tại trước, đợt khác bấm "Hiện
 * thêm"). Trông như {@code SelectTrigger}; danh sách trong popover (portal, z-[1100] — nổi trên modal).
 */
export default function GroupedPicker({
  options, value, onChange, placeholder, searchPlaceholder, people, collapseNonCurrent, groupOrder = 'asc', moreLabel,
  emptyLabel, loading, disabled, clearable, clearLabel, labelOf, className, size = 'default', align = 'start',
}: Props) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const selected = options.find((o) => o.id === value)
  const label = (o: TaskOption) => (labelOf ? labelOf(o) : o.name)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (o: TaskOption) => !needle || o.name.toLowerCase().includes(needle)
      || (o.secondary ?? '').toLowerCase().includes(needle) || (o.groupName ?? '').toLowerCase().includes(needle)
    const map = new Map<string, Group>()
    for (const o of options) {
      if (!match(o)) continue
      const key = o.groupId ?? '__none__'
      const g = map.get(key) ?? { key, label: o.groupName ?? t('picker.noGroup'), current: o.groupCurrent, sort: o.groupSort ?? '', items: [] }
      g.items.push(o)
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1
      const c = a.sort.localeCompare(b.sort)
      return groupOrder === 'desc' ? -c : c
    })
  }, [options, q, groupOrder, t])

  const searching = q.trim().length > 0
  // Nhóm hiện sẵn: đợt đang diễn ra; không có đợt nào đang diễn ra thì đợt gần nhất (nhóm đầu, đã xếp mới trước).
  const anyCurrent = groups.some((g) => g.current)
  const primaryKeys = new Set(anyCurrent ? groups.filter((g) => g.current).map((g) => g.key) : groups.slice(0, 1).map((g) => g.key))
  const hideOthers = collapseNonCurrent && !searching && !showAll && groups.length > primaryKeys.size
  const visible = hideOthers ? groups.filter((g) => primaryKeys.has(g.key)) : groups
  const hiddenCount = hideOthers ? groups.filter((g) => !primaryKeys.has(g.key)).reduce((n, g) => n + g.items.length, 0) : 0

  const pick = (id: string | null) => {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(''); setShowAll(false) } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full max-w-full items-center justify-between gap-2 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] transition-colors hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
            size === 'sm' ? 'h-8 text-xs' : 'h-9',
            className,
          )}
        >
          <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-[var(--color-muted-foreground)]')}>
            {selected && people && <UserAvatar fullName={selected.name} avatarUrl={selected.avatarUrl} className="h-5 w-5 rounded-full text-[9px]" />}
            <span className="truncate">{selected ? label(selected) : placeholder}</span>
            {selected?.groupName && !people && <span className="truncate text-xs text-[var(--color-subtle-foreground)]">· {selected.groupName}</span>}
          </span>
          {clearable && selected ? (
            <span role="button" tabIndex={0} aria-label={clearLabel} onClick={(e) => { e.stopPropagation(); pick(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); pick(null) } }}
              className="rounded p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]">
              <X size={13} />
            </span>
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-24px))] p-0" align={align}>
        <div className="border-b border-[var(--color-border)] p-2">
          <Input size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={searchPlaceholder} />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {loading && <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[var(--color-subtle-foreground)]" /></div>}
          {!loading && visible.length === 0 && <p className="px-3 py-4 text-center text-xs text-[var(--color-subtle-foreground)]">{emptyLabel ?? t('picker.empty')}</p>}
          {visible.map((g) => (
            <div key={g.key}>
              <div className="sticky top-0 z-[1] flex items-center gap-2 bg-[var(--color-popover,var(--color-card))] px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-subtle-foreground)]">
                <span className="truncate">{g.label}</span>
                {collapseNonCurrent && (g.current || (!anyCurrent && primaryKeys.has(g.key))) && (
                  <span className="rounded-full bg-[var(--color-primary-soft)] px-1.5 text-[10px] normal-case text-[var(--color-primary)]">
                    {g.current ? t('picker.currentPeriod') : t('picker.latestPeriod')}
                  </span>
                )}
                <span className="ml-auto font-normal normal-case">{g.items.length}</span>
              </div>
              {g.items.map((o) => (
                <button key={o.id} type="button" onClick={() => pick(o.id)}
                  className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-muted)]', o.id === value && 'bg-[var(--color-primary-soft)]')}>
                  {people && <UserAvatar fullName={o.name} avatarUrl={o.avatarUrl} className="h-6 w-6 shrink-0 rounded-full text-[9px]" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--color-foreground)]">{label(o)}</span>
                    {people && o.detail && <span className="block truncate text-[11px] text-[var(--color-subtle-foreground)]">{o.detail}</span>}
                  </span>
                  {o.id === value && <Check size={14} className="shrink-0 text-[var(--color-primary)]" />}
                </button>
              ))}
            </div>
          ))}
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAll(true)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]">
              <ChevronRight size={13} /> {moreLabel ? moreLabel(hiddenCount) : t('picker.showMore', { count: hiddenCount })}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
