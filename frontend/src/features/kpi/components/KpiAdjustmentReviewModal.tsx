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
  // Ô % bù trừ chỉ hiện khi PHÊ DUYỆT một yêu cầu ngưng KPI, nên ràng buộc theo ngữ cảnh.
  const needsCompensation = !!request?.deactivationRequest
  const schema = useMemo(() => createAdjustmentReviewSchema({ needsCompensation }), [needsCompensation])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AdjustmentReviewFormData>({
    resolver: zodResolver(schema),
    defaultValues: { reviewMode: initialMode, note: '', compensationPercentage: '' },
  })

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
        ...(data.reviewMode === 'approve' && request!.deactivationRequest
          ? { compensationPercentage: Number(data.compensationPercentage) }
          : {}),
      }),
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: ['kpi-adjustments'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success(data.reviewMode === 'approve' ? 'Đã duyệt yêu cầu điều chỉnh' : 'Đã từ chối yêu cầu điều chỉnh')
      close()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Xử lý yêu cầu điều chỉnh thất bại')),
  })

  if (!request) return null

  const isPending = reviewMutation.isPending
  const isReviewable = request.status === 'PENDING'
  const inForm = isReviewable && reviewMode !== 'view'
  const needsCompensationInput = reviewMode === 'approve' && request.deactivationRequest
  const realWeight = (w: number | null) =>
    w == null ? null : request.categoryWeightPercent != null ? `${(w * request.categoryWeightPercent / 100).toFixed(1)}% / ${w}%` : `${w}%`

  const footer = isReviewable
    ? inForm
      ? (
        <DialogFooter
          note="Người yêu cầu sẽ nhận thông báo kèm phản hồi."
          secondary={<Button variant="outline" onClick={() => setReviewMode('view')} disabled={isPending}>Quay lại</Button>}
          primary={
            <Button variant={reviewMode === 'approve' ? 'default' : 'destructive'} onClick={handleSubmit(d => reviewMutation.mutate(d))} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : reviewMode === 'approve' ? <CheckCircle aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              {reviewMode === 'approve' ? 'Duyệt' : 'Từ chối'}
            </Button>
          }
        />
      ) : (
        <DialogFooter
          destructive={
            <Button variant="outline" onClick={() => setReviewMode('reject')} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
              <XCircle aria-hidden="true" /> Từ chối
            </Button>
          }
          secondary={<Button variant="outline" onClick={close}>Đóng</Button>}
          primary={<Button onClick={() => setReviewMode('approve')}><CheckCircle aria-hidden="true" /> Duyệt</Button>}
        />
      )
    : <DialogFooter primary={<Button variant="outline" onClick={close}>Đóng</Button>} />

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!isPending}
      title={request.kpiCriteriaName}
      description={`${request.requesterName} · gửi ${formatDateTime(request.createdAt)}`}
      headerExtra={<StatusBadge status={request.status} />}
      footer={footer}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {request.deactivationRequest ? <Badge variant="destructive">Đề nghị ngưng KPI</Badge> : <Badge variant="warning">Điều chỉnh số liệu</Badge>}
          {request.kpiType === 'QUALITATIVE' && <Badge variant="outline">Định tính</Badge>}
          {request.perspectiveName && (
            <Badge variant="outline" title={`Hạng mục BSC: ${request.perspectiveName}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: request.perspectiveColor || 'var(--color-primary)' }} aria-hidden="true" />
              {request.perspectiveName}
            </Badge>
          )}
        </div>

        <section>
          <h3 className="text-eyebrow mb-1">Lý do điều chỉnh</h3>
          <p className="text-sm leading-5 text-[var(--color-foreground)]">{request.reason}</p>
        </section>
          
        {/* Hiện tại → đề xuất: một bảng ba cột để mắt so theo hàng, không phải hai cột thẻ rời */}
        <section className="overflow-hidden rounded-card border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <th scope="col" className="px-4 py-2 text-left text-eyebrow">Chỉ số</th>
                <th scope="col" className="px-4 py-2 text-right text-eyebrow">Hiện tại</th>
                <th scope="col" className="w-8 px-0 py-2" aria-hidden="true" />
                <th scope="col" className="px-4 py-2 text-right text-eyebrow">Đề xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] tabular-nums">
                  {request.deactivationRequest ? (
                <tr>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">Trạng thái KPI</td>
                  <td className="px-4 py-3 text-right">Đang áp dụng</td>
                  <td className="px-0 py-3 text-center text-[var(--color-subtle-foreground)]"><ArrowRight size={14} className="inline" aria-hidden="true" /></td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--color-error)]">
                    Ngưng{request.compensationPercentage != null ? ` · bù ${request.compensationPercentage}%` : ''}
                  </td>
                </tr>
                  ) : (
                    <>
                      {request.kpiType !== 'QUALITATIVE' && (
                    <ChangeRow label="Mục tiêu" from={formatNumber(request.currentTargetValue)} to={request.requestedTargetValue != null ? formatNumber(request.requestedTargetValue) : null} />
                      )}
                  <ChangeRow label={request.categoryWeightPercent != null ? 'Trọng số thật / form' : 'Trọng số'} from={realWeight(request.currentWeight) ?? '—'} to={realWeight(request.requestedWeight)} />
                      {request.kpiType !== 'QUALITATIVE' && (
                    <ChangeRow label="Tối thiểu" from={request.currentMinimumValue != null ? formatNumber(request.currentMinimumValue) : '0'} to={request.requestedMinimumValue != null ? formatNumber(request.requestedMinimumValue) : null} />
                      )}
                    </>
                  )}
            </tbody>
          </table>
        </section>

        {!isReviewable && request.reviewerNote && (
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
            <h3 className="text-eyebrow mb-1">Phản hồi của {request.reviewerName || 'người duyệt'}</h3>
            <p className="text-sm leading-5 text-[var(--color-foreground)]">{request.reviewerNote}</p>
          </section>
        )}

        {inForm && (
          <section className={`space-y-4 rounded-card border p-4 ${reviewMode === 'reject' ? 'border-[var(--color-error-border)]' : 'border-[var(--color-border)]'}`}>
                {needsCompensationInput && (
                  <div>
                <label htmlFor="adj-compensation" className="text-label block">
                  Tỷ lệ bù trừ thành tích (%) <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
                    </label>
                    <input
                  id="adj-compensation"
                  type="number" min={0} max={150} inputMode="numeric"
                      {...register('compensationPercentage')}
                  aria-invalid={!!errors.compensationPercentage}
                  className="mt-1.5 h-9 w-40 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm tabular-nums text-[var(--color-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  placeholder="100"
                    />
                {errors.compensationPercentage && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.compensationPercentage.message}</p>}
                <p className="mt-1 text-caption">KPI này được tính đạt đúng tỷ lệ nhập ở đây (0–150) thay cho kết quả thực tế.</p>
                  </div>
                )}
                <div>
              <label htmlFor="adj-note" className="text-label block">
                Phản hồi cho người yêu cầu {reviewMode === 'reject' && <span className="text-[var(--color-error)]" aria-hidden="true">*</span>}
                  </label>
                  <textarea
                id="adj-note"
                    {...register('note')}
                    rows={3}
                autoFocus
                aria-invalid={!!errors.note}
                className="mt-1.5 w-full resize-none rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                placeholder={reviewMode === 'reject' ? 'Nêu rõ vì sao không chấp nhận điều chỉnh này.' : 'Ghi chú thêm (không bắt buộc).'}
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
  const changed = to != null && to !== from
  return (
    <tr>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{label}</td>
      <td className="px-4 py-3 text-right text-[var(--color-foreground)]">{from}</td>
      <td className="px-0 py-3 text-center text-[var(--color-subtle-foreground)]"><ArrowRight size={14} className="inline" aria-hidden="true" /></td>
      <td className={`px-4 py-3 text-right ${changed ? 'font-medium text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>
        {to ?? 'Không đổi'}
      </td>
    </tr>
  )
}
