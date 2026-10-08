import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import type { ApiResponse, PageResponse } from '@/types/api'
import type { Submission, CreateSubmissionRequest, UpdateSubmissionRequest, ReviewSubmissionRequest, ReturnSubmissionRequest, Attachment } from '@/types/submission'
import type { SubmissionStatus } from '@/types/submission'

export const submissionApi = {
  getAll: (params: { 
    page?: number; 
    size?: number; 
    status?: SubmissionStatus; 
    kpiCriteriaId?: string;
    submittedById?: string;
    orgUnitId?: string;
    kpiPeriodId?: string;
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
    kpiPeriodId?: string;
  } = {}) =>
    axiosInstance.get<ApiResponse<PageResponse<Submission>>>('/submissions/my', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<Submission>>(`/submissions/${id}`).then((r) => r.data.data),

  create: (data: CreateSubmissionRequest) =>
    axiosInstance.post<ApiResponse<Submission>>('/submissions', data).then((r) => r.data.data),

  update: (id: string, data: UpdateSubmissionRequest) =>
    axiosInstance.put<ApiResponse<Submission>>(`/submissions/${id}`, data).then((r) => r.data.data),

  /** Hoàn duyệt: trả bài nộp về để nhân viên làm lại bằng bài nộp mới trước hạn nộp lại. */
  returnSubmission: (id: string, data: ReturnSubmissionRequest) =>
    axiosInstance.post<ApiResponse<Submission>>(`/submissions/${id}/return`, data).then((r) => r.data.data),

  review: (id: string, data: ReviewSubmissionRequest) =>
    axiosInstance.post<ApiResponse<Submission>>(`/submissions/${id}/review`, data).then((r) => r.data.data),

  bulkReview: (data: { 
    submissionIds: string[], 
    commonReview: ReviewSubmissionRequest,
    individualReviews?: { submissionId: string, managerScore?: number, qualitativeLevelId?: string, reviewNote?: string }[]
  }) =>
    axiosInstance.post<ApiResponse<Submission[]>>('/submissions/bulk-review', data).then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/submissions/${id}`).then((r) => r.data),

  uploadAttachments: (id: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return sendMultipart<ApiResponse<Attachment[]>>(`/submissions/${id}/attachments`, formData).then((r) => r.data.data)
  },

  getAttachments: (id: string) =>
    axiosInstance.get<ApiResponse<Attachment[]>>(`/submissions/${id}/attachments`).then((r) => r.data.data),

  deleteAttachment: (attachmentId: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/submissions/attachments/${attachmentId}`).then((r) => r.data),
}
