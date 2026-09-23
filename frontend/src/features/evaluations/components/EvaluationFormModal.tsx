import { useNavigate } from 'react-router-dom'
import { useWorkflowNavigator } from '@/features/kpi/workflow/hooks/useWorkflowNavigator'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { evaluationSchema, type EvaluationFormData } from '../schemas/evaluationSchema'
import { useCreateEvaluation } from '../hooks/useCreateEvaluation'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useAuthStore } from '@/store/authStore'
import EvidenceAttachments from '@/features/evidence/EvidenceAttachments'
import { evidenceKey } from '@/features/evidence/evidenceApi'
import { useFormAssistStore } from '@/store/formAssistStore'
import { MicButton } from '@/components/common/MicButton'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions, SCORING_POOL, describePerspectiveScore } from '@/lib/scoring'
import { Loader2, Zap, CheckCircle2, MessageSquare, Lock, Layers, AlertTriangle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Section, ScoreRow, RefStat, Collapsible } from '@/components/common/ScoreForm'
import { useMemo, useEffect, useRef } from 'react'
import { BscScoringMode, type PerspectiveScoreResponse } from '@/features/bsc/types'
import { useQuery } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'
import { cn } from '@/lib/utils'
import ConductInlineSheet, { type ConductSheetHandle } from '@/features/conduct/components/ConductInlineSheet'

interface EvaluationFormModalProps {
  open: boolean
  onClose: () => void
  readOnly?: boolean
  initialPeriodId?: string
  /** `inline` bỏ lớp phủ và nút đóng để nhúng thẳng vào một trang (trình thiết lập KPI). */
  variant?: 'modal' | 'inline'
  /**
   * Có thì thay hẳn phần tự điều hướng sau khi lưu — chủ trang quyết định đi đâu.
   *
   * Cần thiết khi nhúng: mặc định form gọi `goToNext` rồi `navigate('/evaluations')`, tức là lưu
   * xong lại đá người dùng ra khỏi trang đang đứng.
   */
  onSaved?: () => void
}

export default function EvaluationFormModal({ open, onClose, readOnly = false, initialPeriodId, variant = 'modal', onSaved }: EvaluationFormModalProps) {
  const { user } = useAuthStore()
  /** Ô đang thật sự sửa được, cho trợ lý AI. Cập nhật bằng effect riêng bên dưới — điều kiện
   *  khoá điểm khai báo SAU chỗ đăng ký nên không đưa thẳng vào deps được. */
  const fillableRef = useRef<string[]>([])
  
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreLabel, maxScore } = getScoringFunctions(org)

  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })
  const createMutation = useCreateEvaluation()

  const { data: myAllKpis } = useMyKpi({ page: 0, size: 500 })
  const assignedPeriodIds = useMemo(() => {
    if (!myAllKpis?.content) return new Set<string>()
    return new Set(myAllKpis.content.map(k => k.kpiPeriodId))
  }, [myAllKpis])

  const filteredPeriods = useMemo(() => {
    if (!periodsData?.content) return []
    return periodsData.content.filter(p => assignedPeriodIds.has(p.id))
  }, [periodsData, assignedPeriodIds])

  const { register, handleSubmit, reset, watch, setValue, getValues, formState } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { 
      score: 0,
      userId: user?.id ?? '',
      kpiPeriodId: initialPeriodId || '',
    },
  })

  // Giới thiệu form này với trợ lý AI trong lúc nó đang mở. Truyền HÀM đọc/ghi chứ không truyền
  // dữ liệu: giá trị chỉ cần đúng tại thời điểm gửi câu hỏi.
  useEffect(() => {
    if (!open) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'evaluation_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      // Chép lại đúng điều kiện vẽ/khoá bên dưới. readOnly = modal đang dùng làm bản xem lại,
      // không ô nào sửa được; score còn bị khoá thêm khi điểm do BSC chốt hoặc KPI không có
      // phần định lượng. Người bị đánh giá là ô ẩn nên không bao giờ có mặt ở đây.
      fillableFields: () => fillableRef.current,
      setValue: (field, value) =>
        setValue(field as keyof EvaluationFormData, value as never,
          { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('evaluation_form')
  }, [open, getValues, setValue])

  const hasManuallyEditedScore = useRef(false)

  useEffect(() => {
    if (open) {
      hasManuallyEditedScore.current = false
      if (initialPeriodId) {
        setValue('kpiPeriodId', initialPeriodId)
      } else if (filteredPeriods.length > 0 && !watch('kpiPeriodId')) {
        const firstPeriod = filteredPeriods[0]
        if (firstPeriod) {
          setValue('kpiPeriodId', firstPeriod.id)
        }
      }
    }
  }, [open, initialPeriodId, filteredPeriods, setValue, watch])

  const currentScore = watch('score')
  const displayScore = currentScore
  const selectedPeriodId = watch('kpiPeriodId')

  const { data: scorePreview } = useQuery({
    queryKey: ['score-preview', selectedPeriodId, user?.id],
    queryFn: () => evaluationApi.getScorePreview(selectedPeriodId!, user?.id),
    enabled: !!selectedPeriodId,
  })

  const rawSystemScore = scorePreview?.systemScore ?? 0
  const matrixRating = scorePreview?.matrixRating ?? null
  const behaviorScore = scorePreview?.behaviorScore ?? null

  // BSC (chỉ có khi org bật BSC & kỳ đã có bộ tiêu chí)
  const bscScore = scorePreview?.bscScore ?? null
  const bscMode = scorePreview?.bscScoringMode ?? null
  const bscPerspectives = scorePreview?.bscPerspectives ?? []
  // KPI thưởng nằm ngoài pool 100% nên điểm của nó được cộng THÊM lên trên thang điểm:
  // trần thật = thang điểm + điểm thưởng, lấy từ backend để thanh kéo không chặn thấp hơn
  // giới hạn mà createEvaluation kiểm tra (nếu kẹp ở maxScore thì chính điểm hệ thống lại không lưu được).
  const scoreCeiling = scorePreview?.maxAllowedScore ?? maxScore
  const bonusScore = scorePreview?.bonusScore ?? 0
  const bscUnassigned = scorePreview?.bscUnassignedKpis ?? []
  const completionPct = scorePreview?.kpiCompletionPercent ?? null
  // Full-qualitative: no quantitative KPI -> the 0..100 system score is N/A.
  const noQuantScore = scorePreview != null && completionPct == null

  // Kỳ đang chấm CHÍNH THỨC bằng BSC ⇒ điểm bị KHÓA theo bsc_score (backend cũng ép, không chỉ khóa UI).
  const isBscOfficial = bscMode === 'OFFICIAL' && bscScore != null
  const selectedPeriodIdForEvidence = watch('kpiPeriodId')
  const scoreLocked = readOnly || isBscOfficial

  // Chép lại đúng điều kiện vẽ/khoá bên dưới: readOnly = modal đang dùng làm bản xem lại nên
  // không ô nào sửa được; ô điểm còn bị khoá thêm khi điểm do BSC chốt hoặc KPI không có phần
  // định lượng. Người bị đánh giá là input ẩn nên không bao giờ có mặt ở đây.
  useEffect(() => {
    fillableRef.current = readOnly
      ? []
      : ['kpiPeriodId', 'comment', ...(scoreLocked || noQuantScore ? [] : ['score'])]
  }, [readOnly, scoreLocked, noQuantScore])

  // Điểm gợi ý 0..100:
  // - BSC chính thức  -> lấy officialScore (= bsc_score)
  // - Toàn định tính  -> completion mặc định 100% nên khóa ở trọn pool chấm
  // - Còn lại         -> điểm hệ thống định lượng
  // KHÔNG làm tròn khi khóa theo BSC: backend lưu đúng bsc_score (vd 82.5) nên UI phải khớp.
  const calculatedScore = isBscOfficial
    ? (scorePreview?.officialScore ?? bscScore!)
    : noQuantScore
      ? SCORING_POOL
      : rawSystemScore

  const handleApplyCalculatedScore = () => {
    if (scoreLocked) return
    hasManuallyEditedScore.current = false
    setValue('score', calculatedScore)
  }

  useEffect(() => {
    // Khi BSC chính thức: luôn ép điểm = bsc_score, bỏ qua mọi chỉnh tay trước đó.
    if (isBscOfficial) {
      setValue('score', calculatedScore)
      return
    }
    if (calculatedScore > 0 && !hasManuallyEditedScore.current && !readOnly) {
      setValue('score', calculatedScore)
    }
  }, [calculatedScore, setValue, readOnly, isBscOfficial])

  const navigate = useNavigate()
  const { goToNext } = useWorkflowNavigator()

  // Phiếu hạnh kiểm nằm ngay trong form này nên nó lưu theo nút "Gửi đánh giá" luôn —
  // trước đây người dùng phải bấm lưu riêng cho phiếu, quên là mất điểm hành vi vừa chấm.
  // Lưu TRƯỚC khi gửi vì điểm hành vi là đầu vào của xếp loại; lưu hỏng thì dừng hẳn, để
  // họ sửa rồi gửi lại thay vì gửi đánh giá kèm điểm hành vi cũ.
  const conductRef = useRef<ConductSheetHandle>(null)

  const onSubmit = async (data: EvaluationFormData) => {
    if (readOnly) return
    try {
      await conductRef.current?.save()
    } catch {
      return // hook của phiếu đã hiện toast lỗi
    }
    createMutation.mutate(data, {
      onSuccess: () => {
        reset()

        // Chủ trang đã nhận việc điều hướng thì dừng ở đây — nhúng trong một luồng khác mà vẫn tự
        // nhảy đi là kéo người dùng ra khỏi trang họ đang đứng.
        if (onSaved) {
          onSaved()
          return
        }

        onClose()

        // Đích lấy từ cấu hình luồng thay vì đoán qua roleRank rồi điều hướng cứng. Hai cái lợi:
        // quản lý chấm điểm xong được dẫn tiếp sang bước đánh giá kỳ thay vì quay về chỗ cũ, và
        // tổ chức tắt bước nào thì nút tự bỏ qua bước đó.
        const stage = data.userId === user?.id ? 'SELF_EVALUATION' : 'MANAGER_EVALUATION'
        const movedOn = goToNext(stage, { periodId: data.kpiPeriodId }, { openCreate: false })
        if (!movedOn) navigate('/evaluations')
      },
    })
  }

  const isInline = variant === 'inline'
  // isSubmitting phủ cả nhịp lưu phiếu hạnh kiểm chạy trước khi gọi createMutation — không có nó,
  // bấm hai lần là lưu phiếu hai lần.
  const busy = createMutation.isPending || formState.isSubmitting

  const submitButton = (
    <Button type="submit" form="evaluation-form" disabled={busy || !selectedPeriodId}>
      {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
      Gửi đánh giá
    </Button>
  )

  const body = (
    <div className="p-5 md:p-6">
      <form id="evaluation-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" {...register('userId')} />
        <input type="hidden" {...register('kpiPeriodId')} />

        {/* ── 1. Bối cảnh: chấm cho đợt nào, dựa trên những con số nào ───────────────
            Trước đây đợt và "kết quả đo lường" là hai khối rời nhau, còn điểm hệ thống hiện
            to gần bằng ô điểm bên dưới nên màn hình có HAI con số 68 cỡ lớn — người dùng
            không biết cái nào là điểm mình đang chấm. */}
        <Section title="Bối cảnh" hint={filteredPeriods.length ? `${filteredPeriods.length} đợt bạn có KPI` : undefined}>
          <div className="rounded-card border border-[var(--color-border)]">
            <ScoreRow
              label={<>Đợt đánh giá {!readOnly && <span className="text-[var(--color-error)]">*</span>}</>}
              hint="Đợt bạn có KPI"
            >
              <Select
                value={selectedPeriodId || undefined}
                onValueChange={(v) => setValue('kpiPeriodId', v, { shouldValidate: true, shouldDirty: true })}
                disabled={readOnly}
              >
                <SelectTrigger className="w-full sm:max-w-xs" aria-label="Đợt đánh giá">
                  <SelectValue placeholder="Lựa chọn kỳ đánh giá" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPeriods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </ScoreRow>
          </div>

          {selectedPeriodId && (
            <MeasurementPanel
              maxScore={maxScore}
              calculatedScore={calculatedScore}
              noQuantScore={noQuantScore}
              isBscOfficial={isBscOfficial}
              completionPct={completionPct}
              matrixRating={matrixRating}
              behaviorScore={behaviorScore}
              systemScore={rawSystemScore}
              bscScore={bscScore}
              bscMode={bscMode}
              bscPerspectives={bscPerspectives}
              bscUnassigned={bscUnassigned}
              readOnly={readOnly}
            />
          )}
        </Section>

        {/* ── 2. Bạn tự chấm: cùng khuôn "nhãn | ô nhập" với phiếu chấm của quản lý ── */}
        {selectedPeriodId && (
          <Section title="Bạn tự chấm" hint={readOnly ? 'Chế độ chỉ xem' : undefined}>
            <div className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
              <ScoreRow
                label={<>Điểm tự đánh giá {!readOnly && <span className="text-[var(--color-error)]">*</span>}</>}
                hint={isBscOfficial ? 'Khoá theo điểm BSC chính thức'
                  : noQuantScore ? `KPI toàn định tính · cố định ${SCORING_POOL}`
                  : `Hệ thống tính ${trim(calculatedScore)}`}
                trailing={!readOnly && !scoreLocked && !noQuantScore && calculatedScore > 0 && displayScore !== calculatedScore && (
                  <Button variant="ghost" size="sm" type="button" onClick={handleApplyCalculatedScore}
                          title="Lấy lại đúng điểm hệ thống tự tính">
                    <Zap aria-hidden="true" /> Dùng {trim(calculatedScore)}
                  </Button>
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="number" min={0} max={scoreCeiling} step={1}
                    value={String(currentScore ?? 0)}
                    readOnly={readOnly || scoreLocked || noQuantScore}
                    onChange={e => {
                      hasManuallyEditedScore.current = true
                      setValue('score', Number(e.target.value), { shouldValidate: true, shouldDirty: true })
                    }}
                    onWheel={e => e.currentTarget.blur()}
                    suffix={<span className="text-xs">/ {scoreCeiling}</span>}
                    className="w-32"
                    inputClassName="text-base font-semibold tabular-nums"
                  />
                  <span className={cn('text-eyebrow', getScoreColor(displayScore))}>{getScoreLabel(displayScore)}</span>

                  {!isBscOfficial && !noQuantScore && calculatedScore > 0 && displayScore !== calculatedScore && (
                    <span className={cn(
                      'text-eyebrow inline-flex items-center rounded-full px-2 py-0.5',
                      displayScore > calculatedScore
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                        : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
                    )}>
                      {displayScore > calculatedScore ? '+' : ''}{trim(displayScore - calculatedScore)} so với hệ thống
                    </span>
                  )}
                  {!readOnly && (scoreLocked || noQuantScore) && (
                    <span className="text-caption inline-flex items-center gap-1">
                      <Lock size={11} aria-hidden="true" /> không sửa tay
                    </span>
                  )}
                </div>

                {/* Thanh kéo chỉ để chấm nhanh; con số đọc ở ô trên, nên bỏ hẳn khối số 7xl
                    và hai đầu mốc 0 / 50 / 100 vốn chiếm nguyên một màn. */}
                {!readOnly && !scoreLocked && !noQuantScore && (
                  <>
                    <input
                      type="range" min={0} max={scoreCeiling} step={1}
                      value={currentScore}
                      onChange={e => {
                        hasManuallyEditedScore.current = true
                        setValue('score', Number(e.target.value), { shouldValidate: true, shouldDirty: true })
                      }}
                      aria-label="Kéo để chọn điểm tự đánh giá"
                      className="mt-3 h-1.5 w-full max-w-md cursor-pointer appearance-none rounded-full bg-[var(--color-border)]"
                    />
                    {bonusScore > 0 && (
                      <p className="text-caption mt-1.5">
                        Đạt đủ KPI = {SCORING_POOL} điểm · KPI thưởng cộng thêm tối đa {trim(bonusScore)}
                      </p>
                    )}
                  </>
                )}
              </ScoreRow>

              {/* Hạnh kiểm nằm CÙNG khối chấm: nó cũng là điểm người dùng tự cho, và là trục
                  hành vi của ma trận xếp loại — tách thành khối riêng thì hay bị bỏ quên. */}
              {org?.enableConduct && (
                <ScoreRow label="Hạnh kiểm" hint="Trục hành vi · lưu khi gửi">
                  <ConductInlineSheet
                    ref={conductRef}
                    hideActions
                    target={{ scope: 'PERIOD', periodId: selectedPeriodId, cycleId: null }}
                  />
                </ScoreRow>
              )}
            </div>
          </Section>
        )}

        {/* ── 3. Minh chứng & ý kiến ──────────────────────────────────────────────── */}
        <Section title="Minh chứng & ý kiến">
          {selectedPeriodIdForEvidence && user?.id && (
            <EvidenceAttachments
              target={evidenceKey.period(selectedPeriodIdForEvidence, user.id)}
              readOnly={readOnly}
              title="Minh chứng của bạn"
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-label flex items-center gap-2" htmlFor="self-eval-comment">
                <MessageSquare size={14} aria-hidden="true" /> Ý kiến cá nhân
              </label>
              <MicButton
                disabled={readOnly}
                getBaseText={() => getValues('comment') ?? ''}
                onText={text => setValue('comment', text, { shouldValidate: true, shouldDirty: true })}
              />
            </div>
            <Textarea
              id="self-eval-comment"
              {...register('comment')}
              rows={3}
              disabled={readOnly}
              placeholder="Bạn thấy đợt này thế nào? Có khó khăn hay đề xuất gì không?"
            />
            {/* Thay cột mẹo bên phải: ba gạch đầu dòng chung chung + tấm thẻ tím "hãy trung
                thực" chiếm 288px mà không nói được điều gì người dùng cần lúc đang chấm. */}
            <p className="text-caption">
              Điểm này là cơ sở xếp loại khen thưởng của đợt; bản đã gửi xem lại được ở mục Lịch sử.
            </p>
          </div>
        </Section>

        {/* Nhúng trong trang thì không có chân hộp thoại: nút gửi nằm ngay cuối form. Nút
            quay lại đã có ở vỏ bước của wizard nên không lặp thêm "Hủy bỏ". */}
        {isInline && !readOnly && (
          <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
            {submitButton}
          </div>
        )}
      </form>
    </div>
  )

  // Nhúng trong trang (trình thiết lập KPI): không lớp phủ, không nút đóng — thanh bước của wizard
  // là lối ra. Vỏ thẻ tự dựng vì StepShell ở đó chạy chế độ `bare`.
  if (isInline) {
    if (!open) return null
    return (
      <div className="overflow-hidden rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
        {body}
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      flush
      dismissible={!busy}
      title={readOnly ? 'Tổng kết Hiệu suất' : 'Tự đánh giá của bạn'}
      description={readOnly ? 'Xem lại kết quả nỗ lực của bạn trong đợt này.' : 'Hãy dành chút thời gian để phản ánh lại kết quả làm việc.'}
      footer={readOnly ? (
        <DialogFooter primary={<Button onClick={onClose}>Đã hiểu & đóng</Button>} />
      ) : (
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>Hủy bỏ</Button>}
          primary={submitButton}
        />
      )}
    >
      {body}
    </Dialog>
  )
}

/** Bỏ số 0 thừa: 80.0 → "80", 82.5 → "82.5". */
const trim = (v: number) => Number(v.toFixed(1)).toString()

/**
 * Khối "Cơ sở đo lường" — những con số CÓ SẴN của đợt, đặt cạnh nhau để người dùng biết
 * mình đang chấm dựa trên cái gì: điểm hệ thống, mức hoàn thành, xếp loại ma trận, điểm BSC.
 *
 * Trước đây mỗi con số là một tấm thẻ cao 72px xếp dọc, con số đầu để cỡ 4xl — to ngang ô
 * điểm tự chấm bên dưới, nên màn hình có hai số lớn và không ai biết số nào là điểm của mình.
 * Ở đây tất cả là thẻ số nhỏ dùng chung `RefStat` với phiếu chấm đợt / chốt kỳ; con số SẼ
 * thành điểm được tô màu chính và ghi rõ "hệ thống đề xuất", còn chi tiết BSC gập lại.
 */
function MeasurementPanel({
  maxScore, calculatedScore, noQuantScore, isBscOfficial, completionPct,
  matrixRating, behaviorScore, systemScore, bscScore, bscMode, bscPerspectives,
  bscUnassigned, readOnly,
}: {
  maxScore: number
  calculatedScore: number
  noQuantScore: boolean
  isBscOfficial: boolean
  completionPct: number | null
  matrixRating: number | null
  behaviorScore: number | null
  systemScore: number
  bscScore: number | null
  bscMode: BscScoringMode | null
  bscPerspectives: PerspectiveScoreResponse[]
  bscUnassigned: string[]
  readOnly: boolean
}) {
  const basis = isBscOfficial
    ? 'Kỳ này chấm chính thức bằng BSC — ô điểm bên dưới khoá theo con số này.'
    : noQuantScore
      ? 'KPI toàn định tính, không có phần định lượng để tính — hệ thống đề xuất trọn thang điểm.'
      : completionPct != null
        ? `Tính từ ${Math.round(completionPct)}% chỉ tiêu định lượng đã duyệt.`
        : 'Tính từ kết quả các chỉ tiêu đã được duyệt.'

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RefStat
          tone="primary"
          label={isBscOfficial ? 'BSC chính thức' : 'Hệ thống đề xuất'}
          value={<>{noQuantScore && !isBscOfficial ? '—' : trim(calculatedScore)}<span className="text-sm text-[var(--color-subtle-foreground)]">/{maxScore}</span></>}
        />
        <RefStat
          label="Hoàn thành"
          value={completionPct != null ? `${Math.round(completionPct)}%` : '—'}
        />
        <RefStat
          label="Xếp loại"
          value={matrixRating != null ? <>{matrixRating}<span className="text-sm text-[var(--color-subtle-foreground)]">/5</span></> : '—'}
        />
        {/* Điểm hệ thống vẫn hiện khi BSC đã thay nó: người dùng cần biết phần định lượng của
            mình ra bao nhiêu, dù nó không còn là điểm chính thức. */}
        {isBscOfficial ? (
          <RefStat label="Hệ thống (không dùng)" value={trim(systemScore)} />
        ) : bscScore != null ? (
          <RefStat label="BSC (song song)" value={trim(bscScore)} />
        ) : (
          <RefStat label="Hành vi" value={behaviorScore != null ? <>{behaviorScore.toFixed(1)}<span className="text-sm text-[var(--color-subtle-foreground)]">/5</span></> : '—'} />
        )}
      </div>

      <p className="text-caption flex items-start gap-1.5">
        {isBscOfficial
          ? <Layers size={13} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          : <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />}
        <span>
          {basis}
          {matrixRating != null && (
            <> Xếp loại tra từ hành vi {behaviorScore != null ? behaviorScore.toFixed(1) : '—'}/5 và mức hoàn thành {completionPct != null ? Math.round(completionPct) : 100}%.</>
          )}
          {readOnly && ' Đây là bản tổng kết tự động sau khi tất cả chỉ tiêu đã được duyệt.'}
        </span>
      </p>

      {bscUnassigned.length > 0 && (
        <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-xs font-medium leading-relaxed text-[var(--color-warning)]">
            <b>{bscUnassigned.length} chỉ tiêu chưa gán hạng mục</b> nên không được tính vào điểm BSC: {bscUnassigned.join(', ')}.
            {bscMode === BscScoringMode.OFFICIAL && ' Kỳ đang chấm chính thức — phải gán đủ mới chốt được đánh giá.'}
          </p>
        </div>
      )}

      {/* Chi tiết BSC là thứ để TRA khi thắc mắc, không phải thứ đọc mỗi lần chấm → gập lại. */}
      {bscPerspectives.length > 0 && (
        <Collapsible label="Chi tiết điểm BSC theo hạng mục" count={bscPerspectives.length} countLabel="hạng mục">
          <div className="space-y-1">
            <div className="text-eyebrow flex items-center gap-2">
              <span className="flex-1">Hạng mục</span>
              <span className="w-12 text-right">Đạt</span>
              <span className="w-14 text-right">Trọng số</span>
            </div>
            {bscPerspectives.map(p => {
              const color = p.color || '#8b5cf6'
              const pct = p.achievementPercent
              const failedGate = p.isGate && p.gatePassed === false
              return (
                <div key={p.perspectiveId} className="flex items-center gap-2" title={describePerspectiveScore(p)}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-caption min-w-0 flex-1 truncate">
                    {p.name}
                    {p.isGate && (
                      <span className={cn(
                        'text-eyebrow ml-1.5 rounded px-1 py-px align-middle',
                        failedGate
                          ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                          : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]',
                      )}>
                        Chặn
                      </span>
                    )}
                  </span>
                  {/* Thanh mức đạt cắt ở 100% để hạng mục vượt chỉ tiêu không đẩy tràn cột. */}
                  <span className="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--color-border)] sm:block">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%`, backgroundColor: color }}
                    />
                  </span>
                  <span className={cn(
                    'w-12 text-right text-xs font-semibold tabular-nums',
                    failedGate ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]',
                  )}>
                    {pct != null ? `${pct.toFixed(0)}%` : '—'}
                  </span>
                  <span className="w-14 text-right text-xs font-medium tabular-nums text-[var(--color-subtle-foreground)]">
                    ×{p.weightPercentage}%
                  </span>
                </div>
              )
            })}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
