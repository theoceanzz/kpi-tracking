import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã duyệt bài nộp'); reset(); onClose() },
    onError: () => toast.error('Duyệt thất bại'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => submissionApi.review(submission!.id, { status: 'REJECTED', reviewNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã từ chối bài nộp'); reset(); onClose() },
    onError: () => toast.error('Từ chối thất bại'),
  })

  const reset = () => { setReviewNote(''); setMode('view') }

  if (!open || !submission) return null

  const isPending = approveMutation.isPending || rejectMutation.isPending
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Xét duyệt bài nộp</h3>
          <button onClick={() => { reset(); onClose() }} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>

        <div className="bg-[var(--color-muted)]/50 rounded-lg p-4 mb-4 space-y-2 text-sm">
          <div><span className="text-[var(--color-muted-foreground)]">Chỉ tiêu:</span> <span className="font-medium">{submission.kpiCriteriaName}</span></div>
          <div><span className="text-[var(--color-muted-foreground)]">Người nộp:</span> {submission.submittedByName}</div>
          <div><span className="text-[var(--color-muted-foreground)]">Giá trị:</span> <span className="font-semibold text-[var(--color-primary)]">{submission.actualValue}</span>{submission.targetValue != null ? ` / ${submission.targetValue}` : ''}</div>
          {submission.note && <div><span className="text-[var(--color-muted-foreground)]">Ghi chú:</span> {submission.note}</div>}
          <div><span className="text-[var(--color-muted-foreground)]">Ngày nộp:</span> {formatDateTime(submission.createdAt)}</div>
        </div>

        {submission.attachments?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-[var(--color-muted-foreground)] mb-2">Tệp đính kèm</p>
            <AttachmentList attachments={submission.attachments} />
          </div>
        )}

        {mode === 'reject' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Lý do từ chối</label>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Nhập phản hồi cho người nộp..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMode('view')} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Quay lại</button>
              <button onClick={() => rejectMutation.mutate()} disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition flex items-center justify-center gap-2">
                {rejectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Từ chối
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nhận xét (tùy chọn)</label>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Ghi nhận kết quả..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setMode('reject'); setReviewNote('') }} disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center gap-2">
                <XCircle size={16} /> Từ chối
              </button>
              <button onClick={() => approveMutation.mutate()} disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition flex items-center justify-center gap-2">
                {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Phê duyệt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
