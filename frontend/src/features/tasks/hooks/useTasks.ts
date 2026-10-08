import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscribeTopic } from '@/lib/realtime'
import { taskApi } from '../api/taskApi'
import type { CreateTaskInput, KpiTask, ReminderInput, TaskListParams, TaskStatus, UpdateTaskInput } from '../types'

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
      qc.invalidateQueries({ queryKey: taskKeys.one(openTaskId) })
      qc.invalidateQueries({ queryKey: taskKeys.history(openTaskId) })
    })
  }, [openTaskId, qc, onDeleted])
}

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
      mutationFn: (v: { id: string; ownerId: string; kpiId?: string; version: number }) =>
        taskApi.assign(v.id, { ownerId: v.ownerId, kpiId: v.kpiId, version: v.version }),
      onSuccess: done,
    }),
    addFollower: useMutation({ mutationFn: (v: { id: string; userId: string }) => taskApi.addFollower(v.id, v.userId), onSuccess: done }),
    removeFollower: useMutation({
      mutationFn: (v: { id: string; userId: string }) => taskApi.removeFollower(v.id, v.userId),
      onSuccess: (t) => done(t),
    }),
    setReminders: useMutation({
      mutationFn: (v: { id: string; reminders: ReminderInput[] }) => taskApi.setReminders(v.id, v.reminders),
      onSuccess: done,
    }),
    duplicate: useMutation({ mutationFn: (id: string) => taskApi.duplicate(id), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => taskApi.remove(id), onSuccess: () => refresh() }),
    addChecklist: useMutation({ mutationFn: (v: { id: string; title: string }) => taskApi.addChecklist(v.id, v.title), onSuccess: done }),
    updateChecklist: useMutation({
      mutationFn: (v: { id: string; itemId: string; title?: string; done?: boolean }) =>
        taskApi.updateChecklist(v.id, v.itemId, { title: v.title, done: v.done }),
      onSuccess: done,
    }),
    deleteChecklist: useMutation({ mutationFn: (v: { id: string; itemId: string }) => taskApi.deleteChecklist(v.id, v.itemId), onSuccess: done }),
    addAttachments: useMutation({ mutationFn: (v: { id: string; files: File[] }) => taskApi.addAttachments(v.id, v.files), onSuccess: done }),
    deleteAttachment: useMutation({
      mutationFn: (v: { id: string; attachmentId: string }) => taskApi.deleteAttachment(v.id, v.attachmentId),
      onSuccess: done,
    }),
    move: useMutation({
      mutationFn: (v: { fromKpiId: string; toKpiId: string; taskIds?: string[] }) => taskApi.move(v),
      onSuccess: () => refresh(),
    }),
  }
}
