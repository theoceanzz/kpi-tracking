import { useTranslation } from 'react-i18next'
import { CalendarDays, Columns3, Filter, List, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import GroupedPicker from './GroupedPicker'
import { TASK_PRIORITIES, TASK_STATUSES, type TaskOption, type TaskDueFilter, type TaskGroupBy, type TaskPriority, type TaskSort, type TaskStatus } from '../types'
import { tourAnchor } from '@/components/common/tours/anchors'

export type TaskMode = 'list' | 'kanban' | 'calendar'

export interface TaskFilters {
  status: TaskStatus[]
  priority?: TaskPriority
  due?: TaskDueFilter
  kpiPeriodId?: string
  ownerId?: string
  keyword: string
}

interface Props {
  mode: TaskMode
  onMode: (m: TaskMode) => void
  groupBy: TaskGroupBy
  onGroupBy: (g: TaskGroupBy) => void
  sort: TaskSort
  onSort: (s: TaskSort) => void
  filters: TaskFilters
  onFilters: (f: TaskFilters) => void
  periods: { id: string; name: string }[]
  /** Người phụ trách để lọc — nhóm theo đơn vị. */
  owners: TaskOption[]
  /** KPI để lọc — nhóm theo đợt. */
  kpis: TaskOption[]
  kpiId?: string
  onKpi: (kpiId: string | null) => void
  onCreate: () => void
}

const DUES: TaskDueFilter[] = ['OVERDUE', 'TODAY', 'TOMORROW', 'WEEK', 'LATER', 'NONE']
const GROUPS: TaskGroupBy[] = ['due', 'kpi', 'status', 'owner', 'priority', 'none']
const SORTS: TaskSort[] = ['due', 'priority', 'created', 'manual']

/** Thanh công cụ trên danh sách: chế độ xem · nhóm theo · sắp xếp · bộ lọc (chip bỏ được) · tìm kiếm · tạo việc. */
export default function TaskToolbar(p: Props) {
  const { t } = useTranslation('tasks')
  const f = p.filters
  const set = (patch: Partial<TaskFilters>) => p.onFilters({ ...f, ...patch })
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...f.status.map((s) => ({ key: `s:${s}`, label: t(`status.${s}`), clear: () => set({ status: f.status.filter((x) => x !== s) }) })),
    ...(f.priority ? [{ key: 'p', label: t(`priority.${f.priority}`), clear: () => set({ priority: undefined }) }] : []),
    ...(f.due ? [{ key: 'd', label: t(`dueFilter.${f.due}`), clear: () => set({ due: undefined }) }] : []),
    ...(f.kpiPeriodId ? [{ key: 'k', label: p.periods.find((x) => x.id === f.kpiPeriodId)?.name ?? t('filter.period'), clear: () => set({ kpiPeriodId: undefined }) }] : []),
    ...(f.ownerId ? [{ key: 'o', label: p.owners.find((x) => x.id === f.ownerId)?.name ?? t('filter.owner'), clear: () => set({ ownerId: undefined }) }] : []),
    ...(p.kpiId ? [{ key: 'kpi', label: p.kpis.find((x) => x.id === p.kpiId)?.name ?? t('filter.kpi'), clear: () => p.onKpi(null) }] : []),
  ]
  const ALL = '__all__'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div {...tourAnchor('tasks.mode')} className="inline-flex rounded-card border border-[var(--color-border)] p-0.5">
          {([['list', List], ['kanban', Columns3], ['calendar', CalendarDays]] as const).map(([m, Icon]) => (
            <Button key={m} size="sm" variant={p.mode === m ? 'secondary' : 'ghost'} onClick={() => p.onMode(m)}>
              <Icon /> <span className="hidden sm:inline">{t(`mode.${m}`)}</span>
            </Button>
          ))}
        </div>
        {p.mode !== 'calendar' && (
          <Select value={p.groupBy} onValueChange={(v) => p.onGroupBy(v as TaskGroupBy)}>
            <SelectTrigger {...tourAnchor('tasks.group')} className="h-8 w-auto gap-1 text-xs"><span className="text-[var(--color-subtle-foreground)]">{t('toolbar.groupBy')}:</span> <SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUPS.filter((g) => p.mode !== 'kanban' || g !== 'none').map((g) => <SelectItem key={g} value={g}>{t(`groupBy.${g}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {p.mode === 'list' && (
          <Select value={p.sort} onValueChange={(v) => p.onSort(v as TaskSort)}>
            <SelectTrigger {...tourAnchor('tasks.sort')} className="h-8 w-auto gap-1 text-xs"><span className="text-[var(--color-subtle-foreground)]">{t('toolbar.sort')}:</span> <SelectValue /></SelectTrigger>
            <SelectContent>{SORTS.map((s) => <SelectItem key={s} value={s}>{t(`sort.${s}`)}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button {...tourAnchor('tasks.filter')} size="sm" variant={chips.length ? 'secondary' : 'ghost'}><Filter /> {t('toolbar.filter')}{chips.length ? ` (${chips.length})` : ''}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3 p-3" align="start">
            <div>
              <p className="mb-1 text-xs text-[var(--color-subtle-foreground)]">{t('filter.status')}</p>
              <div className="flex flex-wrap gap-1">
                {TASK_STATUSES.map((s) => (
                  <ChoiceChip key={s} size="sm" selected={f.status.includes(s)}
                    onClick={() => set({ status: f.status.includes(s) ? f.status.filter((x) => x !== s) : [...f.status, s] })}>
                    {t(`status.${s}`)}
                  </ChoiceChip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-[var(--color-subtle-foreground)]">{t('filter.due')}</p>
              <div className="flex flex-wrap gap-1">
                {DUES.map((d) => (
                  <ChoiceChip key={d} size="sm" selected={f.due === d} onClick={() => set({ due: f.due === d ? undefined : d })}>{t(`dueFilter.${d}`)}</ChoiceChip>
                ))}
              </div>
            </div>
            <Select value={f.priority ?? ALL} onValueChange={(v) => set({ priority: v === ALL ? undefined : (v as TaskPriority) })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filter.allPriorities')}</SelectItem>
                {TASK_PRIORITIES.map((x) => <SelectItem key={x} value={x}>{t(`priority.${x}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.kpiPeriodId ?? ALL} onValueChange={(v) => set({ kpiPeriodId: v === ALL ? undefined : v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filter.allPeriods')}</SelectItem>
                {p.periods.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <GroupedPicker size="sm" options={p.kpis} value={p.kpiId ?? null} onChange={p.onKpi} clearable clearLabel={t('filter.remove')}
              placeholder={t('filter.allKpis')} searchPlaceholder={t('picker.searchKpi')} collapseNonCurrent groupOrder="desc"
              moreLabel={(n) => t('picker.morePeriods', { count: n })} />
            {p.owners.length > 1 && (
              <GroupedPicker size="sm" people options={p.owners} value={f.ownerId ?? null} onChange={(v) => set({ ownerId: v ?? undefined })}
                clearable clearLabel={t('filter.remove')} placeholder={t('filter.allOwners')} searchPlaceholder={t('picker.searchPerson')} />
            )}
          </PopoverContent>
        </Popover>
        <div className="w-full sm:w-56">
          <Input {...tourAnchor('tasks.search')} size="sm" value={f.keyword} onChange={(e) => set({ keyword: e.target.value })} prefix={<Search size={14} />}
            placeholder={t('filter.search')} />
        </div>
        <div className="flex-1" />
        <Button {...tourAnchor('tasks.create')} size="sm" onClick={p.onCreate} title={t('toolbar.createHint')}><Plus /> {t('toolbar.create')}</Button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className={cn('inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs text-[var(--color-primary)]')}>
              {c.label}
              <button type="button" aria-label={t('filter.remove')} onClick={c.clear}><X size={11} /></button>
            </span>
          ))}
          <button type="button" className="text-xs text-[var(--color-subtle-foreground)] hover:underline"
            onClick={() => p.onFilters({ status: [], keyword: f.keyword })}>{t('filter.clearAll')}</button>
        </div>
      )}
    </div>
  )
}
