export type SubmissionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED'

// Matches BE: SubmissionResponse
export interface Submission {
  id: string
  kpiCriteriaId: string
  kpiCriteriaName: string
  kpiType: import('./kpi').KpiType
  actualValue: number
  targetValue: number | null
  qualitativeLevelId: string | null
  qualitativeLevelName: string | null
  qualitativeLevelValue: number | null
  note: string | null
  status: SubmissionStatus
  submittedById: string
  submittedByName: string
  reviewedById: string | null
  reviewedByName: string | null
  reviewNote: string | null
  reviewedAt: string | null
  periodStart: string | null
  periodEnd: string | null
  autoScore: number | null
  managerScore: number | null
  unit: string | null
  weight: number | null
  kpiPeriod: { id: string; name: string } | null
  attachments: Attachment[]
  isSubmittedByManager: boolean
  createdAt: string
  updatedAt: string
  parentSubmissionId?: string
  allChildrenApproved?: boolean
  // Hoàn duyệt (trả lại để làm lại)
  returnedById?: string | null
  returnedByName?: string | null
  returnedAt?: string | null
  returnReason?: string | null
  resubmitDeadline?: string | null
  /** Bài nộp mới thay cho bài bị trả lại này. */
  resubmissionId?: string | null
  /** Bị trả lại, chưa nộp bài mới và chưa quá hạn nộp lại. */
  awaitingResubmission?: boolean
  /** Bài này là bài nộp lại (thay cho một bài bị trả lại). */
  resubmission?: boolean
  previousReturnReason?: string | null
}

// Matches BE: ReturnSubmissionRequest
export interface ReturnSubmissionRequest {
  reason: string
  /** ISO instant */
  resubmitDeadline: string
}

// Matches BE: AttachmentResponse
export interface Attachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  contentType: string
  storageProvider: string
  createdAt: string
}

export interface CreateSubmissionRequest {
  kpiCriteriaId: string
  actualValue?: number
  qualitativeLevelId?: string
  note?: string
  periodStart?: string
  periodEnd?: string
  isDraft?: boolean
}

export interface UpdateSubmissionRequest {
  actualValue?: number
  note?: string
  periodStart?: string
  periodEnd?: string
  isDraft?: boolean
}

// Matches BE: ReviewSubmissionRequest
export interface ReviewSubmissionRequest {
  status: 'APPROVED' | 'REJECTED'
  reviewNote?: string
  managerScore?: number
  qualitativeLevelId?: string
}
