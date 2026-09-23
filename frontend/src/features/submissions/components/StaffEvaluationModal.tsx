import { useState, useMemo, useEffect, useRef } from 'react'
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
  AlertCircle, Lock
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Section, ScoreRow, AxisLine, Collapsible } from '@/components/common/ScoreForm'
import type { Submission } from '@/types/submission'
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
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreLabel, maxScore } = getScoringFunctions(org)
  const canPromptReward = useCanPromptReward()
  const qualitativeLevels = [...(org?.qualitativeLevels ?? [])].sort((a, b) => a.position - b.position)
  const userRoleName = user?.memberships?.[0]?.roleName || 'Quản lý'
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

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<StaffEvaluationFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      individualScores: {}, individualLevels: {},
      overallComment: '', finalScore: 0,
    },
  })

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
  // KPI thưởng nằm ngoài pool 100% nên điểm của nó cộng THÊM lên trên thang điểm — trần thật
  // lấy từ backend để khớp đúng giới hạn mà createEvaluation kiểm tra khi lưu.
  const scoreCeiling = scorePreview?.maxAllowedScore ?? maxScore
  scoreCeilingRef.current = scoreCeiling
  const bonusScore = scorePreview?.bonusScore ?? 0

  const submissionList = submissions?.content ?? []
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
          commonReview: { status: 'APPROVED', reviewNote: 'Phê duyệt tổng hợp qua bảng đánh giá' },
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
        comment: data.overallComment || `${userRoleName} đánh giá kết quả đợt ${periodName}`
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
        toast.success('Đã hoàn tất đánh giá và phê duyệt cho nhân viên')
        setShowAllApproved(true)
      } else {
        // Chốt xong mới mời thưởng, ngay tại đây — đây là lúc người chấm còn nhớ rõ
        // nhất vì sao nhân viên xứng đáng. Tổ chức tắt thưởng hoặc người chấm không có
        // quyền trao thì RewardPrompt ẩn và không bao giờ gọi onDone ⇒ phải tự đóng,
        // không thì modal đứng im sau khi chốt.
        toast.success('Đã chốt đánh giá cho nhân viên')
        if (canPromptReward) setJustEvaluated(true)
        else onClose()
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Lưu đánh giá thất bại'))
    }
  })

  const [justEvaluated, setJustEvaluated] = useState(false)
  const [showAllApproved, setShowAllApproved] = useState(false)
  const [showEvalForm, setShowEvalForm] = useState(false)

  const isFullyApproved = useMemo(() => 
    submissionList.length > 0 && submissionList.every(s => s.status === 'APPROVED'),
  [submissionList])
  const canScore = isFullyApproved || !readOnly

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
          <span>Trọng số {s.weight}%</span>
          <AttachmentChips files={s.attachments} />
        </p>
        {s.note && <p className="text-caption mt-0.5 line-clamp-1 italic group-hover:line-clamp-none" title={s.note}>“{s.note}”</p>}
      </div>
    </div>
  )
  const resultCell = (s: Submission) => s.kpiType === 'QUALITATIVE' ? (
    <span className="text-eyebrow inline-flex items-center gap-1 rounded-control border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 py-1 text-[var(--color-info)]">
      ★ {s.qualitativeLevelName ?? 'Tự đánh giá'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1 text-xs tabular-nums">
      <b className="text-[var(--color-foreground)]">{formatNumber(s.actualValue)}</b>
      <span className="text-caption">/ {s.targetValue != null ? formatNumber(s.targetValue) : '—'}</span>
    </span>
  )
  const systemScoreCell = (s: Submission) => (
    <span className="text-sm tabular-nums text-[var(--color-muted-foreground)]">
      {s.kpiType === 'QUALITATIVE' ? '—' : formatNumber(Math.round((s.autoScore ?? 0) * normFactor))}
    </span>
  )
  const scoreInputCell = (s: Submission) => s.kpiType === 'QUALITATIVE' ? (
    <Select
      value={individualLevels[s.id] ?? ''}
      onValueChange={v => setIndividualLevels({ ...individualLevels, [s.id]: v })}
      disabled={readOnly}
    >
      <SelectTrigger className="w-44" aria-label="Mức định tính">
        <SelectValue placeholder="— Chọn mức —" />
      </SelectTrigger>
      <SelectContent>
        {qualitativeLevels.filter(l => !!l.id).map(l => (
          <SelectItem key={l.id} value={l.id as string}>{l.name} ({formatNumber(l.value)}đ)</SelectItem>
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
      aria-label={`Điểm ${s.kpiCriteriaName}`}
      className="w-24"
      inputClassName="text-right font-semibold tabular-nums text-[var(--color-primary)]"
    />
  )

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      dismissible={!submitMutation.isPending}
      title={<>Đánh giá tổng hợp: <span className="text-[var(--color-primary)]">{userName}</span></>}
      description={<>Kỳ đánh giá: <span className="font-medium text-[var(--color-foreground)]">{periodName}</span> · {submissionList.length} chỉ tiêu KPI</>}
      headerExtra={isFullyApproved
        ? <Badge variant="success">Đã phê duyệt</Badge>
        : <Badge variant="warning">Đang chờ chấm điểm</Badge>}
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
            defaultReason={`Kết quả tốt trong đợt${periodName ? ` ${periodName}` : ''}`}
            onDone={onClose}
          />
        </div>
      ) : (
        <DialogFooter
          note="Phê duyệt đồng loạt các bài nộp và lưu kết quả đánh giá chính thức vào hồ sơ nhân sự."
          secondary={<Button variant="outline" onClick={onClose} disabled={submitMutation.isPending}>{justEvaluated ? 'Đóng' : 'Hủy bỏ'}</Button>}
          primary={!justEvaluated && (
            <Button
              onClick={handleSubmit(data => submitMutation.mutate(data))}
              disabled={submitMutation.isPending || (submissionList.length === 0 && !periodEnded)}
            >
              {submitMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              Phê duyệt & chốt đánh giá
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-6">

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20">
            <Loader2 size={40} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium text-[var(--color-subtle-foreground)]">Đang tổng hợp dữ liệu KPI...</p>
          </div>
        ) : submissionList.length === 0 && !periodEnded ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-card border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)] py-20 text-center">
             <AlertCircle size={48} className="text-[var(--color-subtle-foreground)]" />
             <div className="space-y-1">
                <p className="text-lg font-semibold text-[var(--color-foreground)]">Không tìm thấy bài nộp</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">Nhân viên này chưa có bài nộp nào trong đợt {periodName}. Bạn chỉ có thể chốt đánh giá sau khi đợt kết thúc.</p>
             </div>
          </div>
        ) : (
          <>
            {/* ── 1. Chỉ tiêu KPI ─────────────────────────────────────────────
                Bảng đọc + chấm từng KPI. Cột "chấm" dùng Select/Input chuẩn, ô chấm định lượng
                đứng cạnh điểm hệ thống để thấy mình đang nâng/hạ bao nhiêu. */}
            <Section
              title={`Chỉ tiêu KPI · ${submissionList.length}`}
              hint={submissionList.length > 0 ? `Điểm hệ thống ${formatNumber(totalAutoScore)} · đã chấm ${formatNumber(totalManagerScore)}` : undefined}
            >
              {submissionList.length === 0 ? (
                <div className="flex items-start gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
                  <div className="text-sm text-[var(--color-warning)]">
                    <p className="font-semibold">Nhân viên chưa làm trong đợt này</p>
                    <p className="text-xs opacity-80">Không có bài nộp nào. Đợt đã kết thúc nên vẫn chốt được — điểm mặc định 0, chỉnh nếu cần.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
                  {/* Mobile */}
                  <div className="divide-y divide-[var(--color-border)] sm:hidden">
                    {submissionList.map(s => (
                      <div key={s.id} className="space-y-2 px-4 py-3">
                        {kpiCell(s)}
                        <div className="flex items-center justify-between gap-3">
                          {resultCell(s)}
                          {canScore ? scoreInputCell(s) : systemScoreCell(s)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop */}
                  <table className="hidden w-full border-collapse sm:table">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                        <th className="text-eyebrow px-4 py-2.5 text-left">Chỉ tiêu KPI</th>
                        <th className="text-eyebrow px-4 py-2.5 text-center">Kết quả / Mục tiêu</th>
                        <th className="text-eyebrow px-4 py-2.5 text-right">Điểm hệ thống</th>
                        {canScore && <th className="text-eyebrow px-4 py-2.5 text-right text-[var(--color-primary)]">{userRoleName} chấm</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {submissionList.map(s => (
                        <tr key={s.id} className="group transition-colors hover:bg-[var(--color-muted)]">
                          <td className="px-4 py-3">{kpiCell(s)}</td>
                          <td className="px-4 py-3 text-center">{resultCell(s)}</td>
                          <td className="px-4 py-3 text-right">{systemScoreCell(s)}</td>
                          {canScore && <td className="px-4 py-3"><div className="flex justify-end">{scoreInputCell(s)}</div></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ── 2. Chấm điểm đợt ─────────────────────────────────────────────
                Cùng khuôn "nhãn | ô nhập" với phiếu chốt kỳ: điểm cuối, hạnh kiểm, rồi xếp loại
                là KẾT QUẢ ở hàng cuối. Thay cho tấm thẻ tím sticky chiếm nửa màn hình. */}
            <Section title="Chấm điểm đợt" hint={readOnly ? 'Bạn đang ở chế độ chỉ xem' : undefined}>
              <div className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
                <ScoreRow
                  label={<>Điểm cuối đợt {!readOnly && <span className="text-[var(--color-error)]">*</span>}</>}
                  hint={isBscOfficial ? 'Khoá theo điểm BSC chính thức'
                    : isFullQualitative ? `Toàn định tính · cố định ${SCORING_POOL}`
                    : `Đã chấm theo chỉ tiêu: ${formatNumber(totalManagerScore)}`}
                  trailing={!readOnly && !isBscOfficial && !isFullQualitative && finalScore !== totalManagerScore && (
                    <Button variant="ghost" size="sm" type="button" onClick={handleResetFinalScore} title="Lấy tổng điểm đã chấm theo chỉ tiêu">
                      <Zap aria-hidden="true" /> Dùng {formatNumber(totalManagerScore)}
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
                        {finalScore > totalAutoScore ? '+' : ''}{formatNumber(finalScore - totalAutoScore)} so với hệ thống
                      </span>
                    )}
                    {(isBscOfficial || isFullQualitative) && (
                      <span className="text-caption inline-flex items-center gap-1"><Lock size={11} aria-hidden="true" /> không sửa tay</span>
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
                        aria-label="Kéo để chọn điểm cuối đợt"
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-success-solid)]"
                      />
                      <div className="text-eyebrow mt-1.5 flex justify-between">
                        <span>0</span>
                        <span>{Math.round(scoreCeiling / 2)}</span>
                        <span>{scoreCeiling}{bonusScore > 0 && <span className="text-[var(--color-success)]"> (+{bonusScore} thưởng)</span>}</span>
                      </div>
                    </div>
                  )}
                  {isBscOfficial && (
                    <p className="text-caption mt-2 leading-relaxed">
                      Điểm BSC tính từ <b>kết quả thực đạt</b> (định lượng) và <b>mức được chấm</b> (định tính) — sửa ô chấm
                      KPI định lượng không đổi điểm này, đổi mức KPI định tính thì có.
                    </p>
                  )}
                </ScoreRow>

                {showConduct && (
                  <ScoreRow label="Hạnh kiểm" hint="Chấm theo đợt · trục hành vi khi không có KPI định tính">
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
                  <ScoreRow label="Xếp loại ma trận" hint="Hành vi × % hoàn thành">
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
                          label="Hành vi"
                          value={behaviorLive != null ? `${formatNumber(behaviorLive)}/5` : null}
                          source={behaviorLive == null ? null : hasQualitative ? 'KPI định tính' : 'hạnh kiểm'}
                        />
                        <AxisLine
                          label="% hoàn thành"
                          value={completionPercent != null ? `${formatNumber(completionPercent)}%` : null}
                          source={completionPercent == null ? null : isFullQualitative ? 'hạnh kiểm' : 'KPI định lượng'}
                        />
                      </dl>
                      {matrixLive == null && (
                        <span className="text-caption basis-full">
                          {behaviorLive == null
                            ? `Chưa xếp loại được: thiếu điểm hành vi (${hasQualitative ? 'chọn mức cho KPI định tính' : 'chấm hạnh kiểm ở trên'}).`
                            : 'Chưa xếp loại được: thiếu % hoàn thành KPI định lượng.'}
                        </span>
                      )}
                    </div>
                  </ScoreRow>
                )}
              </div>
            </Section>

            {/* ── 3. Nhận xét & minh chứng ───────────────────────────────────── */}
            <Section title="Nhận xét & minh chứng">
                {priorManagerEvals.length > 0 && (
                  <Collapsible label="Nhận xét của các cấp đã chấm" count={priorManagerEvals.length} countLabel="nhận xét">
                    <ul className="space-y-3">
                      {priorManagerEvals.map(e => (
                        <li key={e.id} className="text-sm">
                          <p className={cn('whitespace-pre-wrap', !e.comment && 'italic text-[var(--color-subtle-foreground)]')}>
                            {e.comment || 'Chưa có nhận xét'}
                          </p>
                          <p className="text-caption mt-0.5">
                            {e.evaluatorRoleName || 'Quản lý'} · {e.evaluatorName}
                            {e.score != null && <> · {formatNumber(e.score)} điểm</>} · {formatDateTime(e.updatedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Collapsible>
                )}

                {(canScore && (!readOnly || myEval)) && (
                  <div className="space-y-2">
                    <label htmlFor="period-comment" className="text-label ml-1">
                      Nhận xét của {userRoleName}
                      {!readOnly && priorManagerEvals.length > 0 && <span className="text-caption ml-1">(riêng của bạn)</span>}
                    </label>
                    <Textarea
                      id="period-comment"
                      {...register('overallComment')}
                      rows={3}
                      disabled={readOnly}
                      placeholder={readOnly ? 'Chưa có nhận xét nào…' : 'Đánh giá tổng quát thái độ, nỗ lực và kết quả làm việc trong đợt này…'}
                    />
                  </div>
                )}

                <EvidenceAttachments target={evidenceKey.period(periodId, userId)} readOnly={readOnly} title="Minh chứng chấm đợt" />
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
        title="Đã chấm xong"
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => { setShowAllApproved(false); onClose() }}>Để sau</Button>}
            primary={<Button onClick={() => { setShowAllApproved(false); setShowEvalForm(true) }}>Tự đánh giá ngay</Button>}
          />
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-success-bg)]">
            <CheckCircle size={18} className="text-[var(--color-success)]" aria-hidden="true" />
          </span>
          <p className="text-sm text-[var(--color-muted-foreground)]">Bạn đã duyệt hết KPI đã giao. Bạn có muốn tự đánh giá luôn không?</p>
        </div>
      </Dialog>

      {/* Form tự đánh giá */}
      <EvaluationFormModal
        open={showEvalForm}
        onClose={() => { setShowEvalForm(false); onClose() }}
        initialPeriodId={periodId}
      />
    </>
  )
}
