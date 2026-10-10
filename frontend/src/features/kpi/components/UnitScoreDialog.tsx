import { useState } from 'react'
import { Award, Calculator, Loader2, Lock, MessageSquare, PenLine, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CycleUnitEvaluation } from '@/types/kpi'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

/**
 * Bước 2 của luồng đánh giá kỳ: CHẤM ĐIỂM PHÒNG BAN — mở từ nút "Chấm" trên dải bước.
 *
 * Từng là một thẻ nằm sẵn trên trang; nhưng 90% thời gian người ta chỉ cần biết phòng đang
 * mấy điểm (đã có ngay trên ô bước ②), còn việc chấm tay là chuyện làm một lần. Để thẻ nằm
 * đó chỉ tổ đẩy bảng nhân viên xuống dưới.
 *
 * Điểm nền là TRUNG BÌNH điểm chốt kỳ của thành viên. Nhập số KHÁC trung bình là chấm tay và
 * backend bắt buộc kèm lý do; nhập đúng bằng trung bình vẫn là chốt bằng TB.
 */
export default function UnitScoreDialog({
  summary, maxScore, isQualMode, canEdit, isSaving, onSave, onClose, getScoreColor, getScoreLabel,
}: {
  summary: CycleUnitEvaluation
  maxScore: number
  isQualMode: boolean
  canEdit: boolean
  isSaving: boolean
  onSave: (score: number | null, reason: string) => Promise<unknown>
  onClose: () => void
  getScoreColor: (score: number) => string
  getScoreLabel: (score: number) => string
}) {
  const { t } = useTranslation('kpi')
  const auto = summary.autoScore ?? null
  const override = summary.overrideScore ?? null

  const [score, setScore] = useState(override != null ? String(override) : '')
  const [reason, setReason] = useState(summary.overrideReason ?? '')
  const draft = useStateDraft({ score, reason }, v => { setScore(v.score); setReason(v.reason) }, { key: `unit-score:${summary.cycleId}:${summary.orgUnitId}`, enabled: canEdit })

  const trimmed = score.trim()
  const typed = trimmed !== '' ? Number(trimmed) : null
  const manual = typed != null && (!Number.isFinite(typed) || auto == null || typed !== auto)
  const parsed = manual ? typed : null
  const effective = manual ? (Number.isFinite(parsed) ? parsed : null) : auto
  const dirty = (manual ? parsed : null) !== override || (manual && reason.trim() !== (summary.overrideReason ?? ''))

  const save = async () => {
    if (blockedByTour()) return
    if (manual) {
      if (parsed == null || !Number.isFinite(parsed)) { toast.error(t('UnitScoreDialog.invalidUnitScore')); return }
      if (parsed < 0 || parsed > maxScore) { toast.error(t('UnitScoreDialog.theUnitScoreMustBeBetween', { maxScore })); return }
      if (!reason.trim()) { toast.error(t('UnitScoreDialog.enterTheReasonTheUnitScore')); return }
      await onSave(parsed, reason.trim())
    } else if (override != null) {
      await onSave(null, '')
    }
    draft.clear()
    onClose()
  }

  return (
    <Dialog {...tourAnchor('unitscore.dialog')}
      open
      onClose={onClose}
      size="md"
      dismissible={!isSaving}
      title={t('UnitScoreDialog.scoreTheDepartment')}
      description={t('UnitScoreDialog.theAverageOfMembersIs', { orgUnitName: summary.orgUnitName, memberCount: summary.memberCount, value: auto ?? '—' })}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSaving}>{t('UnitScoreDialog.close')}</Button>}
          primary={canEdit && (
            <Button {...tourAnchor('unitscore.save')} onClick={save} disabled={isSaving || !dirty}>
              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {t('UnitScoreDialog.saveDepartmentScore')}
            </Button>
          )}
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {/* Con số sẽ có hiệu lực — đổi màu/nhãn theo từng phím gõ. */}
        <div {...tourAnchor('unitscore.summary')} className="flex flex-wrap items-end justify-between gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
          <div>
            <p className="text-eyebrow mb-1">{t('UnitScoreDialog.unitScore')}</p>
            {effective != null ? (
              <span className="flex items-end gap-2">
                <span className={cn('text-4xl font-semibold leading-none tabular-nums', getScoreColor(effective))}>{effective}</span>
                <span className="text-eyebrow pb-1">{getScoreLabel(effective)}</span>
              </span>
            ) : (
              <span className="text-4xl font-semibold leading-none text-[var(--color-subtle-foreground)]">—</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              'text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-2.5 py-1',
              manual
                ? 'border-[var(--color-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]',
            )}>
              {manual ? <><PenLine size={12} /> {t('UnitScoreDialog.manualScore')}</> : <><Calculator size={12} /> {t('UnitScoreDialog.medium')}</>}
            </span>
            {summary.classification && (
              <span
                className="text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-2.5 py-1"
                style={{
                  color: summary.classificationColor ?? undefined,
                  backgroundColor: `${summary.classificationColor ?? '#64748b'}14`,
                  borderColor: `${summary.classificationColor ?? '#64748b'}33`,
                }}
                title={summary.classificationProfileName ? t('UnitScoreDialog.profile', { classificationProfileName: summary.classificationProfileName }) : undefined}
              >
                <Award size={12} /> {summary.classification}
              </span>
            )}
          </div>
        </div>

        {canEdit ? (
          <>
            <div {...tourAnchor('unitscore.manual')} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-eyebrow">{t('UnitScoreDialog.scoreTheUnitManually')}</span>
                <Input
                  type="number" size="lg" min={0} max={maxScore} step={0.1} value={score}
                  onChange={e => setScore(e.target.value)}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder={auto != null ? String(auto) : '0'}
                  suffix={<span className="text-sm">/ {maxScore}</span>}
                  className="w-36"
                  inputClassName="text-lg font-semibold tabular-nums"
                />
              </label>
              {trimmed !== '' ? (
                <Button variant="ghost" size="sm" type="button" className="h-10" onClick={() => { setScore(''); setReason('') }} title={t('UnitScoreDialog.backToTheMemberAverage')}>
                  <RotateCcw aria-hidden="true" /> {t('UnitScoreDialog.useAvg')} {auto ?? '—'}
                </Button>
              ) : (
                <span className="pb-2.5 text-caption">{t('UnitScoreDialog.emptyAverage')} {auto ?? '—'}</span>
              )}
            </div>
            {/* Thanh kéo đi cùng ô nhập (một giá trị). Chưa gõ gì thì nút kéo đứng ở trung bình. */}
            <div {...tourAnchor('unitscore.slider')} className="relative max-w-md px-2">
              {/* Vạch mốc trung bình thành viên: canh theo tâm nút kéo (rộng ~16px). */}
              {auto != null && auto >= 0 && auto <= maxScore && maxScore > 0 && (
                <div
                  className="pointer-events-none absolute top-0 h-2 w-0.5 rounded-full bg-[var(--color-foreground)]"
                  style={{ left: `calc(8px + ${(auto / maxScore) * 100}% - ${(auto / maxScore) * 16}px - 1px)` }}
                  title={t('UnitScoreDialog.memberAverage', { auto })}
                />
              )}
              <input
                type="range" min={0} max={maxScore} step={0.5}
                value={typed != null && Number.isFinite(typed) ? Math.min(Math.max(typed, 0), maxScore) : (auto ?? 0)}
                onChange={e => setScore(e.target.value)}
                aria-label={t('UnitScoreDialog.dragToScoreTheUnit')}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-primary)]"
              />
              <div className="text-eyebrow mt-1.5 flex justify-between">
                <span>0</span>
                <span>{Math.round(maxScore / 2)}</span>
                <span>{maxScore}</span>
              </div>
            </div>
            {typed != null && !manual && (
              <p className="text-caption">{t('UnitScoreDialog.exactlyEqualsTheAverage')}{auto}{t('UnitScoreDialog.noReasonNeeded')}</p>
            )}
            {isQualMode && <p className="text-caption">{t('UnitScoreDialog.qualitativeCycleLevel55')} {maxScore} {t('UnitScoreDialog.points')}</p>}

            {manual && (
              <label className="flex flex-col gap-1.5">
                <span className="text-eyebrow">
                  {t('UnitScoreDialog.reasonForDifferingFromTheAverage')} <span className="text-[var(--color-error)]">*</span>
                </span>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder={t('UnitScoreDialog.eGTheDepartmentGotHigh')}
                />
              </label>
            )}
            {override != null && (summary.overriddenByName || summary.overriddenAt) && (
              <p className="text-caption">
                {t('UnitScoreDialog.scoringManually')} {summary.overriddenByName}
                {summary.overriddenAt && ` · ${format(parseISO(summary.overriddenAt), 'HH:mm dd/MM/yyyy')}`}
              </p>
            )}
          </>
        ) : (
          <p className="flex items-start gap-2 text-caption">
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {summary.status === 'FINALIZED'
              ? t('UnitScoreDialog.resultsAreLockedUnlockIfThe')
              : t('UnitScoreDialog.youCannotEditTheUnitScore')}
            {override != null && summary.overrideReason && <span className="italic"> {t('UnitScoreDialog.reason')} {summary.overrideReason}</span>}
          </p>
        )}

        {summary.comment && (
          <p className="flex items-start gap-2 border-t border-[var(--color-border)] pt-3 text-caption">
            <MessageSquare size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="italic">{summary.comment}</span>
          </p>
        )}
      </div>
    </Dialog>
  )
}
