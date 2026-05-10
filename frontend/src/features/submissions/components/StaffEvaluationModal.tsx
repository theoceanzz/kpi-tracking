import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import { toast } from 'sonner'
import { 
  X, Loader2, CheckCircle, Target, TrendingUp, 
  MessageSquare, Award, Star,
  AlertCircle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { formatNumber, cn } from '@/lib/utils'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

interface StaffEvaluationModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  periodId: string
  periodName: string
  readOnly?: boolean
  evaluationComment?: string
}
export default function StaffEvaluationModal({ 
  open, onClose, userId, userName, periodId, periodName, readOnly = false, evaluationComment 
}: StaffEvaluationModalProps) {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const userRoleName = user?.memberships?.[0]?.roleName || 'Quản lý'
  const qc = useQueryClient()
  const [individualScores, setIndividualScores] = useState<Record<string, number>>({})
  const [overallComment, setOverallComment] = useState(evaluationComment || '')

  const getGrade = (score: number) => {
    if (!org) return '—'
    if (score >= (org.excellentThreshold ?? 90)) return 'XUẤT SẮC'
    if (score >= (org.goodThreshold ?? 80)) return 'TỐT'
    if (score >= (org.fairThreshold ?? 70)) return 'KHÁ'
    if (score >= (org.averageThreshold ?? 50)) return 'TRUNG BÌNH'
    return 'YẾU'
  }

  // Fetch all submissions for this user in this period
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['submissions', 'staff-eval', userId, periodId],
    queryFn: () => submissionApi.getAll({ 
      submittedById: userId, 
      kpiPeriodId: periodId,
      size: 100 
    }),
    enabled: open
  })

  // Fetch existing evaluation if any
  const { data: existingEval } = useQuery({
    queryKey: ['evaluations', 'staff-eval', userId, periodId],
    queryFn: () => evaluationApi.getAll({ userId, kpiPeriodId: periodId, size: 1 }),
    enabled: open
  })

  const submissionList = submissions?.content ?? []

  // Initialize individual scores when data loaded
  useEffect(() => {
    if (submissionList.length > 0) {
      const scores: Record<string, number> = {}
      submissionList.forEach(s => {
        scores[s.id] = s.managerScore ?? s.autoScore ?? 0
      })
      setIndividualScores(scores)
    }
  }, [submissions])

  // Initialize comment from existing evaluation
  useEffect(() => {
    const evalData = existingEval?.content?.[0]
    if (evalData?.comment) {
      setOverallComment(evalData.comment)
    } else if (evaluationComment) {
      setOverallComment(evaluationComment)
    }
  }, [existingEval, evaluationComment])

  // Calculation logic
  const totalAutoScore = useMemo(() => 
    submissionList.reduce((acc, s) => acc + (s.autoScore ?? 0), 0), 
  [submissionList])

  const totalManagerScore = useMemo(() => 
    Object.values(individualScores).reduce((acc, s) => acc + s, 0), 
  [individualScores])

  // Bulk review mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // 1. Bulk Review Submissions
      await submissionApi.bulkReview({
        submissionIds: submissionList.map(s => s.id),
        commonReview: { status: 'APPROVED', reviewNote: 'Phê duyệt tổng hợp qua bảng đánh giá' },
        individualReviews: Object.entries(individualScores).map(([id, score]) => ({
          submissionId: id,
          managerScore: score
        }))
      })

      // 2. Create Evaluation record
      await evaluationApi.create({
        userId,
        kpiPeriodId: periodId,
        score: totalManagerScore,
        comment: overallComment || `${userRoleName} đánh giá kết quả đợt ${periodName}`
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success('Đã hoàn tất đánh giá và phê duyệt cho nhân viên')
      onClose()
    },
    onError: () => {
      toast.error('Có lỗi xảy ra khi lưu đánh giá')
    }
  })

  const isFullyApproved = useMemo(() => 
    submissionList.length > 0 && submissionList.every(s => s.status === 'APPROVED'),
  [submissionList])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-5xl mx-auto overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="relative bg-slate-900 p-8 text-white shrink-0">
          <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 pointer-events-none">
            <Award size={140} />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                <Star size={12} className="fill-current" /> Aggregated Performance Review
              </div>
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                Đánh giá tổng hợp: <span className="text-indigo-400">{userName}</span>
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                Kỳ đánh giá: <b className="text-white">{periodName}</b> • Đang xem xét {submissionList.length} chỉ tiêu KPI
                {isFullyApproved ? (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-widest">Đã chấm điểm</span>
                ) : (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-widest">Chưa chấm điểm</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={40} className="animate-spin text-indigo-500" />
              <p className="text-sm font-bold text-slate-400">Đang tổng hợp dữ liệu KPI...</p>
            </div>
          ) : submissionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-50 dark:bg-slate-800/30 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800">
               <AlertCircle size={48} className="text-slate-300" />
               <div className="space-y-1">
                  <p className="text-lg font-black text-slate-900 dark:text-white">Không tìm thấy bài nộp</p>
                  <p className="text-sm text-slate-500">Nhân viên này chưa có bài nộp nào trong đợt {periodName}.</p>
               </div>
            </div>
          ) : (
            <>
              {/* KPI List Table */}
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Chỉ tiêu KPI</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Kết quả / Mục tiêu</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Điểm hệ thống</th>
                      {(isFullyApproved || !readOnly) && (
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-indigo-400 text-right">{userRoleName} chấm</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {submissionList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-all group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                              <Target size={14} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 dark:text-white">{s.kpiCriteriaName}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Trọng số: {s.weight}%</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                             <span className="text-xs font-black text-slate-900 dark:text-white">{formatNumber(s.actualValue)}</span>
                             <span className="text-[10px] text-slate-400">/</span>
                             <span className="text-[10px] font-bold text-slate-500">{s.targetValue != null ? formatNumber(s.targetValue) : '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-bold text-slate-400">{formatNumber(s.autoScore ?? 0)}</span>
                        </td>
                        {(isFullyApproved || !readOnly) && (
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end">
                              <div className="w-24 relative group/input">
                                <input 
                                  type="number"
                                  value={individualScores[s.id] ?? 0}
                                  onChange={e => setIndividualScores(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  disabled={readOnly}
                                  className={cn(
                                    "w-full px-3 py-2 rounded-xl text-right text-sm font-black outline-none transition-all",
                                    readOnly 
                                      ? "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                                      : "bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                                  )}
                                />
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary and Comment */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {(isFullyApproved || !readOnly) && (
                  <div className="lg:col-span-7 space-y-4">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                      <MessageSquare size={14} /> Nhận xét chung của {userRoleName}
                    </label>
                    <textarea 
                      value={overallComment}
                      onChange={e => setOverallComment(e.target.value)}
                      rows={4}
                      disabled={readOnly}
                      className={cn(
                        "w-full px-6 py-5 rounded-[32px] border text-sm font-medium resize-none transition-all",
                        readOnly
                          ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                      )}
                      placeholder={readOnly ? "Chưa có nhận xét nào..." : "Đánh giá tổng quát thái độ, nỗ lực và kết quả làm việc của nhân sự trong đợt này..."}
                    />
                  </div>
                )}

                <div className={cn(
                  "lg:col-span-5",
                  !(isFullyApproved || !readOnly) && "lg:col-span-12"
                )}>
                   <div className="p-8 rounded-[40px] bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-2xl shadow-indigo-500/20 space-y-6 relative overflow-hidden group">
                      <div className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                         <TrendingUp size={200} />
                      </div>
                      
                      <div className="space-y-1 relative z-10">
                         <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Kết quả đánh giá cuối cùng</p>
                         <div className="flex items-baseline gap-2">
                            <h3 className="text-6xl font-black tracking-tighter">{formatNumber(totalManagerScore)}</h3>
                            <span className="text-lg font-bold opacity-60">điểm</span>
                         </div>
                      </div>

                      <div className="pt-6 border-t border-white/10 space-y-3 relative z-10">
                         <div className="flex justify-between text-xs font-bold text-indigo-100/60">
                            <span>Tổng điểm hệ thống</span>
                            <span>{formatNumber(totalAutoScore)}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold text-indigo-100/60">
                            <span>Chênh lệch do điều chỉnh</span>
                            <span>{totalManagerScore - totalAutoScore >= 0 ? '+' : ''}{formatNumber(totalManagerScore - totalAutoScore)}</span>
                         </div>
                      </div>

                      <div className="pt-2 relative z-10">
                         <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
                            <Award size={14} /> Tự động xếp loại: {getGrade(totalManagerScore)}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!readOnly && (
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                 <AlertCircle size={20} />
              </div>
              <p className="text-[10px] font-medium text-slate-500 max-w-[280px]">
                 Hành động này sẽ <b>phê duyệt đồng loạt</b> các bài nộp và <b>lưu kết quả đánh giá chính thức</b> vào hồ sơ nhân sự.
              </p>
           </div>

           <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || submissionList.length === 0}
                className="px-10 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[2px] shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />}
                PHÊ DUYỆT & CHỐT ĐÁNH GIÁ
              </button>
           </div>
        </div>
        )}
      </div>
    </div>
  )
}
