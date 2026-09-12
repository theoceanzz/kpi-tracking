import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { createReviewSubmissionSchema, type ReviewSubmissionFormData } from '../schemas/submissionSchema'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { Loader2, CheckCircle, XCircle, User, Calendar, Paperclip, MessageSquare, Info } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import type { Submission } from '@/types/submission'
import AttachmentList from './AttachmentList'
import { useAuth } from '@/hooks/useAuth'
import { usePermission } from '@/hooks/usePermission'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import StaffEvaluationModal from './StaffEvaluationModal'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  submission: Submission | null
}
export default function ReviewModal({ open, onClose, submission }: ReviewModalProps) {
  const { user } = useAuth()
  const [showStaffEval, setShowStaffEval] = useState(false)
  const qc = useQueryClient()

  const { hasPermission } = usePermission()
  const isHighAuthority = hasPermission('ROLE:ASSIGN')
  const isOwnSubmission = submission?.submittedById === user?.id
  const canReviewThis = (!submission?.isSubmittedByManager || isHighAuthority) && !isOwnSubmission

  const isQualitative = submission?.kpiType === 'QUALITATIVE'
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const qualitativeLevels = [...(org?.qualitativeLevels ?? [])].sort((a, b) => a.position - b.position)

  // KPI định tính chọn mức, KPI định lượng chấm điểm — hai luật khác nhau nên schema
  // dựng theo loại của bài nộp đang mở.
  const schema = useMemo(() => createReviewSubmissionSchema({ isQualitative }), [isQualitative])

  const { register, handleSubmit, reset: resetForm, watch, setValue, formState: { errors } } = useForm<ReviewSubmissionFormData>({
    resolver: zodResolver(schema),
    defaultValues: { mode: 'view', reviewNote: '', managerScore: undefined, qualitativeLevelId: undefined },
  })

  const mode = watch('mode')
  const selectedLevelId = watch('qualitativeLevelId')
  const setMode = (next: ReviewSubmissionFormData['mode']) => setValue('mode', next)
  const setSelectedLevelId = (id: string | undefined) =>
    setValue('qualitativeLevelId', id, { shouldValidate: true })

  // Mở bài nộp nào thì nạp lại điểm/mức đã chấm của bài đó.
  useEffect(() => {
    if (!submission) return
    resetForm({
      mode: 'view',
      reviewNote: '',
      managerScore: Math.round(submission.managerScore ?? submission.autoScore ?? 0),
      qualitativeLevelId: submission.qualitativeLevelId ?? undefined,
    })
  }, [submission, resetForm])

  const [showAllApproved, setShowAllApproved] = useState(false)
  const [showEvalForm, setShowEvalForm] = useState(false)

  const approveMutation = useMutation({
    mutationFn: (data: ReviewSubmissionFormData) => submissionApi.review(submission!.id, {
      status: 'APPROVED',
      reviewNote: data.reviewNote || undefined,
      // Qualitative KPIs: send the chosen level; the backend computes managerScore.
      ...(isQualitative
        ? { qualitativeLevelId: data.qualitativeLevelId }
        : { managerScore: data.managerScore }),
    }),
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ['submissions'] })
      toast.success('Đã phê duyệt bài nộp')
      reset()
      
      if (data.allChildrenApproved) {
        setShowAllApproved(true)
      } else {
        onClose()
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Duyệt bài nộp thất bại')),
  })

  const rejectMutation = useMutation({
    mutationFn: (data: ReviewSubmissionFormData) =>
      submissionApi.review(submission!.id, { status: 'REJECTED', reviewNote: data.reviewNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã trả lại bài nộp'); reset(); onClose() },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Trả lại bài nộp thất bại')),
  })

  const reset = () => resetForm({ mode: 'view', reviewNote: '', managerScore: undefined, qualitativeLevelId: undefined })

  if (!open || !submission) return null

  const isPending = approveMutation.isPending || rejectMutation.isPending
  const isReviewable = submission.status === 'PENDING' && canReviewThis
  const progress = submission.targetValue ? Math.min(100, Math.round((submission.actualValue / submission.targetValue) * 100)) : null

  return (
    <>
    <Dialog
      open
      onClose={() => { reset(); onClose() }}
      size="md"
      dismissible={!isPending}
      title="Xét duyệt Bài nộp"
      description={submission.status === 'PENDING' ? 'Đang chờ phê duyệt' : submission.status === 'APPROVED' ? 'Đã phê duyệt' : 'Đã từ chối'}
      footer={isReviewable ? (
        mode === 'reject' ? (
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setMode('view')} disabled={isPending}>Quay lại</Button>}
            primary={
              <Button variant="destructive" onClick={handleSubmit(data => rejectMutation.mutate(data))} disabled={isPending}>
                {rejectMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                Xác nhận Từ chối
              </Button>
            }
          />
        ) : (
          <DialogFooter
            secondary={
              <Button
                variant="outline"
                className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                onClick={() => { setMode('reject'); setValue('reviewNote', '') }}
                disabled={isPending}
              >
              <XCircle aria-hidden="true" /> Trả lại
            </Button>
          }
          primary={
            <Button
              className="bg-[var(--color-success-solid)] text-white hover:bg-[var(--color-success-solid)]"
              onClick={handleSubmit(data => approveMutation.mutate(data))}
              disabled={isPending}
              title={isQualitative && !selectedLevelId ? 'Vui lòng chọn mức đánh giá định tính' : undefined}
            >
              {approveMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              Phê duyệt
            </Button>
          }
        />
      )
    ) : (
      <DialogFooter secondary={<Button variant="outline" onClick={() => { reset(); onClose() }}>Đóng</Button>} />
    )}
  >
      <div className="space-y-5">

        {/* KPI Name */}
        <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-success-border)]">
          <h4 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">{submission.kpiCriteriaName}</h4>
          <div className="flex items-center gap-3 text-xs font-medium text-[var(--color-muted-foreground)] mt-2">
            <span className="flex items-center gap-1"><User size={12} /> {submission.submittedByName}</span>
            <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateTime(submission.createdAt)}</span>
          </div>
        </div>

        {/* Value Comparison — quantitative only */}
        {!isQualitative && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)] text-center">
            <p className="text-eyebrow text-[var(--color-primary)] mb-1">Giá trị thực tế</p>
            <p className="text-3xl font-semibold text-[var(--color-primary)]">{formatNumber(submission.actualValue)}</p>
          </div>
          <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-center">
            <p className="text-eyebrow mb-1">Mục tiêu</p>
            <p className="text-3xl font-semibold text-[var(--color-muted-foreground)]">{submission.targetValue != null ? formatNumber(submission.targetValue) :'—'}</p>
          </div>
        </div>
        )}

        {/* Scoring Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-eyebrow">Đánh giá điểm số</span>
            <div className="h-px flex-1 mx-4 bg-[var(--color-muted)]"/>
          </div>

          {isQualitative ? (
            /* Qualitative: pick a level from the org's qualitative scale */
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-muted-foreground)] px-1">Chọn mức đánh giá định tính:</p>
              {qualitativeLevels.length === 0 ? (
                <p className="text-xs font-medium text-[var(--color-warning)] px-1">Chưa cấu hình thang điểm định tính ở trang Công ty.</p>
              ) : (
                <div className="space-y-2">
                  {qualitativeLevels.map(level => {
                    const active = selectedLevelId === level.id
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => isReviewable && setSelectedLevelId(level.id)}
                        disabled={!isReviewable}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-card border-2 transition-all text-left disabled:cursor-not-allowed",
                          active
                            ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] ring-2 ring-[var(--color-success-solid)]"
                            :"border-[var(--color-border)] hover:border-[var(--color-success-border)]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-control flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: level.color || '#64748b' }}>
                            {level.position}
                          </span>
                          <span className={cn("text-sm font-medium", active ? "text-[var(--color-success)]" : "text-[var(--color-foreground)]")}>
                            {level.name}
                          </span>
                        </div>
                        <span className="text-lg font-semibold text-[var(--color-muted-foreground)]">{formatNumber(level.value)} đ</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {errors.qualitativeLevelId && (
                <p className="px-1 text-xs font-medium text-[var(--color-error)]">{errors.qualitativeLevelId.message}</p>
              )}
              {submission.managerScore != null && (
                <p className="text-caption px-1">Điểm quy đổi hiện tại: <span className="text-[var(--color-success)]">{formatNumber(submission.managerScore)}</span></p>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto Score Display */}
            <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] flex items-center justify-between">
              <div>
                <p className="text-eyebrow mb-0.5">Điểm hệ thống</p>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">Tự động tính</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-[var(--color-foreground)]">{submission.autoScore != null ? formatNumber(submission.autoScore) :'0'}</p>
              </div>
            </div>

            {/* Manager Score Input */}
            <div className={cn(
              "p-4 rounded-card border transition-all duration-300 flex items-center justify-between",
              isReviewable
                ? "bg-[var(--color-primary-soft)] border-[var(--color-border)] ring-2 ring-[var(--color-ring)]"
                :"bg-[var(--color-muted)] border-[var(--color-border)]"
            )}>
              <div>
                <p className="text-eyebrow text-[var(--color-primary)] mb-0.5">Điểm chốt cuối</p>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{user?.memberships?.[0]?.roleName || 'Quản lý'} chấm</p>
              </div>
              <div className="w-20">
                <input
                  type="number"
                  {...register('managerScore', { setValueAs: v => (v === '' || v == null ? undefined : Number(v)) })}
                  readOnly={!isReviewable}
                  className="w-full bg-transparent text-right text-2xl font-semibold text-[var(--color-primary)] outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Progress bar */}
        {progress !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-[var(--color-muted-foreground)]">Tiến độ hoàn thành</span>
              <span className={progress >= 100 ? 'text-[var(--color-success)]' : progress >= 70 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}>{progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-[var(--color-success-solid)]' : progress >= 70 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]'}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Note */}
        {submission.note && (
          <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
            <div className="text-eyebrow flex items-center gap-1.5 mb-2">
              <MessageSquare size={12} /> Ghi chú của người nộp
            </div>
            <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{submission.note}</p>
          </div>
        )}

        {/* Review info (if already reviewed) */}
        {submission.reviewNote && (
          <div className="p-4 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)]">
            <p className="text-eyebrow text-[var(--color-info)] mb-1">Phản hồi người duyệt</p>
            <p className="text-sm text-[var(--color-info)]">{submission.reviewNote}</p>
            {submission.reviewedByName && (
              <p className="text-xs text-[var(--color-info)] mt-2 font-medium">— {submission.reviewedByName}, {submission.reviewedAt ? formatDateTime(submission.reviewedAt) : ''}</p>
            )}
          </div>
        )}

        {/* Attachments */}
        {submission.attachments?.length > 0 && (
          <div>
            <div className="text-eyebrow flex items-center gap-1.5 mb-3">
              <Paperclip size={12} /> Tệp đính kèm ({submission.attachments.length})
            </div>
            <AttachmentList attachments={submission.attachments} />
          </div>
        )}

        {/* View Detailed Evaluation Button */}
        <Button variant="outline" className="w-full group" onClick={() => setShowStaffEval(true)}>
          <Info aria-hidden="true" className="group-hover:animate-bounce" />
          <span className="text-sm font-medium">Xem chi tiết đợt đánh giá của nhân viên này</span>
        </Button>

        {/* Aggregated Evaluation Modal */}
        {submission && (
          <StaffEvaluationModal
            open={showStaffEval}
            onClose={() => setShowStaffEval(false)}
            userId={submission.submittedById}
            userName={submission.submittedByName}
            periodId={submission.kpiPeriod?.id || ''}
            periodName={submission.kpiPeriod?.name || ''}
          />
        )}

        {/* Restriction Notice */}
        {!canReviewThis && submission.status === 'PENDING' && (
          <div className="p-4 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] flex gap-3 animate-in slide-in-from-top-2 duration-300">
            <Info className="text-[var(--color-warning)] shrink-0" size={20} />
            <div className="text-xs font-medium text-[var(--color-warning)] leading-relaxed">
              <span className="text-eyebrow block mb-1">Quyền hạn hạn chế</span>
              Bản nộp này của cấp quản lý. Theo quy định, chỉ cấp trên có thẩm quyền tương ứng mới có quyền phê duyệt các báo cáo này.
            </div>
          </div>
        )}

        {/* Actions */}
        {isReviewable && (
          <>
            {mode === 'reject' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-label block mb-2 text-[var(--color-foreground)]">
                    Lý do từ chối
                  </label>
                  <textarea
                    {...register('reviewNote')}
                    rows={3}
                    className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-error-solid)] focus:border-[var(--color-error-border)] resize-none transition-all"
                    placeholder="Phản hồi chi tiết để nhân viên chỉnh sửa..."
                  />
                  {errors.reviewNote && (
                    <p className="mt-1 text-xs font-medium text-[var(--color-error)]">{errors.reviewNote.message}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-label block mb-2 text-[var(--color-foreground)]">
                    Nhận xét <span className="text-[var(--color-subtle-foreground)] font-normal">(tùy chọn)</span>
                  </label>
                  <textarea
                    {...register('reviewNote')}
                    rows={2}
                    className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] resize-none transition-all"
                    placeholder="Ghi nhận kết quả công việc..."
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>

      {/* Đã duyệt hết KPI con → hỏi tự đánh giá */}
      <Dialog
        open={showAllApproved}
        onClose={() => { setShowAllApproved(false); onClose() }}
        size="sm"
        title="Đã chấm xong"
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => { setShowAllApproved(false); onClose() }}>Để sau</Button>}
            primary={<Button onClick={() => { setShowAllApproved(false); setShowEvalForm(true) }}>Tự đánh giá ngay</Button>}
          />
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-success-bg)]">
            <CheckCircle size={18} className="text-[var(--color-success)]" aria-hidden="true" />
          </span>
          <p className="text-sm text-[var(--color-muted-foreground)]">Bạn đã duyệt hết KPI đã giao. Bạn có muốn tự đánh giá luôn không?</p>
        </div>
      </Dialog>

      {/* Form tự đánh giá */}
      <EvaluationFormModal
        open={showEvalForm}
        onClose={() => { setShowEvalForm(false); onClose() }}
        initialPeriodId={submission?.kpiPeriod?.id}
      />
    </>
  )
}
