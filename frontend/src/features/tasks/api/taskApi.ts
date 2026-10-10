import { appendFilesWithSources } from '@/features/documents/librarySource'
import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  CreateTaskInput, KpiTask, ReminderInput, TaskEvent, TaskListParams, TaskOption, TaskReplacement, TaskSidebar,
  TaskStatus, UpdateTaskInput,
} from '../types'

const BASE = '/kpi-tasks'
type R<T> = { data: ApiResponse<T> }
const data = <T,>(r: R<T>) => r.data.data

export const taskApi = {
  list: (p: TaskListParams) =>
    axiosInstance
      .get<ApiResponse<PageResponse<KpiTask>>>(BASE, {
        params: { ...p, status: p.status?.length ? p.status : undefined },
        // Spring nhận danh sách dạng status=A&status=B.
        paramsSerializer: { indexes: null },
      })
      .then(data),
  sidebar: () => axiosInstance.get<ApiResponse<TaskSidebar>>(`${BASE}/sidebar`).then(data),
  assignableUsers: (q: string) =>
    axiosInstance.get<ApiResponse<TaskOption[]>>(`${BASE}/assignable-users`, { params: { q: q || undefined } }).then(data),
  assignableKpis: (ownerId?: string) =>
    axiosInstance.get<ApiResponse<TaskOption[]>>(`${BASE}/assignable-kpis`, { params: { ownerId } }).then(data),
  followerCandidates: (id: string, q: string) =>
    axiosInstance.get<ApiResponse<TaskOption[]>>(`${BASE}/${id}/follower-candidates`, { params: { q: q || undefined } }).then(data),
  ofKpi: (kpiId: string) => axiosInstance.get<ApiResponse<KpiTask[]>>(`/kpi-criteria/${kpiId}/tasks`).then(data),
  replacements: (kpiId: string) =>
    axiosInstance.get<ApiResponse<TaskReplacement[]>>(`/kpi-criteria/${kpiId}/task-replacements`).then(data),
  get: (id: string) => axiosInstance.get<ApiResponse<KpiTask>>(`${BASE}/${id}`).then(data),
  history: (id: string) => axiosInstance.get<ApiResponse<TaskEvent[]>>(`${BASE}/${id}/events`).then(data),
  create: (input: CreateTaskInput) => axiosInstance.post<ApiResponse<KpiTask>>(BASE, input).then(data),
  update: (id: string, input: UpdateTaskInput) => axiosInstance.patch<ApiResponse<KpiTask>>(`${BASE}/${id}`, input).then(data),
  changeStatus: (id: string, input: { status: TaskStatus; sortOrder?: number; version: number; force?: boolean }) =>
    axiosInstance.patch<ApiResponse<KpiTask>>(`${BASE}/${id}/status`, input).then(data),
  assign: (id: string, input: { ownerId: string; kpiId?: string; version: number }) =>
    axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/assign`, input).then(data),
  addFollower: (id: string, userId: string) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/followers/${userId}`).then(data),
  removeFollower: (id: string, userId: string) =>
    axiosInstance.delete<ApiResponse<KpiTask | null>>(`${BASE}/${id}/followers/${userId}`).then(data),
  setReminders: (id: string, reminders: ReminderInput[]) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/reminders`, reminders).then(data),
  duplicate: (id: string) => axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/duplicate`).then(data),
  remove: (id: string) => axiosInstance.delete(`${BASE}/${id}`).then(() => undefined),
  addChecklist: (id: string, title: string) =>
    axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/checklist`, { title }).then(data),
  updateChecklist: (id: string, itemId: string, input: { title?: string; done?: boolean }) =>
    axiosInstance.patch<ApiResponse<KpiTask>>(`${BASE}/${id}/checklist/${itemId}`, input).then(data),
  deleteChecklist: (id: string, itemId: string) =>
    axiosInstance.delete<ApiResponse<KpiTask>>(`${BASE}/${id}/checklist/${itemId}`).then(data),
  addAttachments: (id: string, files: File[]) => {
    const form = new FormData()
    appendFilesWithSources(form, files)
    return sendMultipart<ApiResponse<KpiTask>>(`${BASE}/${id}/attachments`, form)
      .then(data)
  },
  deleteAttachment: (id: string, attachmentId: string) =>
    axiosInstance.delete<ApiResponse<KpiTask>>(`${BASE}/${id}/attachments/${attachmentId}`).then(data),
  move: (input: { fromKpiId: string; toKpiId: string; taskIds?: string[] }) =>
    axiosInstance.post<ApiResponse<{ moved: number }>>(`${BASE}/move`, input).then(data),
}
