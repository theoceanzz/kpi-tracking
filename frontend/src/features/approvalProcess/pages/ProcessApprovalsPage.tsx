import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, ExternalLink, GitBranch, Inbox, Loader2, XCircle } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import DraftNotice from '@/components/common/DraftNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourModal } from '@/components/common/tours/actions'
import { blockedByTour } from '@/components/common/tours/guard'
import { useStateDraft } from '@/hooks/useFormDraft'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime, formatNumber } from '@/lib/utils'
import ApprovalChainPanel from '@/features/kpi/components/ApprovalChainPanel'
import { useAuthStore } from '@/store/authStore'
import { approvalInboxApi } from '../api/approvalInboxApi'
import { OBJECT_OF_SUBJECT as OBJECT_OF, type ApprovalInboxItem } from '../types'

/** Đối tượng duyệt ở màn riêng của nó (có thêm thao tác nghiệp vụ: chấm điểm, so chỉ tiêu…). */
function ownScreen(item: ApprovalInboxItem): string {
  switch (item.subjectType) {
    case 'SUBMISSION': return `/submissions/${item.subjectId}`
    case 'ADJUSTMENT': return '/performance?section=kpi-adjustments-pending'
    default: return '/performance?section=kpi-criteria-pending'
  }
}

const num = (v: unknown) => (typeof v === 'number' ? formatNumber(v) : '—')
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '—')

/**
 * "Chờ tôi duyệt": mọi việc đang chờ ĐÚNG người xem ở bước hiện tại của chuỗi duyệt, mọi loại đối
 * tượng. Đề xuất chưa có màn riêng (đánh giá đợt, chốt kỳ) duyệt ngay tại đây; loại khác mở màn của nó.
 */
export default function ProcessApprovalsPage() {
  const { t } = useTranslation('approvalProcess')
  const [deciding, setDeciding] = useState<ApprovalInboxItem | null>(null)
  const { data = [], isLoading } = useQuery({ queryKey: ['approvals', 'inbox'], queryFn: approvalInboxApi.inbox })
  const firstActionable = data.find((i) => i.actionable)
  useTourModal('procapp.decide', () => { if (firstActionable) setDeciding(firstActionable) }, () => setDeciding(null))

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <WorkspaceHeader
        title={t('inbox.title')}
        description={t('inbox.description')}
        stats={[{ label: t('inbox.waiting'), value: data.length, icon: Inbox }]}
      />

      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : data.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={Inbox} title={t('inbox.empty')} description={t('inbox.emptyHint')} />
        </div>
      ) : (
        <ul className="space-y-3" {...tourAnchor('procapp.list')}>
          {data.map((item, i) => (
            <li key={item.flowId} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t(`objects.${OBJECT_OF[item.subjectType]}`)}</Badge>
                    <h3 className="truncate text-sm font-semibold text-[var(--color-foreground)]">{item.subjectName}</h3>
                  </div>
                  <p className="text-caption">
                    {item.requesterName && <>{t('inbox.from', { name: item.requesterName })} · </>}
                    {item.orgUnitName && <>{item.orgUnitName} · </>}
                    {item.approval && t('inbox.step', { number: item.approval.stepNumber, total: item.approval.totalSteps, step: item.approval.currentUnitName ?? '' })}
                  </p>
                  {item.approval?.pendingSince && (
                    <p className="text-caption">{t('inbox.since', { time: formatDateTime(item.approval.pendingSince) })}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2" {...(i === 0 ? tourAnchor('procapp.open') : {})}>
                  {item.actionable ? (
                    <Button size="sm" onClick={() => setDeciding(item)}>{t('inbox.review')}</Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={ownScreen(item)}><ExternalLink aria-hidden="true" /> {t('inbox.openOwn')}</Link>
                    </Button>
                  )}
                </div>
              </div>
              {item.payload && <PayloadDetails item={item} />}
            </li>
          ))}
        </ul>
      )}

      {deciding && <DecisionDialog key={deciding.flowId} item={deciding} onClose={() => setDeciding(null)} />}
    </div>
  )
}

/** Nội dung đề xuất — người duyệt đọc ngay, không phải mở màn khác. Loại không có payload: không vẽ. */
function PayloadDetails({ item }: { item: ApprovalInboxItem }) {
  const { t } = useTranslation('approvalProcess')
  const p = item.payload ?? {}
  const units = Array.isArray(p.unitNames) && p.unitNames.length ? (p.unitNames as string[]).join(', ') : t('inbox.bsc.wholeOrg')
  const rows: [string, string][] | null = item.subjectType === 'REWARD_GRANT'
    ? [
        [t('inbox.reward.totalPoints'), num(p.totalPoints)],
        [t('inbox.reward.recipients'), num(p.recipientCount)],
        [t('inbox.reward.recipientNames'), Array.isArray(p.recipientNames) ? (p.recipientNames as string[]).join(', ') : '—'],
        [t('inbox.reward.whyApproval'), str(p.approvalReason)],
      ]
    : item.subjectType === 'GIFT_REDEMPTION'
    ? [
        [t('inbox.reward.redeemer'), str(p.userName)],
        [t('inbox.reward.gift'), str(p.giftName)],
        [t('inbox.reward.quantity'), num(p.quantity)],
        [t('inbox.reward.pointsSpent'), num(p.pointsSpent)],
      ]
    : item.subjectType === 'BSC_SCORECARD'
    ? [
        [t('inbox.bsc.scorecard'), str(p.scorecardName)],
        [t('inbox.bsc.units'), units],
        [t('inbox.bsc.items'), num(p.itemCount)],
        [t('inbox.bsc.totalWeight'), typeof p.totalWeight === 'number' ? `${formatNumber(p.totalWeight)}%` : '—'],
      ]
    : item.subjectType === 'BSC_RESULT'
    ? [
        [t('inbox.bsc.scorecard'), str(p.scorecardName)],
        [t('inbox.bsc.units'), units],
        [t('inbox.eval.period'), str(p.kpiPeriodName)],
        [t('inbox.bsc.achievement'), typeof p.achievementPercent === 'number' ? `${formatNumber(p.achievementPercent)}%` : '—'],
      ]
    : item.subjectType === 'EVALUATION'
    ? [
        [t('inbox.eval.user'), str(p.userName)],
        [t('inbox.eval.period'), str(p.kpiPeriodName)],
        [t('inbox.eval.evaluator'), str(p.evaluatorName)],
        [t('inbox.eval.score'), num(p.score)],
        [t('inbox.eval.systemScore'), num(p.systemScore)],
      ]
    : item.subjectType === 'CYCLE_FINALIZE'
    ? [
        [t('inbox.cycle.unit'), str(p.orgUnitName)],
        [t('inbox.cycle.cycle'), str(p.cycleName)],
        [t('inbox.cycle.members'), num(p.memberCount)],
        [t('inbox.cycle.managerScore'), num(p.managerScore)],
        [t('inbox.cycle.classification'), str(p.classification)],
      ]
    : null
  if (!rows || !item.payload) return null
  return (
    <div className="mt-3 space-y-2" {...tourAnchor('procapp.details')}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-caption">{label}</dt>
            <dd className="truncate text-[var(--color-foreground)]">{value}</dd>
          </div>
        ))}
      </dl>
      {item.subjectType === 'BSC_RESULT' && p.allowProvisional === true && (
        <p className="flex items-start gap-2 text-sm text-[var(--color-warning)]">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> {t('inbox.bsc.provisional')}
        </p>
      )}
      {item.subjectType === 'REWARD_GRANT' && typeof p.reason === 'string' && p.reason.trim() && (
        <p className="whitespace-pre-wrap rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm">{p.reason}</p>
      )}
      {item.subjectType === 'GIFT_REDEMPTION' && typeof p.note === 'string' && p.note.trim() && (
        <p className="whitespace-pre-wrap rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm">{p.note}</p>
      )}
      {typeof p.comment === 'string' && p.comment.trim() && (
        <p className="whitespace-pre-wrap rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm">{p.comment}</p>
      )}
      {item.subjectType === 'CYCLE_FINALIZE' && p.root === true && (
        <p className="flex items-start gap-2 text-sm text-[var(--color-warning)]">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> {t('inbox.cycle.rootWarning')}
        </p>
      )}
    </div>
  )
}

/** Duyệt / từ chối khi người xem giữ bước hiện tại; người khác (kể cả người gửi) chỉ xem chuỗi duyệt và sơ đồ. */
export function DecisionDialog({ item, onClose }: { item: ApprovalInboxItem; onClose: () => void }) {
  const { t } = useTranslation('approvalProcess')
  const myId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const draft = useStateDraft(comment, setComment, { key: `approval-decision:${item.flowId}`, enabled: true })
  const { data: detail } = useQuery({
    queryKey: ['approvals', 'flow', item.flowId],
    queryFn: () => approvalInboxApi.detail(item.flowId),
  })
  const expectedStepId = item.approval?.stepId ?? null
  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: ['approvals'] })
    qc.invalidateQueries({ queryKey: ['evaluations'] })
    qc.invalidateQueries({ queryKey: ['cycle-evaluation'] })
    draft.clear()
    toast.success(msg)
    onClose()
  }
  const approve = useMutation({
    mutationFn: () => approvalInboxApi.approve(item.flowId, { expectedStepId, comment: comment.trim() || undefined }),
    onSuccess: (outcome) => done(outcome === 'FINAL' ? t('inbox.approvedFinal') : t('inbox.forwarded')),
    onError: (e) => toast.error(getApiErrorMessage(e, t('inbox.failed'))),
  })
  const reject = useMutation({
    mutationFn: () => approvalInboxApi.reject(item.flowId, { expectedStepId, comment: comment.trim() }),
    onSuccess: () => done(t('inbox.rejected')),
    onError: (e) => toast.error(getApiErrorMessage(e, t('inbox.failed'))),
  })
  const busy = approve.isPending || reject.isPending
  const canAct = item.approval?.canAct ?? false
  const forward = item.approval?.actionKind === 'FORWARDED'
  const reasonMissing = rejecting && !comment.trim()

  const submitApprove = () => { if (blockedByTour()) return; approve.mutate() }
  const submitReject = () => {
    if (blockedByTour()) return
    if (!rejecting) { setRejecting(true); return }
    if (comment.trim()) reject.mutate()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!busy}
      title={item.subjectName}
      description={t(`objects.${OBJECT_OF[item.subjectType]}`)}
      {...tourAnchor('procapp.dialog')}
      footer={canAct ? (
        <DialogFooter
          secondary={
            <Button variant="outline" onClick={submitReject} disabled={busy} {...tourAnchor('procapp.reject')}
              className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]">
              {reject.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              {rejecting ? t('inbox.confirmReject') : t('inbox.reject')}
            </Button>
          }
          primary={
            <Button onClick={submitApprove} disabled={busy || rejecting} {...tourAnchor('procapp.approve')}>
              {approve.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              {forward ? t('inbox.approveForward') : t('inbox.approve')}
            </Button>
          }
        />
      ) : (
        <DialogFooter secondary={<Button variant="outline" onClick={onClose}>{t('inbox.close')}</Button>} />
      )}
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {item.approval && (
          <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm text-[var(--color-info)]">
            <GitBranch size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {!canAct
                ? t(item.requesterId === myId ? 'mine.waitingFor' : 'inbox.notYourTurn', { names: item.approval.holderNames.join(', ') })
                : forward ? t('inbox.willForward', { names: item.approval.nextHolderNames ?? '' }) : t('inbox.isFinal')}
            </span>
          </div>
        )}
        <PayloadDetails item={item} />
        {canAct && (
          <div {...tourAnchor('procapp.comment')}>
            <label htmlFor="approval-comment" className="mb-1.5 block text-label">
              {rejecting ? <>{t('inbox.reason')} <span className="text-[var(--color-error)]">*</span></> : t('inbox.comment')}
            </label>
            <Textarea id="approval-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              invalid={reasonMissing} placeholder={rejecting ? t('inbox.reasonPlaceholder') : t('inbox.commentPlaceholder')} />
          </div>
        )}
        <ApprovalChainPanel chain={detail?.chain} loading={!detail} title={t('inbox.chain')} />
      </div>
    </Dialog>
  )
}
