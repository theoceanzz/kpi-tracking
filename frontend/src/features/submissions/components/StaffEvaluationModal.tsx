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
  Loader2, CheckCircle, Target, TrendingUp,
  MessageSquare, Award, Zap,
  AlertCircle, Paperclip, ExternalLink, Lock
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import EvidenceAttachments from '@/features/evidence/EvidenceAttachments'
import { evidenceKey } from '@/features/evidence/evidenceApi'
import { Badge } from '@/components/ui/badge'

import { useAuthStore } from '@/store/authStore'
import { formatNumber, cn } from '@/lib/utils'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

import { getScoringFunctions, SCORING_POOL } from '@/lib/scoring'
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
  evaluationComment?: string
  periodEnded?: boolean
}
/**
 * Chỉ số dải cho một giá trị theo nhãn dải tăng dần (VD "<2", "≥2 và <3", "≥120%").
 * Lấy số lớn nhất trong nhãn làm cận trên, dải cuối bắt hết phần còn lại —
 * khớp đúng bandIndex() ở EvaluationService phía backend.
 */
function bandIndex(value: number, bands: string[]): number {
  for (let i = 0; i < bands.length; i++) {
    if (i === bands.length - 1) return i
    const nums = String(bands[i]).match(/[0-9]+(?:\.[0-9]+)?/g)
    if (!nums?.length) continue
    const upper = Math.max(...nums.map(Number))
    if (value < upper) return i
  }
  return bands.length - 1
}

/** Tra ma trận hiệu suất của tổ chức: (điểm hành vi) × (% hoàn thành định lượng) → xếp loại 1..5. */
function lookupMatrixRating(
  behavior: number | null, completion: number | null, matrixJson?: string | null,
): number | null {
  if (behavior == null || completion == null || !matrixJson) return null
  try {
    const m = JSON.parse(matrixJson)
    if (!m?.rows || !m?.cols || !m?.cells) return null
    const r = bandIndex(behavior, m.rows)
    const c = bandIndex(completion, m.cols)
    return m.cells?.[r]?.[c] ?? null
  } catch {
    return null
  }
}

export default function StaffEvaluationModal({
  open, onClose, userId, userName, periodId, periodName, readOnly = false, evaluationComment, periodEnded = false
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
      overallComment: evaluationComment || '', finalScore: 0,
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

  // Fetch existing evaluation if any
  const { data: existingEval } = useQuery({
    queryKey: ['evaluations', 'staff-eval', userId, periodId],
    queryFn: () => evaluationApi.getAll({ userId, kpiPeriodId: periodId, size: 1 }),
    enabled: open
  })

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
  const conductAsBehavior = !hasQualitative && conductLive?.total != null && conductLive.max > 0
    ? Math.round(conductLive.total / conductLive.max * 5 * 100) / 100
    : null
  const conductAsCompletion = isFullQualitative && conductLive?.total != null && conductLive.max > 0
    ? Math.round(conductLive.total / conductLive.max * 100 * 100) / 100
    : null

  const behaviorLive = useMemo(() => {
    if (!hasQualitative) return conductAsBehavior ?? scorePreview?.behaviorScore ?? null
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
  }, [submissionList, individualLevels, qualitativeLevels, hasQualitative, conductAsBehavior, scorePreview?.behaviorScore])

  // Trục cột của ma trận: % hoàn thành định lượng (không đổi theo thao tác chấm tay).
  // Không có KPI định lượng ⇒ TRỐNG, và ma trận không xếp loại. Một loại KPI chỉ cấp được
  // một trục; muốn đủ hai trục thì tổ chức phải bật chấm hạnh kiểm — khi đó server đã trả
  // sẵn trục cột đã quy đổi trong kpiCompletionPercent.
  const completionPercent = conductAsCompletion ?? scorePreview?.kpiCompletionPercent ?? null

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

  // Initialize comment and final score from existing evaluation
  useEffect(() => {
    const evalData = existingEval?.content?.[0]
    if (evalData?.comment) {
      setValue('overallComment', evalData.comment)
    } else if (evaluationComment) {
      setValue('overallComment', evaluationComment)
    }
    if (evalData?.score != null) {
      setFinalScore(evalData.score)
      hasManuallyAdjustedFinal.current = true
    }
  }, [existingEval, evaluationComment, setValue])

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

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      flush
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
      <div className="space-y-6 p-5">

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 size={40} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium text-[var(--color-subtle-foreground)]">Đang tổng hợp dữ liệu KPI...</p>
          </div>
        ) : submissionList.length === 0 && !periodEnded ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-[var(--color-muted)] rounded-card border-2 border-dashed border-[var(--color-border)]">
             <AlertCircle size={48} className="text-[var(--color-subtle-foreground)]" />
             <div className="space-y-1">
                <p className="text-lg font-semibold text-[var(--color-foreground)]">Không tìm thấy bài nộp</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">Nhân viên này chưa có bài nộp nào trong đợt {periodName}. Bạn chỉ có thể chốt đánh giá sau khi đợt kết thúc.</p>
             </div>
          </div>
        ) : (
          <>
            {/* "Chưa làm" banner — staff member has no submissions and the period has ended */}
            {submissionList.length === 0 && (
              <div className="flex items-center gap-4 p-5 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
                <div className="w-12 h-12 rounded-card bg-[var(--color-warning-solid)] text-white flex items-center justify-center shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-warning)]">Nhân viên chưa làm trong đợt này</p>
                  <p className="text-xs font-medium text-[var(--color-warning)] opacity-80">
                    Không có bài nộp nào. Đợt đã kết thúc nên bạn có thể chốt đánh giá — điểm mặc định là 0, có thể điều chỉnh nếu cần.
                  </p>
                </div>
              </div>
            )}

            {/* KPI List — Mobile: cards, Desktop: table */}
            {submissionList.length > 0 && (
            <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">

              {/* Mobile card layout (hidden on sm+) */}
              <div className="sm:hidden divide-y divide-[var(--color-border)]">
                {submissionList.map((s) => (
                  <div key={s.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-card bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)] shrink-0 mt-0.5">
                        <Target size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-foreground)] leading-tight">{s.kpiCriteriaName}</p>
                        <p className="text-eyebrow mt-0.5">Trọng số: {s.weight}%</p>
                        {s.note && (
                          <p className="text-caption font-medium mt-1 italic">"{s.note}"</p>
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
                                className="text-eyebrow inline-flex items-center gap-1 px-2 py-0.5 rounded-control bg-[var(--color-muted)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)] transition-all"
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
                        <p className="text-eyebrow">{s.kpiType === 'QUALITATIVE' ? 'Tự đánh giá' : 'Kết quả / Mục tiêu'}</p>
                        {s.kpiType === 'QUALITATIVE' ? (
                          <span className="text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info)]">★ {s.qualitativeLevelName ?? '—'}</span>
                        ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)]">
                          <span className="text-xs font-semibold text-[var(--color-foreground)]">{formatNumber(s.actualValue)}</span>
                          <span className="text-caption">/</span>
                          <span className="text-caption">{s.targetValue != null ? formatNumber(s.targetValue) :'—'}</span>
                        </div>
                        )}
                      </div>
                      {(isFullyApproved || !readOnly) ? (
                        <div className="space-y-1">
                          <p className="text-eyebrow text-[var(--color-primary)] text-right">{userRoleName} chấm</p>
                          {s.kpiType === 'QUALITATIVE' ? (
                            <select
                              value={individualLevels[s.id] ?? ''}
                              onChange={e => setIndividualLevels({ ...individualLevels, [s.id]: e.target.value })}
                              disabled={readOnly}
                              className={cn(
                                "w-36 px-2 py-2 rounded-card text-xs font-medium outline-none transition-all",
                                readOnly
                                  ? "bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] cursor-not-allowed"
                                  : "bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info)] focus:ring-2 focus:ring-[var(--color-info-solid)]"
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
                            onChange={e => setIndividualScores({ ...individualScores, [s.id]: Number(e.target.value) })}
                            onWheel={(e) => e.currentTarget.blur()}
                            disabled={readOnly}
                            className={cn(
                              "w-20 px-3 py-2 rounded-card text-right text-sm font-semibold outline-none transition-all",
                              readOnly
                                ? "bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] cursor-not-allowed"
                                : "bg-[var(--color-primary-soft)] border border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                            )}
                          />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1 text-right">
                          <p className="text-eyebrow">Điểm hệ thống</p>
                          <span className="text-sm font-medium text-[var(--color-subtle-foreground)]">{s.kpiType === 'QUALITATIVE' ? '—' : formatNumber(Math.round((s.autoScore ?? 0) * normFactor))}</span>
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
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="text-eyebrow px-6 py-4 text-left">Chỉ tiêu KPI</th>
                      <th className="text-eyebrow px-6 py-4 text-center">Kết quả / Mục tiêu</th>
                      <th className="text-eyebrow px-6 py-4 text-right">Điểm hệ thống</th>
                      {(isFullyApproved || !readOnly) && (
                        <th className="text-eyebrow px-6 py-4 text-[var(--color-primary)] text-right">{userRoleName} chấm</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {submissionList.map((s) => (
                      <tr key={s.id} className="hover:bg-[var(--color-muted)] transition-all group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-card bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)] group-hover:text-[var(--color-primary)] transition-colors">
                              <Target size={14} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--color-foreground)]">{s.kpiCriteriaName}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <p className="text-eyebrow">Trọng số: {s.weight}%</p>
                                {s.attachments && s.attachments.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-caption">•</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {s.attachments.map(att => (
                                        <a
                                          key={att.id}
                                          href={att.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={att.fileName}
                                          className="text-eyebrow inline-flex items-center gap-1 px-2 py-0.5 rounded-control bg-[var(--color-muted)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)] transition-all"
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
                                <p className="text-caption font-medium mt-1 italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                  " {s.note} "
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          {s.kpiType === 'QUALITATIVE' ? (
                            <span className="text-eyebrow inline-flex items-center gap-1 px-3 py-1.5 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info)]">
                              ★ {s.qualitativeLevelName ?? 'Tự đánh giá'}
                            </span>
                          ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
                            <span className="text-xs font-semibold text-[var(--color-foreground)]">{formatNumber(s.actualValue)}</span>
                            <span className="text-caption">/</span>
                            <span className="text-caption">{s.targetValue != null ? formatNumber(s.targetValue) :'—'}</span>
                          </div>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-medium text-[var(--color-subtle-foreground)]">{s.kpiType === 'QUALITATIVE' ? '—' : formatNumber(Math.round((s.autoScore ?? 0) * normFactor))}</span>
                        </td>
                        {(isFullyApproved || !readOnly) && (
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end">
                              {s.kpiType === 'QUALITATIVE' ? (
                                <select
                                  value={individualLevels[s.id] ?? ''}
                                  onChange={e => setIndividualLevels({ ...individualLevels, [s.id]: e.target.value })}
                                  disabled={readOnly}
                                  className={cn(
                                    "w-44 px-3 py-2 rounded-card text-sm font-medium outline-none transition-all",
                                    readOnly
                                      ? "bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] cursor-not-allowed"
                                      : "bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info)] focus:ring-2 focus:ring-[var(--color-info-solid)]"
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
                                  onChange={e => setIndividualScores({ ...individualScores, [s.id]: Number(e.target.value) })}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  disabled={readOnly}
                                  className={cn(
                                    "w-full px-3 py-2 rounded-card text-right text-sm font-semibold outline-none transition-all",
                                    readOnly
                                      ? "bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] cursor-not-allowed"
                                      : "bg-[var(--color-primary-soft)] border border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
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

            {/* Cột trái = việc phải làm (chấm hạnh kiểm, viết nhận xét), cột phải = kết quả.
                Trước đây phiếu hạnh kiểm rơi xuống dưới cùng, tách hẳn khỏi thẻ xếp loại mà
                chính nó nuôi, còn cạnh thẻ xếp loại thì trống một mảng vì ô nhận xét quá ngắn. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {(isFullyApproved || !readOnly || showConduct) && (
                <div className="lg:col-span-7 space-y-6">
                  {showConduct && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-eyebrow">
                          Hạnh kiểm của đợt
                        </span>
                        <span className="flex-1 h-px bg-[var(--color-muted)]"/>
                      </div>

                      {/* Trục "Hành vi" của ma trận đang trống mà nguồn duy nhất lấp nó là hạnh
                          kiểm ⇒ nói thẳng, thay vì để người chấm nhìn "Hành vi —/5" rồi tự đoán. */}
                      {!readOnly && !hasQualitative && behaviorLive == null && !!org?.performanceMatrix && (
                        <div className="flex items-start gap-2.5 p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
                          <AlertCircle size={14} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                          <p className="text-xs font-medium text-[var(--color-warning)] leading-relaxed">
                            Chưa chấm hạnh kiểm nên trục <b>Hành vi</b> của ma trận còn trống — chưa ra được
                            xếp loại. Chấm phiếu dưới đây là xếp loại bên cạnh tự cập nhật.
                          </p>
                        </div>
                      )}

                      <ConductInlineSheet
                        ref={conductRef}
                        hideActions
                        onLiveScore={(total, max) => setConductLive({ total, max })}
                        target={{ scope: 'PERIOD', periodId, cycleId: null }}
                        userId={userId}
                      />
                    </div>
                  )}

                  {(isFullyApproved || !readOnly) && (
                    <div className="space-y-4">
                      <label className="text-label flex items-center gap-2 tracking-widest">
                        <MessageSquare size={14} /> Nhận xét chung của {userRoleName}
                      </label>
                      <textarea
                        {...register('overallComment')}
                        rows={4}
                        disabled={readOnly}
                        className={cn(
"w-full px-6 py-5 rounded-card border text-sm font-medium resize-none transition-all",
                          readOnly
                            ? "bg-[var(--color-muted)] border-[var(--color-border)] cursor-not-allowed"
                            :"border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-ring)] outline-none"
                        )}
                        placeholder={readOnly ? "Chưa có nhận xét nào..." : "Đánh giá tổng quát thái độ, nỗ lực và kết quả làm việc của nhân sự trong đợt này..."}
                      />
                    </div>
                  )}
                  {/* Minh chứng của lượt chấm đợt: người chấm đính kèm, nhân viên xem lại được. Tệp gắn vào
                      (đợt, người) nên đính kèm được cả trước khi bấm chốt. */}
                  <EvidenceAttachments target={evidenceKey.period(periodId, userId)} readOnly={readOnly} title="Minh chứng chấm đợt" />
                </div>
              )}

              {/* Dính đầu khung cuộn: chấm hạnh kiểm ở cột trái mà vẫn thấy xếp loại đổi
                  theo, không phải cuộn lên xuống để đối chiếu. */}
              <div className={cn(
                "lg:col-span-5 lg:sticky lg:top-2",
                !(isFullyApproved || !readOnly || showConduct) && "lg:col-span-12"
              )}>
                 <div className="p-8 rounded-card bg-[var(--color-primary)] text-[var(--color-primary-foreground)] space-y-6 relative overflow-hidden group">
                    <div className="absolute -bottom-10 -right-10 opacity-10 transition-transform duration-700">
                       <TrendingUp size={200} />
                    </div>

                    <div className="space-y-1 relative z-10 flex items-start justify-between">
                       <div>
                          <p className="text-eyebrow text-[var(--color-primary-foreground)]">Kết quả đánh giá cuối cùng</p>
                          {matrixLive != null ? (
                            <>
                              <div className="flex items-baseline gap-2">
                                 <h3 className="text-section-title text-6xl tracking-tighter">{matrixLive}</h3>
                                 <span className="text-lg font-semibold opacity-60">/5</span>
                              </div>
                              {/* Thanh 5 nấc: nhìn phát biết đang ở mức nào, khỏi phải đoán 4/5 là cao hay thấp */}
                              <div className="flex items-center gap-1 mt-2">
                                 {[1, 2, 3, 4, 5].map(i => (
                                   <span key={i} className={cn(
                                     "h-1.5 w-6 rounded-full transition-colors",
                                     i <= matrixLive ? "bg-white" : "bg-white/25"
                                   )} />
                                 ))}
                              </div>
                              <p className="text-eyebrow text-[var(--color-primary-foreground)]/70 mt-2">
                                 Xếp loại ma trận hiệu suất
                              </p>
                            </>
                          ) : (
                            <div className="flex items-baseline gap-2">
                               <h3 className="text-section-title text-6xl tracking-tighter">{formatNumber(effectiveFinalScore)}</h3>
                               <span className="text-lg font-semibold opacity-60">điểm</span>
                            </div>
                          )}
                       </div>
                       {isBscOfficial ? (
                          <span className="text-xs font-semibold text-[var(--color-primary-foreground)] flex items-center gap-1 shrink-0 whitespace-nowrap"
                            title="Kỳ này đang chấm điểm chính thức bằng BSC nên điểm cuối được khóa theo điểm BSC">
                            <Lock size={10} /> Khóa theo điểm BSC
                          </span>
                       ) : (!readOnly && !isFullQualitative && finalScore !== totalManagerScore && (
                          <Button variant="ghost" size="sm" className="shrink-0" type="button" onClick={handleResetFinalScore}>
                            <Zap aria-hidden="true" fill="currentColor" /> Dùng điểm đã chấm
                          </Button>
                       ))}
                    </div>

                    {/* Xếp loại đến từ đâu — đặt ngay dưới số lớn để đọc theo mạch nhân quả */}
                    {hasQualitative && (
                    <div className="pt-5 border-t border-white/10 relative z-10">
                       <p className="text-eyebrow text-[var(--color-primary-foreground)]/70 mb-3">
                          Xếp loại này đến từ đâu
                       </p>
                       <div className="flex items-stretch gap-1.5">
                          <div className="flex-1 px-2 py-2.5 rounded-card bg-white/10 text-center">
                             <p className="text-eyebrow text-[var(--color-primary-foreground)]/70 mb-0.5">Hành vi</p>
                             <p className="text-xl font-semibold tracking-tighter whitespace-nowrap">
                                {behaviorLive != null ? <>{formatNumber(behaviorLive)}<span className="text-xs opacity-60">/5</span></> : '—'}
                             </p>
                          </div>
                          <div className="flex items-center text-sm font-semibold text-[var(--color-primary-foreground)]/50">×</div>
                          <div className="flex-1 px-2 py-2.5 rounded-card bg-white/10 text-center">
                             <p className="text-eyebrow text-[var(--color-primary-foreground)]/70 mb-0.5">Hoàn thành</p>
                             <p className="text-xl font-semibold tracking-tighter whitespace-nowrap">
                                {completionPercent != null ? <>{formatNumber(completionPercent)}<span className="text-xs opacity-60">%</span></> : '—'}
                             </p>
                          </div>
                          <div className="flex items-center text-sm font-semibold text-[var(--color-primary-foreground)]/50">→</div>
                          <div className="flex-1 px-2 py-2.5 rounded-card bg-white/20 text-center border border-white/25">
                             <p className="text-eyebrow text-[var(--color-primary-foreground)] mb-0.5">Xếp loại</p>
                             <p className="text-xl font-semibold tracking-tighter whitespace-nowrap">
                                {matrixLive != null ? <>{matrixLive}<span className="text-xs opacity-60">/5</span></> : '—'}
                             </p>
                          </div>
                       </div>
                       <p className="text-xs font-medium text-[var(--color-primary-foreground)]/50 leading-relaxed mt-2.5">
                          Hai chỉ số này tra trên ma trận hiệu suất của tổ chức để ra xếp loại.
                       </p>
                    </div>
                    )}

                    {/* Điểm cuối — con số thực sự lưu vào hồ sơ nhân sự */}
                    <div className="pt-5 border-t border-white/10 relative z-10 space-y-2.5">
                       <div className="flex justify-between items-baseline">
                          <span className="text-eyebrow text-[var(--color-primary-foreground)]">
                             Điểm cuối · lưu vào hồ sơ
                          </span>
                          <span className="text-2xl font-semibold tracking-tighter">{formatNumber(effectiveFinalScore)}</span>
                       </div>
                       {!isFullQualitative && (
                       <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-xs font-medium text-[var(--color-primary-foreground)]/50">
                             <span>Tổng điểm hệ thống</span>
                             <span>{formatNumber(totalAutoScore)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-medium text-[var(--color-primary-foreground)]/50">
                             <span>Đã chấm theo chỉ tiêu</span>
                             <span>{formatNumber(totalManagerScore)}</span>
                          </div>
                          {isBscOfficial ? (
                            <div className="flex justify-between text-xs font-medium text-[var(--color-primary-foreground)]">
                               <span>Điểm BSC (chính thức)</span>
                               <span>{formatNumber(bscScore!)}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-xs font-medium text-[var(--color-primary-foreground)]/50">
                               <span>Chênh lệch so với hệ thống</span>
                               <span>{finalScore - totalAutoScore >= 0 ? '+' : ''}{formatNumber(finalScore - totalAutoScore)}</span>
                            </div>
                          )}
                       </div>
                       )}
                    </div>

                    {/* Chiều ĐỊNH TÍNH: hiện điểm hành vi + xếp loại ma trận để người chấm
                        hiểu phần định tính đóng góp gì, thay vì chỉ thấy điểm định lượng. */}

                    {/* Final score adjustment slider - starts at the sum of per-KPI scores,
                        can be dragged independently within [0, scoreCeiling].
                        Full-qualitative locks the score to the full scoring pool instead. */}
                    {isBscOfficial ? (
                      <div className="pt-6 border-t border-white/10 relative z-10 space-y-2">
                         <div className="text-eyebrow inline-flex items-center gap-2 px-4 py-2 rounded-card bg-white/10 text-[var(--color-primary-foreground)] whitespace-nowrap">
                            <Lock size={12} className="shrink-0" /> Điểm chính thức theo BSC — không sửa tay
                         </div>
                         <p className="text-xs font-medium text-[var(--color-primary-foreground)]/60 leading-relaxed">
                            Điểm BSC tính từ <b>kết quả thực đạt</b> (định lượng: thực đạt/mục tiêu) và <b>mức được chấm</b> (định tính).
                            Vì vậy sửa ô chấm của KPI định lượng sẽ <b>không đổi</b> điểm BSC, còn đổi mức của KPI định tính thì <b>có</b>.
                         </p>
                      </div>
                    ) : isFullQualitative ? (
                      <div className="pt-6 border-t border-white/10 relative z-10">
                         <div className="text-eyebrow inline-flex items-center gap-2 px-4 py-2 rounded-card bg-white/10 text-[var(--color-primary-foreground)] whitespace-nowrap">
                            <Lock size={12} className="shrink-0" /> Full định tính · Cố định điểm {SCORING_POOL}
                         </div>
                      </div>
                    ) : (
                    <div className="pt-2 relative z-10 space-y-3">
                       <input
                         type="range" min={0} max={scoreCeiling} step={1}
                         value={finalScore}
                         onChange={(e) => {
                           if (readOnly) return
                           hasManuallyAdjustedFinal.current = true
                           setFinalScore(Number(e.target.value))
                         }}
                         disabled={readOnly}
                         className="w-full accent-white h-2 bg-white/20 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                       />
                       {firstErrorMessage(errors) && (
                         <p className="text-eyebrow text-rose-200 dark:text-rose-950">
                           {firstErrorMessage(errors)}
                         </p>
                       )}
                       <div className="text-eyebrow flex justify-between text-[var(--color-primary-foreground)]">
                          <span>0</span>
                          <span>{Math.round(scoreCeiling / 2)}</span>
                          <span>{scoreCeiling}</span>
                       </div>
                       {bonusScore > 0 && (
                         <p className="text-eyebrow text-emerald-200 dark:text-emerald-950">
                           Đạt đủ KPI = {SCORING_POOL} điểm · thưởng thêm {bonusScore}
                         </p>
                       )}
                    </div>
                    )}

                    <div className="pt-2 relative z-10">
                       <div className="text-eyebrow px-4 py-2 rounded-card bg-white/10 text-[var(--color-primary-foreground)] inline-flex items-center gap-2">
                          <Award size={14} /> Tự động xếp loại: {getGrade(effectiveFinalScore)}
                       </div>
                    </div>
                 </div>
              </div>
            </div>
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
