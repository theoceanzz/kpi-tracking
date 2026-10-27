import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, Loader2, Undo2, X } from 'lucide-react'
import { Drawer, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { blockedByTour } from '@/components/common/tours/guard'
import { getApiErrorMessage } from '@/lib/apiError'
import { useFormat } from '@/i18n/useFormat'
import ApprovalChainPanel from '@/features/kpi/components/ApprovalChainPanel'
import { approvalInboxApi } from '@/features/approvalProcess/api/approvalInboxApi'
import { approvalFormKeys, useRequestDetail, useWithdrawRequest } from '../../hooks/useApprovalForms'
import { pickName } from '../../model/formState'
import FormIcon from '../FormIcon'
import FormRenderer from '../renderer/FormRenderer'
import { RequestStatusBadge } from './requestParts'

/**
 * Chi tiết một đơn: giá trị đã nộp (theo form lúc nộp), chuỗi duyệt, và thao tác của người xem — người giữ bước hiện tại
 * duyệt / từ chối (từ chối phải có lý do), người nộp rút đơn khi còn chờ.
 */
export default function RequestDetailDrawer({ requestId, onClose }: { requestId: string | null; onClose: () => void }) {
  const { t } = useTranslation('approvalForms')
  const { lang, dateTime } = useFormat()
  const qc = useQueryClient()
  const { data, isLoading, isError } = useRequestDetail(requestId)
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const withdraw = useWithdrawRequest()

  const approval = data?.item.approval
  const decide = useMutation({
    mutationFn: () => decision === 'approve'
      ? approvalInboxApi.approve(approval!.flowId, { expectedStepId: approval!.stepId, comment: comment.trim() || undefined })
      : approvalInboxApi.reject(approval!.flowId, { expectedStepId: approval!.stepId, comment: comment.trim() }),
    onSuccess: () => {
      toast.success(decision === 'approve' ? t('detail.approved') : t('detail.rejected'))
      setDecision(null)
      setComment('')
      qc.invalidateQueries({ queryKey: approvalFormKeys.requests })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('toast.failed'))),
  })

  const close = () => {
    setDecision(null)
    setComment('')
    onClose()
  }
  const confirm = () => {
    if (blockedByTour()) return
    if (decision === 'reject' && !comment.trim()) return
    decide.mutate()
  }

  const footer = data && (approval?.canAct || data.canWithdraw) ? (
    decision ? (
      <div className="space-y-2 border-t border-[var(--color-border)] px-5 py-3">
        <label htmlFor="af-decision" className="block text-label">
          {decision === 'approve' ? t('detail.commentOptional') : t('detail.reasonRequired')}
        </label>
        <Textarea id="af-decision" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus maxLength={1000} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDecision(null)}>{t('common.cancel')}</Button>
          <Button variant={decision === 'reject' ? 'destructive' : 'default'} onClick={confirm}
            disabled={decide.isPending || (decision === 'reject' && !comment.trim())}>
            {decide.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {decision === 'approve' ? t('detail.confirmApprove') : t('detail.confirmReject')}
          </Button>
        </div>
      </div>
    ) : (
      <DialogFooter
        destructive={data.canWithdraw ? (
          <Button variant="outline" onClick={() => setConfirmWithdraw(true)}><Undo2 aria-hidden="true" /> {t('detail.withdraw')}</Button>
        ) : undefined}
        secondary={approval?.canAct ? (
          <Button variant="outline" onClick={() => setDecision('reject')}><X aria-hidden="true" /> {t('detail.reject')}</Button>
        ) : undefined}
        primary={approval?.canAct ? (
          <Button onClick={() => setDecision('approve')}><Check aria-hidden="true" /> {t('detail.approve')}</Button>
        ) : undefined}
      />
    )
  ) : undefined

  return (
    <>
      <Drawer
        open={!!requestId}
        onClose={close}
        size="lg"
        title={data ? (
          <span className="flex items-center gap-2.5">
            <FormIcon icon={data.item.formIcon} color={data.item.formColor} size="sm" />
            <span className="truncate">{pickName(data.item.formName, lang)}</span>
            <RequestStatusBadge status={data.item.status} />
          </span>
        ) : t('detail.title')}
        description={data ? `${data.item.code} · ${data.item.requester.name} · ${data.item.orgUnitName} · ${dateTime(data.item.submittedAt)}` : undefined}
        footer={footer}
      >
        {isLoading ? <LoadingSkeleton type="form" rows={6} /> : isError || !data ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('detail.notFound')}</p>
        ) : (
          <div className="space-y-6">
            {data.item.status === 'REJECTED' && data.rejectReason && (
              <div className="rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--color-error)]">{t('detail.rejectReason')}: </span>{data.rejectReason}
              </div>
            )}
            <FormRenderer schema={data.schema} values={data.values} mode="view" />
            <ApprovalChainPanel chain={data.chain} />
          </div>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        onConfirm={() => data && withdraw.mutate(data.item.id, { onSuccess: () => setConfirmWithdraw(false) })}
        loading={withdraw.isPending}
        title={t('detail.withdrawTitle')}
        description={t('detail.withdrawDescription')}
        confirmLabel={t('detail.withdraw')}
      />
    </>
  )
}
