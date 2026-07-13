import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import { toast } from 'sonner'
import {
  X, Loader2, CheckCircle, Target, TrendingUp,
  MessageSquare, Award, Star, Zap,
  AlertCircle, Paperclip, ExternalLink, Lock
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { formatNumber, cn } from '@/lib/utils'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

import { getScoringFunctions } from '@/lib/scoring'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'

interface StaffEvaluationModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  periodId: string
  periodName: string
  readOnly?: boolean
  evaluationComment?: string
  periodEnded?: boolean
}
export default function StaffEvaluationModal({
  open, onClose, userId, userName, periodId, periodName, readOnly = false, evaluationComment, periodEnded = false
}: StaffEvaluationModalProps) {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreLabel, maxScore } = getScoringFunctions(org)
  const qualitativeLevels = [...(org?.qualitativeLevels ?? [])].sort((a, b) => a.position - b.position)
  const userRoleName = user?.memberships?.[0]?.roleName || 'Quản lý'
  const qc = useQueryClient()
  const [individualScores, setIndividualScores] = useState<Record<string, number>>({})
  const [individualLevels, setIndividualLevels] = useState<Record<string, string>>({})
  const [overallComment, setOverallComment] = useState(evaluationComment || '')
  const [finalScore, setFinalScore] = useState(0)
  const hasManuallyAdjustedFinal = useRef(false)

  const getGrade = (score: number) => {
    return getScoreLabel(score)
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

  // Full-qualitative: the staff member has only qualitative KPIs, so KPI completion defaults to
  // 100% -> the final 0..100 score is locked to maxScore (in sync with "100% hoàn thành"),
  // matching EvaluationFormModal's self-score behaviour.
  const isFullQualitative = submissionList.length > 0 && submissionList.every(s => s.kpiType === 'QUALITATIVE')
  const effectiveFinalScore = isFullQualitative ? maxScore : finalScore

  // Quantitative KPIs share the 0..100 pool. When qualitative takes part of the 100%
  // weight, normalize the quantitative scores over their OWN weight so they still fill
  // the 0..100 scale (matching the backend evaluation system score, which is normalized).
  // Per-submission autoScore/managerScore stay on the raw weight scale in the DB; we only
  // scale them by normFactor for display/inputs here, and de-normalize again on save.
  const quantWeight = useMemo(() =>
    submissionList.filter(s => s.kpiType !== 'QUALITATIVE').reduce((acc, s) => acc + (s.weight ?? 0), 0),
  [submissionList])
  const normFactor = quantWeight > 0 ? 100 / quantWeight : 1

  // Initialize individual scores when data loaded
  useEffect(() => {
    if (submissionList.length > 0) {
      const scores: Record<string, number> = {}
      const levels: Record<string, string> = {}
      submissionList.forEach(s => {
        scores[s.id] = Math.round((s.managerScore ?? s.autoScore ?? 0) * normFactor)
        if (s.qualitativeLevelId) levels[s.id] = s.qualitativeLevelId
      })
      setIndividualScores(scores)
      setIndividualLevels(levels)
    }
  }, [submissions])

  // Initialize comment and final score from existing evaluation
  useEffect(() => {
    const evalData = existingEval?.content?.[0]
    if (evalData?.comment) {
      setOverallComment(evalData.comment)
    } else if (evaluationComment) {
      setOverallComment(evaluationComment)
    }
    if (evalData?.score != null) {
      setFinalScore(evalData.score)
      hasManuallyAdjustedFinal.current = true
    }
  }, [existingEval, evaluationComment])

  // Calculation logic (quantitative only, normalized to fill the 0..100 pool)
  const totalAutoScore = useMemo(() =>
    submissionList.filter(s => s.kpiType !== 'QUALITATIVE').reduce((acc, s) => acc + Math.round((s.autoScore ?? 0) * normFactor), 0),
  [submissionList, normFactor])

  // Qualitative KPIs feed the matrix, not the 0..100 sum, so exclude them here.
  const totalManagerScore = useMemo(() =>
    submissionList.filter(s => s.kpiType !== 'QUALITATIVE').reduce((acc, s) => acc + (individualScores[s.id] ?? 0), 0),
  [individualScores, submissionList])

  // Final score slider starts at the sum of the per-KPI scores above, then can be
  // dragged independently within [0, maxScore] without being tied back to those scores.
  useEffect(() => {
    if (!hasManuallyAdjustedFinal.current) {
      setFinalScore(totalManagerScore)
    }
  }, [totalManagerScore])

  const handleResetFinalScore = () => {
    if (readOnly) return
    hasManuallyAdjustedFinal.current = false
    setFinalScore(totalManagerScore)
  }

  // Bulk review mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // 1. Bulk Review Submissions — skip when the staff member has no submissions
      let reviewResults: Awaited<ReturnType<typeof submissionApi.bulkReview>> = []
      if (submissionList.length > 0) {
        reviewResults = await submissionApi.bulkReview({
          submissionIds: submissionList.map(s => s.id),
          commonReview: { status: 'APPROVED', reviewNote: 'Phê duyệt tổng hợp qua bảng đánh giá' },
          individualReviews: submissionList.map(s =>
            s.kpiType === 'QUALITATIVE'
              ? { submissionId: s.id, qualitativeLevelId: individualLevels[s.id] }
              // De-normalize back to the raw weight scale for storage.
              : { submissionId: s.id, managerScore: (individualScores[s.id] ?? 0) / normFactor }
          ).filter(ir => ('managerScore' in ir && ir.managerScore != null) || ('qualitativeLevelId' in ir && ir.qualitativeLevelId != null))
        })
      }

      // 2. Create Evaluation record
      await evaluationApi.create({
        userId,
        kpiPeriodId: periodId,
        score: effectiveFinalScore,
        comment: overallComment || `${userRoleName} đánh giá kết quả đợt ${periodName}`
      })

      return reviewResults
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['evaluations'] })

      const autoApproved = data?.find(s => s.allChildrenApproved && s.parentSubmissionId)
      if (autoApproved) {
        toast.success('Đã hoàn tất đánh giá và phê duyệt cho nhân viên')
        setShowAllApproved(true)
      } else {
        onClose()
      }
    },
    onError: () => {
      toast.error('Có lỗi xảy ra khi lưu đánh giá')
    }
  })

  const [showAllApproved, setShowAllApproved] = useState(false)
  const [showEvalForm, setShowEvalForm] = useState(false)

  const isFullyApproved = useMemo(() => 
    submissionList.length > 0 && submissionList.every(s => s.status === 'APPROVED'),
  [submissionList])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-5xl mx-auto overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="relative bg-slate-900 p-4 sm:p-8 text-white shrink-0">
          <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 pointer-events-none">
            <Award size={140} />
          </div>
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest text-indigo-300 whitespace-nowrap">
                <Star size={12} className="fill-current shrink-0" /> Aggregated Performance Review
              </div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight">
                Đánh giá tổng hợp: <span className="text-indigo-400">{userName}</span>
              </h2>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-slate-400 text-xs font-medium truncate">
                  Kỳ đánh giá: <b className="text-white">{periodName}</b> • {submissionList.length} chỉ tiêu KPI
                </p>
                {isFullyApproved ? (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-widest border border-emerald-500/30 whitespace-nowrap">
                    Đã phê duyệt
                  </span>
                ) : (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-widest border border-amber-500/30 whitespace-nowrap">
                    Đang chờ chấm điểm
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all shrink-0">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar">

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={40} className="animate-spin text-indigo-500" />
              <p className="text-sm font-bold text-slate-400">Đang tổng hợp dữ liệu KPI...</p>
            </div>
          ) : submissionList.length === 0 && !periodEnded ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-50 dark:bg-slate-800/30 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800">
               <AlertCircle size={48} className="text-slate-300" />
               <div className="space-y-1">
                  <p className="text-lg font-black text-slate-900 dark:text-white">Không tìm thấy bài nộp</p>
                  <p className="text-sm text-slate-500">Nhân viên này chưa có bài nộp nào trong đợt {periodName}. Bạn chỉ có thể chốt đánh giá sau khi đợt kết thúc.</p>
               </div>
            </div>
          ) : (
            <>
              {/* "Chưa làm" banner — staff member has no submissions and the period has ended */}
              {submissionList.length === 0 && (
                <div className="flex items-center gap-4 p-5 rounded-[28px] bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-amber-900 dark:text-amber-100">Nhân viên chưa làm trong đợt này</p>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 opacity-80">
                      Không có bài nộp nào. Đợt đã kết thúc nên bạn có thể chốt đánh giá — điểm mặc định là 0, có thể điều chỉnh nếu cần.
                    </p>
                  </div>
                </div>
              )}

              {/* KPI List — Mobile: cards, Desktop: table */}
              {submissionList.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

                {/* Mobile card layout (hidden on sm+) */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/50">
                  {submissionList.map((s) => (
                    <div key={s.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                          <Target size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{s.kpiCriteriaName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Trọng số: {s.weight}%</p>
                          {s.note && (
                            <p className="text-[10px] text-slate-500 font-medium mt-1 italic">"{s.note}"</p>
                          )}
                          {s.attachments && s.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {s.attachments.map(att => (
                                <a
                                  key={att.id}
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={att.fileName}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider hover:bg-indigo-500 hover:text-white transition-all"
                                >
                                  <Paperclip size={10} />
                                  <span className="truncate max-w-[80px]">{att.fileName}</span>
                                  <ExternalLink size={10} />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 pl-11">
                        <div className="space-y-1">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{s.kpiType === 'QUALITATIVE' ? 'Tự đánh giá' : 'Kết quả / Mục tiêu'}</p>
                          {s.kpiType === 'QUALITATIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">★ {s.qualitativeLevelName ?? '—'}</span>
                          ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{formatNumber(s.actualValue)}</span>
                            <span className="text-[10px] text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-slate-500">{s.targetValue != null ? formatNumber(s.targetValue) : '—'}</span>
                          </div>
                          )}
                        </div>
                        {(isFullyApproved || !readOnly) ? (
                          <div className="space-y-1">
                            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest text-right">{userRoleName} chấm</p>
                            {s.kpiType === 'QUALITATIVE' ? (
                              <select
                                value={individualLevels[s.id] ?? ''}
                                onChange={e => setIndividualLevels(prev => ({ ...prev, [s.id]: e.target.value }))}
                                disabled={readOnly}
                                className={cn(
                                  "w-40 px-2 py-2 rounded-xl text-xs font-bold outline-none transition-all",
                                  readOnly
                                    ? "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                                    : "bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 focus:ring-2 focus:ring-teal-500/20"
                                )}
                              >
                                <option value="">— Chọn mức —</option>
                                {qualitativeLevels.map(l => (
                                  <option key={l.id} value={l.id}>{l.name} ({formatNumber(l.value)}đ)</option>
                                ))}
                              </select>
                            ) : (
                            <input
                              type="number"
                              value={individualScores[s.id] ?? 0}
                              onChange={e => setIndividualScores(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                              onWheel={(e) => e.currentTarget.blur()}
                              disabled={readOnly}
                              className={cn(
                                "w-20 px-3 py-2 rounded-xl text-right text-sm font-black outline-none transition-all",
                                readOnly
                                  ? "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                                  : "bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                              )}
                            />
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1 text-right">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Điểm hệ thống</p>
                            <span className="text-sm font-bold text-slate-400">{s.kpiType === 'QUALITATIVE' ? '—' : formatNumber(Math.round((s.autoScore ?? 0) * normFactor))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table layout (hidden on mobile) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]">
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
                                <div className="flex items-center gap-3 mt-0.5">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Trọng số: {s.weight}%</p>
                                  {s.attachments && s.attachments.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-300">•</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {s.attachments.map(att => (
                                          <a
                                            key={att.id}
                                            href={att.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={att.fileName}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider hover:bg-indigo-500 hover:text-white transition-all"
                                          >
                                            <Paperclip size={10} />
                                            <span className="truncate max-w-[80px]">{att.fileName}</span>
                                            <ExternalLink size={10} />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {s.note && (
                                  <p className="text-[10px] text-slate-500 font-medium mt-1 italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                    " {s.note} "
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {s.kpiType === 'QUALITATIVE' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 text-[11px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                ★ {s.qualitativeLevelName ?? 'Tự đánh giá'}
                              </span>
                            ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                              <span className="text-xs font-black text-slate-900 dark:text-white">{formatNumber(s.actualValue)}</span>
                              <span className="text-[10px] text-slate-400">/</span>
                              <span className="text-[10px] font-bold text-slate-500">{s.targetValue != null ? formatNumber(s.targetValue) : '—'}</span>
                            </div>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className="text-sm font-bold text-slate-400">{s.kpiType === 'QUALITATIVE' ? '—' : formatNumber(Math.round((s.autoScore ?? 0) * normFactor))}</span>
                          </td>
                          {(isFullyApproved || !readOnly) && (
                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end">
                                {s.kpiType === 'QUALITATIVE' ? (
                                  <select
                                    value={individualLevels[s.id] ?? ''}
                                    onChange={e => setIndividualLevels(prev => ({ ...prev, [s.id]: e.target.value }))}
                                    disabled={readOnly}
                                    className={cn(
                                      "w-44 px-3 py-2 rounded-xl text-sm font-bold outline-none transition-all",
                                      readOnly
                                        ? "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                                        : "bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 focus:ring-2 focus:ring-teal-500/20"
                                    )}
                                  >
                                    <option value="">— Chọn mức —</option>
                                    {qualitativeLevels.map(l => (
                                      <option key={l.id} value={l.id}>{l.name} ({formatNumber(l.value)}đ)</option>
                                    ))}
                                  </select>
                                ) : (
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
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

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

                      <div className="space-y-1 relative z-10 flex items-start justify-between">
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Kết quả đánh giá cuối cùng</p>
                            <div className="flex items-baseline gap-2">
                               <h3 className="text-6xl font-black tracking-tighter">{formatNumber(effectiveFinalScore)}</h3>
                               <span className="text-lg font-bold opacity-60">điểm</span>
                            </div>
                         </div>
                         {!readOnly && !isFullQualitative && finalScore !== totalManagerScore && (
                            <button
                              type="button"
                              onClick={handleResetFinalScore}
                              className="text-[10px] font-black text-indigo-200 hover:text-white hover:underline flex items-center gap-1 shrink-0"
                            >
                              <Zap size={10} fill="currentColor" /> Dùng điểm đã chấm
                            </button>
                         )}
                      </div>

                      {!isFullQualitative && (
                      <div className="pt-6 border-t border-white/10 space-y-3 relative z-10">
                         <div className="flex justify-between text-xs font-bold text-indigo-100/60">
                            <span>Tổng điểm hệ thống</span>
                            <span>{formatNumber(totalAutoScore)}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold text-indigo-100/60">
                            <span>Tổng điểm đã chấm theo chỉ tiêu</span>
                            <span>{formatNumber(totalManagerScore)}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold text-indigo-100/60">
                            <span>Chênh lệch so với hệ thống</span>
                            <span>{finalScore - totalAutoScore >= 0 ? '+' : ''}{formatNumber(finalScore - totalAutoScore)}</span>
                         </div>
                      </div>
                      )}

                      {/* Final score adjustment slider - starts at the sum of per-KPI scores,
                          can be dragged independently within [0, maxScore].
                          Full-qualitative locks the score to maxScore instead. */}
                      {isFullQualitative ? (
                        <div className="pt-6 border-t border-white/10 relative z-10">
                           <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                              <Lock size={12} className="shrink-0" /> Full định tính · Cố định điểm {maxScore}
                           </div>
                        </div>
                      ) : (
                      <div className="pt-2 relative z-10 space-y-3">
                         <input
                           type="range" min={0} max={maxScore} step={1}
                           value={finalScore}
                           onChange={(e) => {
                             if (readOnly) return
                             hasManuallyAdjustedFinal.current = true
                             setFinalScore(Number(e.target.value))
                           }}
                           disabled={readOnly}
                           className="w-full accent-white h-2 bg-white/20 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                         />
                         <div className="flex justify-between text-[9px] font-black text-indigo-200 uppercase tracking-widest">
                            <span>0</span>
                            <span>{Math.round(maxScore / 2)}</span>
                            <span>{maxScore}</span>
                         </div>
                      </div>
                      )}

                      <div className="pt-2 relative z-10">
                         <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
                            <Award size={14} /> Tự động xếp loại: {getGrade(effectiveFinalScore)}
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
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
           <div className="hidden sm:flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0">
                 <AlertCircle size={20} />
              </div>
              <p className="text-[10px] font-medium text-slate-500 max-w-[280px]">
                 Hành động này sẽ <b>phê duyệt đồng loạt</b> các bài nộp và <b>lưu kết quả đánh giá chính thức</b> vào hồ sơ nhân sự.
              </p>
           </div>

           <div className="flex gap-3 sm:gap-4">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 sm:px-8 py-3 sm:py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all whitespace-nowrap"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || (submissionList.length === 0 && !periodEnded)}
                className="flex-1 sm:flex-none px-5 sm:px-10 py-3 sm:py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[2px] shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 disabled:opacity-50 disabled:scale-100 whitespace-nowrap"
              >
                {submitMutation.isPending ? <Loader2 size={16} className="animate-spin shrink-0" /> : <CheckCircle size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />}
                <span className="sm:hidden">Phê duyệt & Chốt</span>
                <span className="hidden sm:inline">PHÊ DUYỆT & CHỐT ĐÁNH GIÁ</span>
              </button>
           </div>
        </div>
        )}
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
        initialPeriodId={periodId}
      />
    </div>
  )
}
