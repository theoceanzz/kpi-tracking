export type SubmissionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

// Matches BE: SubmissionResponse
export interface Submission {
  id: string
  kpiCriteriaId: string
  kpiCriteriaName: string
  actualValue: number
  targetValue: number | null
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
  unit: string | null
  weight: number | null
  kpiPeriod: { id: string; name: string } | null
  attachments: Attachment[]
  isSubmittedByManager: boolean
  createdAt: string
  updatedAt: string
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
  actualValue: number
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
}
