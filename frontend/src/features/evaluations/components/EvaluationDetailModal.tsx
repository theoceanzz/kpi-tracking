import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createInlineEvaluationSchema, type InlineEvaluationFormData } from '../schemas/evaluationSchema'
import { useSubmissions } from '@/features/submissions/hooks/useSubmissions'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions, SCORING_POOL, describePerspectiveScore } from '@/lib/scoring'
import { formatNumber, formatDateTime, cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import type { Evaluation } from '@/types/evaluation'
import {
  Star, User, MessageSquare, TrendingUp,
  Award, Target, Loader2, Layers, HeartHandshake, ArrowUpRight
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ReviewModal from '@/features/submissions/components/ReviewModal'
import StaffEvaluationModal from '@/features/submissions/components/StaffEvaluationModal'
import StaffPerformanceDetailModal from '@/features/submissions/components/StaffPerformanceDetailModal'
import { usePermission } from '@/hooks/usePermission'
import TimelineStep from '@/components/common/TimelineStep'
import { useConductSheet } from '@/features/conduct/hooks/useConduct'
import type { ConductSheet } from '@/features/conduct/api/conductApi'
import BscWaterfallModal from '@/features/bsc/components/BscWaterfallModal'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

interface EvaluationDetailModalProps {
  open: boolean
  onClose: () => void
  evaluation: Evaluation | null
}



export default function EvaluationDetailModal({ open, onClose, evaluation }: EvaluationDetailModalProps) {
  // Id đánh giá đang mở màn hình diễn giải điểm (waterfall + ghi đè).
  const [waterfallId, setWaterfallId] = useState<string | null>(null)
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const { getScoreColor, getScoreBg, getScoreLabel, maxScore } = getScoringFunctions(org)
  const { canReviewSubmission, canCreateEvaluation } = usePermission()
  const isManager = useMemo(() => user?.memberships?.some(m => m.roleRank === 0), [user])
  const isDeputy = useMemo(() => user?.memberships?.some(m => m.roleRank === 1), [user])
  const qc = useQueryClient()

  const { data: relatedData } = useEvaluations(
    evaluation ? { userId: evaluation.userId, kpiPeriodId: evaluation.kpiPeriodId, size: 50 } : {}
  )

  const [showStaffEval, setShowStaffEval] = useState(false)
  const [showPerfDetail, setShowPerfDetail] = useState(false)
  const [inlineScoreInitialized, setInlineScoreInitialized] = useState(false)

  // Trần điểm chỉ có sau khi score-preview trả về, tức là sau khi form đã dựng — giữ trong
  // ref và để schema đọc lúc kiểm tra, thay vì dựng lại schema mỗi lần con số đổi.
  const scoreCeilingRef = useRef(0)
  const inlineSchema = useMemo(() => createInlineEvaluationSchema(() => scoreCeilingRef.current), [])

  const {
    register: registerInline,
    handleSubmit: handleInlineSubmit,
    reset: resetInline,
    watch: watchInline,
    setValue: setInlineValue,
    formState: { errors: inlineErrors },
  } = useForm<InlineEvaluationFormData>({
    resolver: zodResolver(inlineSchema),
    defaultValues: { score: 0, comment: '' },
  })

  // Thanh kéo điểm hiển thị lại theo từng nấc nên phải theo dõi giá trị.
  const inlineScore = watchInline('score')

  // Reset internal form state when evaluation changes to avoid data leakage between users
  useEffect(() => {
    if (evaluation?.id) {
      resetInline({ score: 0, comment: '' })
      setInlineScoreInitialized(false)
    }
  }, [evaluation?.id, resetInline])

  // Determine if current user already evaluated at their level  
  const myEvalAtLevel = useMemo(() => {
    if (!relatedData?.content || !user) return null
    return relatedData.content.find((e: any) => 
      e.userId === evaluation?.userId && e.evaluatorId === user.id && e.evaluatorRole !== 'SELF'
    ) ?? null
  }, [relatedData, user, evaluation])

  const inlineSubmitMutation = useMutation({
    mutationFn: (data: InlineEvaluationFormData) => evaluationApi.create({
      userId: evaluation!.userId,
      kpiPeriodId: evaluation!.kpiPeriodId,
      score: data.score,
      comment: data.comment || undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success('Đã lưu đánh giá thành công')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Lưu đánh giá thất bại'))
    }
  })

  const timelineSteps = useMemo(() => {
    if (!evaluation || !org?.hierarchyLevels || !relatedData?.content) return []
    
    const steps: any[] = []
    
    const selfEval = relatedData.content.find((e: any) => e.userId === evaluation.userId && e.evaluatorRole === 'SELF')
    
    const isTwoLevelOrg = org.hierarchyLevels.length <= 2
    const totalLevels = org.hierarchyLevels.length

    const mapLevel = (levelOrder: number) => {
      // Anchoring logic: The last level (Staff) always maps to 5 (virtual SELF).
      // The level immediately above it (Direct Manager) maps to 4 (TEAM_LEADER).
      // This ensures consistent timeline positions across different org sizes.
      return 5 - (totalLevels - 1 - levelOrder);
    }

    const firstEval = relatedData.content[0]
    const maxLevelRaw = Math.max(...org.hierarchyLevels.map(hl => hl.levelOrder), 0)
    const rawEvalUserLevel = [evaluation.userLevel, selfEval?.userLevel, firstEval?.userLevel].find(l => l != null) ?? maxLevelRaw
    const evalUserLevel = mapLevel(rawEvalUserLevel)
    const evalUserRank = [evaluation.userRank, selfEval?.userRank, firstEval?.userRank].find(r => r != null) ?? 2

    const roleLabel = evaluation.userRoleName || (selfEval?.evaluatorRoleName || (selfEval?.evaluatorRole === 'SELF' ? 'Nhân viên' : 'Thành viên'))
    const verb = (evalUserLevel <= 1) ? 'tự nhận xét' : 'tự đánh giá'
    let selfTitle = `${roleLabel} ${verb}`

    // Try to derive generic title from hierarchy levels for Managers (Rank 0, 1)
    const userHl = org.hierarchyLevels?.find(hl => {
      let mapped = hl.roleLevel !== undefined ? hl.roleLevel : hl.levelOrder;
      const totalLevels = org.hierarchyLevels.length;
      if (hl.roleLevel === undefined) {
        if (totalLevels === 5) mapped = hl.levelOrder;
        else if (totalLevels === 4) mapped = hl.levelOrder + 1;
        else if (totalLevels === 3) mapped = hl.levelOrder + 2;
        else if (totalLevels === 2) mapped = hl.levelOrder === 0 ? 2 : 4;
        else mapped = hl.levelOrder + (5 - totalLevels);
      }
      return Number(mapped) === Number(evalUserLevel);
    });

    if (userHl && (evalUserRank === 0 || evalUserRank === 1)) {
      const baseLabel = userHl.managerRoleLabel || userHl.unitTypeName;
      if (evalUserRank === 0) {
        selfTitle = `${baseLabel} ${verb}`;
      } else if (evalUserRank === 1) {
        const phoSuffix = baseLabel.toLowerCase().startsWith('trưởng') 
          ? baseLabel.replace(/Trưởng/i, 'Phó') 
          : `Phó ${baseLabel}`;
        selfTitle = `${phoSuffix} ${verb}`;
      }
    }

    steps.push({
      id: 'self',
      title: selfTitle,
      icon: User,
      iconBg: "bg-[var(--color-muted)]",
      iconColor: "text-[var(--color-muted-foreground)]",
      evaluation: selfEval || null,
      role: 'SELF'
    })

    // 2. Manager Evaluations based on hierarchy - TOP DOWN priority for matching
    const sortedLevelsMatching = [...org.hierarchyLevels].sort((a, b) => a.levelOrder - b.levelOrder)
    
    const consumedIds = new Set<string>()
    const managerSteps: any[] = []

    sortedLevelsMatching.forEach(hl => {
      const hlRawLevel = hl.roleLevel !== undefined ? hl.roleLevel : hl.levelOrder;
      const mappedRoleLevel = mapLevel(hlRawLevel);

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
      let iconBg = "bg-[var(--color-info-bg)]"
      let iconColor = "text-[var(--color-info)]"

      if (mappedRoleLevel === 0) {
        roleCode = 'CEO'
        stepTitle = `${hl.managerRoleLabel || 'Cấp quản lý cao nhất'} Quyết định`
        icon = Star
        iconBg = "bg-[var(--color-warning-bg)]"
        iconColor = "text-[var(--color-warning)]"
      } else if (mappedRoleLevel === 1) {
        roleCode = 'REGIONAL_DIRECTOR'
        stepTitle = `${hl.managerRoleLabel || 'Cấp quản lý vùng'} đánh giá`
        iconBg = "bg-[var(--color-primary-soft)]"
        iconColor = "text-[var(--color-primary)]"
      } else if (mappedRoleLevel === 2) {
        roleCode = 'DIRECTOR'
        stepTitle = `${hl.managerRoleLabel || 'Quản lý cấp cao'} đánh giá`
        iconBg = "bg-[var(--color-info-bg)]"
        iconColor = "text-[var(--color-info)]"
      } else if (mappedRoleLevel === 3) {
        roleCode = 'DEPT_HEAD'
        stepTitle = `${hl.managerRoleLabel || 'Quản lý đơn vị'} đánh giá`
        iconBg = "bg-[var(--color-primary-soft)]"
        iconColor = "text-[var(--color-primary)]"
      } else if (mappedRoleLevel === 4) {
        roleCode = 'TEAM_LEADER'
        stepTitle = `${hl.managerRoleLabel || 'Quản lý trực tiếp'} đánh giá`
        iconBg = "bg-[var(--color-success-bg)]"
        iconColor = "text-[var(--color-success)]"
      } else {
        roleCode = `LEVEL_${mappedRoleLevel}`
        stepTitle = `${hl.managerRoleLabel || 'Cấp quản lý'} đánh giá`
      }

      const evalAtLevel = relatedData.content.find((e: any) => {
        if (consumedIds.has(e.id)) return false
        if (e.userId !== evaluation.userId) return false

        let matches = false
        // 1. Check for exact role match (Highest Priority)
        if (e.evaluatorRole === roleCode) {
          matches = true
        } 
        // 2. Check for Role Level match (New robust method)
        else if (e.evaluatorRoleLevel != null) {
          const mappedEvalLevel = mapLevel(e.evaluatorRoleLevel)
          if (mappedEvalLevel === mappedRoleLevel) {
            matches = true
          }
        }
        // 3. Special case for current user if role match failed
        else if (e.evaluatorId === user?.id && roleCode !== 'SELF' && e.evaluatorRole !== 'SELF') {
          const myMembership = user?.memberships?.[0]
          if (myMembership) {
            const rawMyLevel = myMembership.roleLevel ?? myMembership.levelOrder
            if (rawMyLevel != null) {
              const myLevel = mapLevel(rawMyLevel)
              const myRank = myMembership.roleRank
              
              // Strictly match level AND ensure it's a manager role (Rank 0)
              if (myLevel === mappedRoleLevel && myRank === 0) {
                matches = true
              }
            }
          }
        }
        
        // 3. Special cases for self-evaluation and organization-specific overrides
        if (!matches) {
          if (roleCode === 'SELF') {
            matches = e.evaluatorRole === 'SELF'
          } else if (roleCode === 'CEO') {
            matches = ['CEO', 'DIRECTOR', 'REGIONAL_DIRECTOR'].includes(e.evaluatorRole)
          } else if (roleCode === 'DIRECTOR') {
            matches = ['DIRECTOR', 'MANAGER', 'REGIONAL_DIRECTOR'].includes(e.evaluatorRole)
          } else if (isTwoLevelOrg && roleCode === 'TEAM_LEADER') {
            matches = ['TEAM_LEADER', 'DEPT_HEAD', 'MANAGER', 'TEAM_DEPUTY', 'DEPT_DEPUTY'].includes(e.evaluatorRole)
          }
        }

        if (matches) {
          consumedIds.add(e.id)
          return true
        }
        return false
      })
      
      const displayTitle = evalAtLevel?.evaluatorRoleName 
        ? `${evalAtLevel.evaluatorRoleName.toUpperCase()} ĐÁNH GIÁ`
        : stepTitle;

      managerSteps.push({
        id: roleCode,
        title: displayTitle,
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
      setInlineValue('score', layers.selfEval.score, { shouldValidate: true })
      setInlineScoreInitialized(true)
    }
  }, [layers.selfEval, inlineScoreInitialized, setInlineValue])

  // System Score Calculation — dùng score-preview thay cho system-score vì còn cần TRẦN điểm
  // (thang điểm + điểm KPI thưởng) cho thanh kéo; cũng dùng chung cache với các modal chấm điểm.
  const { data: scorePreview } = useQuery({
    queryKey: ['score-preview', evaluation?.kpiPeriodId, evaluation?.userId],
    queryFn: () => evaluationApi.getScorePreview(evaluation!.kpiPeriodId, evaluation!.userId),
    enabled: !!evaluation?.kpiPeriodId && !!evaluation?.userId,
  })

  const { data: mySubmissions } = useSubmissions({ 
    page: 0, size: 500,
    submittedById: evaluation?.userId,
    kpiPeriodId: evaluation?.kpiPeriodId
  })

  // Phiếu hạnh kiểm của đợt, để dòng thời gian nói được điểm hạnh kiểm THẬT (vd 3/4) chứ
  // không chỉ hiện con số đã quy về trục ma trận ("hành vi 3.8/5") — người chấm 3/4 nhìn
  // vào 3.8 không nhận ra đó là điểm mình vừa chấm. Cùng queryKey với phiếu đầy đủ bên
  // dưới nên React Query dùng chung một lần gọi, không phát sinh request thứ hai.
  const { data: conductSheet } = useConductSheet(
    {
      scope: 'PERIOD',
      periodId: org?.enableConduct ? (evaluation?.kpiPeriodId ?? null) : null,
      cycleId: null,
    },
    evaluation?.userId
  )

  const calculatedScore = scorePreview?.systemScore ?? null
  const scoreCeiling = scorePreview?.maxAllowedScore ?? maxScore
  scoreCeilingRef.current = scoreCeiling
  const bonusScore = scorePreview?.bonusScore ?? 0

  const [selectedSubmission, setSelectedSubmission] = useState<any>(null)



  if (!open || !evaluation) return null


  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Chi tiết Đánh giá"
      description={evaluation.kpiPeriodName}
    >
      <div className="space-y-6">

        {/* Subject Info */}
        <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-warning-border)]">
          <div className="flex items-center gap-4">
            <UserAvatar
              fullName={evaluation.userName}
              avatarUrl={evaluation.userAvatarUrl}
              className="w-14 h-14 rounded-card"
              fallbackClassName="bg-[var(--color-warning-bg)] font-semibold text-lg text-[var(--color-warning)]"
            />
            <div>
              <h4 className="text-lg font-semibold text-[var(--color-foreground)]">{evaluation.userName}</h4>
              <div className="flex items-center gap-2 mt-0.5 mb-1.5">
                <span className="text-eyebrow px-1.5 py-0.5 rounded-control bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info-border)]">
                  {evaluation.userRoleName || 'NHÂN VIÊN'}
                </span>
                <span className="text-caption font-medium">{evaluation.orgUnitName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-[var(--color-subtle-foreground)]">
                <span className="flex items-center gap-1"><Target size={12} /> {evaluation.kpiPeriodName}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-[var(--color-subtle-foreground)]">Dòng thời gian đánh giá</h4>

          {timelineSteps.map((step, idx) => (
            <EvalLayerCard
              key={step.id}
              title={step.title}
              icon={step.icon}
              iconBg={step.iconBg}
              iconColor={step.iconColor}
              evaluation={step.evaluation}
              calculatedScore={step.role === 'SELF' ? calculatedScore : undefined}
              maxScore={maxScore}
              // Phiếu chưa ai chấm thì không dựng dòng "điểm hạnh kiểm —" cho có.
              conduct={conductSheet?.effectiveScore != null ? conductSheet : null}
              lineActive={idx < timelineSteps.length - 1 && !!timelineSteps[idx + 1].evaluation}
              isLast={idx === timelineSteps.length - 1}
              getScoreColor={getScoreColor}
              getScoreBg={getScoreBg}
              getScoreLabel={getScoreLabel}
              onClick={step.role === 'SELF' && isDeputy ? () => setShowPerfDetail(true) : undefined}
              onExplainBsc={setWaterfallId}
            />


          ))}
        </div>



        {/* KHÔNG dựng phiếu hạnh kiểm ở đây. Màn này là màn XEM LẠI: nhân viên chấm ở
            modal tự đánh giá, quản lý chấm ở modal chấm đợt — hiện lại cả phiếu chỉ làm
            modal dài thêm. Con số đã nằm ở dòng "Điểm hạnh kiểm" trên timeline. */}

        {/* === Director: Drill-down to StaffEvaluationModal === */}
        {canReviewSubmission && isManager && evaluation?.userId !== user?.id && mySubmissions && mySubmissions.content.length > 0 && (
          <div className="pt-4 border-t border-[var(--color-border)]">
            <Button className="w-full group" onClick={() => setShowStaffEval(true)}>
              <Target aria-hidden="true" className="group-hover:rotate-45 transition-transform" />
              {(layers.directorEval || myEvalAtLevel) ? 'Xem Chi tiết bài nộp KPI' : 'Phê duyệt & Đánh giá bài nộp'} ({mySubmissions.content.length})
            </Button>
            <p className="text-caption mt-2 text-center italic font-medium">
              {(layers.directorEval || myEvalAtLevel)
                ? 'Nhấn để xem lại danh sách chỉ tiêu KPI đã đánh giá.' 
                : 'Nhấn để xem danh sách chỉ tiêu KPI và thực hiện đánh giá chính thức.'}
            </p>
          </div>
        )}

        {/* === Mid-level managers (Trưởng nhóm/Trưởng phòng): Inline evaluation form === */}
        {!canReviewSubmission && canCreateEvaluation && isManager && evaluation?.userId !== user?.id && !myEvalAtLevel && (
          <div className="pt-6 border-t border-[var(--color-border)] space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-eyebrow flex items-center gap-2">
                <Award size={14} className="text-[var(--color-primary)]" /> Thực hiện đánh giá
              </h4>
            </div>
            
            {/* Not evaluated yet — show polished slider form */}
            <div className="space-y-6">
              {/* Score Display + Slider Card */}
              <div className="relative group p-8 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] overflow-hidden">
                
                <div className="flex flex-col items-center gap-6 relative">
                  <div className="flex items-baseline justify-center gap-4">
                    <div className={cn("text-7xl font-semibold tracking-tighter transition-all duration-700 drop-shadow-sm", getScoreColor(inlineScore))}>
                      {inlineScore}
                    </div>
                    <div className="space-y-1">
                      <p className={cn("text-sm font-semibold transition-all duration-500", getScoreColor(inlineScore))}>
                        {getScoreLabel(inlineScore)}
                      </p>
                      {layers.selfEval?.score != null && inlineScore !== layers.selfEval.score && (
                        <div className={cn(
                          "text-eyebrow inline-flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm animate-in fade-in zoom-in-95 duration-300",
                          inlineScore > layers.selfEval.score
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)] dark:bg-[var(--color-success-bg)] dark:border-[var(--color-success-border)]"
                            : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)] dark:border-[var(--color-warning-border)]"
                        )}>
                          {inlineScore > layers.selfEval.score ? <TrendingUp size={10} /> : <Target size={10} />}
                          {inlineScore > layers.selfEval.score ? '+' : ''}{Math.round(inlineScore - layers.selfEval.score)} so với tự đánh giá
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full max-w-md mx-auto space-y-4">
                    <input
                      type="range" min={0} max={scoreCeiling} step={1}
                      value={inlineScore}
                      onChange={e => setInlineValue('score', Number(e.target.value), { shouldValidate: true })}
                      className="w-full h-2.5 bg-[var(--color-border)] rounded-full appearance-none cursor-pointer transition-all hover:h-3"
                    />
                    {inlineErrors.score && (
                      <p className="text-eyebrow text-center text-[var(--color-error)]">
                        {inlineErrors.score.message}
                      </p>
                    )}
                    <div className="flex justify-between px-1">
                      <span className="text-eyebrow">0</span>
                      <span className="text-eyebrow text-[var(--color-subtle-foreground)] opacity-50">{Math.round(scoreCeiling / 2)}</span>
                      <span className="text-eyebrow">{scoreCeiling}</span>
                    </div>
                    {bonusScore > 0 && (
                      <p className="text-eyebrow text-center text-[var(--color-success)]">
                        Đạt đủ KPI = {SCORING_POOL} điểm · thưởng thêm {bonusScore}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Comment Area */}
              <div className="space-y-3">
                <label className="text-label flex items-center gap-2 ml-2">
                  <MessageSquare size={14} className="text-[var(--color-primary)]" /> Nhận xét đánh giá
                </label>
                <textarea
                  {...registerInline('comment')}
                  rows={3}
                  placeholder="Ghi lại nhận xét chi tiết về nỗ lực và kết quả của nhân viên..."
                  className="w-full px-6 py-5 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none resize-none transition-all shadow-sm placeholder:text-[var(--color-subtle-foreground)]"
                />
              </div>

              <Button className="w-full" onClick={handleInlineSubmit(data => inlineSubmitMutation.mutate(data))} disabled={inlineSubmitMutation.isPending}>
                {inlineSubmitMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Award aria-hidden="true" />}
                Hoàn tất đánh giá
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>

      {showStaffEval && evaluation && (
        <StaffEvaluationModal
          open={showStaffEval}
          onClose={() => setShowStaffEval(false)}
          userId={evaluation.userId}
          userName={evaluation.userName}
          periodId={evaluation.kpiPeriodId}
          periodName={evaluation.kpiPeriodName}
          readOnly={!!(layers.directorEval || myEvalAtLevel)}
          evaluationComment={layers.directorEval?.comment || ''}
        />
      )}

      {showPerfDetail && evaluation && (
        <StaffPerformanceDetailModal
          open={showPerfDetail}
          onClose={() => setShowPerfDetail(false)}
          userId={evaluation.userId}
          userName={evaluation.userName}
          periodId={evaluation.kpiPeriodId}
          periodName={evaluation.kpiPeriodName}
        />
      )}

      <ReviewModal 
        open={!!selectedSubmission} 
        onClose={() => setSelectedSubmission(null)} 
        submission={selectedSubmission} 
      />

      <BscWaterfallModal
        open={!!waterfallId}
        onClose={() => setWaterfallId(null)}
        evaluationId={waterfallId}
      />
    </>
  )
}


// --- Sub Components ---

/**
 * Một con số phụ của thẻ đánh giá: nhãn + câu giải thích bên trái, con số bên phải.
 *
 * Ba con số này (ma trận, hạnh kiểm, BSC) trước đây là ba viên pill chữ 9px in hoa nằm
 * cùng một dòng với nhau — cùng cỡ, cùng kiểu, không có nhãn nào nói con số nghĩa là gì.
 * Xếp thành hàng có nhãn thì đọc một lượt là hiểu.
 */
function DetailRow({
  icon, label, badge, caption, value, valueClass, action, children,
}: {
  icon: ReactNode
  label: string
  badge?: string
  caption?: string
  value?: ReactNode
  valueClass?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="px-3 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-caption flex items-center gap-1.5">
            {label}
            {badge && (
              <span className="text-eyebrow px-1.5 py-px rounded-full bg-[var(--color-border)]">
                {badge}
              </span>
            )}
          </p>
          {caption && (
            <p className="text-caption leading-relaxed">{caption}</p>
          )}
        </div>
        {action}
        {value != null && (
          <span className={cn('shrink-0 text-lg font-semibold leading-none tabular-nums', valueClass)}>{value}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function EvalLayerCard({ title, icon: Icon, iconBg, iconColor, evaluation, lineActive, isLast, calculatedScore, maxScore, conduct, getScoreColor, getScoreBg, getScoreLabel, onClick, onExplainBsc }: {
  title: string; icon: any; iconBg: string; iconColor: string;
  evaluation: Evaluation | null; lineActive?: boolean; isLast?: boolean;
  calculatedScore?: number | null;
  maxScore: number;
  /** Phiếu hạnh kiểm của đợt — null khi tổ chức không chấm hạnh kiểm hoặc phiếu chưa có điểm. */
  conduct?: ConductSheet | null;
  getScoreColor: (s: number | null) => string;
  getScoreBg: (s: number | null) => string;
  getScoreLabel: (s: number | null) => string;
  onClick?: () => void;
  /** Mở màn hình diễn giải điểm BSC (điểm gốc, trần, hạng mục chặn, ghi đè). */
  onExplainBsc?: (evaluationId: string) => void;
}) {

  return (
    <TimelineStep
      title={title}
      icon={Icon}
      iconBg={iconBg}
      iconColor={iconColor}
      timeLabel={evaluation ? formatDateTime(evaluation.createdAt) : null}
      lineActive={lineActive}
      isLast={isLast}
      onClick={evaluation ? onClick : undefined}
    >
      {evaluation ? (
          <>
            {/* Hàng đầu: CHỈ điểm chốt của tầng này và người chấm. Mọi con số phụ (ma trận,
                hạnh kiểm, BSC) xuống khối dưới — trước đây tất cả chen trong một cột trái,
                cùng cỡ chữ 9px in hoa nên không đọc được cái nào ra cái nào. */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-12 h-12 rounded-card border flex items-center justify-center shrink-0', getScoreBg(evaluation.score))}>
                  <TrendingUp size={20} className={getScoreColor(evaluation.score)} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className={cn('text-3xl font-semibold tracking-tighter tabular-nums', getScoreColor(evaluation.score))}>
                      {evaluation.score != null ? formatNumber(evaluation.score) : '—'}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-subtle-foreground)]">/{maxScore}</span>
                    <span className={cn('ml-1 text-eyebrow whitespace-nowrap', getScoreColor(evaluation.score))}>
                      {getScoreLabel(evaluation.score)}
                    </span>
                  </div>

                  {evaluation.evaluatorRole === 'SELF' && !(evaluation.behaviorScore != null && evaluation.kpiCompletionPercent == null) && (evaluation.systemScore ?? calculatedScore) != null && evaluation.score !== (evaluation.systemScore ?? calculatedScore) && (
                     <div className={cn(
                       "text-eyebrow mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-control",
                       evaluation.score! > (evaluation.systemScore ?? calculatedScore!)
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]"
                        : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]"
                     )}>
                       {evaluation.score! > (evaluation.systemScore ?? calculatedScore!) ? '+' : ''}{Math.round(evaluation.score! - (evaluation.systemScore ?? calculatedScore!))} so với điểm hệ thống
                     </div>
                  )}
                </div>
              </div>

              {evaluation.evaluatorName && (
                <p className="shrink-0 text-right text-caption leading-relaxed">
                  bởi<br />
                  <span className="text-[var(--color-muted-foreground)]">{evaluation.evaluatorName}</span>
                </p>
              )}
            </div>

            {(evaluation.matrixRating != null || conduct != null || evaluation.bscScore != null) && (
              <div className="mt-4 space-y-1.5">
                {evaluation.matrixRating != null && (
                  <DetailRow
                    icon={<Star size={13} className="text-[var(--color-info)] fill-current" />}
                    label="Xếp loại theo ma trận"
                    caption={`Tra từ hành vi ${evaluation.behaviorScore != null ? evaluation.behaviorScore.toFixed(1) : '—'}/5 và hoàn thành ${evaluation.kpiCompletionPercent != null ? Math.round(evaluation.kpiCompletionPercent) + '%' : '—'}`}
                    value={<>{evaluation.matrixRating}<span className="text-xs text-[var(--color-subtle-foreground)]">/5</span></>}
                    valueClass="text-[var(--color-info)]"
                  />
                )}

                {/* Điểm hạnh kiểm THẬT của phiếu, đúng thang của bộ tiêu chí. */}
                {conduct != null && (
                  <DetailRow
                    icon={<HeartHandshake size={13} className="text-[var(--color-success)]" />}
                    label="Điểm hạnh kiểm"
                    caption={[
                      `Tự chấm ${conduct.selfScore != null ? formatNumber(conduct.selfScore) : '—'}`,
                      `quản lý chấm ${conduct.managerScore != null ? formatNumber(conduct.managerScore) : '—'}`,
                    ].join(' · ')}
                    value={<>
                      {conduct.effectiveScore != null ? formatNumber(conduct.effectiveScore) : '—'}
                      <span className="text-xs text-[var(--color-subtle-foreground)]">/{conduct.maxScore}</span>
                    </>}
                    valueClass="text-[var(--color-success)]"
                  />
                )}

                {/* BSC: điểm + breakdown hạng mục (chỉ hiện khi kỳ có bộ tiêu chí) */}
                {evaluation.bscScore != null && (
                  <DetailRow
                    icon={<Layers size={13} className="text-[var(--color-primary)]" />}
                    label="Điểm BSC"
                    badge={evaluation.bscScoringMode === 'OFFICIAL' ? 'Chính thức' : 'Song song'}
                    caption={evaluation.bscScoringMode === 'OFFICIAL'
                      ? 'Đang là điểm chính thức của kỳ'
                      : 'Chạy song song để đối chiếu — chưa thay điểm hệ thống'}
                    value={evaluation.bscScore.toFixed(1)}
                    valueClass="text-[var(--color-primary)]"
                    action={
                      // Điểm BSC đứng một mình không giải thích được vì sao ra con số đó —
                      // trần điểm và hạng mục chặn nằm ở màn hình diễn giải.
                      <Button variant="ghost" size="sm" className="shrink-0" type="button" onClick={e => { e.stopPropagation(); onExplainBsc?.(evaluation.id) }}>
                        Diễn giải <ArrowUpRight aria-hidden="true" />
                      </Button>
                    }
                  >
                    {evaluation.bscPerspectives && evaluation.bscPerspectives.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {evaluation.bscPerspectives.map(p => (
                          <span key={p.perspectiveId}
                            className="inline-flex items-center gap-1.5 text-caption"
                            title={describePerspectiveScore(p)}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                            {p.name}
                            <b className={cn('tabular-nums', p.achievementPercent == null && 'text-[var(--color-subtle-foreground)]')}>
                              {p.achievementPercent != null ? `${p.achievementPercent.toFixed(0)}%` : 'chưa có'}
                            </b>
                          </span>
                        ))}
                      </div>
                    )}
                  </DetailRow>
                )}
              </div>
            )}

            {evaluation.comment && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-muted-foreground)] italic leading-relaxed">
                  "{evaluation.comment}"
                </p>
              </div>
            )}
          </>
      ) : null}
    </TimelineStep>
  )
}


