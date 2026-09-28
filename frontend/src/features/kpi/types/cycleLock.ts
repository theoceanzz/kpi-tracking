import type { KpiCycleStatus, KpiFrequency, KpiPeriodStatus } from '@/types/kpi'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Tiến độ đợt khi xét khoá kỳ (tính từ KPI, không lưu). Khớp BE PeriodProgress. */
export type PeriodProgress = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'

/** Nhóm tiến độ của một KPI. Khớp BE KpiProgressBucket — thứ tự là thứ tự vòng đời. */
export type KpiProgressBucket =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED' | 'NOT_SUBMITTED'
  | 'SUBMISSION_PENDING' | 'AWAITING_EVALUATION' | 'COMPLETED' | 'CLOSED'

export const BUCKET_ORDER: KpiProgressBucket[] = [
  'DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'NOT_SUBMITTED',
  'SUBMISSION_PENDING', 'AWAITING_EVALUATION', 'COMPLETED', 'CLOSED',
]

export const BUCKET_LABEL = perLanguage((): Record<KpiProgressBucket, string> => ({
  DRAFT: i18n.t('kpi:cycleLock.draft'),
  PENDING_APPROVAL: i18n.t('kpi:cycleLock.pendingApproval'),
  REJECTED: i18n.t('kpi:cycleLock.returned'),
  NOT_SUBMITTED: i18n.t('kpi:cycleLock.resultsNotSubmitted'),
  SUBMISSION_PENDING: i18n.t('kpi:cycleLock.resultsPendingApproval'),
  AWAITING_EVALUATION: i18n.t('kpi:cycleLock.pendingEvaluation'),
  COMPLETED: i18n.t('kpi:cycleLock.completed'),
  CLOSED: i18n.t('kpi:cycleLock.closed'),
}))

export const PROGRESS_LABEL = perLanguage((): Record<PeriodProgress, string> => ({
  COMPLETED: i18n.t('kpi:cycleLock.completed'),
  IN_PROGRESS: i18n.t('kpi:cycleLock.unfinished'),
  NOT_STARTED: i18n.t('kpi:cycleLock.notStarted'),
}))

export const PERIOD_STATUS_LABEL = perLanguage((): Record<KpiPeriodStatus, string> => ({
  ACTIVE: i18n.t('kpi:cycleLock.active'),
  CLOSED_BY_LOCK: i18n.t('kpi:cycleLock.closedByCycleLock'),
  TRANSFERRED: i18n.t('kpi:cycleLock.movedToAnotherCycle'),
  CANCELLED: i18n.t('kpi:cycleLock.cancelled'),
}))

export interface CycleRef {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
}

export interface PeriodPreview {
  periodId: string
  name: string
  startDate: string | null
  endDate: string | null
  status: KpiPeriodStatus
  progress: PeriodProgress
  kpiCount: number
  bucketCounts: Partial<Record<KpiProgressBucket, number>>
  unfinishedKpiCount: number
  willSplitOnTransfer: boolean
  canCancel: boolean
}

export interface CycleLockPreview {
  cycleId: string
  cycleName: string
  cycleType: KpiFrequency
  status: KpiCycleStatus
  startDate: string | null
  endDate: string | null
  previewToken: string
  totalPeriods: number
  completedCount: number
  inProgressCount: number
  notStartedCount: number
  targetCycles: CycleRef[]
  periods: PeriodPreview[]
}

export type PeriodLockAction = 'TRANSFER' | 'CLOSE' | 'CANCEL'

export interface PeriodDecision {
  periodId: string
  action: PeriodLockAction
  targetCycleId?: string | null
  newStartDate?: string | null
  newEndDate?: string | null
}

export interface LockCyclePayload {
  previewToken: string
  decisions: PeriodDecision[]
}

export type KpiCycleEventAction =
  | 'LOCK' | 'EXTEND' | 'REOPEN' | 'PERIOD_TRANSFER' | 'PERIOD_SPLIT' | 'PERIOD_CLOSE' | 'PERIOD_CANCEL'

export interface KpiCycleEvent {
  id: string
  action: KpiCycleEventAction
  actorId: string | null
  actorName: string | null
  createdAt: string
  periodId: string | null
  periodName: string | null
  newPeriodId: string | null
  newPeriodName: string | null
  targetCycleId: string | null
  targetCycleName: string | null
  oldEndDate: string | null
  newEndDate: string | null
  affectedKpiIds: string[] | null
  reason: string | null
  detail: Record<string, unknown> | null
}
