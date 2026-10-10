import { LocaleNumberInput } from '@/components/ui/number-input'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentApi } from '../api/adjustmentApi'
import { createAdjustmentReviewSchema, type AdjustmentReviewFormData } from '../schemas/reviewSchema'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { Loader2, XCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { formatNumber, formatDateTime } from '@/lib/utils'
import type { KpiAdjustmentRequest } from '@/types/adjustment'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/common/StatusBadge'
import ApprovalChainPanel from './ApprovalChainPanel'
import { useKpiApprovalChain, invalidateApprovalQueries } from '../hooks/useKpiApprovalChain'
import { useApprovalChainMode } from '../workflow/hooks/useKpiWorkflow'
import { approveButtonLabel } from '../utils/approvalChainLabels'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

interface KpiAdjustmentReviewModalProps {
  open: boolean
  onClose: () => void
  request: KpiAdjustmentRequest | null
  /** Mở thẳng ở bước nhập lý do từ chối / xác nhận duyệt (từ nút trên hàng bảng). */
  initialMode?: 'view' | 'approve' | 'reject'
}

/**
 * Xem một yêu cầu điều chỉnh và duyệt / từ chối ngay trong hộp thoại — cùng khuôn với
 * `KpiReviewModal` (UX_PATTERNS.md P1/P4). Thân: lý do → bảng "hiện tại → đề xuất" → audit.
 * Duyệt yêu cầu ngưng KPI cần thêm % bù trừ nên bước duyệt cũng có form.
 */
export default function KpiAdjustmentReviewModal({ open, onClose, request, initialMode = 'view' }: KpiAdjustmentReviewModalProps) {
  const { t } = useTranslation('kpi')
  const chainMode = useApprovalChainMode()
  const summary = request?.approval ?? null
  const { data: chain, isLoading: chainLoading } = useKpiApprovalChain(open && chainMode ? request?.kpiCriteriaId : undefined)
  // Chuỗi duyệt: chỉ người duyệt CUỐI mới chốt % bù trừ; bước trung gian được gợi ý (không bắt buộc).
  const isFinalStep = !chainMode || summary?.actionKind === 'FINAL'
  // Ô % bù trừ chỉ hiện khi PHÊ DUYỆT một yêu cầu ngưng KPI, nên ràng buộc theo ngữ cảnh.
  const needsCompensation = !!request?.deactivationRequest && isFinalStep
  const schema = useMemo(() => createAdjustmentReviewSchema({ needsCompensation }), [needsCompensation])

  const formApi = useForm<AdjustmentReviewFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      reviewMode: initialMode,
      note: '',
      compensationPercentage: request?.suggestedCompensationPercent != null ? String(request.suggestedCompensationPercent) : '',
    },
  })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `kpi-adjustment-review:${request?.id ?? ''}`, enabled: open && !!request })

  // Ba nút Từ chối / Duyệt / Quay lại chỉ đổi bước, không phải ô nhập.
  const reviewMode = watch('reviewMode')
  const setReviewMode = (mode: AdjustmentReviewFormData['reviewMode']) => setValue('reviewMode', mode, { shouldValidate: false })
  const close = () => { reset({ reviewMode: 'view', note: '', compensationPercentage: '' }); onClose() }

  const qc = useQueryClient()
  const reviewMutation = useMutation({
    mutationFn: (data: AdjustmentReviewFormData) =>
      adjustmentApi.review(request!.id, {
        status: data.reviewMode === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewerNote: data.note,
        ...(data.reviewMode === 'approve' && request!.deactivationRequest && data.compensationPercentage.trim() !== ''
          ? { compensationPercentage: Number(data.compensationPercentage) }
          : {}),
        expectedStepId: summary?.stepId ?? null,
      }),
    onSuccess: (_, data) => {
      invalidateApprovalQueries(qc)
      toast.success(data.reviewMode === 'approve'
        ? (summary?.actionKind === 'FORWARDED'
          ? t('KpiAdjustmentReviewModal.approvedAndForwardedTo', { value: summary.nextHolderNames || t('KpiAdjustmentReviewModal.manager') })
          : t('KpiAdjustmentReviewModal.adjustmentRequestApproved'))
        : t('KpiAdjustmentReviewModal.adjustmentRequestRejected'))
      close()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('KpiAdjustmentReviewModal.failedToHandleTheAdjustmentRequest')))
      invalidateApprovalQueries(qc)
    },
  })

  if (!request) return null

  const isPending = reviewMutation.isPending
  // Chuỗi duyệt: chỉ người đang giữ bước hiện tại thấy nút; cấp trên và admin chỉ xem.
  const isReviewable = request.status === 'PENDING' && (!chainMode || !!summary?.canAct)
  const inForm = isReviewable && reviewMode !== 'view'
  const needsCompensationInput = reviewMode === 'approve' && request.deactivationRequest
  const approveLabel = chainMode ? approveButtonLabel(summary) : t('KpiAdjustmentReviewModal.approve')
  const realWeight = (w: number | null) =>
    w == null ? null : request.categoryWeightPercent != null ? `${(w * request.categoryWeightPercent / 100).toFixed(1)}% / ${w}%` : `${w}%`

  const footer = isReviewable
    ? inForm
      ? (
        <DialogFooter
          note={t('KpiAdjustmentReviewModal.theRequesterWillBeNotifiedWith')}
          secondary={<Button variant="outline" onClick={() => setReviewMode('view')} disabled={isPending}>{t('KpiAdjustmentReviewModal.back')}</Button>}
          primary={
            <Button variant={reviewMode === 'approve' ? 'default' : 'destructive'} onClick={handleSubmit(d => { if (!blockedByTour()) reviewMutation.mutate(d) })} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : reviewMode === 'approve' ? <CheckCircle aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              {reviewMode === 'approve' ? approveLabel : t('KpiAdjustmentReviewModal.rejected')}
            </Button>
          }
        />
      ) : (
        <DialogFooter
          destructive={
            <Button {...tourAnchor('adjreview.reject')} variant="outline" onClick={() => setReviewMode('reject')} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
              <XCircle aria-hidden="true" /> {t('KpiAdjustmentReviewModal.rejected')}
            </Button>
          }
          secondary={<Button variant="outline" onClick={close}>{t('KpiAdjustmentReviewModal.close')}</Button>}
          primary={<Button {...tourAnchor('adjreview.approve')} onClick={() => setReviewMode('approve')}><CheckCircle aria-hidden="true" /> {approveLabel}</Button>}
        />
      )
    : <DialogFooter primary={<Button variant="outline" onClick={close}>{t('KpiAdjustmentReviewModal.close')}</Button>} />

  return (
    <Dialog {...tourAnchor('adjreview.dialog')}
      open={open}
      onClose={close}
      size="lg"
      dismissible={!isPending}
      title={request.kpiCriteriaName}
      description={t('KpiAdjustmentReviewModal.sent', { requesterName: request.requesterName, createdAt: formatDateTime(request.createdAt) })}
      headerExtra={<StatusBadge status={request.status} />}
      footer={footer}
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {request.deactivationRequest ? <Badge variant="destructive">{t('KpiAdjustmentReviewModal.requestToDeactivateKpi')}</Badge> : <Badge variant="warning">{t('KpiAdjustmentReviewModal.adjustFigures')}</Badge>}
          {request.kpiType === 'QUALITATIVE' && <Badge variant="outline">{t('KpiAdjustmentReviewModal.qualitative')}</Badge>}
          {request.perspectiveName && (
            <Badge variant="outline" title={t('KpiAdjustmentReviewModal.bscItem', { perspectiveName: request.perspectiveName })}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: request.perspectiveColor || 'var(--color-primary)' }} aria-hidden="true" />
              {request.perspectiveName}
            </Badge>
          )}
        </div>

        <section {...tourAnchor('adjreview.reason')}>
          <h3 className="text-eyebrow mb-1">{t('KpiAdjustmentReviewModal.adjustmentReason')}</h3>
          <p className="text-sm leading-5 text-[var(--color-foreground)]">{request.reason}</p>
        </section>
          
        {/* Hiện tại → đề xuất: một bảng ba cột để mắt so theo hàng, không phải hai cột thẻ rời */}
        <section {...tourAnchor('adjreview.compare')} className="overflow-hidden rounded-card border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <th scope="col" className="px-4 py-2 text-left text-eyebrow">{t('KpiAdjustmentReviewModal.metric')}</th>
                <th scope="col" className="px-4 py-2 text-right text-eyebrow">{t('KpiAdjustmentReviewModal.current')}</th>
                <th scope="col" className="w-8 px-0 py-2" aria-hidden="true" />
                <th scope="col" className="px-4 py-2 text-right text-eyebrow">{t('KpiAdjustmentReviewModal.proposed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] tabular-nums">
                  {request.deactivationRequest ? (
                <tr>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{t('KpiAdjustmentReviewModal.kpiStatus')}</td>
                  <td className="px-4 py-3 text-right">{t('KpiAdjustmentReviewModal.inEffect')}</td>
                  <td className="px-0 py-3 text-center text-[var(--color-subtle-foreground)]"><ArrowRight size={14} className="inline" aria-hidden="true" /></td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--color-error)]">
                    {t('KpiAdjustmentReviewModal.deactivated')}{request.compensationPercentage != null ? t('KpiAdjustmentReviewModal.compensation', { compensationPercentage: request.compensationPercentage }) : ''}
                  </td>
                </tr>
                  ) : (
                    <>
                      {request.kpiType !== 'QUALITATIVE' && (
                    <ChangeRow label={t('KpiAdjustmentReviewModal.target')} from={formatNumber(request.currentTargetValue)} to={request.requestedTargetValue != null ? formatNumber(request.requestedTargetValue) : null} />
                      )}
                  <ChangeRow label={request.categoryWeightPercent != null ? t('KpiAdjustmentReviewModal.actualWeightForm') : t('KpiAdjustmentReviewModal.weight')} from={realWeight(request.currentWeight) ?? '—'} to={realWeight(request.requestedWeight)} />
                      {request.kpiType !== 'QUALITATIVE' && (
                    <ChangeRow label={t('KpiAdjustmentReviewModal.minimum')} from={request.currentMinimumValue != null ? formatNumber(request.currentMinimumValue) : '0'} to={request.requestedMinimumValue != null ? formatNumber(request.requestedMinimumValue) : null} />
                      )}
                    </>
                  )}
            </tbody>
          </table>
        </section>

        {!isReviewable && request.reviewerNote && (
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
            <h3 className="text-eyebrow mb-1">{t('KpiAdjustmentReviewModal.responseFrom')} {request.reviewerName || t('KpiAdjustmentReviewModal.approver')}</h3>
            <p className="text-sm leading-5 text-[var(--color-foreground)]">{request.reviewerNote}</p>
          </section>
        )}

        {chainMode && (
          <ApprovalChainPanel
            chain={chain}
            loading={chainLoading}
            adjustmentId={request.id}
            canReassignAdjustment={!!summary?.canReassign}
          />
        )}

        {inForm && (
          <section className={`space-y-4 rounded-card border p-4 ${reviewMode === 'reject' ? 'border-[var(--color-error-border)]' : 'border-[var(--color-border)]'}`}>
                {needsCompensationInput && (
                  <div>
                <label htmlFor="adj-compensation" className="text-label block">
                  {isFinalStep ? t('KpiAdjustmentReviewModal.achievementCompensationRate') : t('KpiAdjustmentReviewModal.suggestedCompensationRateForTheFinal')}
                  {isFinalStep && <span className="text-[var(--color-error)]" aria-hidden="true"> *</span>}
                    </label>
                    <LocaleNumberInput
                  id="adj-compensation"
                  type="number" min={0} max={150} inputMode="numeric"
                      {...register('compensationPercentage')}
                  aria-invalid={!!errors.compensationPercentage}
                  className="mt-1.5 h-9 w-40 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm tabular-nums text-[var(--color-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  placeholder="100"
                    />
                {errors.compensationPercentage && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.compensationPercentage.message}</p>}
                <p className="mt-1 text-caption">
                  {isFinalStep
                    ? t('KpiAdjustmentReviewModal.thisKpiIsCountedAsAchieved')
                    : t('KpiAdjustmentReviewModal.optionalOnlyTheFinalApproverSets')}
                </p>
                  </div>
                )}
                <div>
              <label htmlFor="adj-note" className="text-label block">
                {t('KpiAdjustmentReviewModal.responseToTheRequester')} {reviewMode === 'reject' && <span className="text-[var(--color-error)]" aria-hidden="true">*</span>}
                  </label>
                  <textarea
                id="adj-note"
                    {...register('note')}
                    rows={3}
                autoFocus
                aria-invalid={!!errors.note}
                className="mt-1.5 w-full resize-none rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                placeholder={reviewMode === 'reject' ? t('KpiAdjustmentReviewModal.explainWhyThisAdjustmentIsNot') : t('KpiAdjustmentReviewModal.additionalNotesOptional')}
                  />
              {errors.note && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.note.message}</p>}
            </div>
          </section>
                  )}
                </div>
    </Dialog>
  )
}

function ChangeRow({ label, from, to }: { label: string; from: string; to: string | null }) {
  const { t } = useTranslation('kpi')
  const changed = to != null && to !== from
  return (
    <tr>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{label}</td>
      <td className="px-4 py-3 text-right text-[var(--color-foreground)]">{from}</td>
      <td className="px-0 py-3 text-center text-[var(--color-subtle-foreground)]"><ArrowRight size={14} className="inline" aria-hidden="true" /></td>
      <td className={`px-4 py-3 text-right ${changed ? 'font-medium text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>
        {to ?? t('KpiAdjustmentReviewModal.unchanged')}
      </td>
    </tr>
  )
}
