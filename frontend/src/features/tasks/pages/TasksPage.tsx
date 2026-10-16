import { useTourScope } from '@/hooks/useTourScope'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, ChevronDown, FileSpreadsheet, ListPlus, Loader2, MoreHorizontal, Plus, Settings2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar from '@/components/common/UserAvatar'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { getApiErrorMessage } from '@/lib/apiError'
import AssignDialog from '../components/AssignDialog'
import CreateListDialog from '../components/CreateListDialog'
import TaskBatchBar from '../components/TaskBatchBar'
import TaskCalendarView from '../components/TaskCalendarView'
import TaskCreateDialog from '../components/TaskCreateDialog'
import TaskDetailPanel from '../components/TaskDetailPanel'
import TaskGanttView from '../components/TaskGanttView'
import TaskImportDialog from '../components/TaskImportDialog'
import TaskKanbanView from '../components/TaskKanbanView'
import TaskListSettingsDialog, { type TaskListSettingsTab } from '../components/TaskListSettingsDialog'
import TaskListStatsView from '../components/TaskListStatsView'
import TaskListView from '../components/TaskListView'
import LoadMoreRow from '../components/LoadMoreRow'
import TaskSidebarNav, { type SidebarSelection } from '../components/TaskSidebarNav'
import TaskCommandPalette from '../components/TaskCommandPalette'
import TaskToolbar, { type TaskFilters } from '../components/TaskToolbar'
import {
  taskKeys, useSavedTaskViews, useTask, useTaskListDetail, useTaskListPaged, useTaskMutations, useTaskRealtime, useTaskSidebar, useTaskTags,
} from '../hooks/useTasks'
import { TASK_MODES } from '../types'
import { OPEN_STATUSES } from '../taskUtils'
import TaskActivityFeed from '../components/TaskActivityFeed'
import { mySectionApi } from '../api/listApi'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type {
  KpiTask, TaskGroupBy, TaskMode, TaskListDetail, TaskListParams, TaskOption, TaskSavedView, TaskSort, TaskView,
} from '../types'
import { taskApi } from '../api/taskApi'
import { listApi } from '../api/listApi'
import { useTourAction, useTourFact, useTourModal } from '@/components/common/tours/actions'
import { tourAnchor } from '@/components/common/tours/anchors'

function stored<T extends string>(key: string, fallback: T, ok: (v: string) => boolean): T {
  try {
    const v = localStorage.getItem(key)
    return v && ok(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function store(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* trình duyệt chặn bộ nhớ */ }
}
/** Lựa chọn nhớ theo trình duyệt (chế độ xem, nhóm, sắp xếp). */
function usePersisted<T extends string>(key: string, fallback: T, ok: (v: string) => boolean) {
  const [v, setV] = useState<T>(() => stored(key, fallback, ok))
  return [v, (next: T) => { setV(next); store(key, next) }] as const
}

const VIEWS: readonly TaskView[] = ['ASSIGNED', 'FOLLOWING', 'CREATED', 'DELEGATED', 'NOKPI', 'DONE', 'ALL', 'TEAM', 'ACTIVITY']
const BASE_GROUPS = ['due', 'mysection', 'kpi', 'status', 'owner', 'priority', 'tag', 'none']
const okGroup = (v: string) => BASE_GROUPS.includes(v) || v === 'section' || v.startsWith('field:')
const okSort = (v: string) => ['due', 'start', 'priority', 'created', 'updated', 'title', 'manual'].includes(v) || v.startsWith('field:')

/** Nhóm theo "Nhóm" / trường chỉ có nghĩa trong một danh sách và khi trường còn tồn tại; ngoài ra lùi về mặc định. */
function effectiveGroup(g: TaskGroupBy, list: TaskListDetail | null | undefined, fallback: TaskGroupBy): TaskGroupBy {
  if (g === 'section') return list ? g : fallback
  if (g.startsWith('field:')) return list?.fields.some((f) => `field:${f.id}` === g) ? g : fallback
  return g
}

/**
 * Trang "Công việc" kiểu Lark Tasks: cột trái (chế độ xem / danh sách / chế độ xem đã lưu / theo KPI / việc của đơn vị),
 * cột giữa (Danh sách · Kanban · Lịch · Gantt · Thống kê), cột phải (bảng chi tiết trượt ra). Lựa chọn ở cột trái + việc
 * đang mở nằm trên URL (`?view=&kpi=&list=&task=`) để chia sẻ / quay lại được; chế độ xem, nhóm, sắp xếp nhớ theo trình
 * duyệt (trong danh sách nhớ riêng, mặc định nhóm theo "Nhóm").
 */
export default function TasksPage() {
  useTourScope('tasks')
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  usePageTitle('tasks', t('page.title'))
  const [params, setParams] = useSearchParams()
  const organizationId = useAuthStore((s) => s.user?.memberships?.[0]?.organizationId)
  const viewParam = params.get('view') as TaskView | null
  const listId = params.get('list') ?? undefined
  const selection: SidebarSelection = {
    view: viewParam && VIEWS.includes(viewParam) ? viewParam : (params.get('kpi') || listId ? 'ALL' : 'ASSIGNED'),
    kpiId: params.get('kpi') ?? undefined,
    listId,
  }
  const openTaskId = params.get('task')
  const inList = !!listId

  const [rawMode, setMode] = usePersisted<TaskMode>('tasks.mode', 'list', (v) => (TASK_MODES as readonly string[]).includes(v))
  const [groupBy, setGroupBy] = usePersisted<TaskGroupBy>('tasks.groupBy', 'due', okGroup)
  // Kanban nhóm riêng (mặc định theo trạng thái) — "Nhóm theo: Hạn" của danh sách không hợp với cột Kanban.
  const [kanbanGroupBy, setKanbanGroupBy] = usePersisted<TaskGroupBy>('tasks.kanbanGroupBy', 'status', okGroup)
  const [listGroupBy, setListGroupBy] = usePersisted<TaskGroupBy>('tasks.list.groupBy', 'section', okGroup)
  const [listKanbanGroupBy, setListKanbanGroupBy] = usePersisted<TaskGroupBy>('tasks.list.kanbanGroupBy', 'section', okGroup)
  const [sort, setSort] = usePersisted<TaskSort>('tasks.sort', 'due', okSort)
  const [listSort, setListSort] = usePersisted<TaskSort>('tasks.list.sort', 'manual', okSort)
  // Như Lark: mặc định chỉ việc "Đang làm" (chưa làm + đang làm); đổi ở ô "Đang làm ▾".
  const [filters, setFilters] = useState<TaskFilters>({ status: [...OPEN_STATUSES], keyword: '' })
  const [groupDialog, setGroupDialog] = useState(false)
  const [createOpen, setCreateOpen] = useState<{ dueDate?: string; dueTime?: string } | null>(null)
  useTourModal('tasks.form', () => setCreateOpen({}), () => setCreateOpen(null))
  const [createListOpen, setCreateListOpen] = useState(false)
  useTourModal('tasks.listForm', () => setCreateListOpen(true), () => setCreateListOpen(false))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<TaskListSettingsTab>('general')
  const [importOpen, setImportOpen] = useState(false)
  const openSettings = (tab: TaskListSettingsTab = 'general') => { setImportOpen(false); setSettingsTab(tab); setSettingsOpen(true) }
  const [assignFor, setAssignFor] = useState<{ task: KpiTask; ownerId: string } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastPicked, setLastPicked] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  // Thứ tự việc đang thấy (Danh sách báo lại thứ tự sau khi nhóm / xổ việc con) — bảng chi tiết dùng để sang việc trước / sau.
  const [listOrder, setListOrder] = useState<string[]>([])
  const m = useTaskMutations()

  const { data: sidebar } = useTaskSidebar()
  const { data: list } = useTaskListDetail(listId)
  const { data: tags = [] } = useTaskTags()
  const { data: savedViews = [] } = useSavedTaskViews()
  const { data: periods } = useKpiPeriods({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })

  // Bảng điều khiển / Hoạt động chỉ là tab của một danh sách.
  const mode: TaskMode = (rawMode === 'stats' || rawMode === 'activity') && !inList ? 'list' : rawMode
  const activityPage = !inList && selection.view === 'ACTIVITY'
  const curSort = inList ? listSort : sort
  const rawGroup = mode === 'kanban' ? (inList ? listKanbanGroupBy : kanbanGroupBy) : (inList ? listGroupBy : groupBy)
  const curGroup = effectiveGroup(rawGroup, list, mode === 'kanban' ? 'status' : 'due')
  const sortField = curSort.startsWith('field:') && list?.fields.some((f) => `field:${f.id}` === curSort) ? curSort.slice(6) : undefined

  const listParams: TaskListParams = {
    view: inList ? 'LIST' : selection.view,
    listId,
    kpiId: selection.kpiId,
    status: selection.view === 'DONE' || !filters.status.length ? undefined : filters.status,
    priority: filters.priority,
    due: filters.due,
    kpiPeriodId: filters.kpiPeriodId,
    ownerId: filters.ownerId,
    keyword: filters.keyword.trim() || undefined,
    tagIds: filters.tagIds?.length ? filters.tagIds : undefined,
    hasKpi: filters.hasKpi,
    sort: mode === 'list' ? (sortField ? 'due' : curSort.startsWith('field:') ? 'due' : curSort) : 'manual',
    sortFieldId: mode === 'list' ? sortField : undefined,
    size: 500,
  }
  const paged = useTaskListPaged(listParams, !activityPage && (mode === 'list' || mode === 'kanban'))
  const { tasks, isLoading } = paged
  const loadMore = paged.hasMore
    ? <LoadMoreRow shown={tasks.length} total={paged.total} loading={paged.loadingMore} onLoadMore={paged.loadMore} />
    : null
  // Bộ lọc người phụ trách: người mình được giao việc (nhóm theo đơn vị) + người phụ trách đang có trong danh sách.
  const { data: assignable = [] } = useQuery({ queryKey: ['kpi-tasks', 'assignable-users', ''], queryFn: () => taskApi.assignableUsers(''), staleTime: 60_000 })
  const owners = useMemo<TaskOption[]>(() => {
    const map = new Map<string, TaskOption>(assignable.map((o) => [o.id, o]))
    tasks.forEach((x) => {
      if (!map.has(x.ownerId)) {
        map.set(x.ownerId, { id: x.ownerId, name: x.ownerName ?? '-', secondary: null, avatarUrl: x.ownerAvatarUrl, detail: null,
          groupId: null, groupName: null, groupCurrent: true, groupSort: '~' })
      }
    })
    return [...map.values()]
  }, [assignable, tasks])
  // Bộ lọc KPI: KPI của tôi (nhóm theo đợt, đợt hiện tại trước) + KPI đang có trong danh sách (vd. việc tôi giao).
  const { data: myKpis = [] } = useQuery({ queryKey: ['kpi-tasks', 'assignable-kpis', 'me'], queryFn: () => taskApi.assignableKpis(), staleTime: 60_000 })
  const kpiOptions = useMemo<TaskOption[]>(() => {
    const map = new Map<string, TaskOption>(myKpis.map((o) => [o.id, o]))
    tasks.forEach((x) => {
      if (x.kpiId && !map.has(x.kpiId) && x.kpiName) {
        map.set(x.kpiId, { id: x.kpiId, name: x.kpiName, secondary: x.kpiPeriodName, avatarUrl: null, detail: null,
          groupId: x.kpiPeriodId, groupName: x.kpiPeriodName, groupCurrent: myKpis.some((k) => k.groupId === x.kpiPeriodId && k.groupCurrent),
          groupSort: '' })
      }
    })
    return [...map.values()]
  }, [myKpis, tasks])

  const setParam = useCallback((patch: Record<string, string | null>) => {
    setParams((p) => {
      Object.entries(patch).forEach(([k, v]) => { if (v == null) p.delete(k); else p.set(k, v) })
      return p
    }, { replace: true })
  }, [setParams])

  const clearSelection = useCallback(() => { setSelected(new Set()); setLastPicked(null) }, [])
  const select = (v: SidebarSelection) => {
    setActiveViewId(null)
    clearSelection()
    setParam({ view: v.kpiId || v.listId ? null : v.view, kpi: v.kpiId ?? null, list: v.listId ?? null })
  }

  const openTask = useCallback((id: string) => setParam({ task: id, comment: null }), [setParam])
  const closeTask = useCallback(() => setParam({ task: null, comment: null, taskTab: null }), [setParam])
  useTaskRealtime(openTaskId, closeTask)

  // Phím tắt: N tạo việc · Ctrl/Cmd+Enter hoàn thành việc đang mở · Esc bỏ chọn. Bỏ qua khi đang gõ.
  const { data: openedTask } = useTask(openTaskId)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const typing = !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
      if (document.querySelector('[role="dialog"]')) return
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        setCreateOpen({})
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && openedTask?.canEdit && openedTask.status !== 'DONE') {
        e.preventDefault()
        m.changeStatus.mutate({ id: openedTask.id, status: 'DONE', version: openedTask.version }, {
          onSuccess: () => toast.success(t('row.completed', { title: openedTask.title })),
          onError: (er) => toast.error(getApiErrorMessage(er)),
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openedTask, m.changeStatus, t])

  // Chọn nhiều: bấm = bật/tắt một việc; Shift + bấm = chọn cả đoạn từ việc chọn trước đó.
  const toggleSelect = (task: KpiTask, shift: boolean, ordered: KpiTask[]) => {
    setSelected((cur) => {
      const next = new Set(cur)
      if (shift && lastPicked) {
        const a = ordered.findIndex((x) => x.id === lastPicked)
        const b = ordered.findIndex((x) => x.id === task.id)
        if (a >= 0 && b >= 0) {
          ordered.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => next.add(x.id))
          return next
        }
      }
      if (next.has(task.id)) next.delete(task.id)
      else next.add(task.id)
      return next
    })
    setLastPicked(task.id)
  }

  const saveView = (name: string, shared: boolean) => {
    listApi.createView({
      name, shared, listId: listId ?? null,
      config: { mode, groupBy: curGroup, sort: curSort, view: selection.view, listId, kpiId: selection.kpiId,
        filters: filters as unknown as Record<string, unknown> },
    }).then((v) => {
      qc.invalidateQueries({ queryKey: taskKeys.views })
      setActiveViewId(v.id)
      toast.success(t('views.saved'))
    }).catch((e) => toast.error(getApiErrorMessage(e)))
  }
  const applyView = (v: TaskSavedView) => {
    const c = v.config ?? {}
    clearSelection()
    setParam({
      view: c.kpiId || c.listId ? null : (c.view && VIEWS.includes(c.view as TaskView) ? c.view : null),
      kpi: c.kpiId ?? null, list: c.listId ?? v.listId ?? null,
    })
    if (c.mode && (TASK_MODES as readonly string[]).includes(c.mode)) setMode(c.mode as TaskMode)
    const viewInList = !!(c.listId ?? v.listId)
    if (c.groupBy && okGroup(c.groupBy)) {
      const g = c.groupBy as TaskGroupBy
      if (c.mode === 'kanban') (viewInList ? setListKanbanGroupBy : setKanbanGroupBy)(g)
      else (viewInList ? setListGroupBy : setGroupBy)(g)
    }
    if (c.sort && okSort(c.sort)) (viewInList ? setListSort : setSort)(c.sort as TaskSort)
    const f = (c.filters ?? {}) as Partial<TaskFilters>
    setFilters({ status: f.status ?? [], keyword: f.keyword ?? '', priority: f.priority, due: f.due, kpiPeriodId: f.kpiPeriodId,
      ownerId: f.ownerId, tagIds: f.tagIds, hasKpi: f.hasKpi })
    setActiveViewId(v.id)
  }
  const deleteView = (v: TaskSavedView) => {
    listApi.deleteView(v.id).then(() => {
      qc.invalidateQueries({ queryKey: taskKeys.views })
      if (activeViewId === v.id) setActiveViewId(null)
    }).catch((e) => toast.error(getApiErrorMessage(e)))
  }

  const listEditable = !!list && !list.archived && (list.role === 'OWNER' || list.role === 'EDITOR')
  // Bài hướng dẫn hộp Cài đặt / Nhập Excel cần một danh sách đang mở. Đang ở trang chung (hoặc danh sách đang xem không
  // nhập được) thì mở danh sách đầu tiên phù hợp; hộp chờ danh sách đó tải xong mới mở (`tourPending`).
  const [tourPending, setTourPending] = useState<{ kind: 'settings' | 'import'; tab?: TaskListSettingsTab } | null>(null)
  const tourList = (kind: 'settings' | 'import') => sidebar?.lists.find((l) =>
    !l.archived && (kind === 'settings' || l.role === 'OWNER' || l.role === 'EDITOR'))
  const ensureTourList = (kind: 'settings' | 'import') => {
    const fits = !!listId && (kind === 'settings' || listEditable)
    if (fits) return true
    const target = tourList(kind)
    if (target) setParam({ view: null, kpi: null, task: null, list: target.listId })
    return false
  }
  const openForTour = (kind: 'settings' | 'import', tab?: TaskListSettingsTab) => {
    if (!ensureTourList(kind)) { setTourPending({ kind, tab }); return }
    if (kind === 'settings') openSettings(tab)
    else { setSettingsOpen(false); setImportOpen(true) }
  }
  useTourAction('tasks.list.ensure', (kind) => { ensureTourList(kind as 'settings' | 'import') })
  useTourModal('tasks.listSettings', () => openForTour('settings'), () => { setSettingsOpen(false); setTourPending(null) })
  useTourAction('tasks.listSettings.tab', (tab) => openForTour('settings', tab as TaskListSettingsTab))
  useTourModal('tasks.listImport', () => openForTour('import'), () => { setImportOpen(false); setTourPending(null) })
  useTourFact('tasks.hasList', !!sidebar?.lists.some((l) => !l.archived))
  useTourFact('tasks.hasEditableList', !!sidebar?.lists.some((l) => !l.archived && (l.role === 'OWNER' || l.role === 'EDITOR')))
  // Danh sách bài hướng dẫn vừa mở đã tải xong ⇒ mở hộp (đặt state ngay lúc render, có điều kiện, không qua effect).
  if (tourPending && list && list.id === listId && (tourPending.kind === 'settings' || listEditable)) {
    setTourPending(null)
    if (tourPending.kind === 'settings') openSettings(tourPending.tab)
    else { setSettingsOpen(false); setImportOpen(true) }
  }
  const canCreate = inList ? listEditable : selection.view !== 'DONE' && selection.view !== 'TEAM'
  const selectionTitle = inList
    ? list?.name ?? ''
    : selection.kpiId
      ? sidebar?.kpis.find((k) => k.kpiId === selection.kpiId)?.kpiName ?? t('sidebar.byKpi')
      : t(`view.${selection.view}`)

  const onGroupBy = (v: TaskGroupBy) => {
    setActiveViewId(null)
    if (mode === 'kanban') (inList ? setListKanbanGroupBy : setKanbanGroupBy)(v)
    else (inList ? setListGroupBy : setGroupBy)(v)
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <TaskSidebarNav data={sidebar} value={selection} onChange={select} onCreateList={() => setCreateListOpen(true)}
        views={savedViews} activeViewId={activeViewId} onApplyView={applyView} onDeleteView={deleteView} />

      <main className="min-w-0 flex-1 space-y-3">
        {inList ? (
          <ListHeader list={list} onSettings={() => openSettings()} onShare={() => openSettings('members')} onImport={() => setImportOpen(true)} editable={listEditable}
            dialogOpen={settingsOpen || importOpen} />
        ) : (
          // Đầu trang như Lark: tên mục bên trái, nút chính "Tạo việc ▾" bên phải.
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-[var(--color-foreground)]">{selectionTitle}</h1>
            {canCreate && !activityPage && (
              <div className="inline-flex h-9 overflow-hidden rounded-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
                <button type="button" onClick={() => setCreateOpen({})} className="inline-flex items-center gap-1 px-3 text-sm hover:bg-[var(--color-primary-hover)]">
                  <Plus size={15} /> {t('toolbar.create')}
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label={t('toolbar.createMore')} className="border-l border-white/25 px-2 hover:bg-[var(--color-primary-hover)]"><ChevronDown size={15} /></button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1" align="end">
                    <button type="button" onClick={() => setCreateOpen({})} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]"><Plus size={15} /> {t('toolbar.create')}</button>
                    <button type="button" onClick={() => setCreateListOpen(true)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]"><ListPlus size={15} /> {t('sidebar.newList')}</button>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        )}
        {!activityPage && (
        <TaskToolbar
          mode={mode} onMode={(v) => { setActiveViewId(null); setMode(v); if (v !== 'list') { setSelecting(false); clearSelection() } }}
          groupBy={curGroup} onGroupBy={onGroupBy}
          sort={curSort} onSort={(v) => { setActiveViewId(null); (inList ? setListSort : setSort)(v) }}
          filters={filters} onFilters={(f) => { setActiveViewId(null); setFilters(f) }}
          periods={(periods?.content ?? []).map((p) => ({ id: p.id, name: p.name }))}
          owners={owners}
          kpis={kpiOptions}
          kpiId={selection.kpiId}
          onKpi={(id) => setParam({ kpi: id, view: id ? null : selection.view === 'ALL' ? null : selection.view })}
          onCreate={() => setCreateOpen({})}
          onCreateGroup={(curGroup === 'section' && listEditable) || curGroup === 'mysection' ? () => setGroupDialog(true) : undefined}
          onImport={listEditable ? () => setImportOpen(true) : undefined}
          list={list}
          tags={tags}
          selecting={selecting}
          onSelecting={(v) => { setSelecting(v); if (!v) clearSelection() }}
          onExport={() => taskApi.exportExcel(listParams).catch((e) => { toast.error(getApiErrorMessage(e)) })}
          onSaveView={saveView}
          canCreate={canCreate}
          canShareView={listEditable}
          hideStatus={selection.view === 'DONE'}
        />
        )}

        {activityPage ? (
          <TaskActivityFeed onOpen={openTask} />
        ) : mode === 'activity' && listId ? (
          <TaskActivityFeed listId={listId} onOpen={openTask} />
        ) : mode === 'stats' && listId ? (
          list ? <TaskListStatsView list={list} /> : null
        ) : mode === 'calendar' ? (
          <TaskCalendarView params={listParams} activeTaskId={openTaskId} onOpen={(x) => openTask(x.id)}
            onCreateOn={(date, time) => setCreateOpen({ dueDate: date, dueTime: time })} />
        ) : mode === 'gantt' ? (
          <TaskGanttView params={listParams} groupBy={curGroup} activeTaskId={openTaskId} onOpen={(x) => openTask(x.id)} list={list} tags={tags} />
        ) : isLoading ? (
          <TaskListSkeleton />
        ) : mode === 'kanban' ? (
          <TaskKanbanView tasks={tasks} groupBy={curGroup} activeTaskId={openTaskId}
            onOpen={(x) => openTask(x.id)} defaultKpiId={selection.kpiId} list={list} tags={tags}
            onRequestAssign={(task, ownerId) => setAssignFor({ task, ownerId })} footer={loadMore} />
        ) : (
          <TaskListView tasks={tasks} groupBy={curGroup} sort={curSort} activeTaskId={openTaskId}
            onOpen={(x) => openTask(x.id)} defaultKpiId={selection.kpiId} showKpi={!selection.kpiId}
            onRequestAssign={(task, ownerId) => setAssignFor({ task, ownerId })} list={list} tags={tags}
            selectedIds={selecting ? selected : undefined} onToggleSelect={selecting ? toggleSelect : undefined}
            allowQuickAdd={canCreate && selection.view !== 'FOLLOWING'} onOrdered={setListOrder} footer={loadMore} />
        )}
      </main>

      {selecting && selected.size > 0 && <TaskBatchBar ids={[...selected]} onClear={clearSelection} list={list} />}
      <TaskDetailPanel taskId={openTaskId} onClose={closeTask} onNavigate={openTask}
        navIds={mode === 'list' ? listOrder : tasks.map((x) => x.id)}
        focusCommentId={params.get('comment')} initialTab={params.get('taskTab') === 'activity' ? 'activity' : 'all'} />
      <TaskCreateDialog open={!!createOpen} onClose={() => setCreateOpen(null)}
        defaults={{ kpiId: selection.kpiId, dueDate: createOpen?.dueDate, dueTime: createOpen?.dueTime, listId: listEditable ? listId : undefined }} onCreated={openTask} />
      <AssignDialog task={assignFor?.task ?? null} open={!!assignFor} initialOwnerId={assignFor?.ownerId}
        onClose={() => setAssignFor(null)} />
      <CreateListDialog open={createListOpen} onClose={() => setCreateListOpen(false)}
        onCreated={(id) => select({ view: 'ALL', listId: id })} />
      {list && (
        <TaskListSettingsDialog key={list.id} list={list} open={settingsOpen} onClose={() => setSettingsOpen(false)}
          tab={settingsTab} onTab={setSettingsTab}
          onDeleted={() => select({ view: 'ASSIGNED' })} />
      )}
      <NewGroupDialog open={groupDialog} onClose={() => setGroupDialog(false)}
        onCreate={(name) => (curGroup === 'section' && list
          ? listApi.addSection(list.id, name).then(() => qc.invalidateQueries({ queryKey: taskKeys.taskList(list.id) }))
          : mySectionApi.create(name).then(() => qc.invalidateQueries({ queryKey: taskKeys.mySections })))
          .then(() => setGroupDialog(false)).catch((e) => toast.error(getApiErrorMessage(e)))} />
      <TaskCommandPalette onOpenTask={openTask} onOpenList={(id) => select({ view: 'ALL', listId: id })} />
      {listId && <TaskImportDialog listId={listId} open={importOpen} onClose={() => setImportOpen(false)} />}
    </div>
  )
}

/**
 * Đầu trang của một danh sách như Lark: biểu tượng + tên + "···" (Cài đặt, Nhập Excel), bên phải avatar thành viên và nút
 * "Chia sẻ" (mở thẻ thành viên).
 */
function ListHeader({ list, editable, onSettings, onShare, onImport, dialogOpen }: {
  list: TaskListDetail | undefined
  editable: boolean
  /** Hộp Cài đặt / Nhập Excel đang mở (kể cả do bài hướng dẫn mở) ⇒ đóng menu ⋯ để nó không nằm dưới hộp. */
  dialogOpen: boolean
  onSettings: () => void
  onShare: () => void
  onImport: () => void
}) {
  const { t } = useTranslation('tasks')
  const [menuOpen, setMenuOpen] = useState(false)
  // Hộp vừa mở ⇒ đóng menu ⋯ (đặt lại ngay lúc render theo prop đổi, không qua effect).
  const [prevDialogOpen, setPrevDialogOpen] = useState(dialogOpen)
  if (dialogOpen !== prevDialogOpen) {
    setPrevDialogOpen(dialogOpen)
    if (dialogOpen) setMenuOpen(false)
  }
  if (!list) return <div className="h-12"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
  const people = list.members.filter((m) => m.userId)
  const units = list.members.filter((m) => m.orgUnitId)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {list.icon
          ? <span className="shrink-0 text-2xl leading-none">{list.icon}</span>
          : <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: list.color ?? '#94a3b8' }} />}
        <h1 className="truncate text-xl font-semibold text-[var(--color-foreground)]">{list.name}</h1>
        {list.archived && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-muted)] px-2 text-xs text-[var(--color-subtle-foreground)]">
            <Archive size={11} /> {t('lists.archivedBadge')}
          </span>
        )}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button {...tourAnchor('tasks.list.menu')} type="button" aria-label={t('menu.more')} className="shrink-0 rounded-md p-1 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
              <MoreHorizontal size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="start">
            <button {...tourAnchor('tasks.list.settings')} type="button" onClick={onSettings} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
              <Settings2 size={15} /> {t('lists.settings')}
            </button>
            {editable && (
              <button {...tourAnchor('tasks.list.import')} type="button" onClick={onImport} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
                <FileSpreadsheet size={15} /> {t('import.button')}
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onShare} className="flex items-center -space-x-1.5" title={t('lists.membersCount', { count: list.members.length })}>
          {people.slice(0, 3).map((m) => (
            <UserAvatar key={m.id} fullName={m.userName ?? ''} avatarUrl={m.avatarUrl} className="h-7 w-7 rounded-full border-2 border-[var(--color-card)] text-[10px]" />
          ))}
          {(people.length > 3 || units.length > 0) && (
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[var(--color-card)] bg-[var(--color-muted)] px-1 text-[11px]">
              +{Math.max(0, people.length - 3) + units.length}
            </span>
          )}
        </button>
        <Button size="sm" variant="outline" onClick={onShare}><Share2 /> {t('lists.share')}</Button>
      </div>
    </div>
  )
}

/** "Nhóm mới" (Lark: New Task ▾ > New Group): nhóm của danh sách hoặc nhóm riêng của tôi, tuỳ đang nhóm theo gì. */
function NewGroupDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const { t } = useTranslation('tasks')
  const [name, setName] = useState('')
  const submit = () => { if (name.trim()) { onCreate(name.trim()); setName('') } }
  return (
    <Dialog open={open} onClose={onClose} size="sm" title={t('toolbar.newGroup')}
      footer={<DialogFooter secondary={<Button variant="outline" onClick={onClose}>{t('detail.close')}</Button>}
        primary={<Button disabled={!name.trim()} onClick={submit}>{t('toolbar.createGroup')}</Button>} />}>
      <Input autoFocus value={name} maxLength={100} placeholder={t('toolbar.groupName')} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
    </Dialog>
  )
}

/** Khung xương lúc tải bảng việc (đỡ giật hơn vòng xoay). */
function TaskListSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="h-9 border-b border-[var(--color-border)]" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-10 items-center gap-3 border-b border-[var(--color-border)] px-3 last:border-b-0">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3.5" style={{ width: `${30 + ((i * 17) % 35)}%` }} />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
