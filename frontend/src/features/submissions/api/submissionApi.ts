import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { Submission, CreateSubmissionRequest, UpdateSubmissionRequest, ReviewSubmissionRequest, Attachment } from '@/types/submission'
import type { SubmissionStatus } from '@/types/submission'

export const submissionApi = {
  getAll: (params: { 
    page?: number; 
    size?: number; 
    status?: SubmissionStatus; 
    kpiCriteriaId?: string;
    submittedById?: string;
    orgUnitId?: string;
    organizationId?: string;
    sortBy?: string;
    sortDir?: string;
  }) =>
    axiosInstance.get<ApiResponse<PageResponse<Submission>>>('/submissions', { params }).then((r) => r.data.data),

  getMy: (params: { 
    page?: number; 
    size?: number; 
    status?: SubmissionStatus; 
    sortBy?: string;
    sortDir?: string;
    submittedById?: string;
  } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<Submission>>>('/submissions/my', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Submission>>(`/submissions/${id}`).then((r) => r.data.data),

  create: (data: CreateSubmissionRequest) =>
    axiosInstance.post<ApiResponse<Submission>>('/submissions', data).then((r) => r.data.data),

  update: (id: string, data: UpdateSubmissionRequest) =>
    axiosInstance.put<ApiResponse<Submission>>(`/submissions/${id}`, data).then((r) => r.data.data),

  review: (id: string, data: ReviewSubmissionRequest) =>
    axiosInstance.post<ApiResponse<Submission>>(`/submissions/${id}/review`, data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/submissions/${id}`).then((r) => r.data),

  uploadAttachments: (id: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return axiosInstance.post<ApiResponse<Attachment[]>>(`/submissions/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data)
  },

  getAttachments: (id: string) =>
    axiosInstance.get<ApiResponse<Attachment[]>>(`/submissions/${id}/attachments`).then((r) => r.data.data),

  deleteAttachment: (attachmentId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/submissions/attachments/${attachmentId}`).then((r) => r.data),
}
