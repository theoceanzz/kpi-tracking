import { useTourScope } from '@/hooks/useTourScope'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { getApiErrorMessage } from '@/lib/apiError'
import AssignDialog from '../components/AssignDialog'
import TaskCalendarView from '../components/TaskCalendarView'
import TaskCreateDialog from '../components/TaskCreateDialog'
import TaskDetailPanel from '../components/TaskDetailPanel'
import TaskKanbanView from '../components/TaskKanbanView'
import TaskListView from '../components/TaskListView'
import TaskSidebarNav, { type SidebarSelection } from '../components/TaskSidebarNav'
import TaskToolbar, { type TaskFilters, type TaskMode } from '../components/TaskToolbar'
import { useTask, useTaskList, useTaskMutations, useTaskRealtime, useTaskSidebar } from '../hooks/useTasks'
import type { KpiTask, TaskGroupBy, TaskListParams, TaskOption, TaskSort, TaskView } from '../types'
import { taskApi } from '../api/taskApi'
import { useTourModal } from '@/components/common/tours/actions'

function stored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function store(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* trình duyệt chặn bộ nhớ */ }
}

const VIEWS: readonly TaskView[] = ['ASSIGNED', 'FOLLOWING', 'CREATED', 'DELEGATED', 'DONE', 'ALL', 'TEAM']

/**
 * Trang "Công việc" kiểu Lark Tasks: cột trái (chế độ xem / theo KPI / việc của đơn vị), cột giữa (Danh sách · Kanban ·
 * Lịch), cột phải (bảng chi tiết trượt ra). Lựa chọn ở cột trái + việc đang mở nằm trên URL (`?view=&kpi=&task=`) để
 * chia sẻ / quay lại được; chế độ xem, nhóm, sắp xếp nhớ theo trình duyệt.
 */
export default function TasksPage() {
  useTourScope('tasks')
  const { t } = useTranslation('tasks')
  const pageTitle = usePageTitle('tasks', t('page.title'))
  const [params, setParams] = useSearchParams()
  const organizationId = useAuthStore((s) => s.user?.memberships?.[0]?.organizationId)
  const viewParam = params.get('view') as TaskView | null
  const selection: SidebarSelection = {
    view: viewParam && VIEWS.includes(viewParam) ? viewParam : (params.get('kpi') ? 'ALL' : 'ASSIGNED'),
    kpiId: params.get('kpi') ?? undefined,
  }
  const openTaskId = params.get('task')

  const [mode, setMode] = useState<TaskMode>(() => stored('tasks.mode', 'list', ['list', 'kanban', 'calendar'] as const))
  const [groupBy, setGroupBy] = useState<TaskGroupBy>(() => stored('tasks.groupBy', 'due', ['due', 'kpi', 'status', 'owner', 'priority', 'none'] as const))
  // Kanban nhóm riêng (mặc định theo trạng thái) — "Nhóm theo: Hạn" của danh sách không hợp với cột Kanban.
  const [kanbanGroupBy, setKanbanGroupBy] = useState<TaskGroupBy>(() => stored('tasks.kanbanGroupBy', 'status', ['status', 'kpi', 'owner', 'priority', 'due'] as const))
  const [sort, setSort] = useState<TaskSort>(() => stored('tasks.sort', 'due', ['due', 'priority', 'created', 'manual'] as const))
  const [filters, setFilters] = useState<TaskFilters>({ status: [], keyword: '' })
  const [createOpen, setCreateOpen] = useState<{ dueDate?: string } | null>(null)
  useTourModal('tasks.form', () => setCreateOpen({}), () => setCreateOpen(null))
  const [assignFor, setAssignFor] = useState<{ task: KpiTask; ownerId: string } | null>(null)
  const m = useTaskMutations()

  const { data: sidebar } = useTaskSidebar()
  const { data: periods } = useKpiPeriods({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })

  const listParams: TaskListParams = {
    view: selection.view,
    kpiId: selection.kpiId,
    status: filters.status.length ? filters.status : undefined,
    priority: filters.priority,
    due: filters.due,
    kpiPeriodId: filters.kpiPeriodId,
    ownerId: filters.ownerId,
    keyword: filters.keyword.trim() || undefined,
    sort: mode === 'list' ? sort : 'manual',
    size: 500,
  }
  const { data, isLoading } = useTaskList(listParams, mode !== 'calendar')
  const tasks = useMemo(() => data?.content ?? [], [data])
  // Bộ lọc người phụ trách: người mình được giao việc (nhóm theo đơn vị) + người phụ trách đang có trong danh sách.
  const { data: assignable = [] } = useQuery({ queryKey: ['kpi-tasks', 'assignable-users', ''], queryFn: () => taskApi.assignableUsers(''), staleTime: 60_000 })
  const owners = useMemo<TaskOption[]>(() => {
    const map = new Map<string, TaskOption>(assignable.map((o) => [o.id, o]))
    tasks.forEach((x) => {
      if (!map.has(x.ownerId)) {
        map.set(x.ownerId, { id: x.ownerId, name: x.ownerName ?? '—', secondary: null, avatarUrl: x.ownerAvatarUrl, detail: null,
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
      if (!map.has(x.kpiId) && x.kpiName) {
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

  const openTask = useCallback((id: string) => setParam({ task: id, comment: null }), [setParam])
  const closeTask = useCallback(() => setParam({ task: null, comment: null, taskTab: null }), [setParam])
  useTaskRealtime(openTaskId, closeTask)

  // Phím tắt: N tạo việc · Ctrl/Cmd+Enter hoàn thành việc đang mở. (Esc do bảng chi tiết lo.) Bỏ qua khi đang gõ.
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

  const selectionTitle = selection.kpiId
    ? sidebar?.kpis.find((k) => k.kpiId === selection.kpiId)?.kpiName ?? t('sidebar.byKpi')
    : t(`view.${selection.view}`)

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <TaskSidebarNav data={sidebar} value={selection}
        onChange={(v) => setParam({ view: v.kpiId ? null : v.view, kpi: v.kpiId ?? null })} />

      <main className="min-w-0 flex-1 space-y-3">
        <div>
          <h1 className="text-section-title">{pageTitle}</h1>
          <p className="text-sm text-[var(--color-subtle-foreground)]">{selectionTitle}</p>
        </div>
        <TaskToolbar
          mode={mode} onMode={(v) => { setMode(v); store('tasks.mode', v) }}
          groupBy={mode === 'kanban' ? kanbanGroupBy : groupBy}
          onGroupBy={(v) => {
            if (mode === 'kanban') { setKanbanGroupBy(v); store('tasks.kanbanGroupBy', v) }
            else { setGroupBy(v); store('tasks.groupBy', v) }
          }}
          sort={sort} onSort={(v) => { setSort(v); store('tasks.sort', v) }}
          filters={filters} onFilters={setFilters}
          periods={(periods?.content ?? []).map((p) => ({ id: p.id, name: p.name }))}
          owners={owners}
          kpis={kpiOptions}
          kpiId={selection.kpiId}
          onKpi={(id) => setParam({ kpi: id, view: id ? null : selection.view })}
          onCreate={() => setCreateOpen({})}
        />

        {mode === 'calendar' ? (
          <TaskCalendarView params={listParams} activeTaskId={openTaskId} onOpen={(x) => openTask(x.id)}
            onCreateOn={(date) => setCreateOpen({ dueDate: date })} />
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
        ) : mode === 'kanban' ? (
          <TaskKanbanView tasks={tasks} groupBy={kanbanGroupBy} activeTaskId={openTaskId}
            onOpen={(x) => openTask(x.id)} defaultKpiId={selection.kpiId}
            onRequestAssign={(task, ownerId) => setAssignFor({ task, ownerId })} />
        ) : (
          <TaskListView tasks={tasks} groupBy={groupBy} sort={sort} activeTaskId={openTaskId}
            onOpen={(x) => openTask(x.id)} defaultKpiId={selection.kpiId} showKpi={!selection.kpiId}
            onRequestAssign={(task, ownerId) => setAssignFor({ task, ownerId })}
            allowQuickAdd={selection.view !== 'DONE' && selection.view !== 'TEAM' && selection.view !== 'FOLLOWING'} />
        )}
      </main>

      <TaskDetailPanel taskId={openTaskId} onClose={closeTask} onNavigate={openTask}
        focusCommentId={params.get('comment')} initialTab={params.get('taskTab') === 'activity' ? 'activity' : 'comments'} />
      <TaskCreateDialog open={!!createOpen} onClose={() => setCreateOpen(null)}
        defaults={{ kpiId: selection.kpiId, dueDate: createOpen?.dueDate }} onCreated={openTask} />
      <AssignDialog task={assignFor?.task ?? null} open={!!assignFor} initialOwnerId={assignFor?.ownerId}
        onClose={() => setAssignFor(null)} />
    </div>
  )
}
