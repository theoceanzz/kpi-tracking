import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import type { ApiResponse } from '@/types/api'
import { saveBlob } from './taskApi'
import type {
  KpiTask, TaskAutomation, TaskDashboardConfig, TaskMySection, TaskFieldOption, TaskFieldType, TaskImportPreview, TaskImportResult, TaskImportRow, TaskListDetail,
  TaskListRole, TaskListStats, TaskListTemplate, TaskListUpsert, TaskSavedView, TaskSavedViewConfig, TaskTag,
} from '../types'

type R<T> = { data: ApiResponse<T> }
const data = <T,>(r: R<T>) => r.data.data
const L = '/task-lists'

export interface FieldInput {
  name?: string
  type?: TaskFieldType
  options?: TaskFieldOption[]
  sortOrder?: number
}

export interface AutomationInput {
  name?: string
  trigger?: Record<string, unknown>
  action?: Record<string, unknown>
  enabled?: boolean
}

/** Danh sách công việc: thành viên, nhóm, việc, trường, chế độ xem, mẫu, tự động hoá, thống kê, nhập Excel. */
export const listApi = {
  get: (id: string) => axiosInstance.get<ApiResponse<TaskListDetail>>(`${L}/${id}`).then(data),
  create: (input: TaskListUpsert) => axiosInstance.post<ApiResponse<TaskListDetail>>(L, input).then(data),
  update: (id: string, input: TaskListUpsert) => axiosInstance.patch<ApiResponse<TaskListDetail>>(`${L}/${id}`, input).then(data),
  archive: (id: string, archived: boolean) =>
    axiosInstance.post<ApiResponse<TaskListDetail>>(`${L}/${id}/archive`, null, { params: { archived } }).then(data),
  remove: (id: string) => axiosInstance.delete(`${L}/${id}`).then(() => undefined),

  addMember: (id: string, m: { userId?: string; orgUnitId?: string; role: TaskListRole }) =>
    axiosInstance.post<ApiResponse<TaskListDetail>>(`${L}/${id}/members`, m).then(data),
  updateMember: (id: string, memberId: string, role: TaskListRole) =>
    axiosInstance.patch<ApiResponse<TaskListDetail>>(`${L}/${id}/members/${memberId}`, { role }).then(data),
  removeMember: (id: string, memberId: string) =>
    axiosInstance.delete<ApiResponse<TaskListDetail | null>>(`${L}/${id}/members/${memberId}`).then(data),

  addSection: (id: string, name: string) =>
    axiosInstance.post<ApiResponse<TaskListDetail>>(`${L}/${id}/sections`, { name }).then(data),
  updateSection: (id: string, sectionId: string, input: { name?: string; sortOrder?: number }) =>
    axiosInstance.patch<ApiResponse<TaskListDetail>>(`${L}/${id}/sections/${sectionId}`, input).then(data),
  deleteSection: (id: string, sectionId: string) =>
    axiosInstance.delete<ApiResponse<TaskListDetail>>(`${L}/${id}/sections/${sectionId}`).then(data),

  addItem: (id: string, taskId: string, sectionId?: string | null) =>
    axiosInstance.post<ApiResponse<KpiTask>>(`${L}/${id}/items`, { taskId, sectionId: sectionId ?? undefined }).then(data),
  moveItem: (id: string, input: { taskId: string; sectionId?: string | null; clearSection?: boolean; sortOrder?: number }) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`${L}/${id}/items`, input).then(data),
  removeItem: (id: string, taskId: string) => axiosInstance.delete(`${L}/${id}/items/${taskId}`).then(() => undefined),

  addField: (id: string, input: FieldInput) => axiosInstance.post<ApiResponse<TaskListDetail>>(`${L}/${id}/fields`, input).then(data),
  updateField: (id: string, fieldId: string, input: FieldInput) =>
    axiosInstance.patch<ApiResponse<TaskListDetail>>(`${L}/${id}/fields/${fieldId}`, input).then(data),
  deleteField: (id: string, fieldId: string) =>
    axiosInstance.delete<ApiResponse<TaskListDetail>>(`${L}/${id}/fields/${fieldId}`).then(data),

  automations: (id: string) => axiosInstance.get<ApiResponse<TaskAutomation[]>>(`${L}/${id}/automations`).then(data),
  createAutomation: (id: string, input: AutomationInput) =>
    axiosInstance.post<ApiResponse<TaskAutomation>>(`${L}/${id}/automations`, input).then(data),
  updateAutomation: (id: string, automationId: string, input: AutomationInput) =>
    axiosInstance.patch<ApiResponse<TaskAutomation>>(`${L}/${id}/automations/${automationId}`, input).then(data),
  deleteAutomation: (id: string, automationId: string) =>
    axiosInstance.delete(`${L}/${id}/automations/${automationId}`).then(() => undefined),

  /** Ghim / thư mục của riêng tôi. */
  setMyPrefs: (id: string, input: { pinned?: boolean; folder?: string; clearFolder?: boolean }) =>
    axiosInstance.put(`${L}/${id}/my-prefs`, input).then(() => undefined),
  setDashboard: (id: string, config: TaskDashboardConfig | null) =>
    axiosInstance.put<ApiResponse<TaskListDetail>>(`${L}/${id}/dashboard`, { config }).then(data),

  stats: (id: string) => axiosInstance.get<ApiResponse<TaskListStats>>(`${L}/${id}/stats`).then(data),

  templates: () => axiosInstance.get<ApiResponse<TaskListTemplate[]>>('/task-list-templates').then(data),
  saveAsTemplate: (id: string, input: { name?: string; description?: string; includeTasks: boolean }) =>
    axiosInstance.post<ApiResponse<TaskListTemplate>>(`${L}/${id}/save-as-template`, input).then(data),
  deleteTemplate: (templateId: string) => axiosInstance.delete(`/task-list-templates/${templateId}`).then(() => undefined),

  views: () => axiosInstance.get<ApiResponse<TaskSavedView[]>>('/task-views').then(data),
  createView: (input: { name: string; listId?: string | null; config: TaskSavedViewConfig; shared?: boolean }) =>
    axiosInstance.post<ApiResponse<TaskSavedView>>('/task-views', input).then(data),
  updateView: (viewId: string, input: { name?: string; config?: TaskSavedViewConfig; shared?: boolean }) =>
    axiosInstance.patch<ApiResponse<TaskSavedView>>(`/task-views/${viewId}`, input).then(data),
  deleteView: (viewId: string) => axiosInstance.delete(`/task-views/${viewId}`).then(() => undefined),

  importTemplate: async () => {
    const res = await axiosInstance.get(`${L}/import-template`, { responseType: 'blob' })
    await saveBlob(res.data as Blob, 'task-import-template.xlsx')
  },
  importPreview: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return sendMultipart<ApiResponse<TaskImportPreview>>(`${L}/${id}/import/preview`, form).then(data)
  },
  importCommit: (id: string, rows: TaskImportRow[]) =>
    axiosInstance.post<ApiResponse<TaskImportResult>>(`${L}/${id}/import`, { rows }).then(data),
}

/** Nhóm riêng trong "Việc của tôi". */
export const mySectionApi = {
  list: () => axiosInstance.get<ApiResponse<TaskMySection[]>>('/kpi-tasks/my-sections').then(data),
  create: (name: string) => axiosInstance.post<ApiResponse<TaskMySection>>('/kpi-tasks/my-sections', { name }).then(data),
  update: (id: string, input: { name?: string; sortOrder?: number }) =>
    axiosInstance.patch<ApiResponse<TaskMySection>>(`/kpi-tasks/my-sections/${id}`, input).then(data),
  remove: (id: string) => axiosInstance.delete(`/kpi-tasks/my-sections/${id}`).then(() => undefined),
  assign: (taskId: string, sectionId: string | null) =>
    axiosInstance.put<ApiResponse<KpiTask>>(`/kpi-tasks/${taskId}/my-section`, { sectionId }).then(data),
}

export const tagApi = {
  list: () => axiosInstance.get<ApiResponse<TaskTag[]>>('/task-tags').then(data),
  create: (name: string, color?: string) => axiosInstance.post<ApiResponse<TaskTag>>('/task-tags', { name, color }).then(data),
  update: (id: string, input: { name?: string; color?: string }) =>
    axiosInstance.patch<ApiResponse<TaskTag>>(`/task-tags/${id}`, input).then(data),
  remove: (id: string) => axiosInstance.delete(`/task-tags/${id}`).then(() => undefined),
}
