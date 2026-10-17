import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import type { PeopleSearch } from '@/features/approvalProcess/components/pickers/peopleSearch'
import type { ApiResponse, PageResponse } from '@/types/api'
import type {
  AdminView,
  Catalog,
  FlowPreview,
  FormDetail,
  FormGroup,
  FormRequestBody,
  FormValues,
  Library,
  LocalizedName,
  ProcessOptionsResponse,
  RequestBox,
  RequestDetail,
  RequestItem,
  SubmitView,
  UploadedFile,
} from '../types'

/** Người / đơn vị tìm được trong tổ chức (BE dùng lại bộ chọn chia sẻ tài liệu). */
export interface DirectoryTarget {
  type: 'USER' | 'UNIT'
  id: string
  name: string
  detail: string | null
}

export interface DirectoryUnit {
  id: string
  name: string
  parentId: string | null
  memberCount: number
}

const data = <T,>(r: { data: ApiResponse<T> }) => r.data.data

/** Không endpoint nào nhận organizationId: backend suy tổ chức từ người đang đăng nhập. */
export const approvalFormsApi = {
  // Quản trị
  admin: () => axiosInstance.get<ApiResponse<AdminView>>('/approval-forms/admin').then(data),
  library: () => axiosInstance.get<ApiResponse<Library>>('/approval-forms/library').then(data),
  processOptions: () =>
    axiosInstance.get<ApiResponse<ProcessOptionsResponse>>('/approval-forms/process-options').then(data),
  get: (id: string) => axiosInstance.get<ApiResponse<FormDetail>>(`/approval-forms/${id}`).then(data),
  create: (body: FormRequestBody) =>
    axiosInstance.post<ApiResponse<FormDetail>>('/approval-forms', body).then(data),
  update: (id: string, body: FormRequestBody) =>
    axiosInstance.put<ApiResponse<FormDetail>>(`/approval-forms/${id}`, body).then(data),
  setActive: (id: string, active: boolean) =>
    axiosInstance.patch<ApiResponse<void>>(`/approval-forms/${id}/active`, { active }).then(data),
  rename: (id: string, name: LocalizedName, description?: LocalizedName) =>
    axiosInstance.patch<ApiResponse<void>>(`/approval-forms/${id}/names`, { name, description }).then(data),
  remove: (id: string) => axiosInstance.delete<ApiResponse<void>>(`/approval-forms/${id}`).then(data),

  createGroup: (name: LocalizedName) =>
    axiosInstance.post<ApiResponse<FormGroup>>('/approval-form-groups', { name }).then(data),
  updateGroup: (id: string, name: LocalizedName) =>
    axiosInstance.put<ApiResponse<FormGroup>>(`/approval-form-groups/${id}`, { name }).then(data),
  setGroupActive: (id: string, active: boolean) =>
    axiosInstance.patch<ApiResponse<void>>(`/approval-form-groups/${id}/active`, { active }).then(data),
  removeGroup: (id: string) => axiosInstance.delete<ApiResponse<void>>(`/approval-form-groups/${id}`).then(data),
  reorderGroups: (ids: string[]) =>
    axiosInstance.put<ApiResponse<void>>('/approval-form-groups/order', { ids }).then(data),
  reorderForms: (groupId: string, ids: string[]) =>
    axiosInstance.put<ApiResponse<void>>(`/approval-form-groups/${groupId}/forms/order`, { ids }).then(data),

  // Tra người / đơn vị (chỉ cần đăng nhập)
  targets: (q: string) =>
    axiosInstance.get<ApiResponse<DirectoryTarget[]>>('/approval-forms/directory/targets', { params: { q } }).then(data),
  units: () => axiosInstance.get<ApiResponse<DirectoryUnit[]>>('/approval-forms/directory/units').then(data),

  // Nhân viên
  catalog: () => axiosInstance.get<ApiResponse<Catalog>>('/approval-forms/catalog').then(data),
  submitView: (formId: string) =>
    axiosInstance.get<ApiResponse<SubmitView>>(`/approval-requests/forms/${formId}`).then(data),
  upload: (files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return sendMultipart<ApiResponse<UploadedFile[]>>('/approval-requests/uploads', form).then(data)
  },
  previewFlow: (body: { formId: string; orgUnitId: string; values: FormValues }) =>
    axiosInstance.post<ApiResponse<FlowPreview>>('/approval-requests/preview-flow', body).then(data),
  submit: (body: { formId: string; orgUnitId: string; values: FormValues }) =>
    axiosInstance.post<ApiResponse<RequestDetail>>('/approval-requests', body).then(data),
  list: (params: { box: RequestBox; q?: string; page?: number; size?: number }) =>
    axiosInstance.get<ApiResponse<PageResponse<RequestItem>>>('/approval-requests', { params }).then(data),
  counts: () =>
    axiosInstance.get<ApiResponse<{ todo: number; inReview: number }>>('/approval-requests/counts').then(data),
  detail: (id: string) => axiosInstance.get<ApiResponse<RequestDetail>>(`/approval-requests/${id}`).then(data),
  withdraw: (id: string) =>
    axiosInstance.post<ApiResponse<RequestDetail>>(`/approval-requests/${id}/withdraw`).then(data),
}

/** Tìm người cho widget Liên hệ — nguồn chỉ cần đăng nhập. */
export const directoryPeopleSearch: PeopleSearch = {
  key: 'approval-forms-directory',
  search: (keyword) => approvalFormsApi.targets(keyword).then((list) =>
    list.filter((x) => x.type === 'USER').map((x) => ({ id: x.id, name: x.name, detail: x.detail }))),
}
