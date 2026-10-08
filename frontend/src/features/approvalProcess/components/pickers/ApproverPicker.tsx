import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Briefcase, Building2, Check, Search, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ChoiceChip } from '@/components/ui/choice-chip'
import UserAvatar from '@/components/common/UserAvatar'
import { useDebounce } from '@/hooks/useDebounce'
import { userApi } from '@/features/users/api/userApi'
import { cn } from '@/lib/utils'
import type { ApproverSpec, ApproverType, PersonRef } from '../../types'
import type { ProcessOptions } from '../../hooks/useProcessOptions'
import { Chip, pickerTriggerCls } from './MultiSelectPopover'
import { approverKey, approverLabel } from './approverLabels'

const ICON: Record<ApproverType, typeof User> = {
  USER: User,
  ROLE: Briefcase,
  ORG_UNIT_HEAD: Building2,
  REQUESTER_MANAGER: ArrowUpRight,
}

type Tab = 'USER' | 'ROLE' | 'ORG_UNIT_HEAD' | 'REQUESTER_MANAGER'

/**
 * Chọn người duyệt của một bước: người cụ thể, chức vụ, trưởng một đơn vị, hoặc tương đối theo
 * người gửi (trưởng trực tiếp / cấp trên n bậc). Chọn được nhiều mục — ai trong nhóm bấm trước
 * thì được, như chuỗi duyệt hiện có.
 */
export default function ApproverPicker({
  value, onChange, options, users, onUsers, maxLevelsUp, disabled, invalid,
}: {
  value: ApproverSpec[]
  onChange: (value: ApproverSpec[]) => void
  options: ProcessOptions
  users: Record<string, PersonRef>
  onUsers: (people: PersonRef[]) => void
  maxLevelsUp: number
  disabled?: boolean
  invalid?: boolean
}) {
  const { t } = useTranslation('approvalProcess')
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('USER')
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounce(keyword.trim(), 300)
  const { data: people, isFetching } = useQuery({
    queryKey: ['approval-processes', 'user-search', debounced],
    queryFn: () => userApi.getAll({ page: 0, size: 10, keyword: debounced || undefined }),
    enabled: open && tab === 'USER',
    staleTime: 30_000,
  })

  const selected = useMemo(() => new Set(value.map(approverKey)), [value])
  const toggle = (spec: ApproverSpec) => {
    const k = approverKey(spec)
    onChange(selected.has(k) ? value.filter((a) => approverKey(a) !== k) : [...value, spec])
  }

  const filter = <T extends { label: string }>(list: T[]) => {
    const k = keyword.trim().toLowerCase()
    return k ? list.filter((o) => o.label.toLowerCase().includes(k)) : list
  }

  const row = (key: string, on: boolean, onClick: () => void, content: React.ReactNode, depth = 0) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={on}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]',
        on && 'bg-[var(--color-primary-soft)]',
      )}
      style={depth ? { paddingLeft: 10 + depth * 14 } : undefined}
    >
      <span className="min-w-0 flex-1">{content}</span>
      {on && <Check size={16} aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />}
    </button>
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'USER', label: t('approvers.tabUsers') },
    { key: 'ROLE', label: t('approvers.tabRoles') },
    { key: 'ORG_UNIT_HEAD', label: t('approvers.tabUnits') },
    { key: 'REQUESTER_MANAGER', label: t('approvers.tabRelative') },
  ]

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setKeyword('') }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={t('stepDialog.approversPlaceholder')}
          aria-invalid={invalid || undefined}
          className={cn(pickerTriggerCls, invalid && 'border-[var(--color-error)]')}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {value.length === 0 && (
              <span className="truncate text-[var(--color-muted-foreground)]">{t('stepDialog.approversPlaceholder')}</span>
            )}
            {value.map((a) => {
              const Icon = ICON[a.type]
              const label = approverLabel(a, t, options, users)
              return (
                <Chip
                  key={approverKey(a)}
                  icon={<Icon aria-hidden="true" />}
                  removeLabel={t('pickers.remove', { name: label })}
                  onRemove={disabled ? undefined : () => onChange(value.filter((x) => approverKey(x) !== approverKey(a)))}
                >
                  {label}
                </Chip>
              )
            })}
          </span>
          <Search size={16} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0">
        <div className="space-y-2 border-b border-[var(--color-border)] p-2">
          <div className="grid grid-cols-2 gap-1 rounded-card bg-[var(--color-muted)] p-1 sm:grid-cols-4" role="tablist">
            {tabs.map((x) => (
              <ChoiceChip
                key={x.key}
                variant="segment"
                size="sm"
                role="tab"
                aria-selected={tab === x.key}
                selected={tab === x.key}
                onClick={() => { setTab(x.key); setKeyword('') }}
                className="w-full"
              >
                <span className="truncate">{x.label}</span>
              </ChoiceChip>
            ))}
          </div>
          {tab !== 'REQUESTER_MANAGER' && (
            <Input
              autoFocus
              size="sm"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={tab === 'USER' ? t('pickers.searchPeople') : t('pickers.search')}
              prefix={<Search size={14} aria-hidden="true" />}
            />
          )}
        </div>
        <div role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto p-1">
          {tab === 'USER' && (
            <>
              {(people?.content ?? []).length === 0 && (
                <p className="px-2.5 py-2 text-caption">{isFetching ? t('pickers.searching') : t('pickers.noResults')}</p>
              )}
              {(people?.content ?? []).map((u) =>
                row(u.id, selected.has(`USER:${u.id}`), () => {
                  onUsers([{ id: u.id, name: u.fullName, avatarUrl: u.avatarUrl }])
                  toggle({ type: 'USER', userId: u.id })
                }, (
                  <span className="flex items-center gap-2.5">
                    <UserAvatar fullName={u.fullName} avatarUrl={u.avatarUrl} className="h-7 w-7 rounded-full text-xs" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.fullName}</span>
                      <span className="block truncate text-caption">{u.email}</span>
                    </span>
                  </span>
                )),
              )}
            </>
          )}
          {tab === 'ROLE' && (
            <>
              {filter(options.roles).length === 0 && <p className="px-2.5 py-2 text-caption">{t('pickers.noResults')}</p>}
              {filter(options.roles).map((r) =>
                row(r.value, selected.has(`ROLE:${r.value}`), () => toggle({ type: 'ROLE', roleId: r.value }),
                  <span className="block truncate">{r.label}</span>),
              )}
              <p className="px-2.5 pb-1 pt-2 text-caption">{t('approvers.roleHint')}</p>
            </>
          )}
          {tab === 'ORG_UNIT_HEAD' && (
            <>
              {filter(options.units).length === 0 && <p className="px-2.5 py-2 text-caption">{t('pickers.noResults')}</p>}
              {filter(options.units).map((u) =>
                row(u.value, selected.has(`ORG_UNIT_HEAD:${u.value}`), () => toggle({ type: 'ORG_UNIT_HEAD', orgUnitId: u.value }),
                  <span className="block truncate">{u.label}</span>, keyword ? 0 : u.depth),
              )}
            </>
          )}
          {tab === 'REQUESTER_MANAGER' && (
            <>
              {Array.from({ length: maxLevelsUp + 1 }, (_, levelsUp) =>
                row(String(levelsUp), selected.has(`REQUESTER_MANAGER:${levelsUp}`), () => toggle({ type: 'REQUESTER_MANAGER', levelsUp }),
                  <span className="block truncate">{t(`approvers.manager${levelsUp}`)}</span>),
              )}
              <p className="px-2.5 pb-1 pt-2 text-caption">{t('approvers.relativeHint')}</p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
