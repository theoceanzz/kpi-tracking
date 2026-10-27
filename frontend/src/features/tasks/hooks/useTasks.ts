import { useEffect, useMemo } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscribeTopic } from '@/lib/realtime'
import { taskApi, type AssignTaskInput, type MoveTasksInput, type SetAssigneesInput, type SetKpiInput } from '../api/taskApi'
import { listApi, mySectionApi, tagApi } from '../api/listApi'
import type {
  CreateTaskInput, KpiTask, ReminderInput, TaskAttachmentKind, TaskBatchInput, TaskListDetail, TaskListParams, TaskStatus, UpdateTaskInput,
} from '../types'

/**
 * Mọi khoá của công việc bắt đầu bằng 'kpi-tasks'. Đổi việc thì làm mới cả danh sách KPI ('kpi-criteria'): ở đó
 * có tiến độ "x/y việc".
 */
export const taskKeys = {
  all: ['kpi-tasks'] as const,
  list: (p: TaskListParams) => ['kpi-tasks', 'list', p] as const,
  sidebar: ['kpi-tasks', 'sidebar'] as const,
  ofKpi: (kpiId: string) => ['kpi-tasks', 'kpi', kpiId] as const,
  one: (id: string) => ['kpi-tasks', 'one', id] as const,
  history: (id: string) => ['kpi-tasks', 'history', id] as const,
  replacements: (kpiId: string) => ['kpi-tasks', 'replacements', kpiId] as const,
  taskList: (id: string) => ['kpi-tasks', 'task-list', id] as const,
  listStats: (id: string) => ['kpi-tasks', 'task-list-stats', id] as const,
  automations: (id: string) => ['kpi-tasks', 'task-list-automations', id] as const,
  tags: ['kpi-tasks', 'tags'] as const,
  views: ['kpi-tasks', 'views'] as const,
  templates: ['kpi-tasks', 'templates'] as const,
  mySections: ['kpi-tasks', 'my-sections'] as const,
}

export function useRefreshTasks() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: taskKeys.all })
    qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
  }
}

export function useTaskList(params: TaskListParams, enabled = true) {
  return useQuery({ queryKey: taskKeys.list(params), queryFn: () => taskApi.list(params), enabled, placeholderData: (p) => p })
}

/** Mỗi trang của danh sách việc (Danh sách / Kanban) — cuộn tới cuối thì tải trang kế. */
export const TASK_PAGE_SIZE = 200

/**
 * Danh sách việc tải dần từng trang (như Lark: cuộn tới đâu tải tới đó) thay vì một lần 500 việc. Gộp các trang, bỏ trùng
 * (thứ tự có thể xê dịch giữa hai lần tải). Khoá nằm dưới `taskKeys.list` nên mọi chỗ làm mới danh sách vẫn áp dụng.
 */
export function useTaskListPaged(params: TaskListParams, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: [...taskKeys.list(params), 'paged'] as const,
    queryFn: ({ pageParam }) => taskApi.list({ ...params, page: pageParam, size: TASK_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
    enabled,
    placeholderData: keepPreviousData,
  })
  const tasks = useMemo(() => {
    const seen = new Set<string>()
    return (q.data?.pages ?? []).flatMap((p) => p.content).filter((x) => !seen.has(x.id) && !!seen.add(x.id))
  }, [q.data])
  return {
    tasks,
    total: q.data?.pages[0]?.totalElements ?? 0,
    isLoading: q.isLoading,
    hasMore: !!q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    loadMore: () => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() },
  }
}

export function useTaskSidebar(enabled = true) {
  return useQuery({ queryKey: taskKeys.sidebar, queryFn: taskApi.sidebar, enabled, staleTime: 30_000, refetchInterval: 120_000 })
}

export function useKpiTasks(kpiId: string | undefined) {
  return useQuery({ queryKey: taskKeys.ofKpi(kpiId ?? ''), queryFn: () => taskApi.ofKpi(kpiId!), enabled: !!kpiId })
}

export function useTask(id: string | null | undefined) {
  return useQuery({ queryKey: taskKeys.one(id ?? ''), queryFn: () => taskApi.get(id!), enabled: !!id })
}

export function useTaskHistory(id: string | null | undefined, enabled: boolean) {
  return useQuery({ queryKey: taskKeys.history(id ?? ''), queryFn: () => taskApi.history(id!), enabled: !!id && enabled })
}

export function useTaskReplacements(kpiId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.replacements(kpiId ?? ''),
    queryFn: () => taskApi.replacements(kpiId!),
    enabled: !!kpiId,
  })
}

/** Chi tiết một danh sách (thành viên, nhóm, trường, vai trò của tôi). */
export function useTaskListDetail(id: string | null | undefined) {
  return useQuery({ queryKey: taskKeys.taskList(id ?? ''), queryFn: () => listApi.get(id!), enabled: !!id })
}

export function useTaskListStats(id: string | null | undefined, enabled = true) {
  return useQuery({ queryKey: taskKeys.listStats(id ?? ''), queryFn: () => listApi.stats(id!), enabled: !!id && enabled })
}

export function useTaskListAutomations(id: string | null | undefined, enabled = true) {
  return useQuery({ queryKey: taskKeys.automations(id ?? ''), queryFn: () => listApi.automations(id!), enabled: !!id && enabled })
}

/** Nhóm riêng của tôi trong "Việc của tôi". */
export function useMySections(enabled = true) {
  return useQuery({ queryKey: taskKeys.mySections, queryFn: mySectionApi.list, enabled, staleTime: 60_000 })
}

export function useTaskTags() {
  return useQuery({ queryKey: taskKeys.tags, queryFn: tagApi.list, staleTime: 60_000 })
}

export function useSavedTaskViews() {
  return useQuery({ queryKey: taskKeys.views, queryFn: listApi.views, staleTime: 60_000 })
}

export function useTaskListTemplates(enabled = true) {
  return useQuery({ queryKey: taskKeys.templates, queryFn: listApi.templates, enabled, staleTime: 60_000 })
}

/**
 * Thời gian thực: người khác sửa việc mình liên quan ⇒ máy chủ đẩy gói lên {@code /user/queue/tasks} ⇒ làm mới danh
 * sách; bảng chi tiết đang mở nghe thêm {@code /topic/task.{id}}. Gọi một lần ở trang Công việc / tab Công việc.
 */
export function useTaskRealtime(openTaskId?: string | null, onDeleted?: (taskId: string) => void) {
  const qc = useQueryClient()
  useEffect(() => subscribeTopic('/user/queue/tasks', () => {
    qc.invalidateQueries({ queryKey: taskKeys.all })
    qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
  }), [qc])
  useEffect(() => {
    if (!openTaskId) return
    return subscribeTopic(`/topic/task.${openTaskId}`, (raw) => {
      const change = raw as { kind?: string; taskId?: string }
      if (change.kind === 'DELETED') {
        onDeleted?.(openTaskId)
        return
      }
      // Có người mở / đóng việc này: chỉ tải lại danh sách người đang xem.
      if (change.kind === 'PRESENCE') {
        qc.invalidateQueries({ queryKey: presenceKey(openTaskId) })
        return
      }
      qc.invalidateQueries({ queryKey: taskKeys.one(openTaskId) })
      qc.invalidateQueries({ queryKey: taskKeys.history(openTaskId) })
    })
  }, [openTaskId, qc, onDeleted])
}

// Khoá riêng, KHÔNG nằm dưới taskKeys.all: làm mới danh sách việc không được kéo theo một nhịp hiện diện.
const presenceKey = (id: string) => ['task-presence', id] as const

/**
 * "Ai đang xem việc này" kiểu Lark: bảng chi tiết đang mở gửi nhịp ~20s (tab ẩn thì ngừng ⇒ ~45s sau người khác hết thấy
 * mình), đóng thì báo rời. Ai vào / ra thì máy chủ đẩy gói PRESENCE lên kênh của việc ⇒ tải lại ngay (xem useTaskRealtime).
 */
export function useTaskPresence(taskId?: string | null) {
  const { data = [] } = useQuery({
    queryKey: presenceKey(taskId ?? ''),
    queryFn: () => taskApi.presence(taskId!),
    enabled: !!taskId,
    refetchInterval: 20_000,
    staleTime: 0,
    retry: false,
  })
  useEffect(() => {
    if (!taskId) return
    // Mở lại ngay (StrictMode gắn-gỡ-gắn, quay lại đúng việc vừa đóng) ⇒ huỷ lệnh rời đang chờ.
    window.clearTimeout(pendingLeave.get(taskId))
    pendingLeave.delete(taskId)
    return () => {
      pendingLeave.set(taskId, window.setTimeout(() => {
        pendingLeave.delete(taskId)
        taskApi.leavePresence(taskId).catch(() => { /* đóng tab giữa chừng: máy chủ tự quên sau 45s */ })
      }, 400))
    }
  }, [taskId])
  return data
}

/** Lệnh "rời việc" hoãn một nhịp để gắn lại ngay không gửi rời → vào lộn thứ tự. */
const pendingLeave = new Map<string, number>()

/** Ghi kết quả trả về (bản mới, version mới) thẳng vào cache chi tiết để lần sửa kế tiếp mang đúng version. */
function useSetTask() {
  const qc = useQueryClient()
  return (t: KpiTask | null | undefined) => {
    if (t) qc.setQueryData(taskKeys.one(t.id), t)
  }
}

export function useTaskMutations() {
  const refresh = useRefreshTasks()
  const setTask = useSetTask()
  const done = (t?: KpiTask | null) => {
    setTask(t)
    refresh()
  }
  return {
    create: useMutation({ mutationFn: (i: CreateTaskInput) => taskApi.create(i), onSuccess: done }),
    update: useMutation({ mutationFn: (v: { id: string; input: UpdateTaskInput }) => taskApi.update(v.id, v.input), onSuccess: done }),
    changeStatus: useMutation({
      mutationFn: (v: { id: string; status: TaskStatus; sortOrder?: number; version: number; force?: boolean }) =>
        taskApi.changeStatus(v.id, { status: v.status, sortOrder: v.sortOrder, version: v.version, force: v.force }),
      onSuccess: () => refresh(),
      onError: () => refresh(),
    }),
    assign: useMutation({
      mutationFn: ({ id, ...input }: AssignTaskInput & { id: string }) => taskApi.assign(id, input),
      onSuccess: done,
    }),
    setAssignees: useMutation({
      mutationFn: ({ id, ...input }: SetAssigneesInput & { id: string }) => taskApi.setAssignees(id, input),
      onSuccess: done,
    }),
    setKpi: useMutation({ mutationFn: ({ id, ...input }: SetKpiInput & { id: string }) => taskApi.setKpi(id, input), onSuccess: done }),
    decline: useMutation({ mutationFn: (v: { id: string; reason?: string }) => taskApi.decline(v.id, v.reason), onSuccess: () => refresh() }),
    addFollower: useMutation({ mutationFn: (v: { id: string; userId: string }) => taskApi.addFollower(v.id, v.userId), onSuccess: done }),
    removeFollower: useMutation({
      mutationFn: (v: { id: string; userId: string }) => taskApi.removeFollower(v.id, v.userId),
      onSuccess: (t) => done(t),
    }),
    setReminders: useMutation({
      mutationFn: (v: { id: string; reminders: ReminderInput[] }) => taskApi.setReminders(v.id, v.reminders),
      onSuccess: done,
    }),
    setTags: useMutation({ mutationFn: (v: { id: string; tagIds: string[] }) => taskApi.setTags(v.id, v.tagIds), onSuccess: done }),
    addDependency: useMutation({
      mutationFn: (v: { id: string; predecessorId: string }) => taskApi.addDependency(v.id, v.predecessorId),
      onSuccess: done,
    }),
    removeDependency: useMutation({ mutationFn: (dependencyId: string) => taskApi.removeDependency(dependencyId), onSuccess: () => refresh() }),
    setFieldValue: useMutation({
      mutationFn: (v: { id: string; fieldId: string; value: unknown }) => taskApi.setFieldValue(v.id, v.fieldId, v.value),
      onSuccess: done,
    }),
    duplicate: useMutation({ mutationFn: (id: string) => taskApi.duplicate(id), onSuccess: done }),
    setParent: useMutation({
      mutationFn: (v: { id: string; parentTaskId: string | null; version: number }) => taskApi.setParent(v.id, v.parentTaskId, v.version),
      onSuccess: done,
    }),
    setMilestone: useMutation({
      mutationFn: (v: { id: string; milestone: boolean; version: number }) => taskApi.setMilestone(v.id, v.milestone, v.version),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => taskApi.remove(id), onSuccess: () => refresh() }),
    addChecklist: useMutation({ mutationFn: (v: { id: string; title: string }) => taskApi.addChecklist(v.id, v.title), onSuccess: done }),
    updateChecklist: useMutation({
      mutationFn: (v: { id: string; itemId: string; title?: string; done?: boolean }) =>
        taskApi.updateChecklist(v.id, v.itemId, { title: v.title, done: v.done }),
      onSuccess: done,
    }),
    deleteChecklist: useMutation({ mutationFn: (v: { id: string; itemId: string }) => taskApi.deleteChecklist(v.id, v.itemId), onSuccess: done }),
    addAttachments: useMutation({
      mutationFn: (v: { id: string; files: File[]; kind?: TaskAttachmentKind }) => taskApi.addAttachments(v.id, v.files, v.kind),
      onSuccess: done,
    }),
    deleteAttachment: useMutation({
      mutationFn: (v: { id: string; attachmentId: string }) => taskApi.deleteAttachment(v.id, v.attachmentId),
      onSuccess: done,
    }),
    move: useMutation({
      mutationFn: (v: MoveTasksInput) => taskApi.move(v),
      onSuccess: () => refresh(),
    }),
    batch: useMutation({ mutationFn: (v: TaskBatchInput) => taskApi.batch(v), onSuccess: () => refresh() }),
    addToList: useMutation({
      mutationFn: (v: { listId: string; taskId: string; sectionId?: string | null }) => listApi.addItem(v.listId, v.taskId, v.sectionId),
      onSuccess: done,
    }),
    moveInList: useMutation({
      mutationFn: (v: { listId: string; taskId: string; sectionId?: string | null; clearSection?: boolean; sortOrder?: number }) =>
        listApi.moveItem(v.listId, { taskId: v.taskId, sectionId: v.sectionId, clearSection: v.clearSection, sortOrder: v.sortOrder }),
      onSuccess: done,
    }),
    assignMySection: useMutation({
      mutationFn: (v: { taskId: string; sectionId: string | null }) => mySectionApi.assign(v.taskId, v.sectionId),
      onSuccess: done,
    }),
    removeFromList: useMutation({
      mutationFn: (v: { listId: string; taskId: string }) => listApi.removeItem(v.listId, v.taskId),
      onSuccess: () => refresh(),
    }),
  }
}

/** Ghi bản chi tiết danh sách mới vào cache + làm mới cột trái. */
export function useSetTaskList() {
  const qc = useQueryClient()
  return (d: TaskListDetail | null | undefined) => {
    if (d) qc.setQueryData(taskKeys.taskList(d.id), d)
    qc.invalidateQueries({ queryKey: taskKeys.sidebar })
  }
}
