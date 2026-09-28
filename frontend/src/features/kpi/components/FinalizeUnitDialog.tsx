import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'sonner'
import { AlertTriangle, Award, CheckCircle2, Loader2, Lock, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CycleUnitEvaluation } from '@/types/kpi'
import type { CalibrationPlan } from '../api/kpiCycleEvaluationApi'
import { kpiCycleApi } from '../api/kpiCycleApi'
import type { LockCyclePayload } from '../types/cycleLock'
import { usePeriodDecisions } from '../hooks/usePeriodDecisions'
import { LockEffects, PeriodDecisionRow } from './CycleLockParts'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

/**
 * Bước 4 — KHOÁ KẾT QUẢ đánh giá kỳ của phòng ban.
 *
 * Hộp thoại này từng gộp cả ô chấm điểm đơn vị; phần đó đã dọn ra thẻ {@code UnitScoreCard}
 * ở bước 2 để khoá thật sự là bước cuối. Ở đây chỉ còn: con số sẽ chụp vào snapshot, xếp loại
 * đi kèm, tình trạng so với khung bell curve, và một ô nhận xét.
 *
 * Khung ở chế độ chặn mà còn vượt trần thì backend từ chối — nút xác nhận tắt luôn, khỏi bấm
 * rồi ăn lỗi. Chế độ cảnh báo thì vẫn khoá được nhưng phải nhìn thấy cảnh báo trước khi bấm.
 *
 * Ở ĐƠN VỊ GỐC, khoá kết quả = KHOÁ LUÔN KỲ (một thao tác, một transaction ở server): hộp thoại
 * nạp danh sách đợt của kỳ và bắt chọn cách xử lý từng đợt còn dở trước khi cho bấm khoá.
 */
export default function FinalizeUnitDialog({
  summary, plan, onFinalize, onClose, getScoreColor, getScoreLabel,
}: {
  summary: CycleUnitEvaluation
  plan?: CalibrationPlan
  onFinalize: (args: { comment: string; cycleLock?: LockCyclePayload }) => Promise<unknown>
  onClose: () => void
  getScoreColor: (score: number) => string
  getScoreLabel: (score: number) => string
}) {
  const { t } = useTranslation('kpi')
  const [comment, setComment] = useState(summary.comment ?? '')
  const draft = useStateDraft(comment, setComment, { key: `cycle-finalize:${summary.cycleId}:${summary.orgUnitId}`, enabled: true })
  const [busy, setBusy] = useState(false)

  const score = summary.managerScore ?? null
  const blocked = !!plan?.blocked
  const offFrame = !!plan?.configured && !plan.withinFrame && !blocked

  // Đơn vị gốc + kỳ còn mở ⇒ khoá kết quả kéo theo khoá kỳ.
  const locksCycle = !!summary.rootUnit && summary.cycleStatus !== 'LOCKED'
  const previewQuery = useQuery({
    queryKey: ['kpiCycleLockPreview', summary.cycleId],
    queryFn: () => kpiCycleApi.lockPreview(summary.cycleId),
    enabled: locksCycle,
    staleTime: 0,
  })
  const preview = previewQuery.data
  const { unfinished, drafts, setDraft, draftProblem, allDecided, decisions } = usePeriodDecisions(preview)

  const cycleReady = !locksCycle || (!!preview && allDecided)

  const confirm = async () => {
    setBusy(true)
    try {
      await onFinalize({
        comment,
        cycleLock: locksCycle && preview ? { previewToken: preview.previewToken, decisions } : undefined,
      })
      draft.clear()
      onClose()
    } catch (error) {
      // Dữ liệu đợt vừa đổi giữa lúc xem và lúc khoá: tải lại để người dùng chọn lại.
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.warning(getApiErrorMessage(error, t('FinalizeUnitDialog.thePeriodDataJustChangedPlease')))
        previewQuery.refetch()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size={locksCycle && unfinished.length > 0 ? 'lg' : 'md'}
      dismissible={!busy}
      title={locksCycle ? t('FinalizeUnitDialog.lockResultsAndLockTheCycle') : t('FinalizeUnitDialog.lockCycleEvaluationResults')}
      description={t('FinalizeUnitDialog.theFiguresBelowWillBeCaptured', { orgUnitName: summary.orgUnitName })}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('FinalizeUnitDialog.cancel')}</Button>}
          primary={
            <Button onClick={confirm} disabled={busy || blocked || !cycleReady}
              title={blocked ? t('FinalizeUnitDialog.someLevelsAreAboveTheCeiling') : !cycleReady ? t('FinalizeUnitDialog.chooseHowToHandleEveryUnfinished') : undefined}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {busy ? t('FinalizeUnitDialog.locking') : locksCycle ? t('FinalizeUnitDialog.lockResultsAndLockTheCycle') : t('FinalizeUnitDialog.confirmLock')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-eyebrow mb-1">{t('FinalizeUnitDialog.unitScoreToBeLocked')}</p>
              <div className="flex items-end gap-2">
                {score != null ? (
                  <>
                    <span className={cn('text-4xl font-semibold leading-none tabular-nums', getScoreColor(score))}>{score}</span>
                    <span className="text-eyebrow pb-1">{getScoreLabel(score)}</span>
                  </>
                ) : (
                  <span className="text-4xl font-semibold leading-none text-[var(--color-subtle-foreground)]">—</span>
                )}
              </div>
              <p className="text-caption mt-1">
                {summary.overrideScore != null
                  ? t('FinalizeUnitDialog.manualScoreMemberAvg', { value: summary.autoScore ?? '—' })
                  : t('FinalizeUnitDialog.averageOfMembers', { memberCount: summary.memberCount })}
              </p>
            </div>
            {summary.classification && (
              <span
                className="text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-3 py-1.5"
                style={{
                  color: summary.classificationColor ?? undefined,
                  backgroundColor: `${summary.classificationColor ?? '#64748b'}14`,
                  borderColor: `${summary.classificationColor ?? '#64748b'}33`,
                }}
              >
                <Award size={12} /> {t('FinalizeUnitDialog.rating')} {summary.classification}
              </span>
            )}
          </div>
        </div>

        {/* Tình trạng so với khung — thứ quyết định có khoá được không. */}
        {plan?.configured && (
          blocked ? (
            <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t('FinalizeUnitDialog.curve')} "{plan.profileName}{t('FinalizeUnitDialog.isBlockingSomeLevelsAreAbove')}</p>
                <p className="text-xs">
                  {plan.slots.filter(s => s.over).map(s => `${s.level} ${s.currentCount}/${s.maxCount}`).join(' · ')}{t('FinalizeUnitDialog.applyTheCalibrationSuggestionsThenLock')}
                </p>
              </div>
            </div>
          ) : offFrame ? (
            <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t('FinalizeUnitDialog.theDistributionIsStillOutsideThe')}{plan.profileName}"</p>
                <p className="text-xs">
                  {plan.slots.filter(s => s.over || s.under)
                    .map(s => s.over ? t('FinalizeUnitDialog.overBy', { level: s.level, value: s.currentCount - s.maxCount }) : t('FinalizeUnitDialog.shortBy', { level: s.level, value: s.minCount - s.currentCount }))
                    .join(' · ')}{t('FinalizeUnitDialog.theQuotaIsWarningOnlySo')}
                </p>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
              <CheckCircle2 size={16} aria-hidden="true" /> {t('FinalizeUnitDialog.theDistributionIsWithinTheQuota')}{plan.profileName}".
            </p>
          )
        )}

        <div>
          <label htmlFor="finalize-unit-comment" className="text-label">{t('FinalizeUnitDialog.commentsOptional')}</label>
          <Textarea
            id="finalize-unit-comment"
            value={comment} onChange={e => setComment(e.target.value)} rows={3}
            placeholder={t('FinalizeUnitDialog.overallCommentsForTheDepartmentThis')}
            className="mt-2"
          />
        </div>

        {locksCycle && (
          <section className="space-y-3 rounded-card border border-[var(--color-border)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('FinalizeUnitDialog.alsoLockCycle')}{summary.cycleName}"</p>
              <p className="text-caption">{summary.orgUnitName} {t('FinalizeUnitDialog.isTheRootUnitSoLocking')}</p>
            </div>
            <LockEffects />
            {previewQuery.isLoading ? (
              <p className="text-caption">{t('FinalizeUnitDialog.checkingTheCyclesPeriods')}</p>
            ) : previewQuery.isError ? (
              <p className="text-caption text-[var(--color-error)]">{getApiErrorMessage(previewQuery.error, t('FinalizeUnitDialog.couldNotCheckTheCyclesPeriods'))}</p>
            ) : unfinished.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
                <CheckCircle2 size={16} aria-hidden="true" /> {t('FinalizeUnitDialog.all')} {preview?.totalPeriods ?? 0} {t('FinalizeUnitDialog.periodsOfTheCycleAreCompleted')}
              </p>
            ) : (
              <div className="space-y-3">
                <p role="alert" className="flex items-start gap-2 text-sm text-[var(--color-warning)]">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {t('FinalizeUnitDialog.theCycleStillHas')} {unfinished.length} {t('FinalizeUnitDialog.unfinishedPeriodsChooseHowToHandle')}
                </p>
                {!preview?.targetCycles.length && (
                  <p className="text-caption">{t('FinalizeUnitDialog.noOpenCycleOfTheSame')}</p>
                )}
                {unfinished.map(p => (
                  <PeriodDecisionRow
                    key={p.periodId}
                    period={p}
                    draft={drafts[p.periodId]}
                    targets={preview?.targetCycles ?? []}
                    problem={draftProblem(p)}
                    onChange={patch => setDraft(p.periodId, patch)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="text-caption leading-relaxed">
          {t('FinalizeUnitDialog.afterLockingIndividualCycleScoresAnd')}
          {locksCycle ? t('FinalizeUnitDialog.andTheCycleIsReopened') : '.'}
        </p>
      </div>
    </Dialog>
  )
}
