import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownUp, CalendarDays, Check, CheckSquare, ChevronDown, Columns3, Download, FileSpreadsheet, Filter, FolderPlus, GanttChart, Gauge, History,
  ListChecks, Loader2, MoreHorizontal, Plus, Search, SlidersHorizontal, Table2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import GroupedPicker from './GroupedPicker'
import { TagChip } from './TaskBits'
import { CUSTOMIZE_EVENT, OPEN_STATUSES, statusPreset, TOGGLE_ON } from '../taskUtils'
import {
  TASK_MODES, TASK_PRIORITIES, TASK_STATUSES, type TaskDueFilter, type TaskMode, type TaskGroupBy, type TaskListDetail, type TaskOption, type TaskPriority,
  type TaskSort, type TaskStatus, type TaskTag,
} from '../types'
import { tourAnchor } from '@/components/common/tours/anchors'

export type { TaskMode } from '../types'

export interface TaskFilters {
  status: TaskStatus[]
  priority?: TaskPriority
  due?: TaskDueFilter
  kpiPeriodId?: string
  ownerId?: string
  keyword: string
  tagIds?: string[]
  /** undefined = mọi việc; true = có KPI; false = không gắn KPI. */
  hasKpi?: boolean
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
  /** "Nhóm mới" trong menu ▾ của nút Tạo việc (khi đang nhóm theo nhóm của danh sách / nhóm của tôi). */
  onCreateGroup?: () => void
  /** "Nhập từ Excel" trong menu ▾ (danh sách sửa được). */
  onImport?: () => void
  /** Danh sách đang xem: thêm nhóm theo "Nhóm" / trường tuỳ chỉnh, sắp theo trường, tab Bảng điều khiển / Hoạt động. */
  list?: TaskListDetail | null
  tags: TaskTag[]
  /** Chọn nhiều để thao tác hàng loạt. */
  selecting: boolean
  onSelecting: (v: boolean) => void
  onExport: () => Promise<void>
  /** Lưu chế độ xem hiện tại (chế độ, nhóm, sắp xếp, bộ lọc). */
  onSaveView: (name: string, shared: boolean) => void
  /** Đang ở chế độ xem không cho tạo (Đã hoàn thành, Đơn vị, danh sách chỉ xem). */
  canCreate?: boolean
  /** Chia sẻ chế độ xem cho thành viên danh sách — chỉ khi đang trong danh sách và mình là biên tập trở lên. */
  canShareView?: boolean
  /** Ẩn ô "Đang làm ▾" (trang Đã hoàn thành đã lọc sẵn). */
  hideStatus?: boolean
}

const DUES: TaskDueFilter[] = ['OVERDUE', 'TODAY', 'TOMORROW', 'WEEK', 'LATER', 'NONE']
const GROUPS: TaskGroupBy[] = ['due', 'mysection', 'kpi', 'status', 'owner', 'priority', 'tag', 'none']
const SORTS: TaskSort[] = ['manual', 'due', 'start', 'priority', 'created', 'updated', 'title']
const MODE_ICON: Record<TaskMode, typeof Table2> = {
  list: Table2, kanban: Columns3, calendar: CalendarDays, gantt: GanttChart, stats: Gauge, activity: History,
}

/** Nút chữ trên thanh công cụ kiểu Lark: icon + chữ xám, nền khi rê / đang bật. */
const toolBtn = 'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'

/**
 * Thanh công cụ theo đúng Lark (docs/TASKS_LARK_REFERENCE.md): hàng tab chế độ (Danh sách · Kanban — KeyGo thêm Lịch,
 * Gantt; trong một danh sách thêm Bảng điều khiển · Hoạt động); hàng dưới: trái "+ Tạo việc ▾"; phải "Đang làm ▾" · Lọc ·
 * Sắp xếp: … · Nhóm theo: … · Tuỳ chỉnh · Lưu chế độ xem; tìm kiếm thu gọn và "···" (Chọn nhiều, Xuất Excel) là của KeyGo.
 */
export default function TaskToolbar(p: Props) {
  const { t } = useTranslation('tasks')
  const f = p.filters
  const set = (patch: Partial<TaskFilters>) => p.onFilters({ ...f, ...patch })
  const [exporting, setExporting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const tagIds = f.tagIds ?? []
  // Số điều kiện lọc ngoài trạng thái (trạng thái có ô "Đang làm ▾" riêng như Lark).
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(f.priority ? [{ key: 'p', label: t(`priority.${f.priority}`), clear: () => set({ priority: undefined }) }] : []),
    ...(f.due ? [{ key: 'd', label: t(`dueFilter.${f.due}`), clear: () => set({ due: undefined }) }] : []),
    ...(f.kpiPeriodId ? [{ key: 'k', label: p.periods.find((x) => x.id === f.kpiPeriodId)?.name ?? t('filter.period'), clear: () => set({ kpiPeriodId: undefined }) }] : []),
    ...(f.ownerId ? [{ key: 'o', label: p.owners.find((x) => x.id === f.ownerId)?.name ?? t('filter.owner'), clear: () => set({ ownerId: undefined }) }] : []),
    ...(p.kpiId ? [{ key: 'kpi', label: p.kpis.find((x) => x.id === p.kpiId)?.name ?? t('filter.kpi'), clear: () => p.onKpi(null) }] : []),
    ...tagIds.map((id) => ({ key: `tag:${id}`, label: `#${p.tags.find((x) => x.id === id)?.name ?? '?'}`, clear: () => set({ tagIds: tagIds.filter((x) => x !== id) }) })),
    ...(f.hasKpi !== undefined ? [{ key: 'hk', label: t(f.hasKpi ? 'filter.withKpi' : 'filter.withoutKpi'), clear: () => set({ hasKpi: undefined }) }] : []),
  ]
  const ALL = '__all__'
  const modes = TASK_MODES.filter((m) => (m !== 'stats' && m !== 'activity') || !!p.list)
  // Trường nhóm được: chọn một / đánh dấu (giá trị rời rạc). Trường sắp được: mọi kiểu trừ chọn nhiều / người.
  const groupFields = (p.list?.fields ?? []).filter((x) => x.type === 'SINGLE_SELECT' || x.type === 'CHECKBOX')
  const sortFields = (p.list?.fields ?? []).filter((x) => x.type !== 'MULTI_SELECT' && x.type !== 'MEMBER')
  const showGroup = p.mode === 'list' || p.mode === 'kanban' || p.mode === 'gantt'
  const groupLabel = (g: TaskGroupBy) => g.startsWith('field:')
    ? p.list?.fields.find((x) => `field:${x.id}` === g)?.name ?? '?'
    : t(`groupBy.${g}`)
  const sortLabel = p.sort.startsWith('field:') ? p.list?.fields.find((x) => `field:${x.id}` === p.sort)?.name ?? '?' : t(`sort.${p.sort}`)
  const preset = statusPreset(f.status)
  const toolbarModes = p.mode !== 'stats' && p.mode !== 'activity'
  const searchShown = searchOpen || !!f.keyword

  return (
    <div className="space-y-2">
      {/* Tab chế độ xem, gạch chân như Lark. Chỉ cuộn ngang khi hẹp, không bao giờ cuộn dọc, ẩn thanh cuộn; vạch đáy vẽ
          bằng bóng trong (gạch chân tab đè lên được mà không lấn ra ngoài khung — lấn ra là hiện thanh cuộn dọc ▲▼). */}
      <div {...tourAnchor('tasks.mode')} role="tablist"
        className="flex items-end overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {modes.map((m) => {
          const Icon = MODE_ICON[m]
          const on = p.mode === m
          return (
            <button key={m} type="button" role="tab" aria-selected={on} onClick={() => p.onMode(m)} title={t(`mode.${m}`)}
              className={cn('inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[15px] transition-colors',
                on ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-foreground)] hover:text-[var(--color-primary)]')}>
              <Icon size={16} /> <span className="hidden sm:inline">{t(`mode.${m}`)}</span>
            </button>
          )
        })}
      </div>

      {toolbarModes && (
        <div className="flex flex-wrap items-center gap-1">
          {/* "+ Tạo việc ▾" (nút viền tách mũi tên) */}
          {p.canCreate !== false && (
            <div className="mr-2 inline-flex h-8 overflow-hidden rounded-md border border-[var(--color-border-strong)]">
              <button {...tourAnchor('tasks.create')} type="button" onClick={p.onCreate} title={t('toolbar.createHint')}
                className="inline-flex items-center gap-1 px-2.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]">
                <Plus size={15} /> {t('toolbar.create')}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label={t('toolbar.createMore')}
                    className="border-l border-[var(--color-border-strong)] px-1.5 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]"><ChevronDown size={15} /></button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1" align="start">
                  <MenuBtn icon={<Plus size={15} />} onClick={p.onCreate}>{t('toolbar.create')}</MenuBtn>
                  {p.onCreateGroup && <MenuBtn icon={<FolderPlus size={15} />} onClick={p.onCreateGroup}>{t('toolbar.newGroup')}</MenuBtn>}
                  {p.onImport && <MenuBtn icon={<FileSpreadsheet size={15} />} onClick={p.onImport}>{t('import.button')}</MenuBtn>}
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="ml-auto flex items-center justify-end gap-0.5 overflow-x-auto">
            {/* Đang làm / Đã hoàn thành / Tất cả việc */}
            {!p.hideStatus && (
              <Popover>
                <PopoverTrigger asChild>
                  <button {...tourAnchor('tasks.status')} type="button" className={toolBtn}><ListChecks size={15} /> {t(`statusPreset.${preset}`)}</button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {(['ongoing', 'completed', 'all'] as const).map((k) => (
                    <MenuBtn key={k} onClick={() => set({ status: k === 'ongoing' ? [...OPEN_STATUSES] : k === 'completed' ? ['DONE'] : [] })}
                      trailing={preset === k ? <Check size={14} className="text-[var(--color-primary)]" /> : undefined}
                      active={preset === k}>{t(`statusPreset.${k}`)}</MenuBtn>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* Lọc */}
            <Popover>
              <PopoverTrigger asChild>
                <button {...tourAnchor('tasks.filter')} type="button" className={cn(toolBtn, chips.length > 0 && cn(TOGGLE_ON, 'text-[var(--color-primary)]'))}>
                  <Filter size={15} /> {t('toolbar.filter')}{chips.length ? ` ${chips.length}` : ''}
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-h-[70vh] w-80 space-y-3 overflow-y-auto p-3" align="end">
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
                <div>
                  <p className="mb-1 text-xs text-[var(--color-subtle-foreground)]">{t('filter.kpiLink')}</p>
                  <div className="flex flex-wrap gap-1">
                    <ChoiceChip size="sm" selected={f.hasKpi === true} onClick={() => set({ hasKpi: f.hasKpi === true ? undefined : true })}>{t('filter.withKpi')}</ChoiceChip>
                    <ChoiceChip size="sm" selected={f.hasKpi === false} onClick={() => set({ hasKpi: f.hasKpi === false ? undefined : false })}>{t('filter.withoutKpi')}</ChoiceChip>
                  </div>
                </div>
                {p.tags.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-[var(--color-subtle-foreground)]">{t('filter.tags')}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((g) => (
                        <button key={g.id} type="button" onClick={() => set({ tagIds: tagIds.includes(g.id) ? tagIds.filter((x) => x !== g.id) : [...tagIds, g.id] })}
                          className={cn('rounded-full', tagIds.includes(g.id) && 'ring-2 ring-[var(--color-ring)]')}>
                          <TagChip tag={g} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                {chips.length > 0 && (
                  <button type="button" className="text-xs text-[var(--color-subtle-foreground)] hover:underline"
                    onClick={() => { p.onFilters({ status: f.status, keyword: f.keyword }); if (p.kpiId) p.onKpi(null) }}>{t('filter.clearAll')}</button>
                )}
              </PopoverContent>
            </Popover>

            {/* Sắp xếp: … */}
            {(p.mode === 'list' || p.mode === 'kanban') && (
              <Select value={p.sort} onValueChange={(v) => p.onSort(v as TaskSort)}>
                <SelectTrigger {...tourAnchor('tasks.sort')} className={cn(toolBtn, 'w-auto border-transparent bg-transparent shadow-none [&>svg:last-child]:hidden')}>
                  <ArrowDownUp size={15} /> {t('toolbar.sort')}: <SelectValue>{sortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => <SelectItem key={s} value={s}>{t(`sort.${s}`)}</SelectItem>)}
                  {sortFields.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t('groupBy.fields')}</SelectLabel>
                      {sortFields.map((x) => <SelectItem key={x.id} value={`field:${x.id}`}>{x.name}</SelectItem>)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Nhóm theo: … */}
            {showGroup && (
              <Select value={p.groupBy} onValueChange={(v) => p.onGroupBy(v as TaskGroupBy)}>
                <SelectTrigger {...tourAnchor('tasks.group')} className={cn(toolBtn, 'w-auto border-transparent bg-transparent shadow-none [&>svg:last-child]:hidden')}>
                  <Columns3 size={15} className="rotate-90" /> {t('toolbar.groupBy')}: <SelectValue>{groupLabel(p.groupBy)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {p.list && <SelectItem value="section">{t('groupBy.section')}</SelectItem>}
                  {GROUPS.filter((g) => p.mode !== 'kanban' || g !== 'none').map((g) => <SelectItem key={g} value={g}>{t(`groupBy.${g}`)}</SelectItem>)}
                  {groupFields.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t('groupBy.fields')}</SelectLabel>
                      {groupFields.map((x) => <SelectItem key={x.id} value={`field:${x.id}`}>{x.name}</SelectItem>)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Tuỳ chỉnh (cột) — mở hộp ở đầu bảng */}
            {p.mode === 'list' && (
              <button type="button" className={toolBtn} onClick={() => window.dispatchEvent(new CustomEvent(CUSTOMIZE_EVENT))}>
                <SlidersHorizontal size={15} /> <span className="hidden 2xl:inline">{t('toolbar.customize')}</span>
              </button>
            )}

            <SaveViewButton onSave={p.onSaveView} canShare={!!p.canShareView} />

            {/* Tìm (KeyGo): icon, bấm mới mở ô */}
            {searchShown ? (
              <div className="w-48">
                <Input {...tourAnchor('tasks.search')} size="sm" autoFocus={searchOpen && !f.keyword} value={f.keyword} onChange={(e) => set({ keyword: e.target.value })}
                  prefix={<Search size={14} />} placeholder={t('filter.search')} className="no-edit-hint"
                  onBlur={() => { if (!f.keyword) setSearchOpen(false) }}
                  suffix={f.keyword ? <button type="button" aria-label={t('filter.remove')} onClick={() => { set({ keyword: '' }); setSearchOpen(false) }}><X size={13} /></button> : undefined} />
              </div>
            ) : (
              <button {...tourAnchor('tasks.search')} type="button" className={toolBtn} aria-label={t('filter.search')} title={t('filter.search')} onClick={() => setSearchOpen(true)}>
                <Search size={15} />
              </button>
            )}

            {/* ··· (KeyGo): Chọn nhiều, Xuất Excel */}
            <Popover>
              <PopoverTrigger asChild>
                <button {...tourAnchor('tasks.more')} type="button" className={cn(toolBtn, 'shrink-0', p.selecting && TOGGLE_ON)} aria-label={t('toolbar.more')} title={t('toolbar.more')}><MoreHorizontal size={16} /></button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1" align="end">
                {p.mode === 'list' && (
                  <MenuBtn icon={<CheckSquare size={15} />} onClick={() => p.onSelecting(!p.selecting)}
                    trailing={p.selecting ? <Check size={14} className="text-[var(--color-primary)]" /> : undefined}>
                    {t('toolbar.select')}
                  </MenuBtn>
                )}
                <MenuBtn icon={exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} disabled={exporting}
                  onClick={() => { setExporting(true); void p.onExport().finally(() => setExporting(false)) }}>
                  {t('toolbar.export')}
                </MenuBtn>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
      {chips.length > 0 && toolbarModes && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs text-[var(--color-primary)]">
              {c.label}
              <button type="button" aria-label={t('filter.remove')} onClick={c.clear}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuBtn({ icon, children, onClick, trailing, disabled, active }: {
  icon?: React.ReactNode; children: React.ReactNode; onClick: () => void; trailing?: React.ReactNode; disabled?: boolean; active?: boolean
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)] disabled:opacity-50',
        active && 'text-[var(--color-primary)]')}>
      {icon} <span className="flex-1">{children}</span>{trailing}
    </button>
  )
}

function SaveViewButton({ onSave, canShare }: { onSave: (name: string, shared: boolean) => void; canShare: boolean }) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const save = () => {
    if (!name.trim()) return
    onSave(name.trim(), canShare && shared)
    setName('')
    setShared(false)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button {...tourAnchor('tasks.saveView')} type="button" className={cn(toolBtn, 'text-[var(--color-primary)] hover:text-[var(--color-primary)]')} title={t('views.save')}>
          <Plus size={15} /> <span className="hidden 2xl:inline">{t('views.save')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="end">
        <p className="text-xs text-[var(--color-subtle-foreground)]">{t('views.saveHint')}</p>
        <Input size="sm" autoFocus value={name} maxLength={120} placeholder={t('views.namePlaceholder')} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
        {canShare && (
          <label className="flex items-center justify-between gap-2 text-sm">
            {t('views.shared')}
            <Switch size="sm" checked={shared} onCheckedChange={setShared} />
          </label>
        )}
        <div className="flex justify-end">
          <Button size="sm" disabled={!name.trim()} onClick={save}>{t('views.saveSubmit')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
