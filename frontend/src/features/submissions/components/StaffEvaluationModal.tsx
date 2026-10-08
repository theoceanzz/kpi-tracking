import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import AiReviewDetailDialog from './AiReviewDetailDialog'
import AiConfidenceBars from './AiConfidenceBars'
import { useAiReview, useRequestAiReview } from '../hooks/useAiReview'
import type { AiReviewItem } from '../api/aiReviewApi'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { createStaffEvaluationSchema, type StaffEvaluationFormData } from '../schemas/submissionSchema'
import { firstErrorMessage } from '@/lib/formErrors'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  Loader2, CheckCircle, Target, Zap,
  AlertCircle, Lock, Undo2, Sparkles, Eye, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import StatusBadge from '@/components/common/StatusBadge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Section, ScoreRow, AxisLine, Collapsible } from '@/components/common/ScoreForm'
import type { Submission, SubmissionEvaluatorScore } from '@/types/submission'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { NEUTRAL_COLOR, seriesColor } from '@/components/charts/chartPalette'
import EvidenceAttachments from '@/features/evidence/EvidenceAttachments'
import AttachmentChips from '@/features/evidence/AttachmentChips'
import { evidenceKey } from '@/features/evidence/evidenceApi'
import { Badge } from '@/components/ui/badge'

import { useAuthStore } from '@/store/authStore'
import { formatNumber, formatDateTime, cn } from '@/lib/utils'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

import { getScoringFunctions, SCORING_POOL } from '@/lib/scoring'
import { conductAsBehavior, conductAsCompletion, lookupMatrixRating } from '@/lib/performanceMatrix'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import RewardPrompt from '@/features/rewards/components/RewardPrompt'
import { useCanPromptReward } from '@/features/rewards/hooks/useCanPromptReward'
import ConductInlineSheet, { type ConductSheetHandle } from '@/features/conduct/components/ConductInlineSheet'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

interface StaffEvaluationModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  periodId: string
  periodName: string
  readOnly?: boolean
  periodEnded?: boolean
}

export default function StaffEvaluationModal({
  open, onClose, userId, userName, periodId, periodName, readOnly = false, periodEnded = false
}: StaffEvaluationModalProps) {
  const { t } = useTranslation('submissions')
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreLabel, maxScore } = getScoringFunctions(org)
  const canPromptReward = useCanPromptReward()
  const qualitativeLevels = [...(org?.qualitativeLevels ?? [])].sort((a, b) => a.position - b.position)
  const userRoleName = user?.memberships?.[0]?.roleName || t('StaffEvaluationModal.manager')
  const qc = useQueryClient()
  // Trần điểm và danh sách KPI định tính chỉ có sau khi truy vấn trả về, tức là sau khi
  // form đã dựng — giữ trong ref để schema đọc lúc kiểm tra thay vì dựng lại schema.
  const scoreCeilingRef = useRef(0)
  const qualitativeIdsRef = useRef<string[]>([])
  const schema = useMemo(
    () => createStaffEvaluationSchema({
      get qualitativeIds() { return qualitativeIdsRef.current },
      getScoreCeiling: () => scoreCeilingRef.current,
    }),
    [],
  )

  const formApi = useForm<StaffEvaluationFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      individualScores: {}, individualLevels: {},
      overallComment: '', finalScore: 0,
    },
  })
  const { register, handleSubmit, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `staff-evaluation:${userId}:${periodId}`, enabled: open && !readOnly })

  // Cả bảng chấm tính lại theo từng ô vừa sửa (điểm hành vi, tổng điểm, xếp loại ma trận).
  const individualScores = watch('individualScores')
  const individualLevels = watch('individualLevels')
  const finalScore = watch('finalScore')
  const setIndividualScores = (next: Record<string, number>) =>
    setValue('individualScores', next, { shouldValidate: true })
  const setIndividualLevels = (next: Record<string, string>) =>
    setValue('individualLevels', next, { shouldValidate: true })
  const setFinalScore = (next: number) => setValue('finalScore', next, { shouldValidate: true })
  const hasManuallyAdjustedFinal = useRef(false)

  // Phiếu hạnh kiểm không có nút lưu riêng — "Phê duyệt & chốt" lưu hộ nó. Đổi lại, đóng
  // modal giữa chừng là mất phần vừa chấm, đúng như mọi ô khác trong form này.
  const conductRef = useRef<ConductSheetHandle>(null)

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

  // Điểm từng chỉ tiêu theo TỪNG người chấm (sổ V37): "Quản lý chấm" và "Sếp chấm" đứng cạnh nhau thay vì cấp sau
  // đè mất điểm cấp trước như ô managerScore của bài nộp.
  const { data: evaluatorScores } = useQuery({
    queryKey: ['submissions', 'evaluator-scores', userId, periodId],
    queryFn: () => submissionApi.getEvaluatorScores(userId, periodId),
    enabled: open && !!userId && !!periodId,
  })

  // Mỗi người chấm có MỘT bản riêng cho (người, đợt) — xem EvaluationService.createEvaluation.
  // Lấy cả danh sách để tách bản CỦA MÌNH (đổ vào form) khỏi bản của cấp dưới đã chấm trước
  // (chỉ hiển thị). Trước đây chỉ lấy 1 bản đầu nên cấp trên mở lên thấy nhận xét của
  // trưởng phòng nằm trong ô của mình, chốt là chép nguyên sang bản của cấp trên.
  const { data: existingEvals } = useQuery({
    queryKey: ['evaluations', 'staff-eval', userId, periodId],
    queryFn: () => evaluationApi.getAll({ userId, kpiPeriodId: periodId, size: 50 }),
    enabled: open
  })
  const myEval = useMemo(
    () => existingEvals?.content?.find(e => e.evaluatorId === user?.id) ?? null,
    [existingEvals, user?.id],
  )
  // Nhận xét của các cấp quản lý khác đã chấm người này (bỏ tự đánh giá), cũ chấm trước lên trên.
  const priorManagerEvals = useMemo(
    () => (existingEvals?.content ?? [])
      .filter(e => e.evaluatorId !== user?.id && e.evaluatorRole !== 'SELF')
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [existingEvals, user?.id],
  )

  // Điểm BSC của kỳ: khi kỳ chấm CHÍNH THỨC, điểm cuối bị KHÓA theo bsc_score
  // (backend cũng ép — xem EvaluationService.createEvaluation — nên UI phải khớp, tránh
  // hiển thị một đằng lưu một nẻo).
  const { data: scorePreview } = useQuery({
    queryKey: ['score-preview', periodId, userId],
    queryFn: () => evaluationApi.getScorePreview(periodId, userId),
    enabled: open && !!periodId && !!userId,
  })
  const bscScore = scorePreview?.bscScore ?? null
  const isBscOfficial = scorePreview?.bscScoringMode === 'OFFICIAL' && bscScore != null
  // Tổ chức bật BSC mà đơn vị chưa có bộ riêng cho đợt ⇒ không có điểm BSC; nói rõ thay vì để trống.
  const bscNotApplied = !!org?.enableBsc && !!scorePreview && !scorePreview.bscScoringMode
  // KPI thưởng nằm ngoài pool 100% nên điểm của nó cộng THÊM lên trên thang điểm — trần thật
  // lấy từ backend để khớp đúng giới hạn mà createEvaluation kiểm tra khi lưu.
  const scoreCeiling = scorePreview?.maxAllowedScore ?? maxScore
  scoreCeilingRef.current = scoreCeiling
  const bonusScore = scorePreview?.bonusScore ?? 0

  // Bài đã trả lại (hoàn duyệt) là lịch sử: không chấm, không duyệt khi chốt — hiện ở mục riêng.
  const allSubmissions = useMemo(() => submissions?.content ?? [], [submissions])
  const submissionList = useMemo(() => allSubmissions.filter(s => s.status !== 'RETURNED'), [allSubmissions])
  const returnedList = allSubmissions.filter(s => s.status === 'RETURNED')
  const awaitingResubmission = returnedList.filter(s => s.awaitingResubmission)
  qualitativeIdsRef.current = submissionList.filter(s => s.kpiType === 'QUALITATIVE').map(s => s.id)

  // Full-qualitative: the staff member has only qualitative KPIs, so KPI completion defaults to
  // 100% -> the final score is locked to the full scoring pool (in sync with "100% hoàn thành"),
  // matching EvaluationFormModal's self-score behaviour.
  const isFullQualitative = submissionList.length > 0 && submissionList.every(s => s.kpiType === 'QUALITATIVE')
  // KHÔNG làm tròn: backend lưu đúng bsc_score (vd 82.5) nên UI phải hiện y hệt, tránh lệch 83 vs 82.5.
  const effectiveFinalScore = isBscOfficial
    ? (scorePreview?.officialScore ?? bscScore!)
    : (isFullQualitative ? SCORING_POOL : finalScore)

  // ── Chiều ĐỊNH TÍNH & xếp loại ma trận (để người chấm hiểu điểm cuối từ đâu ra) ──
  const hasQualitative = submissionList.some(s => s.kpiType === 'QUALITATIVE')
  const showConduct = !!org?.enableConduct

  // Điểm hành vi tính LIVE theo mức đang chọn (trung bình có trọng số),
  // khớp công thức calculateBehaviorScore() ở backend.
  //
  // Không có KPI định tính nào để chấm tay ⇒ lấy đúng con số server đã tính trong
  // scorePreview: khi tổ chức bật chấm hạnh kiểm, đó chính là điểm hạnh kiểm đã quy về
  // thang hành vi 0..5 để lấp trục hàng của ma trận.
  // Điểm hạnh kiểm ĐANG gõ trong phiếu bên dưới (chưa lưu). Phiếu không còn nút lưu riêng
  // nên nếu chỉ trông vào scorePreview thì suốt phiên chấm, ô "Hành vi" và xếp loại vẫn
  // đứng im cho tới lúc chốt — người chấm không thấy việc mình vừa làm đi tới đâu.
  const [conductLive, setConductLive] = useState<{ total: number | null; max: number } | null>(null)

  // Quy về trục nào thì theo đúng ConductAxisResolver ở backend: trục hàng (0..5) khi
  // người này không có KPI định tính, trục cột (%) khi không có KPI định lượng. Chỉ ghi đè
  // trong hai trường hợp CHẮC CHẮN trục đó không có nguồn nào khác.
  const conductBehavior = !hasQualitative
    ? conductAsBehavior(conductLive?.total ?? null, conductLive?.max ?? null) : null
  const conductCompletion = isFullQualitative
    ? conductAsCompletion(conductLive?.total ?? null, conductLive?.max ?? null) : null

  const behaviorLive = useMemo(() => {
    if (!hasQualitative) return conductBehavior ?? scorePreview?.behaviorScore ?? null
    let sum = 0, totalWeight = 0
    for (const s of submissionList) {
      if (s.kpiType !== 'QUALITATIVE') continue
      const weight = s.weight ?? 0
      if (weight <= 0) continue
      const level = qualitativeLevels.find(l => l.id === individualLevels[s.id])
      if (!level || level.value == null) continue
      sum += level.value * weight
      totalWeight += weight
    }
    return totalWeight > 0 ? Math.round((sum / totalWeight) * 100) / 100 : null
  }, [submissionList, individualLevels, qualitativeLevels, hasQualitative, conductBehavior, scorePreview?.behaviorScore])

  // Trục cột của ma trận: % hoàn thành định lượng (không đổi theo thao tác chấm tay).
  // Không có KPI định lượng ⇒ TRỐNG, và ma trận không xếp loại. Một loại KPI chỉ cấp được
  // một trục; muốn đủ hai trục thì tổ chức phải bật chấm hạnh kiểm — khi đó server đã trả
  // sẵn trục cột đã quy đổi trong kpiCompletionPercent.
  const completionPercent = conductCompletion ?? scorePreview?.kpiCompletionPercent ?? null

  const matrixLive = useMemo(
    () => lookupMatrixRating(behaviorLive, completionPercent, org?.performanceMatrix),
    [behaviorLive, completionPercent, org?.performanceMatrix],
  )

  // Quantitative KPIs share the 0..100 pool. When qualitative takes part of the 100%
  // weight, normalize the quantitative scores over their OWN weight so they still fill
  // the 0..100 scale (matching the backend evaluation system score, which is normalized).
  // Per-submission autoScore/managerScore stay on the raw weight scale in the DB; we only
  // scale them by normFactor for display/inputs here, and de-normalize again on save.
  const quantWeight = useMemo(() =>
    submissionList.filter(s => s.kpiType !== 'QUALITATIVE').reduce((acc, s) => acc + (s.weight ?? 0), 0),
  [submissionList])
  const normFactor = quantWeight > 0 ? 100 / quantWeight : 1

  // Initialize individual scores when data loaded. Đã chấm rồi thì lấy điểm CỦA MÌNH trong sổ theo người chấm:
  // điểm trên bài nộp là của người chấm cuối, mở lại sau khi cấp trên chấm sẽ thấy điểm của cấp trên trong ô của mình.
  useEffect(() => {
    if (submissionList.length > 0) {
      const scores: Record<string, number> = {}
      const levels: Record<string, string> = {}
      submissionList.forEach(s => {
        const own = evaluatorScores?.find(r => r.submissionId === s.id && r.evaluatorId === user?.id)
        scores[s.id] = Math.round((own?.managerScore ?? s.managerScore ?? s.autoScore ?? 0) * normFactor)
        const level = own?.qualitativeLevelId ?? s.qualitativeLevelId
        if (level) levels[s.id] = level
      })
      setIndividualScores(scores)
      setIndividualLevels(levels)
    }
  }, [submissions, evaluatorScores])

  // Nhận xét chỉ lấy từ bản CỦA MÌNH. Điểm cuối: bản của mình, không có thì lấy bản mới
  // nhất của cấp dưới làm điểm xuất phát (giữ hành vi cũ), người chấm vẫn kéo lại được.
  useEffect(() => {
    if (myEval?.comment) setValue('overallComment', myEval.comment)
    const scoreSource = myEval ?? existingEvals?.content?.[0]
    if (scoreSource?.score != null) {
      setFinalScore(scoreSource.score)
      hasManuallyAdjustedFinal.current = true
    }
  }, [myEval, existingEvals, setValue])

  // Calculation logic (quantitative only, normalized to fill the 0..100 pool)
  const totalAutoScore = useMemo(() =>
    submissionList.filter(s => s.kpiType !== 'QUALITATIVE').reduce((acc, s) => acc + Math.round((s.autoScore ?? 0) * normFactor), 0),
  [submissionList, normFactor])

  // Qualitative KPIs feed the matrix, not the 0..100 sum, so exclude them here.
  const totalManagerScore = useMemo(() =>
    submissionList.filter(s => s.kpiType !== 'QUALITATIVE').reduce((acc, s) => acc + (individualScores[s.id] ?? 0), 0),
  [individualScores, submissionList])

  // Final score slider starts at the sum of the per-KPI scores above, then can be
  // dragged independently within [0, scoreCeiling] without being tied back to those scores.
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
    mutationFn: async (data: StaffEvaluationFormData) => {
      // 0. Điểm hạnh kiểm đang gõ dở phải vào DB TRƯỚC khi tạo bản ghi đánh giá: bản ghi
      //    chụp lại trục "Hành vi" từ phiếu hạnh kiểm, lưu sau thì bản đã chốt vẫn mang
      //    điểm cũ. Không có gì thay đổi thì handle tự bỏ qua, không gọi API.
      await conductRef.current?.save()

      // 1. Bulk Review Submissions — skip when the staff member has no submissions
      let reviewResults: Awaited<ReturnType<typeof submissionApi.bulkReview>> = []
      if (submissionList.length > 0) {
        reviewResults = await submissionApi.bulkReview({
          submissionIds: submissionList.map(s => s.id),
          commonReview: { status: 'APPROVED', reviewNote: t('StaffEvaluationModal.consolidatedApprovalViaTheEvaluationSheet') },
          individualReviews: submissionList.map(s =>
            s.kpiType === 'QUALITATIVE'
              ? { submissionId: s.id, qualitativeLevelId: data.individualLevels[s.id] }
              // De-normalize back to the raw weight scale for storage.
              : { submissionId: s.id, managerScore: (data.individualScores[s.id] ?? 0) / normFactor }
          ).filter(ir => ('managerScore' in ir && ir.managerScore != null) || ('qualitativeLevelId' in ir && ir.qualitativeLevelId != null))
        })
      }

      // 2. Create Evaluation record
      const evaluation = await evaluationApi.create({
        userId,
        kpiPeriodId: periodId,
        score: effectiveFinalScore,
        comment: data.overallComment || t('StaffEvaluationModal.evaluatesTheResultsOfPeriod', { userRoleName, periodName })
      })

      // Cảnh báo khung bell curve đi kèm bản ghi vừa chốt (chế độ "chặn" đã ném lỗi ở trên).
      return { reviewResults, bellCurveWarning: evaluation?.bellCurveWarning }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['evaluations'] })

      if (data?.bellCurveWarning) toast.warning(data.bellCurveWarning, { duration: 8000 })

      const autoApproved = data?.reviewResults?.find(s => s.allChildrenApproved && s.parentSubmissionId)
      if (autoApproved) {
        toast.success(t('StaffEvaluationModal.evaluationAndApprovalCompletedForThe'))
        setShowAllApproved(true)
      } else {
        // Chốt xong mới mời thưởng, ngay tại đây — đây là lúc người chấm còn nhớ rõ
        // nhất vì sao nhân viên xứng đáng. Tổ chức tắt thưởng hoặc người chấm không có
        // quyền trao thì RewardPrompt ẩn và không bao giờ gọi onDone ⇒ phải tự đóng,
        // không thì modal đứng im sau khi chốt.
        toast.success(t('StaffEvaluationModal.evaluationFinalizedForTheEmployee'))
        if (canPromptReward) setJustEvaluated(true)
        else onClose()
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('StaffEvaluationModal.failedToSaveTheEvaluation')))
    }
  })

  const [justEvaluated, setJustEvaluated] = useState(false)
  const [showAllApproved, setShowAllApproved] = useState(false)
  const [showEvalForm, setShowEvalForm] = useState(false)

  const isFullyApproved = useMemo(() => 
    submissionList.length > 0 && submissionList.every(s => s.status === 'APPROVED'),
  [submissionList])
  const canScore = isFullyApproved || !readOnly

  // Hoàn duyệt: chỉ khi chưa cấp quản lý nào chốt đánh giá đợt cho người này (BE cũng chặn).
  const [returnTarget, setReturnTarget] = useState<Submission | null>(null)
  const canReturn = !readOnly && !justEvaluated && !myEval && priorManagerEvals.length === 0
  const returnable = (s: Submission) => canReturn && ['PENDING', 'APPROVED', 'REJECTED'].includes(s.status)
  const returnButton = (s: Submission) => returnable(s) && (
    <Button
      variant="ghost" size="icon-sm" type="button"
      onClick={() => setReturnTarget(s)}
      title={t('StaffEvaluationModal.returnForRework')}
      aria-label={`${t('StaffEvaluationModal.returnForRework')}: ${s.kpiCriteriaName}`}
      className="text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]"
    >
      <Undo2 aria-hidden="true" />
    </Button>
  )

  // ── Các bên chấm: Hệ thống · Quản lý · AI · Sếp ─────────────────────────────────────────────
  // Thứ tự người chấm theo lần chấm đầu (backend đã sắp). Luật cấp bậc buộc cấp sau cao hơn cấp trước, nên người đầu
  // là quản lý trực tiếp, người cuối là cấp trên cao nhất đã chấm.
  const scorers = useMemo(() => {
    const order: string[] = []
    const names: Record<string, string> = {}
    const bySubmission: Record<string, Record<string, SubmissionEvaluatorScore>> = {}
    for (const r of evaluatorScores ?? []) {
      if (!order.includes(r.evaluatorId)) order.push(r.evaluatorId)
      if (r.evaluatorName) names[r.evaluatorId] = r.evaluatorName
      ;(bySubmission[r.submissionId] ??= {})[r.evaluatorId] = r
    }
    return { order, names, bySubmission }
  }, [evaluatorScores])

  // Người đang mở phiếu (được chấm) nằm vào đúng cột của mình và cột đó là ô nhập: chưa ai chấm hoặc chính mình chấm
  // đầu tiên thì là "Quản lý", đã có cấp dưới chấm trước thì là "Sếp". Xem lại (chỉ đọc) thì cả hai cột là điểm đã lưu.
  type ScorerColumn = { kind: 'input' } | { kind: 'saved'; evaluatorId?: string } | { kind: 'empty' }
  const otherScorers = scorers.order.filter(id => id !== user?.id)
  const viewerIsManager = !readOnly && (scorers.order[0] === user?.id || otherScorers.length === 0)
  const managerColumn: ScorerColumn = readOnly
    ? (scorers.order[0] ? { kind: 'saved', evaluatorId: scorers.order[0] } : { kind: 'saved' })
    : viewerIsManager ? { kind: 'input' } : { kind: 'saved', evaluatorId: otherScorers[0] }
  const bossColumn: ScorerColumn = readOnly
    ? (scorers.order.length > 1 ? { kind: 'saved', evaluatorId: scorers.order[scorers.order.length - 1] } : { kind: 'empty' })
    : viewerIsManager
      ? (otherScorers.length ? { kind: 'saved', evaluatorId: otherScorers[otherScorers.length - 1] } : { kind: 'empty' })
      : { kind: 'input' }
  const columnWho = (c: ScorerColumn) => c.kind === 'input'
    ? t('ScorerColumns.you')
    : c.kind === 'saved' && c.evaluatorId ? scorers.names[c.evaluatorId] : undefined

  /** Điểm đã lưu của một cột: dòng của người đó trong sổ; đợt chấm trước V37 không có sổ thì lấy điểm trên bài nộp. */
  const savedScore = (s: Submission, c: ScorerColumn): Pick<SubmissionEvaluatorScore, 'managerScore' | 'qualitativeLevelId' | 'qualitativeLevelName'> | undefined => {
    if (c.kind !== 'saved') return undefined
    if (c.evaluatorId) return scorers.bySubmission[s.id]?.[c.evaluatorId]
    if (!s.reviewedById) return undefined
    return { managerScore: s.managerScore, qualitativeLevelId: s.qualitativeLevelId, qualitativeLevelName: s.qualitativeLevelName }
  }
  const isQual = (s: Submission) => s.kpiType === 'QUALITATIVE'
  const fmtPoints = (raw?: number | null) => (raw == null ? null : formatNumber(Math.round(raw * normFactor)))

  // AI chỉ chấm TỪNG chỉ tiêu (06/10): bấm "Gợi ý" ở ô nào thì chấm chỉ tiêu đó; chấm xong ô có "Xem cách AI chấm" và
  // "Chấm lại bài này". Điểm đã chấm (kể cả của lượt cả phiếu trước đây) hiện sẵn. Bài không đổi thì máy chủ trả kết quả
  // cũ, không tốn token. Chỉ tiêu xin tạm dừng thì AI không chấm.
  const { hasPermission } = useHasPermission()
  const aiAvailable = !!org?.enableAi && !!org?.enableAiReview && hasPermission('AI_REVIEW:USE')
  const { data: aiReview } = useAiReview(periodId, userId, open && aiAvailable)
  const requestAi = useRequestAiReview(periodId, userId)
  // Bài nộp đang mở hộp "Xem cách AI chấm" (null = đóng).
  const [aiDetailFor, setAiDetailFor] = useState<Submission | null>(null)
  // Mỗi ô quay theo CHỈ TIÊU CỦA NÓ: đang chờ máy chủ nhận yêu cầu (aiPending), hoặc máy chủ báo chỉ tiêu đó đang chấm
  // (runningCriteriaIds). Không dựa vào trạng thái chung của kết quả — trước đây bấm một ô làm mọi ô cùng quay.
  const [aiPending, setAiPending] = useState<ReadonlySet<string>>(() => new Set())
  const aiRowRunning = (s: Submission) => aiPending.has(s.kpiCriteriaId)
    || !!aiReview?.runningCriteriaIds?.includes(s.kpiCriteriaId)
  /** Chỉ tiêu đã duyệt tạm dừng / đang xin tạm dừng — AI không chấm (máy chủ cũng chặn). */
  const aiPaused = (s: Submission) => s.kpiCriteriaStatus === 'INACTIVE' || !!s.kpiPausePending
  // Chỉ nhận kết quả AI của ĐÚNG bài nộp của dòng. Nhân viên nộp lại là một bài nộp mới: kết quả của bài cũ (đã trả
  // lại) không được hiện ở đây, kẻo người xem tưởng AI đã chấm bài mới — ô về "Gợi ý".
  const aiItemOf = (s: Submission): AiReviewItem | undefined =>
    aiReview?.items.find(i => i.kpiSubmissionId === s.id)
  /** Kết quả dùng được của dòng (không tính chỉ tiêu AI báo lỗi — số khi đó thiếu phần chất lượng). */
  const aiUsable = (s: Submission) => {
    const item = aiItemOf(s)
    return item && !item.errorMessage ? item : undefined
  }
  const aiRowFailed = (s: Submission) => !!aiReview?.failedCriteriaIds?.includes(s.kpiCriteriaId) || !!aiItemOf(s)?.errorMessage
  const askAiFor = (ids: string[], force: boolean) => {
    setAiPending(prev => new Set([...prev, ...ids]))
    // onSettled chạy sau khi hook đã đọc lại kết quả gộp (đã có runningCriteriaIds), nên ô không chớp về "Gợi ý".
    requestAi.mutate({ kpiCriteriaIds: ids, force }, {
      onSettled: () => setAiPending(prev => new Set([...prev].filter(id => !ids.includes(id)))),
    })
  }
  // Điểm AI định lượng nằm trên thang đánh giá (cùng thang ô chấm); lượt cũ trước 30/09 còn ở thang trọng số thô.
  const aiText = (s: Submission, item?: AiReviewItem) => {
    if (!item) return null
    if (isQual(s)) return item.suggestedLevel ?? item.qualityLevel ?? null
    if (item.suggestedScore == null) return null
    return formatNumber(Math.round(item.maxPoints != null ? item.suggestedScore : item.suggestedScore * normFactor))
  }

  // Chấm màu ở đầu cột bảng và ở dòng tóm tắt trên điện thoại — cùng một bên chấm, cùng một màu.
  const SCORER_COLORS = { system: NEUTRAL_COLOR, manager: seriesColor(1), ai: seriesColor(4), boss: seriesColor(2) }
  const columnText = (s: Submission, c: ScorerColumn) => {
    if (c.kind === 'input') {
      return isQual(s)
        ? qualitativeLevels.find(l => l.id === individualLevels[s.id])?.name ?? null
        : formatNumber(individualScores[s.id] ?? 0)
    }
    const saved = savedScore(s, c)
    if (!saved) return null
    return isQual(s) ? saved.qualitativeLevelName ?? null : fmtPoints(saved.managerScore)
  }
  // Các ô của bảng KPI — hàm render (không phải component con) để ô nhập không bị dựng lại
  // và mất focus sau mỗi phím gõ. Mobile và desktop dùng chung nên chỉ có một bản.
  const kpiCell = (s: Submission) => (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-card bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]">
        <Target size={13} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-[var(--color-foreground)]">{s.kpiCriteriaName}</p>
        <p className="text-caption mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {s.resubmission && (
            <Badge variant="info" title={s.previousReturnReason
              ? t('StaffEvaluationModal.previouslyReturnedReason', { reason: s.previousReturnReason })
              : undefined}>
              {t('StaffEvaluationModal.resubmittedSubmission')}
            </Badge>
          )}
          <span>{t('StaffEvaluationModal.weight')} {s.weight}%</span>
          <AttachmentChips files={s.attachments} />
        </p>
        {s.note && <p className="text-caption mt-0.5 line-clamp-1 italic group-hover:line-clamp-none" title={s.note}>“{s.note}”</p>}
      </div>
    </div>
  )
  const resultCell = (s: Submission) => s.kpiType === 'QUALITATIVE' ? (
    <span className="text-eyebrow inline-flex items-center gap-1 rounded-control border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 py-1 text-[var(--color-info)]">
      ★ {s.qualitativeLevelName ?? t('StaffEvaluationModal.selfAssessment')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1 text-xs tabular-nums">
      <b className="text-[var(--color-foreground)]">{formatNumber(s.actualValue)}</b>
      <span className="text-caption">/ {s.targetValue != null ? formatNumber(s.targetValue) : '—'}</span>
    </span>
  )
  const systemScoreCell = (s: Submission) => (
    <span className="text-sm tabular-nums text-[var(--color-muted-foreground)]">
      {isQual(s) ? '-' : fmtPoints(s.autoScore ?? 0)}
    </span>
  )
  const scoreInputCell = (s: Submission) => isQual(s) ? (
    <Select
      value={individualLevels[s.id] ?? ''}
      onValueChange={v => setIndividualLevels({ ...individualLevels, [s.id]: v })}
      disabled={readOnly}
    >
      <SelectTrigger className="w-40" aria-label={t('StaffEvaluationModal.qualitativeLevel')}>
        <SelectValue placeholder={t('StaffEvaluationModal.chooseLevel')} />
      </SelectTrigger>
      <SelectContent>
        {qualitativeLevels.filter(l => !!l.id).map(l => (
          <SelectItem key={l.id} value={l.id as string}>{l.name} ({formatNumber(l.value)}{t('StaffEvaluationModal.pts')}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <Input
      type="number" size="sm"
      value={individualScores[s.id] ?? 0}
      onChange={e => setIndividualScores({ ...individualScores, [s.id]: Number(e.target.value) })}
      onWheel={e => e.currentTarget.blur()}
      disabled={readOnly}
      aria-label={t('StaffEvaluationModal.scoreFor', { kpiCriteriaName: s.kpiCriteriaName })}
      className="w-20"
      inputClassName="text-right font-semibold tabular-nums text-[var(--color-primary)]"
    />
  )
  /** Ô "Quản lý chấm" / "Sếp chấm": ô nhập nếu là cột của người đang chấm, không thì điểm đã lưu của người kia. */
  const scorerCell = (s: Submission, c: ScorerColumn) => c.kind === 'input' ? scoreInputCell(s) : (
    <span className="text-sm font-medium tabular-nums text-[var(--color-foreground)]">{columnText(s, c) ?? '-'}</span>
  )
  const aiButtonCls = 'border-[var(--color-ai-line)] text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)]'
  /**
   * Ô "AI chấm" của một dòng:
   * - tạm dừng → nhãn, không có nút;
   * - đang chấm → quay;
   * - chưa có / lỗi → "Gợi ý" / "Thử lại" chấm riêng chỉ tiêu đó;
   * - có điểm → điểm + cột tin cậy, dưới là "Xem cách AI chấm" và "Chấm lại bài này".
   * `compact` cho dòng tóm tắt trên điện thoại (nút chỉ còn biểu tượng).
   */
  const aiCell = (s: Submission, compact = false) => {
    if (aiPaused(s)) {
      return (
        <span title={t('ScorerColumns.pausedHint')}
              className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
          {s.kpiCriteriaStatus === 'INACTIVE' ? t('ScorerColumns.paused') : t('ScorerColumns.pausePending')}
        </span>
      )
    }
    if (aiRowRunning(s)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" /> {t('ScorerColumns.aiRowRunning')}
        </span>
      )
    }
    const item = aiUsable(s)
    const text = aiText(s, item)
    if (!item || text == null) {
      const failed = aiRowFailed(s)
      return (
        <Button size="sm" variant="outline" type="button" className={cn(aiButtonCls, compact && 'h-7 px-2')}
                onClick={() => askAiFor([s.kpiCriteriaId], failed || !!aiItemOf(s))}
                title={failed ? (aiItemOf(s)?.errorMessage ?? t('AiReviewPanel.failed')) : t('ScorerColumns.aiSuggestRow')}
                aria-label={`${failed ? t('ScorerColumns.aiRetry') : t('ScorerColumns.aiSuggest')}: ${s.kpiCriteriaName}`}>
          {failed ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {failed ? t('ScorerColumns.aiRetry') : t('ScorerColumns.aiSuggest')}
        </Button>
      )
    }
    // Điểm + cột tin cậy gói trong một viên tông AI; hai thao tác nhỏ cùng cỡ chữ đứng ngay dưới, canh phải theo cột.
    const score = (
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ai-soft)] py-0.5 pl-2.5 pr-2">
        <span className="text-sm font-semibold leading-5 tabular-nums text-[var(--color-ai)]">{text}</span>
        <AiConfidenceBars level={item.confidence} />
      </span>
    )
    const detailButton = (
      <Button variant="ghost" size={compact ? 'icon-sm' : 'sm'} type="button" onClick={() => setAiDetailFor(s)}
              title={t('ScorerColumns.aiDetail')} aria-label={`${t('ScorerColumns.aiDetail')}: ${s.kpiCriteriaName}`}
              className={cn('text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)]',
                compact ? 'h-6 w-6' : 'h-6 gap-1 px-1.5 text-xs font-medium [&_svg]:size-3.5')}>
        <Eye aria-hidden="true" />{!compact && t('ScorerColumns.aiDetail')}
      </Button>
    )
    const rescoreButton = (
      <Button variant="ghost" size="icon-sm" type="button" onClick={() => askAiFor([s.kpiCriteriaId], true)}
              title={t('ScorerColumns.aiRescoreRow')} aria-label={`${t('ScorerColumns.aiRescoreRow')}: ${s.kpiCriteriaName}`}
              className="h-6 w-6 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-ai-soft)] hover:text-[var(--color-ai)] [&_svg]:size-3.5">
        <RefreshCw aria-hidden="true" />
      </Button>
    )
    if (compact) return <span className="inline-flex items-center gap-1">{score}{detailButton}{rescoreButton}</span>
    return (
      <span className="inline-flex flex-col items-end gap-1">
        {score}
        <span className="inline-flex items-center">
          {detailButton}
          <span className="mx-0.5 h-3 w-px bg-[var(--color-border)]" aria-hidden="true" />
          {rescoreButton}
        </span>
      </span>
    )
  }
  const aiDetailItem = aiDetailFor ? aiUsable(aiDetailFor) : undefined
  const columnHead = (label: string, color: string, who?: string, extra?: ReactNode) => (
    <div className="flex flex-col items-end gap-1">
      <span className="text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        {label}
      </span>
      {who && <span className="text-caption max-w-[9rem] truncate font-normal" title={who}>{who}</span>}
      {extra}
    </div>
  )
  /** Điện thoại không có đầu cột: một dòng tóm tắt bốn bên chấm dưới mỗi chỉ tiêu. */
  const mobileScorers = (s: Submission) => (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {([
        ['system', t('ScorerColumns.system'), isQual(s) ? null : fmtPoints(s.autoScore ?? 0)],
        ['manager', t('ScorerColumns.manager'), columnText(s, managerColumn)],
        ...(aiAvailable ? [['ai', t('ScorerColumns.ai'), null]] : []),
        ['boss', t('ScorerColumns.boss'), columnText(s, bossColumn)],
      ] as [keyof typeof SCORER_COLORS, string, string | null][]).map(([key, label, value]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SCORER_COLORS[key] }} aria-hidden="true" />
          <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
          <dd className="font-semibold tabular-nums text-[var(--color-foreground)]">
            {key === 'ai' ? aiCell(s, true) : value ?? '-'}
          </dd>
        </div>
      ))}
    </dl>
  )

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      // Đang mở hộp "Trả lại bài nộp" chồng lên thì Esc chỉ được đóng hộp đó — không kéo theo
      // đóng cả phiếu chấm và mất phần điểm đang nhập dở.
      dismissible={!submitMutation.isPending && !returnTarget && !aiDetailFor}
      title={<>{t('StaffEvaluationModal.overallEvaluation')} <span className="text-[var(--color-primary)]">{userName}</span></>}
      description={<>{t('StaffEvaluationModal.evaluationCycle')} <span className="font-medium text-[var(--color-foreground)]">{periodName}</span> · {submissionList.length} {t('StaffEvaluationModal.kpis')}</>}
      headerExtra={isFullyApproved
        ? <Badge variant="success">{t('StaffEvaluationModal.approved')}</Badge>
        : <Badge variant="warning">{t('StaffEvaluationModal.waitingToBeScored')}</Badge>}
      footer={readOnly ? undefined : justEvaluated && canPromptReward ? (
        // Chốt đánh giá xong thì mời thưởng ngay tại chỗ, trước khi người dùng đóng modal
        // và quên mất. Đặt ở footer (ngoài vùng cuộn) chứ không ở cuối thân modal: thân
        // dài, lời mời nằm dưới đáy thì người chấm không cuộn xuống sẽ không thấy. Lúc này
        // lời mời THAY hàng nút: "Bỏ qua" của nó đã đóng modal, để thêm "Đóng" bên cạnh
        // thì hai nút cùng một việc, người dùng không biết bấm cái nào.
        <div className="shrink-0 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <RewardPrompt
            userId={userId}
            fullName={userName}
            defaultReason={t('StaffEvaluationModal.goodResultsInThePeriod', { value: periodName ? ` ${periodName}` : '' })}
            onDone={onClose}
          />
        </div>
      ) : (
        <DialogFooter
          note={t('StaffEvaluationModal.approveAllSubmissionsAtOnceAnd')}
          secondary={<Button variant="outline" onClick={onClose} disabled={submitMutation.isPending}>{justEvaluated ? t('StaffEvaluationModal.close') : t('StaffEvaluationModal.cancel')}</Button>}
          primary={!justEvaluated && (
            <Button
              onClick={handleSubmit(data => submitMutation.mutate(data))}
              disabled={submitMutation.isPending || (submissionList.length === 0 && !periodEnded) || awaitingResubmission.length > 0}
              title={awaitingResubmission.length > 0
                ? t('StaffEvaluationModal.finalizeBlockedAwaitingResubmission', { count: awaitingResubmission.length })
                : undefined}
            >
              {submitMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              {t('StaffEvaluationModal.approveFinalizeEvaluation')}
            </Button>
          )}
        />
      )}
    >
      <DraftNotice draft={draft} className="mb-4" />
      {!readOnly && awaitingResubmission.length > 0 && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-foreground)]">
            {t('StaffEvaluationModal.finalizeBlockedAwaitingResubmission', { count: awaitingResubmission.length })}
          </p>
        </div>
      )}
      <div className="space-y-6">

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20">
            <Loader2 size={40} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium text-[var(--color-subtle-foreground)]">{t('StaffEvaluationModal.aggregatingKpiData')}</p>
          </div>
        ) : allSubmissions.length === 0 && !periodEnded ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-card border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)] py-20 text-center">
             <AlertCircle size={48} className="text-[var(--color-subtle-foreground)]" />
             <div className="space-y-1">
                <p className="text-lg font-semibold text-[var(--color-foreground)]">{t('StaffEvaluationModal.noSubmissionFound')}</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">{t('StaffEvaluationModal.thisEmployeeHasNoSubmissionsIn')} {periodName}{t('StaffEvaluationModal.youCanOnlyFinalizeTheEvaluation')}</p>
             </div>
          </div>
        ) : (
          <>
            {/* ── 1. Chỉ tiêu KPI ─────────────────────────────────────────────
                Bảng đọc + chấm từng KPI. Cột "chấm" dùng Select/Input chuẩn, ô chấm định lượng
                đứng cạnh điểm hệ thống để thấy mình đang nâng/hạ bao nhiêu. */}
            <Section
              title={t('StaffEvaluationModal.kpis2', { length: submissionList.length })}
              hint={submissionList.length > 0 ? t('StaffEvaluationModal.systemScoreScored', { totalAutoScore: formatNumber(totalAutoScore), totalManagerScore: formatNumber(totalManagerScore) }) : undefined}
            >
              {submissionList.length === 0 ? (
                <div className="flex items-start gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
                  <div className="text-sm text-[var(--color-warning)]">
                    <p className="font-semibold">{t('StaffEvaluationModal.theEmployeeDidNoWorkIn')}</p>
                    <p className="text-xs opacity-80">{t('StaffEvaluationModal.noSubmissionsThePeriodHasEnded')}</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
                  <div className="divide-y divide-[var(--color-border)] sm:hidden">
                    {submissionList.map(s => (
                      <div key={s.id} className="space-y-2 px-4 py-3">
                        {kpiCell(s)}
                        <div className="flex items-center justify-between gap-3">
                          {resultCell(s)}
                          <span className="flex items-center gap-1">
                            {!readOnly && scoreInputCell(s)}
                            {returnButton(s)}
                          </span>
                        </div>
                        {mobileScorers(s)}
                      </div>
                    ))}
                  </div>
                  {/* Desktop: Hệ thống · Quản lý · AI · Sếp. Cột của người đang chấm là ô nhập. */}
                  <table className="hidden w-full border-collapse sm:table">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)] align-top">
                        <th className="text-eyebrow px-4 py-2.5 text-left">{t('StaffEvaluationModal.kpi')}</th>
                        <th className="text-eyebrow px-3 py-2.5 text-center">{t('StaffEvaluationModal.resultTarget')}</th>
                        <th className="px-3 py-2.5 text-right">{columnHead(t('ScorerColumns.systemScored'), SCORER_COLORS.system)}</th>
                        <th className="px-3 py-2.5 text-right">{columnHead(t('ScorerColumns.managerScored'), SCORER_COLORS.manager, columnWho(managerColumn))}</th>
                        {aiAvailable && <th className="px-3 py-2.5 text-right">{columnHead(t('ScorerColumns.aiScored'), SCORER_COLORS.ai)}</th>}
                        <th className="px-3 py-2.5 text-right">{columnHead(t('ScorerColumns.bossScored'), SCORER_COLORS.boss, columnWho(bossColumn))}</th>
                        {canReturn && <th className="w-12 px-2 py-2.5"><span className="sr-only">{t('StaffEvaluationModal.returnForRework')}</span></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {submissionList.map(s => (
                        <tr key={s.id} className="group transition-colors hover:bg-[var(--color-muted)]">
                          <td className="px-4 py-3">{kpiCell(s)}</td>
                          <td className="px-3 py-3 text-center">{resultCell(s)}</td>
                          <td className="px-3 py-3 text-right">{systemScoreCell(s)}</td>
                          <td className="px-3 py-3"><div className="flex justify-end">{scorerCell(s, managerColumn)}</div></td>
                          {aiAvailable && <td className="px-3 py-3 text-right">{aiCell(s)}</td>}
                          <td className="px-3 py-3"><div className="flex justify-end">{bossColumn.kind === 'empty' ? <span className="text-sm text-[var(--color-subtle-foreground)]">-</span> : scorerCell(s, bossColumn)}</div></td>
                          {canReturn && <td className="px-2 py-3 text-right">{returnButton(s)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ── Bài nộp đã trả lại (hoàn duyệt) — lịch sử, không chấm ── */}
            {returnedList.length > 0 && (
              <Section title={t('StaffEvaluationModal.returnedSubmissions', { count: returnedList.length })}>
                <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
                  {returnedList.map(s => (
                    <li key={s.id} className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--color-foreground)]">{s.kpiCriteriaName}</span>
                        <span className="flex items-center gap-2">
                          {resultCell(s)}
                          <StatusBadge status="RETURNED" />
                          <Badge variant={s.awaitingResubmission ? 'warning' : s.resubmissionId ? 'success' : 'secondary'}>
                            {s.awaitingResubmission
                              ? t('StaffEvaluationModal.awaitingResubmission')
                              : s.resubmissionId ? t('StaffEvaluationModal.resubmitted') : t('StaffEvaluationModal.resubmitOverdue')}
                          </Badge>
                        </span>
                      </div>
                      {s.returnReason && <p className="text-sm text-[var(--color-foreground)]">“{s.returnReason}”</p>}
                      <p className="text-caption">
                        {t('StaffEvaluationModal.returnedBy', { name: s.returnedByName ?? '—', at: formatDateTime(s.returnedAt) })}
                        {s.resubmitDeadline && <> · {t('StaffEvaluationModal.resubmitBy', { deadline: formatDateTime(s.resubmitDeadline) })}</>}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* ── 2. Chấm điểm đợt ─────────────────────────────────────────────
                Cùng khuôn "nhãn | ô nhập" với phiếu chốt kỳ: điểm cuối, hạnh kiểm, rồi xếp loại
                là KẾT QUẢ ở hàng cuối. Thay cho tấm thẻ tím sticky chiếm nửa màn hình. */}
            <Section title={t('StaffEvaluationModal.scoreThePeriod')} hint={readOnly ? t('StaffEvaluationModal.youAreInViewOnlyMode') : undefined}>
              <div className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
                <ScoreRow
                  label={<>{t('StaffEvaluationModal.endOfPeriodScore')} {!readOnly && <span className="text-[var(--color-error)]">*</span>}</>}
                  hint={(isBscOfficial ? t('StaffEvaluationModal.lockedToTheOfficialBscScore')
                    : isFullQualitative ? t('StaffEvaluationModal.allQualitativeFixed', { SCORING_POOL })
                    : t('StaffEvaluationModal.scoredByKpi', { totalManagerScore: formatNumber(totalManagerScore) }))
                    + (bscNotApplied ? ` · ${t('StaffEvaluationModal.bscNotApplied')}` : '')}
                  trailing={!readOnly && !isBscOfficial && !isFullQualitative && finalScore !== totalManagerScore && (
                    <Button variant="ghost" size="sm" type="button" onClick={handleResetFinalScore} title={t('StaffEvaluationModal.useTheTotalOfScoresGiven')}>
                      <Zap aria-hidden="true" /> {t('StaffEvaluationModal.use')} {formatNumber(totalManagerScore)}
                    </Button>
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="number" min={0} max={scoreCeiling} step={0.5}
                      value={isBscOfficial || isFullQualitative ? formatNumber(effectiveFinalScore) : String(finalScore)}
                      readOnly={readOnly || isBscOfficial || isFullQualitative}
                      onChange={e => { hasManuallyAdjustedFinal.current = true; setFinalScore(Number(e.target.value)) }}
                      onWheel={e => e.currentTarget.blur()}
                      suffix={<span className="text-xs">/ {scoreCeiling}</span>}
                      className="w-32"
                      inputClassName="text-base font-semibold tabular-nums"
                    />
                    <span className="text-eyebrow text-[var(--color-primary)]">{getGrade(effectiveFinalScore)}</span>
                    {!isBscOfficial && !isFullQualitative && finalScore !== totalAutoScore && (
                      <span className={cn(
                        'text-eyebrow inline-flex items-center rounded-full px-2 py-0.5',
                        finalScore > totalAutoScore
                          ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                          : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                      )}>
                        {finalScore > totalAutoScore ? '+' : ''}{formatNumber(finalScore - totalAutoScore)} {t('StaffEvaluationModal.comparedWithTheSystem')}
                      </span>
                    )}
                    {(isBscOfficial || isFullQualitative) && (
                      <span className="text-caption inline-flex items-center gap-1"><Lock size={11} aria-hidden="true" /> {t('StaffEvaluationModal.notEditedManually')}</span>
                    )}
                    {firstErrorMessage(errors) && (
                      <span className="text-xs font-medium text-[var(--color-error)]">{firstErrorMessage(errors)}</span>
                    )}
                  </div>
                  {!readOnly && !isBscOfficial && !isFullQualitative && (
                    <div className="mt-3 max-w-xl px-2">
                      <input
                        type="range" min={0} max={scoreCeiling} step={1}
                        value={finalScore}
                        onChange={e => { hasManuallyAdjustedFinal.current = true; setFinalScore(Number(e.target.value)) }}
                        aria-label={t('StaffEvaluationModal.dragToChooseTheEndOf')}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-success-solid)]"
                      />
                      <div className="text-eyebrow mt-1.5 flex justify-between">
                        <span>0</span>
                        <span>{Math.round(scoreCeiling / 2)}</span>
                        <span>{scoreCeiling}{bonusScore > 0 && <span className="text-[var(--color-success)]"> (+{bonusScore} {t('StaffEvaluationModal.bonus')}</span>}</span>
                      </div>
                    </div>
                  )}
                  {isBscOfficial && (
                    <p className="text-caption mt-2 leading-relaxed">
                      {t('StaffEvaluationModal.bscScoreComputedFrom')} <b>{t('StaffEvaluationModal.actualResults')}</b> {t('StaffEvaluationModal.quantitativeAnd')} <b>{t('StaffEvaluationModal.levelsScored')}</b> {t('StaffEvaluationModal.qualitativeEditingAQuantitativeKpiScore')}
                    </p>
                  )}
                </ScoreRow>

                {showConduct && (
                  <ScoreRow label={t('StaffEvaluationModal.conduct')} hint={t('StaffEvaluationModal.periodScoringConductAxisWhenThere')}>
                    <ConductInlineSheet
                      ref={conductRef}
                      hideActions
                      onLiveScore={(total, max) => setConductLive({ total, max })}
                      target={{ scope: 'PERIOD', periodId, cycleId: null }}
                      userId={userId}
                    />
                  </ScoreRow>
                )}

                {(hasQualitative || showConduct) && !!org?.performanceMatrix && (
                  <ScoreRow label={t('StaffEvaluationModal.matrixRating')} hint={t('StaffEvaluationModal.conductCompletion')}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className={cn(
                        'text-2xl font-semibold leading-none tabular-nums',
                        matrixLive != null ? 'text-[var(--color-warning)]' : 'text-[var(--color-subtle-foreground)]'
                      )}>
                        {matrixLive ?? '—'}
                        {matrixLive != null && <span className="text-sm font-medium text-[var(--color-subtle-foreground)]">/5</span>}
                      </span>
                      <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
                        <AxisLine
                          label={t('StaffEvaluationModal.conduct2')}
                          value={behaviorLive != null ? `${formatNumber(behaviorLive)}/5` : null}
                          source={behaviorLive == null ? null : hasQualitative ? t('StaffEvaluationModal.qualitativeKpi') : t('StaffEvaluationModal.conduct3')}
                        />
                        <AxisLine
                          label={t('StaffEvaluationModal.completion')}
                          value={completionPercent != null ? `${formatNumber(completionPercent)}%` : null}
                          source={completionPercent == null ? null : isFullQualitative ? t('StaffEvaluationModal.conduct3') : t('StaffEvaluationModal.quantitativeKpis')}
                        />
                      </dl>
                      {matrixLive == null && (
                        <span className="text-caption basis-full">
                          {behaviorLive == null
                            ? t('StaffEvaluationModal.cannotRateYetMissingTheConduct', { value: hasQualitative ? t('StaffEvaluationModal.chooseLevelsForQualitativeKpis') : t('StaffEvaluationModal.scoreConductAbove') })
                            : t('StaffEvaluationModal.cannotRateYetMissingTheQuantitative')}
                        </span>
                      )}
                    </div>
                  </ScoreRow>
                )}
              </div>
            </Section>

            {/* ── 3. Nhận xét & minh chứng ───────────────────────────────────── */}
            <Section title={t('StaffEvaluationModal.commentsEvidence')}>
                {priorManagerEvals.length > 0 && (
                  <Collapsible label={t('StaffEvaluationModal.commentsFromTheLevelsThatScored')} count={priorManagerEvals.length} countLabel={t('StaffEvaluationModal.comments')}>
                    <ul className="space-y-3">
                      {priorManagerEvals.map(e => (
                        <li key={e.id} className="text-sm">
                          <p className={cn('whitespace-pre-wrap', !e.comment && 'italic text-[var(--color-subtle-foreground)]')}>
                            {e.comment || t('StaffEvaluationModal.noCommentsYet')}
                          </p>
                          <p className="text-caption mt-0.5">
                            {e.evaluatorRoleName || t('StaffEvaluationModal.manager')} · {e.evaluatorName}
                            {e.score != null && <> · {formatNumber(e.score)} {t('StaffEvaluationModal.points')}</>} · {formatDateTime(e.updatedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Collapsible>
                )}

                {(canScore && (!readOnly || myEval)) && (
                  <div className="space-y-2">
                    <label htmlFor="period-comment" className="text-label ml-1">
                      {t('StaffEvaluationModal.commentsFrom')} {userRoleName}
                      {!readOnly && priorManagerEvals.length > 0 && <span className="text-caption ml-1">{t('StaffEvaluationModal.yourOwn')}</span>}
                    </label>
                    <Textarea
                      id="period-comment"
                      {...register('overallComment')}
                      rows={3}
                      disabled={readOnly}
                      placeholder={readOnly ? t('StaffEvaluationModal.noCommentsYet2') : t('StaffEvaluationModal.overallAssessmentOfAttitudeEffortAnd')}
                    />
                  </div>
                )}

                <EvidenceAttachments target={evidenceKey.period(periodId, userId)} readOnly={readOnly} title={t('StaffEvaluationModal.periodScoringEvidence')} />
            </Section>
          </>
        )}

      </div>
    </Dialog>

      {/* Đã duyệt hết KPI con → hỏi tự đánh giá */}
      <Dialog
        open={showAllApproved}
        onClose={() => { setShowAllApproved(false); onClose() }}
        size="sm"
        title={t('StaffEvaluationModal.scoringCompleted')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => { setShowAllApproved(false); onClose() }}>{t('StaffEvaluationModal.later')}</Button>}
            primary={<Button onClick={() => { setShowAllApproved(false); setShowEvalForm(true) }}>{t('StaffEvaluationModal.selfAssessNow')}</Button>}
          />
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-success-bg)]">
            <CheckCircle size={18} className="text-[var(--color-success)]" aria-hidden="true" />
          </span>
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('StaffEvaluationModal.youHaveApprovedAllAssignedKpis')}</p>
        </div>
      </Dialog>

      {aiReview && aiDetailFor && aiDetailItem && (
        <AiReviewDetailDialog
          open
          onClose={() => setAiDetailFor(null)}
          item={aiDetailItem}
          review={aiReview}
          onRescore={() => { askAiFor([aiDetailFor.kpiCriteriaId], true); setAiDetailFor(null) }}
          rescoring={aiRowRunning(aiDetailFor)}
        />
      )}

      {returnTarget && (
        <ReturnSubmissionDialog
          submission={returnTarget}
          userName={userName}
          onClose={() => setReturnTarget(null)}
        />
      )}

      {/* Form tự đánh giá */}
      <EvaluationFormModal
        open={showEvalForm}
        onClose={() => { setShowEvalForm(false); onClose() }}
        initialPeriodId={periodId}
      />
    </>
  )
}

/** Mặc định hạn nộp lại: 3 ngày nữa, 17:00 — đủ để nhân viên làm lại trong giờ làm việc. */
function defaultResubmitDeadline(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return `${format(d, 'yyyy-MM-dd')}T17:00`
}

/**
 * Hoàn duyệt một bài nộp: bắt buộc lý do và hạn nộp lại. Bài cũ thành lịch sử, nhân viên nhận
 * thông báo và nộp bài mới trước hạn (kể cả khi đợt đã hết hạn).
 */
function ReturnSubmissionDialog({ submission, userName, onClose }: {
  submission: Submission
  userName: string
  onClose: () => void
}) {
  const { t } = useTranslation('submissions')
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [deadline, setDeadline] = useState(defaultResubmitDeadline)

  const deadlineDate = deadline ? new Date(deadline) : null
  const deadlineValid = !!deadlineDate && !Number.isNaN(deadlineDate.getTime())

  const mutation = useMutation({
    mutationFn: () => submissionApi.returnSubmission(submission.id, {
      reason: reason.trim(),
      resubmitDeadline: deadlineDate!.toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      toast.success(t('StaffEvaluationModal.submissionReturned'))
      onClose()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('StaffEvaluationModal.failedToReturnSubmission'))),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!mutation.isPending}
      title={t('StaffEvaluationModal.returnSubmissionTitle')}
      description={t('StaffEvaluationModal.returnSubmissionDescription', { kpiName: submission.kpiCriteriaName, userName })}
      footer={
        <DialogFooter
          note={t('StaffEvaluationModal.returnSubmissionNote')}
          secondary={<Button variant="outline" onClick={onClose} disabled={mutation.isPending}>{t('StaffEvaluationModal.cancel')}</Button>}
          primary={
            <Button
              onClick={() => {
                // Kiểm "ở tương lai" lúc bấm (BE cũng kiểm) — không tính trong lúc render.
                if (deadlineDate && deadlineDate.getTime() <= Date.now()) {
                  toast.error(t('StaffEvaluationModal.resubmitDeadlineMustBeFuture'))
                  return
                }
                mutation.mutate()
              }}
              disabled={mutation.isPending || !reason.trim() || !deadlineValid}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
              {t('StaffEvaluationModal.returnConfirm')}
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="return-reason" className="text-label mb-1.5 block">
            {t('StaffEvaluationModal.returnReason')} <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
          </label>
          <Textarea
            id="return-reason"
            rows={3}
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('StaffEvaluationModal.returnReasonPlaceholder')}
          />
        </div>
        <div>
          <p className="text-label mb-1.5">
            {t('StaffEvaluationModal.resubmitDeadline')} <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
          </p>
          <DateTimePicker value={deadline} onChange={setDeadline} />
          <p className="text-caption mt-1">{t('StaffEvaluationModal.resubmitDeadlineHint')}</p>
        </div>
      </div>
    </Dialog>
  )
}
