import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import {
  Loader2, Target,
  Award, AlertCircle, Calendar,
  CheckCircle2, Clock, MessageSquare,
} from 'lucide-react'
import AttachmentChips from '@/features/evidence/AttachmentChips'

import { formatNumber, cn } from '@/lib/utils'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface StaffPerformanceDetailModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  periodId: string
  periodName: string
}

export default function StaffPerformanceDetailModal({ 
  open, onClose, userId, userName, periodId, periodName
}: StaffPerformanceDetailModalProps) {
  // Fetch all submissions
  const { data: submissions, isLoading: loadingSubs } = useQuery({
    queryKey: ['submissions', 'performance-detail', userId, periodId],
    queryFn: () => submissionApi.getAll({ 
      submittedById: userId, 
      kpiPeriodId: periodId,
      size: 100 
    }),
    enabled: open
  })

  // Fetch official evaluation
  const { data: evaluations, isLoading: loadingEval } = useQuery({
    queryKey: ['evaluations', 'performance-detail', userId, periodId],
    queryFn: () => evaluationApi.getAll({ 
      userId, 
      kpiPeriodId: periodId,
      size: 10 
    }),
    enabled: open
  })

  const isLoading = loadingSubs || loadingEval
  const submissionList = submissions?.content ?? []
  const officialEval = useMemo(() => 
    evaluations?.content?.sort((a, b) => (b.score || 0) - (a.score || 0)).find((e: any) => e.evaluatorRole !== 'SELF'),
  [evaluations])

  const pendingCount = useMemo(() => 
    submissionList.filter(s => s.status === 'PENDING').length,
  [submissionList])

  // Stats calculation
  const totalWeight = useMemo(() => 
    submissionList.reduce((acc, s) => acc + (s.weight ?? 0), 0), 
  [submissionList])

  const totalAutoScore = useMemo(() => 
    submissionList.reduce((acc, s) => acc + (s.autoScore ?? 0), 0), 
  [submissionList])

  const completedCount = useMemo(() => 
    submissionList.filter(s => s.status === 'APPROVED').length,
  [submissionList])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      title={userName}
      description={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{periodName}</span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><Calendar size={13} aria-hidden="true" /> {submissionList.length} chỉ tiêu KPI</span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><Award size={13} aria-hidden="true" /> Trọng số {totalWeight}%</span>
        </span>
      }
      footer={<DialogFooter primary={<Button onClick={onClose}>Đóng</Button>} />}
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative">
               <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">Đang tải báo cáo chi tiết...</p>
          </div>
        ) : submissionList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-[var(--color-muted)] rounded-card border-2 border-dashed border-[var(--color-border)]">
             <div className="w-20 h-20 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)]">
                <AlertCircle size={40} />
             </div>
             <div className="space-y-2">
                <p className="text-xl font-semibold text-[var(--color-foreground)]">Chưa có bài nộp nào</p>
                <p className="text-sm text-[var(--color-muted-foreground)] max-w-sm mx-auto">Nhân viên này chưa thực hiện nộp kết quả cho các chỉ tiêu trong đợt đánh giá hiện tại.</p>
             </div>
          </div>
        ) : (
          <>
            {/* Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="p-5 rounded-card bg-[var(--color-card)] border border-[var(--color-border)] flex flex-col justify-between">
                  <div className="w-12 h-12 rounded-card bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-primary)] mb-4">
                     <CheckCircle2 size={24} />
                  </div>
                  <div>
                     <p className="text-4xl font-semibold text-[var(--color-foreground)] tracking-tighter mb-1">{completedCount}/{submissionList.length}</p>
                     <p className="text-eyebrow">KPI Hoàn thành</p>
                  </div>
               </div>
               
               <div className="p-8 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] flex flex-col justify-between group hover:border-[var(--color-warning-border)] transition-all">
                  <div className="w-12 h-12 rounded-card bg-[var(--color-warning-bg)] flex items-center justify-center text-[var(--color-warning)] mb-4">
                     <Clock size={24} />
                  </div>
                  <div>
                     <p className="text-4xl font-semibold text-[var(--color-foreground)] tracking-tighter mb-1">{pendingCount}</p>
                     <p className="text-eyebrow">Đang chờ duyệt</p>
                  </div>
               </div>

               <div className={cn(
"p-8 rounded-card flex flex-col justify-between overflow-hidden relative transition-all duration-500",
                  officialEval 
                    ? "bg-[var(--color-success-solid)] text-white"
                    :"bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
               )}>
                  <div className="w-12 h-12 rounded-card bg-white/10 flex items-center justify-center mb-4">
                     <Award size={24} />
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-baseline gap-2 mb-1">
                        <p className="text-4xl font-semibold tracking-tighter">
                           {officialEval ? formatNumber(Math.round(officialEval.score ?? 0)) : formatNumber(Math.round(totalAutoScore))}
                        </p>
                        <span className="text-xs font-medium opacity-60">Điểm số</span>
                     </div>
                     <p className="text-eyebrow text-white/60">
                        {officialEval ? 'Kết quả đánh giá chính thức' : 'Ghi nhận từ hệ thống'}
                     </p>
                  </div>
               </div>
            </div>

            {/* Manager Comment if exists */}
            {officialEval && officialEval.comment && (
               <div className="p-8 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 -rotate-12 transition-transform duration-500">
                     <MessageSquare size={80} />
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-6 bg-[var(--color-success-solid)] rounded-full" />
                        <h4 className="text-sm font-medium text-[var(--color-success)]">Nhận xét từ {officialEval?.evaluatorRoleName || 'Quản lý'}</h4>
                     </div>
                     <p className="text-lg font-medium text-[var(--color-foreground)] italic leading-relaxed">
                        "{officialEval.comment}"
                     </p>
                  </div>
               </div>
            )}

            {/* KPI List */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                 <div className="w-1 h-5 bg-[var(--color-primary)] rounded-full" />
                 <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Chi tiết chỉ tiêu đã nộp</h3>
              </div>
              
              <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">

                {/* Mobile card layout */}
                <div className="sm:hidden divide-y divide-[var(--color-border)]">
                  {submissionList.map((s) => (
                    <div key={s.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-card bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)] shrink-0 mt-0.5">
                          <Target size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--color-foreground)] leading-tight">{s.kpiCriteriaName}</p>
                          <p className="text-eyebrow mt-0.5">Trọng số: {s.weight}%</p>
                          {s.note && (
                            <p className="text-caption font-medium mt-1 italic">"{s.note}"</p>
                          )}
                          {s.attachments && s.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <AttachmentChips files={s.attachments} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-12">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
                          <span className="text-sm font-semibold text-[var(--color-foreground)]">{formatNumber(s.actualValue)}</span>
                          <span className="text-caption font-medium">/ {s.targetValue != null ? formatNumber(s.targetValue) :'—'}</span>
                        </div>
                        <div className={cn(
"text-eyebrow inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
                          s.status === 'APPROVED' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]' :
                          s.status === 'REJECTED' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]' :
                          'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]'
                        )}>
                          {s.status === 'APPROVED' ? 'Đã duyệt' : s.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                        </div>
                        <span className="text-base font-semibold text-[var(--color-subtle-foreground)]">{formatNumber(s.autoScore ?? 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                        <th className="text-eyebrow px-8 py-5 text-left">Nội dung KPI</th>
                        <th className="text-eyebrow px-8 py-5 text-center">Kết quả nộp</th>
                        <th className="text-eyebrow px-8 py-5 text-center">Trạng thái</th>
                        <th className="text-eyebrow px-8 py-5 text-right">Điểm hệ thống</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {submissionList.map((s) => (
                        <tr key={s.id} className="hover:bg-[var(--color-muted)] transition-all group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-card bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)] group-hover:text-[var(--color-primary)] transition-all">
                                <Target size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">{s.kpiCriteriaName}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <p className="text-eyebrow">Trọng số: {s.weight}%</p>
                                  {s.attachments && s.attachments.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-caption">•</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        <AttachmentChips files={s.attachments} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {s.note && (
                                  <p className="text-caption font-medium mt-1.5 italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                    " {s.note} "
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
                              <span className="text-sm font-semibold text-[var(--color-foreground)]">{formatNumber(s.actualValue)}</span>
                              <span className="text-caption font-medium">/ {s.targetValue != null ? formatNumber(s.targetValue) :'—'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className={cn(
"text-eyebrow inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
                              s.status === 'APPROVED' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]' :
                              s.status === 'REJECTED' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]' :
                              'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]'
                            )}>
                              {s.status === 'APPROVED' ? 'Đã duyệt' : s.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className="text-lg font-semibold text-[var(--color-subtle-foreground)] group-hover:text-[var(--color-primary)] transition-colors">{formatNumber(s.autoScore ?? 0)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
