import { useState, useMemo, useEffect } from 'react'
import { useKpiCriteria } from '@/features/kpi/hooks/useKpiCriteria'
import { useSubmissions } from '@/features/submissions/hooks/useSubmissions'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions } from '@/lib/scoring'
import { formatDateTime, getInitials, cn } from '@/lib/utils'
import type { Evaluation } from '@/types/evaluation'
import {
  X, Star, User, MessageSquare, TrendingUp,
  Award, Target, Loader2
} from 'lucide-react'
import ReviewModal from '@/features/submissions/components/ReviewModal'
import StaffEvaluationModal from '@/features/submissions/components/StaffEvaluationModal'
import { usePermission } from '@/hooks/usePermission'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'
import { toast } from 'sonner'

interface EvaluationDetailModalProps {
  open: boolean
  onClose: () => void
  evaluation: Evaluation | null
}



export default function EvaluationDetailModal({ open, onClose, evaluation }: EvaluationDetailModalProps) {
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const { getScoreColor, getScoreLabel, maxScore } = getScoringFunctions(org)
  const { canReviewSubmission, canCreateEvaluation } = usePermission()
  const isManager = useMemo(() => user?.memberships?.some(m => m.roleRank === 0), [user])
  const qc = useQueryClient()

  const { data: relatedData } = useEvaluations(
    evaluation ? { userId: evaluation.userId, kpiPeriodId: evaluation.kpiPeriodId, size: 50 } : {}
  )

  const [showStaffEval, setShowStaffEval] = useState(false)
  const [inlineScoreInitialized, setInlineScoreInitialized] = useState(false)
  const [inlineScore, setInlineScore] = useState<number>(0)
  const [inlineComment, setInlineComment] = useState('')

  // Reset internal form state when evaluation changes to avoid data leakage between users
  useEffect(() => {
    if (evaluation?.id) {
      setInlineScore(0)
      setInlineComment('')
      setInlineScoreInitialized(false)
    }
  }, [evaluation?.id])

  // Determine if current user already evaluated at their level  
  const myEvalAtLevel = useMemo(() => {
    if (!relatedData?.content || !user) return null
    return relatedData.content.find((e: any) => 
      e.userId === evaluation?.userId && e.evaluatorId === user.id && e.evaluatorRole !== 'SELF'
    ) ?? null
  }, [relatedData, user, evaluation])

  const inlineSubmitMutation = useMutation({
    mutationFn: () => evaluationApi.create({
      userId: evaluation!.userId,
      kpiPeriodId: evaluation!.kpiPeriodId,
      score: inlineScore,
      comment: inlineComment || undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success('Đã lưu đánh giá thành công')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    }
  })

  const timelineSteps = useMemo(() => {
    if (!evaluation || !org?.hierarchyLevels || !relatedData?.content) return []
    
    const steps: any[] = []
    
    const selfEval = relatedData.content.find((e: any) => e.userId === evaluation.userId && e.evaluatorRole === 'SELF')
    
    const firstEval = relatedData.content[0]
    const maxLevel = Math.max(...org.hierarchyLevels.map(hl => hl.levelOrder), 0)
    const evalUserLevel = [evaluation.userLevel, selfEval?.userLevel, firstEval?.userLevel].find(l => l != null) ?? maxLevel
    const evalUserRank = [evaluation.userRank, selfEval?.userRank, firstEval?.userRank].find(r => r != null) ?? 2

    const isTwoLevelOrg = org.hierarchyLevels.length <= 2

    let selfTitle = 'Nhân viên tự đánh giá'
    if (evalUserRank === 0) {
      if (evalUserLevel === 0) selfTitle = 'Tổng Giám đốc tự nhận xét'
      else if (evalUserLevel === 1) selfTitle = 'Giám đốc Vùng tự đánh giá'
      else if (evalUserLevel === 2) selfTitle = 'Giám đốc tự đánh giá'
      else if (evalUserLevel === 3) selfTitle = 'Trưởng phòng tự đánh giá'
      else if (evalUserLevel === 4) selfTitle = 'Trưởng nhóm tự đánh giá'
    } else if (evalUserRank === 1) {
      if (evalUserLevel === 0) selfTitle = 'Phó Tổng Giám đốc tự nhận xét'
      else if (evalUserLevel === 1) selfTitle = 'Phó Giám đốc Vùng tự đánh giá'
      else if (evalUserLevel === 2) selfTitle = 'Phó Giám đốc tự đánh giá'
      else if (evalUserLevel === 3) selfTitle = 'Phó phòng tự đánh giá'
      else if (evalUserLevel === 4) selfTitle = 'Phó nhóm tự đánh giá'
    }

    steps.push({
      id: 'self',
      title: selfTitle,
      icon: User,
      iconBg: "bg-slate-50 dark:bg-slate-800/50",
      iconColor: "text-slate-600 dark:text-slate-400",
      evaluation: selfEval || null,
      role: 'SELF'
    })

    // 2. Manager Evaluations based on hierarchy - TOP DOWN priority for matching
    const sortedLevelsMatching = [...org.hierarchyLevels].sort((a, b) => a.levelOrder - b.levelOrder)
    
    const consumedIds = new Set<string>()
    const managerSteps: any[] = []

    sortedLevelsMatching.forEach(hl => {
      let mappedRoleLevel = hl.roleLevel !== undefined ? hl.roleLevel : hl.levelOrder;
      const totalLevels = org.hierarchyLevels.length;
      
      if (hl.roleLevel === undefined) {
        if (totalLevels === 5) mappedRoleLevel = hl.levelOrder;
        else if (totalLevels === 4) mappedRoleLevel = hl.levelOrder + 1;
        else if (totalLevels === 3) mappedRoleLevel = hl.levelOrder + 2;
        else if (totalLevels === 2) mappedRoleLevel = hl.levelOrder === 0 ? 2 : 4;
        else mappedRoleLevel = hl.levelOrder + (5 - totalLevels);
      }

      // Only include managers at or above the user's level
      if (Number(mappedRoleLevel) > Number(evalUserLevel)) {
        return
      }

      // SKIP this level if the evaluated user themselves is the manager (Rank 0) at this level
      const isUserManagerAtThisLevel = 
        Number(evalUserLevel) === Number(mappedRoleLevel) && 
        Number(evalUserRank) === 0;

      if (isUserManagerAtThisLevel) {
        return
      }

      let roleCode = ''
      let stepTitle = ''
      let icon = Award
      let iconBg = "bg-blue-100 dark:bg-blue-900/30"
      let iconColor = "text-blue-600 dark:text-blue-400"

      if (mappedRoleLevel === 0) {
        roleCode = 'DIRECTOR'
        stepTitle = `${hl.managerRoleLabel || 'Tổng Giám đốc'} Quyết định`
        icon = Star
        iconBg = "bg-amber-50 dark:bg-amber-900/20"
        iconColor = "text-amber-600 dark:text-amber-400"
      } else if (mappedRoleLevel === 1) {
        roleCode = 'REGIONAL_DIRECTOR'
        stepTitle = `${hl.managerRoleLabel || 'Giám đốc Vùng'} đánh giá`
        iconBg = "bg-purple-50 dark:bg-purple-900/20"
        iconColor = "text-purple-600 dark:text-purple-400"
      } else if (mappedRoleLevel === 2) {
        roleCode = 'MANAGER'
        stepTitle = `${hl.managerRoleLabel || 'Giám đốc'} đánh giá`
        iconBg = "bg-blue-50 dark:bg-blue-900/20"
        iconColor = "text-blue-600 dark:text-blue-400"
      } else if (mappedRoleLevel === 3) {
        roleCode = 'DEPT_HEAD'
        stepTitle = `${hl.managerRoleLabel || 'Trưởng phòng'} đánh giá`
        iconBg = "bg-indigo-50 dark:bg-indigo-900/20"
        iconColor = "text-indigo-600 dark:text-indigo-400"
      } else if (mappedRoleLevel === 4) {
        roleCode = 'TEAM_LEADER'
        stepTitle = `${hl.managerRoleLabel || 'Trưởng nhóm'} đánh giá`
        iconBg = "bg-emerald-50 dark:bg-emerald-900/20"
        iconColor = "text-emerald-600 dark:text-emerald-400"
      } else {
        roleCode = `LEVEL_${mappedRoleLevel}`
        stepTitle = `${hl.managerRoleLabel || 'Quản lý'} đánh giá`
      }

      const evalAtLevel = relatedData.content.find((e: any) => {
        if (consumedIds.has(e.id)) return false
        if (e.userId !== evaluation.userId) return false

        let matches = false
        // 1. Check for exact role match (Highest Priority)
        if (e.evaluatorRole === roleCode) {
          matches = true
        } 
        // 2. Special case for current user if role match failed (e.g. role is missing or generic)
        else if (e.evaluatorId === user?.id && roleCode !== 'SELF' && e.evaluatorRole !== 'SELF') {
          const myMembership = user?.memberships?.[0]
          if (myMembership) {
            const myLevel = myMembership.roleLevel ?? myMembership.levelOrder
            const myRank = myMembership.roleRank
            
            // Strictly match level AND ensure it's a manager role (Rank 0)
            if (myLevel === mappedRoleLevel && myRank === 0) {
              matches = true
            }
          }
        }
        
        // 3. Special cases for self-evaluation and organization-specific overrides
        if (!matches) {
          if (roleCode === 'SELF') {
            matches = e.evaluatorRole === 'SELF'
          } else if (isTwoLevelOrg) {
            if (roleCode === 'DIRECTOR') matches = ['DIRECTOR', 'REGIONAL_DIRECTOR'].includes(e.evaluatorRole)
            else if (roleCode === 'TEAM_LEADER') matches = ['TEAM_LEADER', 'DEPT_HEAD', 'MANAGER', 'TEAM_DEPUTY', 'DEPT_DEPUTY'].includes(e.evaluatorRole)
          }
        }

        if (matches) {
          consumedIds.add(e.id)
          return true
        }
        return false
      })
      
      managerSteps.push({
        id: roleCode,
        title: stepTitle,
        icon,
        iconBg,
        iconColor,
        evaluation: evalAtLevel || null,
        role: roleCode,
        level: mappedRoleLevel
      })
    })

    // Final visual order: Self -> Managers from bottom up (highest levelOrder first)
    return [
      steps[0],
      ...managerSteps.sort((a, b) => b.level - a.level)
    ]
  }, [evaluation, org, relatedData])

  const layers = useMemo(() => {
    return {
      selfEval: timelineSteps.find(s => s.role === 'SELF')?.evaluation ?? null,
      teamEval: timelineSteps.find(s => s.id === 'TEAM_LEADER' || s.id === 'LEVEL_4')?.evaluation ?? null,
      headEval: timelineSteps.find(s => s.id === 'DEPT_HEAD' || s.id === 'LEVEL_3')?.evaluation ?? null,
      directorEval: timelineSteps.find(s => s.id === 'DIRECTOR' || s.id === 'MANAGER' || s.id === 'LEVEL_2' || s.id === 'LEVEL_0')?.evaluation ?? null,
    }
  }, [timelineSteps])

  // Initialize inline score from self-evaluation
  useEffect(() => {
    if (!inlineScoreInitialized && layers.selfEval?.score != null) {
      setInlineScore(layers.selfEval.score)
      setInlineScoreInitialized(true)
    }
  }, [layers.selfEval, inlineScoreInitialized])

  // System Score Calculation
  const { data: myKpis, isLoading: loadingKpis } = useKpiCriteria({ 
    page: 0, size: 50, 
    kpiPeriodId: evaluation?.kpiPeriodId,
    // Remove orgUnitId filter to catch KPIs assigned across units
  })
  const { data: mySubmissions, isLoading: loadingSubs } = useSubmissions({ 
    page: 0, size: 500,
    submittedById: evaluation?.userId,
    kpiPeriodId: evaluation?.kpiPeriodId
  })

  const calculatedScore = useMemo(() => {
    if (loadingKpis || loadingSubs || !evaluation || !myKpis?.content || !mySubmissions?.content) return null
    
    const periodKpiIds = new Set(myKpis.content.map(k => k.id))
    const relevantSubs = mySubmissions.content.filter(s => 
      periodKpiIds.has(s.kpiCriteriaId) && 
      (s.status === 'APPROVED' || s.status === 'PENDING' || s.status === 'REJECTED')
    )
    
    const total = relevantSubs.reduce((sum, s) => sum + (s.autoScore || 0), 0)
    return Math.min(maxScore, Math.round(total))
  }, [evaluation, myKpis, mySubmissions, loadingKpis, loadingSubs, maxScore])

  const [selectedSubmission, setSelectedSubmission] = useState<any>(null)



  if (!open || !evaluation) return null


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-between rounded-t-[28px]">
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
                <div className="flex items-center gap-2 mt-0.5 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                    {evaluation.userRoleName || 'NHÂN VIÊN'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{evaluation.orgUnitName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
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



          {/* === Director: Drill-down to StaffEvaluationModal === */}
          {canReviewSubmission && isManager && mySubmissions && mySubmissions.content.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setShowStaffEval(true)}
                className="w-full py-4 rounded-[20px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group"
              >
                <Target size={14} className="group-hover:rotate-45 transition-transform" />
                {layers.directorEval ? 'Xem Chi tiết bài nộp KPI' : 'Phê duyệt & Đánh giá bài nộp'} ({mySubmissions.content.length})
              </button>
              <p className="text-[10px] text-slate-400 mt-2 text-center italic font-medium">
                {layers.directorEval 
                  ? 'Nhấn để xem lại danh sách chỉ tiêu KPI đã đánh giá.' 
                  : 'Nhấn để xem danh sách chỉ tiêu KPI và thực hiện đánh giá chính thức.'}
              </p>
            </div>
          )}

          {/* === Mid-level managers (Trưởng nhóm/Trưởng phòng): Inline evaluation form === */}
          {!canReviewSubmission && canCreateEvaluation && isManager && evaluation?.userId !== user?.id && !myEvalAtLevel && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <Award size={14} className="text-indigo-500" /> Thực hiện đánh giá
                </h4>
              </div>
              
              {/* Not evaluated yet — show polished slider form */}
              <div className="space-y-6">
                {/* Score Display + Slider Card */}
                <div className="relative group p-8 rounded-[32px] bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                  
                  <div className="flex flex-col items-center gap-6 relative">
                    <div className="flex items-baseline justify-center gap-4">
                      <div className={cn("text-7xl font-black tracking-tighter transition-all duration-700 drop-shadow-sm", getScoreColor(inlineScore))}>
                        {inlineScore}
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-sm font-black uppercase tracking-[0.2em] transition-all duration-500", getScoreColor(inlineScore))}>
                          {getScoreLabel(inlineScore)}
                        </p>
                        {layers.selfEval?.score != null && inlineScore !== layers.selfEval.score && (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm animate-in fade-in zoom-in-95 duration-300",
                            inlineScore > layers.selfEval.score
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30"
                              : "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30"
                          )}>
                            {inlineScore > layers.selfEval.score ? <TrendingUp size={10} /> : <Target size={10} />}
                            {inlineScore > layers.selfEval.score ? '+' : ''}{inlineScore - layers.selfEval.score} so với tự đánh giá
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full max-w-md mx-auto space-y-4">
                      <input
                        type="range" min={0} max={maxScore} step={1}
                        value={inlineScore}
                        onChange={e => setInlineScore(Number(e.target.value))}
                        className="w-full accent-indigo-600 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer transition-all hover:h-3"
                      />
                      <div className="flex justify-between px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">0</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-50">{Math.round(maxScore / 2)}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{maxScore}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comment Area */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                    <MessageSquare size={14} className="text-indigo-400" /> Nhận xét đánh giá
                  </label>
                  <textarea
                    value={inlineComment}
                    onChange={e => setInlineComment(e.target.value)}
                    rows={3}
                    placeholder="Ghi lại nhận xét chi tiết về nỗ lực và kết quả của nhân viên..."
                    className="w-full px-6 py-5 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none resize-none transition-all shadow-sm placeholder:text-slate-400"
                  />
                </div>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                  <button
                    onClick={() => inlineSubmitMutation.mutate()}
                    disabled={inlineSubmitMutation.isPending || inlineScore <= 0}
                    className="relative w-full py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[3px] shadow-2xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {inlineSubmitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />}
                    HOÀN TẤT ĐÁNH GIÁ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showStaffEval && evaluation && (
        <StaffEvaluationModal
          open={showStaffEval}
          onClose={() => setShowStaffEval(false)}
          userId={evaluation.userId}
          userName={evaluation.userName}
          periodId={evaluation.kpiPeriodId}
          periodName={evaluation.kpiPeriodName}
          readOnly={!!layers.directorEval}
          evaluationComment={layers.directorEval?.comment || ''}
        />
      )}

      <ReviewModal 
        open={!!selectedSubmission} 
        onClose={() => setSelectedSubmission(null)} 
        submission={selectedSubmission} 
      />
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
    <div className="relative flex gap-5 group/card">
      {/* Timeline line */}
      {!isLast && (
        <div className={`absolute left-[22px] top-[56px] w-0.5 h-[calc(100%-16px)] transition-colors duration-500 ${lineActive ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-slate-100 dark:bg-slate-800'}`} />
      )}
      
      {/* Icon with Ring effect */}
      <div className="relative shrink-0 z-10">
        <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center shadow-sm transition-transform duration-500 group-hover/card:scale-110`}>
          <Icon size={20} className={iconColor} />
        </div>
        {lineActive && (
          <div className="absolute -inset-1 rounded-2xl border-2 border-indigo-500/20 animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{title}</p>
          {evaluation && (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">
              {formatDateTime(evaluation.createdAt)}
            </span>
          )}
        </div>
        
        {evaluation ? (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-300 group-hover/card:shadow-md group-hover/card:border-slate-200 dark:group-hover/card:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50", getScoreColor(evaluation.score).replace('text-', 'text-opacity-20 bg-'))}>
                  <TrendingUp size={20} className={getScoreColor(evaluation.score)} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black tracking-tighter ${getScoreColor(evaluation.score)}`}>{evaluation.score ?? '—'}</span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${getScoreColor(evaluation.score)}`}>{getScoreLabel(evaluation.score)}</span>
                  </div>
                  
                  {evaluation.evaluatorRole === 'SELF' && (evaluation.systemScore ?? calculatedScore) != null && evaluation.score !== (evaluation.systemScore ?? calculatedScore) && (
                     <div className={cn(
                       "mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                       evaluation.score! > (evaluation.systemScore ?? calculatedScore!) 
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" 
                        : "bg-amber-50 text-amber-600 dark:bg-amber-900/20"
                     )}>
                       {evaluation.score! > (evaluation.systemScore ?? calculatedScore!) ? '+' : ''}{Math.round(evaluation.score! - (evaluation.systemScore ?? calculatedScore!))} điểm hệ thống
                     </div>
                  )}
                </div>
              </div>

              {evaluation.evaluatorName && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bởi</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{evaluation.evaluatorName}</p>
                </div>
              )}
            </div>

            {evaluation.comment && (
              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                <p className="text-sm text-slate-500 dark:text-slate-400 italic leading-relaxed">
                  "{evaluation.comment}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10">
            <span className="text-xs font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em]">Chưa có đánh giá</span>
          </div>
        )}
      </div>
    </div>
  )
}


