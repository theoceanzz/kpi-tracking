import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { X, Loader2, CheckCircle, XCircle, User, Calendar, Paperclip, FileText, MessageSquare } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/utils'
import type { Submission } from '@/types/submission'
import AttachmentList from './AttachmentList'

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  submission: Submission | null
}

export default function ReviewModal({ open, onClose, submission }: ReviewModalProps) {
  const [reviewNote, setReviewNote] = useState('')
  const [mode, setMode] = useState<'view' | 'reject'>('view')
  const qc = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: () => submissionApi.review(submission!.id, { status: 'APPROVED', reviewNote: reviewNote || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã phê duyệt bài nộp'); reset(); onClose() },
    onError: () => toast.error('Duyệt thất bại'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => submissionApi.review(submission!.id, { status: 'REJECTED', reviewNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã trả lại bài nộp'); reset(); onClose() },
    onError: () => toast.error('Từ chối thất bại'),
  })

  const reset = () => { setReviewNote(''); setMode('view') }

  if (!open || !submission) return null

  const isPending = approveMutation.isPending || rejectMutation.isPending
  const isReviewable = submission.status === 'PENDING'
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
    </div>
  )
}
