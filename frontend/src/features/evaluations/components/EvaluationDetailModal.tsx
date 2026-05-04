import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useKpiCriteria } from '@/features/kpi/hooks/useKpiCriteria'
import { useSubmissions } from '@/features/submissions/hooks/useSubmissions'
import { evaluationApi } from '../api/evaluationApi'
import { useEvaluations } from '../hooks/useEvaluations'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions } from '@/lib/scoring'
import { formatDateTime, getInitials, cn } from '@/lib/utils'
import type { Evaluation, CreateEvaluationRequest } from '@/types/evaluation'
import {
  X, Star, User, MessageSquare, TrendingUp,
  CheckCircle, Loader2, Award, Target
} from 'lucide-react'

interface EvaluationDetailModalProps {
  open: boolean
  onClose: () => void
  evaluation: Evaluation | null
}



export default function EvaluationDetailModal({ open, onClose, evaluation }: EvaluationDetailModalProps) {
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const { getScoreColor, getScoreLabel, maxScore } = getScoringFunctions(org)
  const { hasPermission } = usePermission()
  const qc = useQueryClient()

  // Load all evaluations for the same user+Period to see the evaluation chain
  const { data: relatedData } = useEvaluations(
    evaluation ? { userId: evaluation.userId, kpiPeriodId: evaluation.kpiPeriodId, size: 50 } : {}
  )

  const timelineSteps = useMemo(() => {
    if (!evaluation || !org?.hierarchyLevels || !relatedData?.content) return []
    
    const steps: any[] = []
    
    // 1. Self Evaluation (Always first)
    const selfEval = relatedData.content.find((e: any) => e.userId === evaluation.userId && e.evaluatorRole === 'SELF')
    steps.push({
      id: 'self',
      title: 'Nhân viên tự đánh giá',
      icon: User,
      iconBg: "bg-slate-50 dark:bg-slate-800/50",
      iconColor: "text-slate-600 dark:text-slate-400",
      evaluation: selfEval || null,
      role: 'SELF'
    })

    // 2. Manager Evaluations based on hierarchy
    // Sort levels to ensure we go from current level down to 0
    const sortedLevels = [...org.hierarchyLevels].sort((a, b) => b.levelOrder - a.levelOrder)
    
    // We only show levels that are strictly higher (lower number) or equal to the evaluation unit level
    // But typically, a manager at level N evaluates their subordinates.
    // If evaluation is at Level 2 (Team), managers at L2, L1, L0 can evaluate.
    
    const evalUnitLevel = evaluation.orgUnitLevel ?? 2
    
    const isTwoLevelOrg = org.hierarchyLevels.length <= 2
    
    sortedLevels.forEach(hl => {
      // Only show levels relevant to the evaluation path (from eval level down to director)
      if (hl.levelOrder > evalUnitLevel) return

      // SKIP this level if the evaluated user themselves is the manager (Rank 0) at this level
      // This handles: "nếu role là trưởng team thì hiện đến giám đốc luôn"
      const isUserManagerAtThisLevel = 
        evaluation.userLevel !== undefined && 
        evaluation.userLevel === hl.levelOrder && 
        evaluation.userRank === 0;

      if (isUserManagerAtThisLevel) {
        return
      }

      let roleCode = ''
      let stepTitle = ''
      let icon = Award
      let iconBg = "bg-blue-100 dark:bg-blue-900/30"
      let iconColor = "text-blue-600 dark:text-blue-400"

      if (hl.levelOrder === 0) {
        roleCode = 'DIRECTOR'
        stepTitle = 'Giám đốc Quyết định'
        icon = Star
        iconBg = "bg-amber-50 dark:bg-amber-900/20"
        iconColor = "text-amber-600 dark:text-amber-400"
      } else if (hl.levelOrder === 1) {
        roleCode = 'DEPT_HEAD'
        stepTitle = isTwoLevelOrg ? 'Trưởng nhóm đánh giá' : (hl.managerRoleLabel || 'Trưởng phòng đánh giá')
        iconBg = "bg-purple-50 dark:bg-purple-900/20"
        iconColor = "text-purple-600 dark:text-purple-400"
      } else if (hl.levelOrder === 2) {
        roleCode = 'TEAM_LEADER'
        stepTitle = hl.managerRoleLabel || 'Trưởng nhóm đánh giá'
      } else {
        roleCode = 'MANAGER'
        stepTitle = `${hl.managerRoleLabel || 'Quản lý'} đánh giá`
      }

      const evalAtLevel = relatedData.content.find((e: any) => e.userId === evaluation.userId && e.evaluatorRole === roleCode)
      
      steps.push({
        id: roleCode,
        title: stepTitle,
        icon,
        iconBg,
        iconColor,
        evaluation: evalAtLevel || null,
        role: roleCode
      })
    })

    return steps
  }, [evaluation, org, relatedData])

  const layers = useMemo(() => {
    return {
      selfEval: timelineSteps.find(s => s.role === 'SELF')?.evaluation ?? null,
      teamEval: timelineSteps.find(s => s.role === 'TEAM_LEADER')?.evaluation ?? null,
      headEval: timelineSteps.find(s => s.role === 'DEPT_HEAD')?.evaluation ?? null,
      directorEval: timelineSteps.find(s => s.role === 'DIRECTOR')?.evaluation ?? null,
    }
  }, [timelineSteps])

  // System Score Calculation
  const { data: myKpis, isLoading: loadingKpis } = useKpiCriteria({ 
    page: 0, size: 50, 
    kpiPeriodId: evaluation?.kpiPeriodId,
    organizationId: undefined, // ensure we get the right set
  })
  const { data: mySubmissions, isLoading: loadingSubs } = useSubmissions({ 
    page: 0, size: 500,
    submittedById: evaluation?.userId 
  })

  const calculatedScore = useMemo(() => {
    if (loadingKpis || loadingSubs || !evaluation || !myKpis?.content || !mySubmissions?.content) return null
    
    const periodKpiIds = new Set(myKpis.content.map(k => k.id))
    const relevantSubs = mySubmissions.content.filter(s => 
      periodKpiIds.has(s.kpiCriteriaId) && 
      (s.status === 'APPROVED' || s.status === 'PENDING')
    )
    
    const total = relevantSubs.reduce((sum, s) => sum + (s.autoScore || 0), 0)
    return Math.min(maxScore, Math.round(total))
  }, [evaluation, myKpis, mySubmissions, loadingKpis, loadingSubs, maxScore])

  // Feedback form state
  const [feedbackScore, setFeedbackScore] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [directorChoice, setDirectorChoice] = useState<'staff' | 'head' | 'own' | null>(null)

  const feedbackMutation = useMutation({
    mutationFn: (data: CreateEvaluationRequest) => evaluationApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success('Đã gửi đánh giá thành công')
      setShowFeedbackForm(false)
      setFeedbackScore(0)
      setFeedbackComment('')
      setDirectorChoice(null)
    },
    onError: () => toast.error('Gửi đánh giá thất bại'),
  })

  const handleSubmitFeedback = () => {
    if (!evaluation) return
    
    let score = feedbackScore
    let comment = feedbackComment

    if (directorChoice === 'staff' && layers.selfEval) {
      score = layers.selfEval.score ?? 0
      comment = `[Đồng ý với nhân viên] ${feedbackComment}`.trim()
    } else if (directorChoice === 'head' && layers.headEval) {
      score = layers.headEval.score ?? 0
      const reviewerLabel = org?.hierarchyLevels?.length === 2 ? 'trưởng team' : 'trưởng phòng'
      comment = `[Đồng ý với ${reviewerLabel}] ${feedbackComment}`.trim()
    }

    feedbackMutation.mutate({
      userId: evaluation.userId,
      kpiPeriodId: evaluation.kpiPeriodId,
      score,
      comment: comment || undefined,
    })
  }

  if (!open || !evaluation) return null

  const canGiveFeedback = hasPermission('SUBMISSION:REVIEW') && layers.selfEval && !layers.headEval && !hasPermission('KPI:APPROVE')
  const canDirectorReview = hasPermission('KPI:APPROVE') && !layers.directorEval && (layers.selfEval || layers.headEval)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Star size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Chi tiết Đánh giá</h3>
              <p className="text-xs font-medium text-slate-500">{evaluation.kpiPeriodName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">

          {/* Subject Info */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-900/30">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-lg">
                {getInitials(evaluation.userName)}
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">{evaluation.userName}</h4>
                <div className="flex items-center gap-3 mt-1 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1"><Target size={12} /> {evaluation.kpiPeriodName}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Dòng thời gian đánh giá</h4>

            {timelineSteps.map((step, idx) => (
              <EvalLayerCard
                key={step.id}
                title={step.title}
                icon={step.icon}
                iconBg={step.iconBg}
                iconColor={step.iconColor}
                evaluation={step.evaluation}
                calculatedScore={step.role === 'SELF' ? calculatedScore : undefined}
                lineActive={idx < timelineSteps.length - 1 && !!timelineSteps[idx + 1].evaluation}
                isLast={idx === timelineSteps.length - 1}
                getScoreColor={getScoreColor}
                getScoreLabel={getScoreLabel}
              />
            ))}
          </div>

          {/* HEAD/DEPUTY Feedback Form */}
          {canGiveFeedback && !showFeedbackForm && (
            <button
              onClick={() => setShowFeedbackForm(true)}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all flex items-center justify-center gap-2"
            >
              <Award size={18} /> Chấm điểm & Phản hồi nhân viên
            </button>
          )}

          {canGiveFeedback && showFeedbackForm && (
            <FeedbackForm
              title={`Phản hồi của ${org?.hierarchyLevels?.length === 2 ? 'Trưởng team' : 'Trưởng phòng'}`}
              score={feedbackScore}
              comment={feedbackComment}
              onScoreChange={setFeedbackScore}
              onCommentChange={setFeedbackComment}
              onSubmit={handleSubmitFeedback}
              onCancel={() => setShowFeedbackForm(false)}
              isPending={feedbackMutation.isPending}
              placeholder="Nhận xét hiệu suất nhân viên, điểm mạnh và hướng phát triển..."
              getScoreColor={getScoreColor}
              getScoreLabel={getScoreLabel}
              maxScore={maxScore}
            />
          )}

          {/* DIRECTOR Choice */}
          {canDirectorReview && !showFeedbackForm && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Quyết định của Giám đốc</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {layers.selfEval && (
                  <button
                    onClick={() => { setDirectorChoice('staff'); setShowFeedbackForm(true); setFeedbackScore(layers.selfEval!.score ?? 0) }}
                    className="p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center group"
                  >
                    <User size={20} className="text-blue-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Đồng ý NV</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{layers.selfEval.score ?? '—'}</p>
                  </button>
                )}
                {layers.headEval && (
                  <button
                    onClick={() => { setDirectorChoice('head'); setShowFeedbackForm(true); setFeedbackScore(layers.headEval!.score ?? 0) }}
                    className="p-4 rounded-2xl border-2 border-purple-200 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-center group"
                  >
                    <Award size={20} className="text-purple-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Đồng ý {org?.hierarchyLevels?.length === 2 ? 'TT' : 'TP'}</p>
                    <p className="text-2xl font-black text-purple-600 mt-1">{layers.headEval.score ?? '—'}</p>
                  </button>
                )}
                <button
                  onClick={() => { setDirectorChoice('own'); setShowFeedbackForm(true); setFeedbackScore(0) }}
                  className="p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-center group"
                >
                  <Star size={20} className="text-amber-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Ý kiến riêng</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Tự chấm điểm</p>
                </button>
              </div>
            </div>
          )}

          {canDirectorReview && showFeedbackForm && (
            <FeedbackForm
              title={directorChoice === 'staff' ? 'Đồng ý với Nhân viên' : directorChoice === 'head' ? `Đồng ý với ${org?.hierarchyLevels?.length === 2 ? 'Trưởng team' : 'Trưởng phòng'}` : 'Ý kiến của Giám đốc'}
              score={feedbackScore}
              comment={feedbackComment}
              onScoreChange={directorChoice === 'own' ? setFeedbackScore : undefined}
              onCommentChange={setFeedbackComment}
              onSubmit={handleSubmitFeedback}
              onCancel={() => { setShowFeedbackForm(false); setDirectorChoice(null) }}
              isPending={feedbackMutation.isPending}
              placeholder="Nhận xét cuối cùng của Giám đốc..."
              readonlyScore={directorChoice !== 'own'}
              getScoreColor={getScoreColor}
              getScoreLabel={getScoreLabel}
              maxScore={maxScore}
            />
          )}

        </div>
      </div>
    </div>
  )
}

// --- Sub Components ---

function EvalLayerCard({ title, icon: Icon, iconBg, iconColor, evaluation, lineActive, isLast, calculatedScore, getScoreColor, getScoreLabel }: {
  title: string; icon: any; iconBg: string; iconColor: string; 
  evaluation: Evaluation | null; lineActive?: boolean; isLast?: boolean;
  calculatedScore?: number | null;
  getScoreColor: (s: number | null) => string;
  getScoreLabel: (s: number | null) => string;
}) {
  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className={`absolute left-[22px] top-[52px] w-0.5 h-[calc(100%-4px)] ${lineActive ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
      )}
      
      {/* Icon */}
      <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 z-10`}>
        <Icon size={20} className={iconColor} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</p>
          {evaluation && (
            <span className="text-xs font-medium text-slate-400">{formatDateTime(evaluation.createdAt)}</span>
          )}
        </div>
        
        {evaluation ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className={getScoreColor(evaluation.score)} />
                <span className={`text-2xl font-black ${getScoreColor(evaluation.score)}`}>{evaluation.score ?? '—'}</span>
                <span className={`text-xs font-bold uppercase tracking-widest ${getScoreColor(evaluation.score)}`}>{getScoreLabel(evaluation.score)}</span>
                
                {evaluation.evaluatorRole === 'SELF' && calculatedScore != null && evaluation.score !== calculatedScore && (
                   <div className={cn(
                     "ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                     evaluation.score! > calculatedScore 
                      ? "bg-emerald-500/10 text-emerald-600" 
                      : "bg-amber-500/10 text-amber-600"
                   )}>
                     {evaluation.score! > calculatedScore ? '+' : ''}{evaluation.score! - calculatedScore} so với điểm hệ thống
                   </div>
                )}
              </div>
              {evaluation.evaluatorName && (
                <span className="text-xs font-medium text-slate-400">bởi {evaluation.evaluatorName}</span>
              )}
            </div>
            {evaluation.comment && (
              <div className="flex items-start gap-2">
                <MessageSquare size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{evaluation.comment}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs font-medium text-slate-400 italic">Chưa có đánh giá</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackForm({ title, score, comment, onScoreChange, onCommentChange, onSubmit, onCancel, isPending, placeholder, readonlyScore, getScoreColor, getScoreLabel, maxScore }: {
  title: string; score: number; comment: string;
  onScoreChange?: (v: number) => void; onCommentChange: (v: string) => void;
  onSubmit: () => void; onCancel: () => void; isPending: boolean;
  placeholder: string; readonlyScore?: boolean;
  getScoreColor: (s: number | null) => string;
  getScoreLabel: (s: number | null) => string;
  maxScore: number;
}) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-200/50 dark:border-indigo-900/30 space-y-4">
      <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">{title}</h4>

      <div className="text-center space-y-2">
        <p className={`text-4xl font-black ${getScoreColor(score)}`}>{score || '0'}</p>
        <p className={`text-xs font-bold uppercase tracking-widest ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
        {!readonlyScore && onScoreChange && (
          <input
            type="range" min={0} max={maxScore} step={1}
            value={score}
            onChange={(e) => onScoreChange(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        )}
        {readonlyScore && (
          <p className="text-xs text-slate-400 italic">Điểm đã được chọn theo nguồn đồng ý</p>
        )}
      </div>

      <textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all"
        placeholder={placeholder}
      />

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all">
          Huỷ
        </button>
        <button
          onClick={onSubmit}
          disabled={isPending}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          Xác nhận
        </button>
      </div>
    </div>
  )
}
