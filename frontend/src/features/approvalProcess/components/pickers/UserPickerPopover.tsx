import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/common/UserAvatar'
import { useDebounce } from '@/hooks/useDebounce'
import { usePeopleSearch } from './peopleSearch'
import { cn } from '@/lib/utils'
import type { PersonRef } from '../../types'
import { Chip, pickerTriggerCls } from './MultiSelectPopover'

/**
 * Chọn nhiều người trong tổ chức, tìm theo tên / email (giống bộ chọn của 360°). Người đã chọn hiện
 * thành chip có ảnh đại diện; tên lấy từ {@code value} nên không phải tải lại.
 */
export default function UserPickerPopover({
  value, onChange, placeholder, disabled, invalid,
}: {
  value: PersonRef[]
  onChange: (users: PersonRef[]) => void
  placeholder: string
  disabled?: boolean
  invalid?: boolean
}) {
  const { t } = useTranslation('approvalProcess')
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounce(keyword.trim(), 300)
  const peopleSearch = usePeopleSearch()
  const { data, isFetching } = useQuery({
    queryKey: ['approval-processes', 'user-search', peopleSearch.key, debounced],
    queryFn: () => peopleSearch.search(debounced),
    enabled: open,
    staleTime: 30_000,
  })
  const selected = new Set(value.map((u) => u.id))

  const toggle = (u: PersonRef) =>
    onChange(selected.has(u.id) ? value.filter((x) => x.id !== u.id) : [...value, u])

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setKeyword('') }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" aria-label={placeholder} className={cn(pickerTriggerCls, invalid && 'border-[var(--color-error)]')}>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {value.length === 0 && <span className="truncate text-[var(--color-muted-foreground)]">{placeholder}</span>}
            {value.map((u) => (
              <Chip
                key={u.id}
                removeLabel={t('pickers.remove', { name: u.name })}
                onRemove={disabled ? undefined : () => onChange(value.filter((x) => x.id !== u.id))}
              >
                {u.name}
              </Chip>
            ))}
          </span>
          <Search size={16} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <div className="border-b border-[var(--color-border)] p-2">
          <Input
            autoFocus
            size="sm"
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('pickers.searchPeople')}
            prefix={<Search size={14} aria-hidden="true" />}
          />
        </div>
        <div role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto p-1">
          {(data ?? []).length === 0 && (
            <p className="px-2.5 py-2 text-caption">{isFetching ? t('pickers.searching') : t('pickers.noResults')}</p>
          )}
          {(data ?? []).map((u) => {
            const on = selected.has(u.id)
            return (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle({ id: u.id, name: u.name, avatarUrl: u.avatarUrl })}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left hover:bg-[var(--color-muted)]',
                  on && 'bg-[var(--color-primary-soft)]',
                )}
              >
                <UserAvatar fullName={u.name} avatarUrl={u.avatarUrl} className="h-7 w-7 rounded-full text-xs" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-caption">{u.detail}</span>
                </span>
                {on && <Check size={16} aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
