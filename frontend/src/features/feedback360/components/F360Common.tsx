import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import UserAvatar from '@/components/common/UserAvatar'
import { useDebounce } from '@/hooks/useDebounce'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { userApi } from '@/features/users/api/userApi'
import { cn } from '@/lib/utils'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import type { PickedUser } from '../utils/f360Format'
import {
  ASSIGNMENT_STATUS_LABEL,
  CAMPAIGN_STATUS_LABEL,
  type F360AssignmentStatus,
  type F360CampaignStatus,
} from '../api/feedback360Api'
import { useTranslation } from 'react-i18next'

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'

const CAMPAIGN_VARIANT: Record<F360CampaignStatus, BadgeVariant> = {
  DRAFT: 'secondary',
  NOMINATING: 'info',
  OPEN: 'info',
  CLOSED: 'warning',
  RELEASED: 'success',
}

const ASSIGNMENT_VARIANT: Record<F360AssignmentStatus, BadgeVariant> = {
  PENDING: 'secondary',
  IN_PROGRESS: 'info',
  SUBMITTED: 'success',
  DECLINED: 'warning',
  REMOVED: 'secondary',
  EXPIRED: 'destructive',
}

export function CampaignStatusBadge({ status }: { status: F360CampaignStatus }) {
  return <Badge variant={CAMPAIGN_VARIANT[status]}>{CAMPAIGN_STATUS_LABEL()[status]}</Badge>
}

export function AssignmentStatusBadge({ status }: { status: F360AssignmentStatus }) {
  return <Badge variant={ASSIGNMENT_VARIANT[status]}>{ASSIGNMENT_STATUS_LABEL()[status]}</Badge>
}

/**
 * Tìm và chọn người trong tổ chức. {@code multiple} = chọn nhiều (thêm người được đánh giá),
 * ngược lại chọn một (thêm người chấm).
 */
export function UserSearchPicker({
  selected,
  onChange,
  multiple = false,
  excludeIds = [],
}: {
  selected: PickedUser[]
  onChange: (users: PickedUser[]) => void
  multiple?: boolean
  excludeIds?: string[]
}) {
  const { t } = useTranslation('feedback360')
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounce(keyword.trim(), 300)
  const { data, isFetching } = useQuery({
    queryKey: ['feedback360', 'user-search', debounced],
    queryFn: () => userApi.getAll({ page: 0, size: 8, keyword: debounced || undefined }),
    staleTime: 30_000,
  })
  const selectedIds = new Set(selected.map(u => u.id))
  const results = (data?.content ?? []).filter(u => !excludeIds.includes(u.id))

  const toggle = (u: PickedUser) => {
    if (!multiple) return onChange([u])
    onChange(selectedIds.has(u.id) ? selected.filter(x => x.id !== u.id) : [...selected, u])
  }

  return (
    <div className="space-y-2">
      <Input
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        placeholder={t('F360Common.searchByNameOrEmail')}
        prefix={<Search size={14} />}
        type="search"
      />
      <div className="max-h-64 overflow-y-auto rounded-card border border-[var(--color-border)]">
        {results.length === 0 && (
          <p className="p-3 text-caption">{isFetching ? t('F360Common.searching') : t('F360Common.noResults')}</p>
        )}
        {results.map(u => {
          const on = selectedIds.has(u.id)
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle({ id: u.id, fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl })}
              className={cn(
                'flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--color-muted)]',
                on && 'bg-[var(--color-primary-soft)]',
              )}
            >
              <UserAvatar fullName={u.fullName} avatarUrl={u.avatarUrl} className="h-7 w-7 rounded-full text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.fullName}</span>
                <span className="block truncate text-caption">{u.email}</span>
              </span>
              {on && <Check size={16} className="text-[var(--color-primary)]" />}
            </button>
          )
        })}
      </div>
      {multiple && selected.length > 0 && (
        <p className="text-caption">{t('F360Common.selected')} {selected.length} {t('F360Common.people')}</p>
      )}
    </div>
  )
}

/** Chọn một đơn vị trong cây, hiển thị thụt lề theo cấp. */
export function OrgUnitSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation('feedback360')
  const { data: tree = [] } = useOrgUnitTree({ staleTime: 60_000 })
  const options = useMemo(() => {
    const out: { id: string; name: string; depth: number }[] = []
    const walk = (nodes: OrgUnitTreeResponse[], depth: number) => {
      nodes.forEach(n => {
        out.push({ id: n.id, name: n.name, depth })
        walk(n.children ?? [], depth + 1)
      })
    }
    walk(tree, 0)
    return out
  }, [tree])

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t('F360Common.chooseUnit')} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.id} value={o.id}>
            <span style={{ paddingLeft: o.depth * 12 }}>{o.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
