import type {
  ApprovalEventAction,
  ApprovalFlowStatus,
  ApprovalStepStatus,
  ApprovalSummary,
} from '@/types/approvalChain'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Nhãn nút duyệt theo quyền của NGƯỜI ĐANG XEM: "Duyệt cuối" khi bấm là chốt, "Duyệt và chuyển lên
 * [người kế tiếp]" khi chỉ là bước trung gian. Không có chuỗi (luồng một cấp) thì chỉ là "Duyệt".
 */
export function approveButtonLabel(summary: ApprovalSummary | null | undefined): string {
  if (!summary?.canAct || !summary.actionKind) return i18n.t('kpi:approvalChainLabels.approve')
  if (summary.actionKind === 'FINAL') return i18n.t('kpi:approvalChainLabels.finalApproval')
  return i18n.t('kpi:approvalChainLabels.approveAndForwardTo', { value: summary.nextHolderNames || summary.nextUnitName || i18n.t('kpi:approvalChainLabels.manager') })
}

/** "Bước 2/3 · Trần B" — dùng cho badge ở danh sách. */
export function stepPositionLabel(summary: ApprovalSummary): string {
  const holders = summary.holderNames.join(', ')
  return i18n.t('kpi:approvalChainLabels.step', { stepNumber: summary.stepNumber, totalSteps: summary.totalSteps, value: holders ? ` · ${holders}` : '' })
}

export const STEP_STATUS_LABEL = perLanguage((): Record<ApprovalStepStatus, string> => ({
  WAITING: i18n.t('kpi:approvalChainLabels.notYetTheirTurn'),
  PENDING: i18n.t('kpi:approvalChainLabels.pendingApproval'),
  APPROVED_FORWARDED: i18n.t('kpi:approvalChainLabels.approvedAndForwarded'),
  APPROVED_FINAL: i18n.t('kpi:approvalChainLabels.finalApproval'),
  REJECTED: i18n.t('kpi:approvalChainLabels.rejected'),
  SKIPPED_DELEGATED: i18n.t('kpi:approvalChainLabels.skippedFinalApprovalGrantedAtA'),
  SKIPPED_NO_HEAD: i18n.t('kpi:approvalChainLabels.skippedUnitHasNoHead'),
  SKIPPED_INACTIVE: i18n.t('kpi:approvalChainLabels.skippedApproverInactive'),
  CANCELLED: i18n.t('kpi:approvalChainLabels.stopped'),
}))

export const FLOW_STATUS_LABEL = perLanguage((): Record<ApprovalFlowStatus, string> => ({
  IN_PROGRESS: i18n.t('kpi:approvalChainLabels.inApproval'),
  APPROVED: i18n.t('kpi:approvalChainLabels.approved'),
  REJECTED: i18n.t('kpi:approvalChainLabels.rejected2'),
  CANCELLED: i18n.t('kpi:approvalChainLabels.stopped'),
  CLOSED_BY_LOCK: i18n.t('kpi:approvalChainLabels.closedByCycleLock'),
}))

export const EVENT_ACTION_LABEL = perLanguage((): Record<ApprovalEventAction, string> => ({
  SUBMITTED: i18n.t('kpi:approvalChainLabels.submitForApproval'),
  APPROVED_FORWARD: i18n.t('kpi:approvalChainLabels.approveAndForward'),
  APPROVED_FINAL: i18n.t('kpi:approvalChainLabels.finalApproval'),
  REJECTED: i18n.t('kpi:approvalChainLabels.rejected'),
  SKIPPED_DELEGATED: i18n.t('kpi:approvalChainLabels.skippedFinalApprovalGrantedAtA'),
  SKIPPED_NO_HEAD: i18n.t('kpi:approvalChainLabels.skippedUnitHasNoHead'),
  SKIPPED_INACTIVE: i18n.t('kpi:approvalChainLabels.skippedApproverInactive'),
  SELF_APPROVED_TOP: i18n.t('kpi:approvalChainLabels.selfApprovedHighestApprovalLevel'),
  REASSIGNED: i18n.t('kpi:approvalChainLabels.reassignApprover'),
  AUTO_ESCALATED: i18n.t('kpi:approvalChainLabels.autoEscalated'),
  REMINDED: i18n.t('kpi:approvalChainLabels.approvalReminder'),
  CANCELLED: i18n.t('kpi:approvalChainLabels.stopApprovalChain'),
  CLOSED_BY_LOCK: i18n.t('kpi:approvalChainLabels.closedByCycleLock'),
  MIGRATED: i18n.t('kpi:approvalChainLabels.migratedFromPreviousWorkflow'),
}))
