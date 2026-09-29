import { useMemo, useState } from 'react'
import {
  CheckCircle2, Circle, CircleDashed, Clock, Loader2, SkipForward, UserCog, XCircle, History, ChevronDown,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrganizationUsers } from '@/features/organization/hooks/useUserRoles'
import type { ApprovalFlow, ApprovalStep, KpiApprovalChain } from '@/types/approvalChain'
import { EVENT_ACTION_LABEL, FLOW_STATUS_LABEL, STEP_STATUS_LABEL } from '../utils/approvalChainLabels'
import { useReassignApprovalStep } from '../hooks/useKpiApprovalChain'
import { useTranslation } from 'react-i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

/**
 * Chuỗi duyệt của một KPI: stepper của lần gửi mới nhất (bước, người giữ, trạng thái, lý do) và
 * lịch sử mọi lần gửi / điều chỉnh. Admin tổ chức thấy thêm nút "Gán lại" ở bước đang chờ — đó là
 * việc duy nhất admin làm được trên chuỗi của người khác.
 */
export default function ApprovalChainPanel({ chain, loading, adjustmentId, canReassignAdjustment }: {
  chain: KpiApprovalChain | undefined
  loading?: boolean
  /** Hiện chuỗi của MỘT yêu cầu điều chỉnh thay cho chuỗi duyệt chỉ tiêu. */
  adjustmentId?: string
  canReassignAdjustment?: boolean
}) {
  const { t } = useTranslation('kpi')
  const [showHistory, setShowHistory] = useState(false)
  const [reassignStep, setReassignStep] = useState<ApprovalStep | null>(null)

  if (loading) {
    return (
      <section className="flex items-center gap-2 rounded-card border border-[var(--color-border)] p-4 text-caption">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('ApprovalChainPanel.loadingApprovalChain')}
      </section>
    )
  }
  if (!chain || !chain.chainMode || chain.flows.length === 0) return null

  const latestCriteria = adjustmentId
    ? chain.flows.find(f => f.adjustmentRequestId === adjustmentId)
    : chain.flows.find(f => f.subjectType === 'CRITERIA') ?? chain.flows[0]
  if (!latestCriteria) return null
  const canReassign = adjustmentId ? !!canReassignAdjustment : !!chain.current?.canReassign
  const historyFlows = adjustmentId ? chain.flows.filter(f => f.adjustmentRequestId === adjustmentId) : chain.flows

  return (
    <section className="rounded-card border border-[var(--color-border)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-eyebrow">{t('ApprovalChainPanel.approvalChain')}{latestCriteria.round > 1 ? t('ApprovalChainPanel.submission', { round: latestCriteria.round }) : ''}</h3>
        <FlowStatusBadge flow={latestCriteria} />
      </div>

      <FlowStepper
        flow={latestCriteria}
        canReassign={canReassign && latestCriteria.status === 'IN_PROGRESS'}
        onReassign={setReassignStep}
      />

      <button
        type="button"
        onClick={() => setShowHistory(v => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
        aria-expanded={showHistory}
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        {showHistory ? t('ApprovalChainPanel.hideApprovalHistory') : t('ApprovalChainPanel.viewApprovalHistorySubmissions', { count: historyFlows.length })}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')} aria-hidden="true" />
      </button>

      {showHistory && (
        <div className="mt-3 space-y-4">
          {historyFlows.map(f => <FlowHistory key={f.id} flow={f} />)}
        </div>
      )}

      {/* Chỉ gắn khi mở: hộp thoại tải danh sách nhân sự của tổ chức. */}
      {reassignStep && <ReassignDialog step={reassignStep} onClose={() => setReassignStep(null)} />}
    </section>
  )
}

function FlowStatusBadge({ flow }: { flow: ApprovalFlow }) {
  const variant = flow.status === 'APPROVED' ? 'success'
    : flow.status === 'REJECTED' ? 'destructive'
    : flow.status === 'IN_PROGRESS' ? 'warning' : 'secondary'
  return <Badge variant={variant as 'success' | 'destructive' | 'warning' | 'secondary'}>{FLOW_STATUS_LABEL()[flow.status]}</Badge>
}

function stepVisual(step: ApprovalStep) {
  switch (step.status) {
    case 'APPROVED_FORWARDED':
    case 'APPROVED_FINAL':
      return { Icon: CheckCircle2, cls: 'text-[var(--color-success)]' }
    case 'REJECTED':
      return { Icon: XCircle, cls: 'text-[var(--color-error)]' }
    case 'PENDING':
      return { Icon: Clock, cls: 'text-[var(--color-warning)]' }
    case 'SKIPPED_DELEGATED':
    case 'SKIPPED_NO_HEAD':
    case 'SKIPPED_INACTIVE':
      return { Icon: SkipForward, cls: 'text-[var(--color-muted-foreground)]' }
    case 'CANCELLED':
      return { Icon: CircleDashed, cls: 'text-[var(--color-muted-foreground)]' }
    default:
      return { Icon: Circle, cls: 'text-[var(--color-subtle-foreground)]' }
  }
}

function FlowStepper({ flow, canReassign, onReassign }: {
  flow: ApprovalFlow
  canReassign?: boolean
  onReassign?: (step: ApprovalStep) => void
}) {
  const { t } = useTranslation('kpi')
  return (
    <ol className="space-y-0" aria-label={t('ApprovalChainPanel.approvalSteps')}>
      {flow.steps.map((step, i) => {
        const { Icon, cls } = stepVisual(step)
        const isLast = i === flow.steps.length - 1
        const muted = step.status === 'WAITING' || step.status.startsWith('SKIPPED') || step.status === 'CANCELLED'
        const units = [step.orgUnitName, ...step.mergedUnitNames].filter(Boolean).join(' · ')
        return (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && <span className="absolute left-[9px] top-6 h-[calc(100%-18px)] w-px bg-[var(--color-border)]" aria-hidden="true" />}
            <Icon className={cn('relative z-10 mt-0.5 h-[19px] w-[19px] shrink-0 bg-[var(--color-card)]', cls)} aria-hidden="true" />
            <div className={cn('min-w-0 flex-1', muted && 'opacity-70')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  {step.kind === 'ADMIN_FALLBACK' ? t('ApprovalChainPanel.organizationAdministrator') : (units || t('ApprovalChainPanel.step', { order: step.order }))}
                </span>
                <span className="text-caption">{STEP_STATUS_LABEL()[step.status]}</span>
              </div>
              {step.approvers.length > 0 && (
                <p className="text-caption">
                  {step.status === 'PENDING' ? t('ApprovalChainPanel.holding') : t('ApprovalChainPanel.approver')}
                  {step.actedByName ?? step.approvers.map(a => a.name).join(', ')}
                  {step.actedAt ? ` · ${formatDateTime(step.actedAt)}` : ''}
                  {step.status === 'PENDING' && step.pendingSince ? t('ApprovalChainPanel.pendingSince', { pendingSince: formatDateTime(step.pendingSince) }) : ''}
                </p>
              )}
              {step.skipReason && <p className="text-caption italic">{step.skipReason}</p>}
              {step.reason && (
                <p className={cn('mt-1 text-sm', step.status === 'REJECTED' ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]')}>
                  “{step.reason}”
                </p>
              )}
              {canReassign && step.status === 'PENDING' && onReassign && (
                <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => onReassign(step)}>
                  <UserCog aria-hidden="true" /> {t('ApprovalChainPanel.reassignApprover')}
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function FlowHistory({ flow }: { flow: ApprovalFlow }) {
  const { t } = useTranslation('kpi')
  const title = flow.subjectType === 'ADJUSTMENT' ? t('ApprovalChainPanel.adjustmentRequest') : t('ApprovalChainPanel.submission2', { round: flow.round })
  return (
    <div className="rounded-control border border-[var(--color-border)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-foreground)]">
          {title}{flow.requesterName ? ` · ${flow.requesterName}` : ''}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-caption tabular-nums">{formatDateTime(flow.startedAt)}</span>
          <FlowStatusBadge flow={flow} />
        </span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-[var(--color-muted-foreground)]">
          <tr>
            <th className="py-1 pr-2 font-medium">{t('ApprovalChainPanel.time')}</th>
            <th className="py-1 pr-2 font-medium">{t('ApprovalChainPanel.step2')}</th>
            <th className="py-1 pr-2 font-medium">{t('ApprovalChainPanel.actions')}</th>
            <th className="py-1 pr-2 font-medium">{t('ApprovalChainPanel.performedBy')}</th>
            <th className="py-1 font-medium">{t('ApprovalChainPanel.reason')}</th>
          </tr>
        </thead>
        <tbody>
          {flow.events.map(e => (
            <tr key={e.id} className="border-t border-[var(--color-border)] align-top">
              <td className="py-1 pr-2 tabular-nums whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
              <td className="py-1 pr-2">{e.stepOrder ?? '—'}</td>
              <td className="py-1 pr-2">{EVENT_ACTION_LABEL()[e.action] ?? e.action}</td>
              <td className="py-1 pr-2">{e.actorName ?? t('ApprovalChainPanel.system')}</td>
              <td className="py-1">{e.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReassignDialog({ step, onClose }: { step: ApprovalStep | null; onClose: () => void }) {
  const { t } = useTranslation('kpi')
  const [approverId, setApproverId] = useState('')
  const [reason, setReason] = useState('')
  const { data: usersPage } = useOrganizationUsers(undefined)
  const reassign = useReassignApprovalStep()

  const users = useMemo(
    () => (usersPage?.content ?? []).filter(u => u.status === 'ACTIVE').sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [usersPage],
  )
  // Mỗi lần mở cho một bước mới thì bắt đầu trống; đóng (Huỷ / Esc / bấm nền) KHÔNG xoá nữa — phần
  // đang nhập nằm trong bản nháp, mở lại đúng bước đó là còn.
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if ((step?.id ?? null) !== openedFor) {
    setOpenedFor(step?.id ?? null)
    setApproverId('')
    setReason('')
  }
  const draft = useStateDraft({ approverId, reason }, v => { setApproverId(v.approverId); setReason(v.reason) }, { key: `approval-reassign:${step?.id ?? ''}`, enabled: !!step })
  const close = () => onClose()
  const submit = () => {
    if (!step) return
    reassign.mutate({ stepId: step.id, approverId, reason: reason.trim() }, { onSuccess: close })
  }

  return (
    <Dialog
      open={!!step}
      onClose={close}
      size="md"
      dismissible={!reassign.isPending}
      title={t('ApprovalChainPanel.reassignApprover')}
      description={step ? t('ApprovalChainPanel.stepHolding', { order: step.order, join: step.approvers.map(a => a.name).join(', ') }) : undefined}
      footer={
        <DialogFooter
          note={t('ApprovalChainPanel.theAssigneeWillBeNotifiedAdministrators')}
          secondary={<Button variant="outline" onClick={close} disabled={reassign.isPending}>{t('ApprovalChainPanel.cancel')}</Button>}
          primary={
            <Button onClick={submit} disabled={!approverId || !reason.trim() || reassign.isPending}>
              {reassign.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserCog aria-hidden="true" />}
              {t('ApprovalChainPanel.reassign')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <div>
          <label className="text-label mb-1.5 block">{t('ApprovalChainPanel.newApprover')}</label>
          <Select value={approverId} onValueChange={setApproverId}>
            <SelectTrigger><SelectValue placeholder={t('ApprovalChainPanel.chooseAPerson')} /></SelectTrigger>
            <SelectContent>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName} · {u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="reassign-reason" className="text-label mb-1.5 block">
            {t('ApprovalChainPanel.reason')} <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
          </label>
          <Textarea id="reassign-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t('ApprovalChainPanel.eGDepartmentHeadOnExtended')} />
        </div>
      </div>
    </Dialog>
  )
}
