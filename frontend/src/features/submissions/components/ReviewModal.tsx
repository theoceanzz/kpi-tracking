import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { X, Loader2, CheckCircle, XCircle, User, Calendar, Paperclip, FileText, MessageSquare, Info } from 'lucide-react'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import type { Submission } from '@/types/submission'
import AttachmentList from './AttachmentList'
import { useAuth } from '@/hooks/useAuth'
import { usePermission } from '@/hooks/usePermission'
import StaffEvaluationModal from './StaffEvaluationModal'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  submission: Submission | null
}
export default function ReviewModal({ open, onClose, submission }: ReviewModalProps) {
  const { user } = useAuth()
  const [reviewNote, setReviewNote] = useState('')
  const [managerScore, setManagerScore] = useState<number | undefined>(undefined)
  const [mode, setMode] = useState<'view' | 'reject'>('view')
  const [showStaffEval, setShowStaffEval] = useState(false)
  const qc = useQueryClient()

  const { hasPermission } = usePermission()
  const isHighAuthority = hasPermission('ROLE:ASSIGN')
  const isOwnSubmission = submission?.submittedById === user?.id
  const canReviewThis = (!submission?.isSubmittedByManager || isHighAuthority) && !isOwnSubmission

  // Initialize managerScore with autoScore when modal opens
  useEffect(() => {
    if (submission && managerScore === undefined) {
      setManagerScore(Math.round(submission.managerScore ?? submission.autoScore ?? 0))
    }
  }, [submission])

  const [showAllApproved, setShowAllApproved] = useState(false)
  const [showEvalForm, setShowEvalForm] = useState(false)

  const approveMutation = useMutation({
    mutationFn: () => submissionApi.review(submission!.id, { 
      status: 'APPROVED', 
      reviewNote: reviewNote || undefined,
      managerScore: managerScore 
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
    onError: () => toast.error('Duyệt thất bại'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => submissionApi.review(submission!.id, { status: 'REJECTED', reviewNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã trả lại bài nộp'); reset(); onClose() },
    onError: () => toast.error('Từ chối thất bại'),
  })

  const reset = () => { setReviewNote(''); setManagerScore(undefined); setMode('view') }

  if (!open || !submission) return null

  const isPending = approveMutation.isPending || rejectMutation.isPending
  const isReviewable = submission.status === 'PENDING' && canReviewThis
  const progress = submission.targetValue ? Math.min(100, Math.round((submission.actualValue / submission.targetValue) * 100)) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { reset(); onClose() }} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileText size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Xét duyệt Bài nộp</h3>
              <p className="text-xs font-medium text-slate-500">{submission.status === 'PENDING' ? 'Đang chờ phê duyệt' : submission.status === 'APPROVED' ? 'Đã phê duyệt' : 'Đã từ chối'}</p>
            </div>
          </div>
          <button onClick={() => { reset(); onClose() }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">

          {/* KPI Name */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border border-emerald-200/50 dark:border-emerald-900/30">
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">{submission.kpiCriteriaName}</h4>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-2">
              <span className="flex items-center gap-1"><User size={12} /> {submission.submittedByName}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateTime(submission.createdAt)}</span>
            </div>
          </div>

          {/* Value Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/50 dark:border-indigo-900/30 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Giá trị thực tế</p>
              <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300">{formatNumber(submission.actualValue)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mục tiêu</p>
              <p className="text-3xl font-black text-slate-600 dark:text-slate-300">{submission.targetValue != null ? formatNumber(submission.targetValue) : '—'}</p>
            </div>
          </div>

          {/* Scoring Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Đánh giá điểm số</span>
              <div className="h-px flex-1 mx-4 bg-slate-100 dark:bg-slate-800" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Auto Score Display */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Điểm hệ thống</p>
                  <p className="text-xs font-medium text-slate-500">Tự động tính</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-700 dark:text-slate-300">{submission.autoScore != null ? formatNumber(submission.autoScore) : '0'}</p>
                </div>
              </div>

              {/* Manager Score Input */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between",
                isReviewable 
                  ? "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800 ring-2 ring-indigo-500/5"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
              )}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-0.5">Điểm chốt cuối</p>
                  <p className="text-xs font-medium text-slate-500">{user?.memberships?.[0]?.roleName || 'Quản lý'} chấm</p>
                </div>
                <div className="w-20">
                  <input 
                    type="number"
                    value={managerScore}
                    onChange={e => setManagerScore(Number(e.target.value))}
                    readOnly={!isReviewable}
                    className="w-full bg-transparent text-right text-2xl font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {progress !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Tiến độ hoàn thành</span>
                <span className={progress >= 100 ? 'text-emerald-600' : progress >= 70 ? 'text-amber-600' : 'text-red-600'}>{progress}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Note */}
          {submission.note && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                <MessageSquare size={12} /> Ghi chú của người nộp
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{submission.note}</p>
            </div>
          )}

          {/* Review info (if already reviewed) */}
          {submission.reviewNote && (
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-900/30">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Phản hồi người duyệt</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{submission.reviewNote}</p>
              {submission.reviewedByName && (
                <p className="text-xs text-blue-500 mt-2 font-medium">— {submission.reviewedByName}, {submission.reviewedAt ? formatDateTime(submission.reviewedAt) : ''}</p>
              )}
            </div>
          )}

          {/* Attachments */}
          {submission.attachments?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                <Paperclip size={12} /> Tệp đính kèm ({submission.attachments.length})
              </div>
              <AttachmentList attachments={submission.attachments} />
            </div>
          )}

          {/* View Detailed Evaluation Button */}
          <button 
            onClick={() => setShowStaffEval(true)}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-3 group"
          >
            <Info size={18} className="group-hover:animate-bounce" />
            <span className="text-sm font-bold">Xem chi tiết đợt đánh giá của nhân viên này</span>
          </button>

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
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex gap-3 animate-in slide-in-from-top-2 duration-300">
              <Info className="text-amber-600 shrink-0" size={20} />
              <div className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
                <span className="block font-black uppercase tracking-widest text-[10px] mb-1">Quyền hạn hạn chế</span>
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
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">
                      Lý do từ chối
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none transition-all"
                      placeholder="Phản hồi chi tiết để nhân viên chỉnh sửa..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setMode('view')} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                      Quay lại
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate()}
                      disabled={isPending}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    >
                      {rejectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                      <XCircle size={16} /> Xác nhận Từ chối
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">
                      Nhận xét <span className="text-slate-400 font-normal">(tùy chọn)</span>
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none transition-all"
                      placeholder="Ghi nhận kết quả công việc..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setMode('reject'); setReviewNote('') }}
                      disabled={isPending}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} /> Trả lại
                    </button>
                    <button
                      onClick={() => approveMutation.mutate()}
                      disabled={isPending}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />}
                      Phê duyệt
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Đã duyệt hết KPI con → hỏi tự đánh giá */}
      {showAllApproved && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center space-y-6 animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Đã chấm xong!</h3>
              <p className="text-sm text-slate-500">Bạn đã duyệt hết KPI đã giao. Bạn có muốn tự đánh giá luôn không?</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAllApproved(false); onClose() }}
                className="flex-1 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Để sau
              </button>
              <button
                onClick={() => { setShowAllApproved(false); setShowEvalForm(true) }}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
              >
                Tự đánh giá ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form tự đánh giá */}
      <EvaluationFormModal
        open={showEvalForm}
        onClose={() => { setShowEvalForm(false); onClose() }}
        initialPeriodId={submission?.kpiPeriod?.id}
      />
    </div>
  )
}
