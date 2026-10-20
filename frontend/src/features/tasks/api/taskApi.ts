import { appendFilesWithSources } from '@/features/documents/librarySource'
import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  CreateTaskInput, FollowerRemoval, FollowerRemovalRef, KpiTask, ReminderInput, TaskBatchInput, TaskBatchResult,
  TaskAttachmentKind, TaskCompletionMode, TaskEvent, TaskListParams, TaskOption, TaskReplacement, TaskActivityItem, TaskSidebar, TaskStatus, TaskViewer, UpdateTaskInput,
} from '../types'

export interface AssignTaskInput {
  ownerId: string
  kpiId?: string
  version: number
  /** Cặp (việc, người theo dõi) đã đồng ý gỡ — lấy từ assignImpact. */
  confirmedFollowerRemovals?: FollowerRemovalRef[]
}

export interface MoveTasksInput {
  fromKpiId: string
  toKpiId: string
  taskIds?: string[]
  /** Cặp (việc, người theo dõi) đã đồng ý gỡ — lấy từ moveImpact. */
  confirmedFollowerRemovals?: FollowerRemovalRef[]
}

export interface SetAssigneesInput {
  assigneeIds: string[]
  primaryId?: string
  completionMode?: TaskCompletionMode
  version: number
}

export interface SetKpiInput {
  /** null = gỡ KPI. */
  kpiId: string | null
  version: number
  confirmedFollowerRemovals?: FollowerRemovalRef[]
}

const BASE = '/kpi-tasks'
type R<T> = { data: ApiResponse<T> }
const data = <T,>(r: R<T>) => r.data.data

/** Bỏ tham số rỗng; danh sách gửi dạng status=A&status=B (Spring). */
function listParams(p: TaskListParams) {
  return {
    ...p,
    view: p.view === 'NOKPI' ? 'ALL' : p.view,
    hasKpi: p.view === 'NOKPI' ? false : p.hasKpi,
    status: p.status?.length ? p.status : undefined,
    tagIds: p.tagIds?.length ? p.tagIds : undefined,
  }
}

/** Tải tệp nhị phân (Excel) và mở hộp lưu của trình duyệt. */
export async function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export const taskApi = {
  list: (p: TaskListParams) =>
    axiosInstance
      .get<ApiResponse<PageResponse<KpiTask>>>(BASE, { params: listParams(p), paramsSerializer: { indexes: null } })
      .then(data),
  sidebar: () => axiosInstance.get<ApiResponse<TaskSidebar>>(`${BASE}/sidebar`).then(data),
  /** all = true ⇒ mọi người trong tổ chức (việc không KPI); false ⇒ người mình được giao việc trên KPI. */
  assignableUsers: (q: string, all = false) =>
    axiosInstance.get<ApiResponse<TaskOption[]>>(`${BASE}/assignable-users`, { params: { q: q || undefined, all: all || undefined } })
      .then(data),
  assignableKpis: (ownerId?: string) =>
    axiosInstance.get<ApiResponse<TaskOption[]>>(`${BASE}/assignable-kpis`, { params: { ownerId } }).then(data),
  followerCandidates: (id: string, q: string) =>
    axiosInstance.get<ApiResponse<TaskOption[]>>(`${BASE}/${id}/follower-candidates`, { params: { q: q || undefined } }).then(data),
  ofKpi: (kpiId: string) => axiosInstance.get<ApiResponse<KpiTask[]>>(`/kpi-criteria/${kpiId}/tasks`).then(data),
  replacements: (kpiId: string) =>
    axiosInstance.get<ApiResponse<TaskReplacement[]>>(`/kpi-criteria/${kpiId}/task-replacements`).then(data),
  get: (id: string) => axiosInstance.get<ApiResponse<KpiTask>>(`${BASE}/${id}`).then(data),
  history: (id: string) => axiosInstance.get<ApiResponse<TaskEvent[]>>(`${BASE}/${id}/events`).then(data),
  /** Lark ··· > Đặt việc cha / Chuyển thành việc độc lập (null). */
  setParent: (id: string, parentTaskId: string | null, version: number) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/parent`, { parentTaskId, version }).then(data),
  /** Lark ··· > Đánh dấu mốc. */
  setMilestone: (id: string, milestone: boolean, version: number) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/milestone`, { milestone, version }).then(data),
  /** Trang "Hoạt động": của việc mình tạo / phụ trách / theo dõi, hoặc của một danh sách. */
  activities: (p: { listId?: string; page: number; size: number }) =>
    axiosInstance.get<ApiResponse<{ items: TaskActivityItem[]; hasMore: boolean }>>(`${BASE}/activities`, { params: p }).then(data),
  /** Nhịp "đang xem việc này"; trả những người khác đang xem. */
  presence: (id: string) => axiosInstance.post<ApiResponse<TaskViewer[]>>(`${BASE}/${id}/presence`).then(data),
  leavePresence: (id: string) => axiosInstance.delete(`${BASE}/${id}/presence`),
  create: (input: CreateTaskInput) => axiosInstance.post<ApiResponse<KpiTask>>(BASE, input).then(data),
  update: (id: string, input: UpdateTaskInput) => axiosInstance.patch<ApiResponse<KpiTask>>(`${BASE}/${id}`, input).then(data),
  changeStatus: (id: string, input: { status: TaskStatus; sortOrder?: number; version: number; force?: boolean }) =>
    axiosInstance.patch<ApiResponse<KpiTask>>(`${BASE}/${id}/status`, input).then(data),
  assign: (id: string, input: AssignTaskInput) =>
    axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/assign`, input).then(data),
  setAssignees: (id: string, input: SetAssigneesInput) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/assignees`, input).then(data),
  setKpi: (id: string, input: SetKpiInput) => axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/kpi`, input).then(data),
  decline: (id: string, reason?: string) =>
    axiosInstance.post<ApiResponse<KpiTask | null>>(`${BASE}/${id}/decline`, { reason }).then(data),
  /** Xem trước khi giao / chuyển / gắn KPI: người theo dõi nào sẽ bị gỡ khỏi việc nào. */
  assignImpact: (id: string, kpiId?: string) =>
    axiosInstance.get<ApiResponse<FollowerRemoval[]>>(`${BASE}/${id}/assign-impact`, { params: { kpiId } }).then(data),
  addFollower: (id: string, userId: string) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/followers/${userId}`).then(data),
  removeFollower: (id: string, userId: string) =>
    axiosInstance.delete<ApiResponse<KpiTask | null>>(`${BASE}/${id}/followers/${userId}`).then(data),
  setReminders: (id: string, reminders: ReminderInput[]) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/reminders`, reminders).then(data),
  setTags: (id: string, tagIds: string[]) => axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/tags`, tagIds).then(data),
  addDependency: (id: string, predecessorId: string) =>
    axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/dependencies/${predecessorId}`).then(data),
  removeDependency: (dependencyId: string) => axiosInstance.delete(`/kpi-task-dependencies/${dependencyId}`).then(() => undefined),
  setFieldValue: (id: string, fieldId: string, value: unknown) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${BASE}/${id}/fields/${fieldId}`, { value }).then(data),
  duplicate: (id: string) => axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/duplicate`).then(data),
  remove: (id: string) => axiosInstance.delete(`${BASE}/${id}`).then(() => undefined),
  addChecklist: (id: string, title: string) =>
    axiosInstance.post<ApiResponse<KpiTask>>(`${BASE}/${id}/checklist`, { title }).then(data),
  updateChecklist: (id: string, itemId: string, input: { title?: string; done?: boolean }) =>
    axiosInstance.patch<ApiResponse<KpiTask>>(`${BASE}/${id}/checklist/${itemId}`, input).then(data),
  deleteChecklist: (id: string, itemId: string) =>
    axiosInstance.delete<ApiResponse<KpiTask>>(`${BASE}/${id}/checklist/${itemId}`).then(data),
  addAttachments: (id: string, files: File[], kind: TaskAttachmentKind = 'REFERENCE') => {
    const form = new FormData()
    appendFilesWithSources(form, files)
    form.append('kind', kind)
    return sendMultipart<ApiResponse<KpiTask>>(`${BASE}/${id}/attachments`, form)
      .then(data)
  },
  deleteAttachment: (id: string, attachmentId: string) =>
    axiosInstance.delete<ApiResponse<KpiTask>>(`${BASE}/${id}/attachments/${attachmentId}`).then(data),
  move: (input: MoveTasksInput) =>
    axiosInstance.post<ApiResponse<{ moved: number }>>(`${BASE}/move`, input).then(data),
  moveImpact: (input: Omit<MoveTasksInput, 'confirmedFollowerRemovals'>) =>
    axiosInstance
      .get<ApiResponse<FollowerRemoval[]>>(`${BASE}/move-impact`, { params: input, paramsSerializer: { indexes: null } })
      .then(data),
  batch: (input: TaskBatchInput) => axiosInstance.post<ApiResponse<TaskBatchResult>>(`${BASE}/batch`, input).then(data),
  /** Xuất Excel theo bộ lọc đang xem. */
  exportExcel: async (p: TaskListParams) => {
    const res = await axiosInstance.get(`${BASE}/export`, {
      params: listParams(p), paramsSerializer: { indexes: null }, responseType: 'blob',
    })
    await saveBlob(res.data as Blob, 'tasks.xlsx')
  },
}
