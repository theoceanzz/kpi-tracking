// Chuỗi duyệt KPI theo phân cấp — khớp DTO BE ở dto/response/kpi/approval.

import type { ProcessGraph } from '@/features/approvalProcess/types'

export type ApprovalSubjectType =
  | 'CRITERIA' | 'ADJUSTMENT' | 'SUBMISSION' | 'EVALUATION' | 'CYCLE_FINALIZE' | 'BSC_SCORECARD' | 'BSC_RESULT'
  | 'REWARD_GRANT' | 'GIFT_REDEMPTION' | 'FORM_REQUEST'
export type ApprovalOutcome = 'FORWARDED' | 'FINAL'
export type ApprovalFlowStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CLOSED_BY_LOCK'
export type ApprovalStepKind = 'UNIT_HEAD' | 'ADMIN_FALLBACK' | 'PROCESS_STEP'
export type ApprovalStepStatus =
  | 'WAITING'
  | 'PENDING'
  | 'APPROVED_FORWARDED'
  | 'APPROVED_FINAL'
  | 'REJECTED'
  | 'SKIPPED_DELEGATED'
  | 'SKIPPED_NO_HEAD'
  | 'SKIPPED_INACTIVE'
  | 'CANCELLED'
export type ApprovalEventAction =
  | 'SUBMITTED'
  | 'APPROVED_FORWARD'
  | 'APPROVED_FINAL'
  | 'REJECTED'
  | 'SKIPPED_DELEGATED'
  | 'SKIPPED_NO_HEAD'
  | 'SKIPPED_INACTIVE'
  | 'SELF_APPROVED_TOP'
  | 'REASSIGNED'
  | 'AUTO_ESCALATED'
  | 'REMINDED'
  | 'CANCELLED'
  | 'CLOSED_BY_LOCK'
  | 'MIGRATED'

/** Vị trí hiện tại trong chuỗi, tính cho người đang xem. */
export interface ApprovalSummary {
  flowId: string
  subjectType: ApprovalSubjectType
  round: number
  stepId: string
  stepNumber: number
  totalSteps: number
  currentUnitName: string | null
  holderIds: string[]
  holderNames: string[]
  pendingSince: string | null
  canAct: boolean
  actionKind: ApprovalOutcome | null
  nextHolderNames: string | null
  nextUnitName: string | null
  canReassign: boolean
}

export interface ApprovalPerson {
  id: string
  name: string
}

export interface ApprovalStep {
  id: string
  order: number
  kind: ApprovalStepKind
  orgUnitId: string | null
  orgUnitName: string | null
  /** Bước lập từ quy trình duyệt (`kind = PROCESS_STEP`): tên + mã "1", "1.1"… */
  stepName?: string | null
  stepCode?: string | null
  processNodeId?: string | null
  mergedUnitNames: string[]
  status: ApprovalStepStatus
  skipReason: string | null
  approvers: ApprovalPerson[]
  actedById: string | null
  actedByName: string | null
  actedAt: string | null
  reason: string | null
  pendingSince: string | null
}

export interface ApprovalEvent {
  id: string
  action: ApprovalEventAction
  stepOrder: number | null
  actorId: string | null
  actorName: string | null
  reason: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

export interface ApprovalFlow {
  id: string
  subjectType: ApprovalSubjectType
  kpiCriteriaId: string
  adjustmentRequestId: string | null
  round: number
  status: ApprovalFlowStatus
  requesterId: string | null
  requesterName: string | null
  currentStepOrder: number | null
  startedAt: string
  finishedAt: string | null
  /** Có khi flow lập theo quy trình duyệt của tổ chức. */
  process?: ApprovalFlowProcess | null
  steps: ApprovalStep[]
  events: ApprovalEvent[]
}

export interface ApprovalFlowProcess {
  id: string | null
  title: string | null
  /** Quy trình bật "Hiển thị quy trình trong đối tượng" lúc gửi ⇒ có `graph` (bản chụp). */
  showDiagram: boolean
  graph: ProcessGraph | null
  pathNodeIds: string[]
  currentNodeId: string | null
}

export interface KpiApprovalChain {
  /** Chuỗi của đối tượng khác KPI (bài nộp): kpiCriteriaId trống, kpiName là tên đối tượng. */
  subjectType?: ApprovalSubjectType
  subjectId?: string
  kpiCriteriaId: string | null
  kpiName: string
  chainMode: boolean
  current: ApprovalSummary | null
  flows: ApprovalFlow[]
}

export interface BulkApproveResult {
  kpiId: string
  kpiName: string | null
  success: boolean
  outcome: ApprovalOutcome | null
  nextHolderNames: string | null
  message: string
}
