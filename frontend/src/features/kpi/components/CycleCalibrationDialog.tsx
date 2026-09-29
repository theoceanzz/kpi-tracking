import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, CheckCheck, CheckCircle2, Loader2, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalibrationPlan, CalibrationSuggestion } from '../api/kpiCycleEvaluationApi'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useTranslation } from 'react-i18next'

/**
 * Bước 3 của luồng đánh giá kỳ: ĐỀ XUẤT HIỆU CHỈNH theo khung bell curve — hộp thoại mở từ
 * nút trên dải bước; kết luận (trong khung / lệch / vượt trần) đã nằm sẵn trên ô bước ③.
 *
 * Bell curve trước đây chỉ là một biểu đồ để nhìn; người chốt phải tự dò bảng xem hạ ai, nâng
 * ai. Panel này nói thẳng: mức nào đang thừa/thiếu mấy suất, và danh sách người nên dời — kèm
 * số cụ thể ("92.5 → 89.5", "Loại 4 → Loại 3"). Con số tính ở server cùng bộ luật với biểu đồ.
 *
 * Giảm thao tác: "Áp dụng tất cả" ở header làm một lượt cho cả danh sách (một lần tải lại);
 * từng dòng vẫn có Áp dụng / Bỏ qua cho ai muốn cân nhắc lẻ. Đề xuất "bắt buộc" gỡ mức vượt
 * trần — khung chặn sẽ không cho khoá nếu bỏ qua; "tuỳ chọn" chỉ lấp sàn.
 */
export default function CycleCalibrationDialog({
  plan, isLoading, canEdit, applyingUserId, isApplyingAll, onApply, onApplyAll, onOpenMember, onClose,
}: {
  plan?: CalibrationPlan
  isLoading: boolean
  canEdit: boolean
  applyingUserId: string | null
  isApplyingAll: boolean
  onApply: (s: CalibrationSuggestion) => Promise<unknown>
  onApplyAll: (list: CalibrationSuggestion[]) => Promise<unknown>
  onOpenMember: (userId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('kpi')
  // Bỏ qua chỉ là ẩn tại chỗ trong phiên này — server tính lại sau mỗi lần áp dụng, người bị bỏ
  // qua có thể được đề xuất lại nếu vẫn là lựa chọn hợp lý.
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const skip = (id: string) => setSkipped(prev => new Set(prev).add(id))

  const visible = (plan?.suggestions ?? []).filter(s => !skipped.has(s.userId))
  const required = visible.filter(s => s.required)
  const optional = visible.filter(s => !s.required)
  const complete = !!plan && plan.evaluated >= plan.headcount
  const overSlots = plan?.slots.filter(s => s.over) ?? []
  const underSlots = plan && complete ? plan.slots.filter(s => s.under) : []
  const busy = applyingUserId != null || isApplyingAll

  const summary = !plan ? t('CycleCalibrationDialog.computing') : !plan.configured
    ? t('CycleCalibrationDialog.theUnitHasNoBellCurve')
    : plan.evaluated === 0
      ? t('CycleCalibrationDialog.noOneHasACycleScore')
      : visible.length === 0
        ? (plan.withinFrame ? t('CycleCalibrationDialog.theDistributionIsWithinTheQuota') : t('CycleCalibrationDialog.noSuggestionsLeft'))
        : [required.length && t('CycleCalibrationDialog.required', { length: required.length }), optional.length && t('CycleCalibrationDialog.optional', { length: optional.length })]
            .filter(Boolean).join(' · ') + t('CycleCalibrationDialog.peopleScored', { evaluated: plan.evaluated, headcount: plan.headcount })

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!busy}
      title={t('CycleCalibrationDialog.calibrateToTheBellCurveQuota')}
      description={summary}
      headerExtra={plan ? <FrameBadge plan={plan} /> : undefined}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('CycleCalibrationDialog.close')}</Button>}
          primary={canEdit && plan && visible.length > 0 && (
            <Button onClick={() => onApplyAll(required.length ? required : visible)} disabled={busy}
              title={required.length ? t('CycleCalibrationDialog.applyAllRequiredSuggestionsAtOnce') : t('CycleCalibrationDialog.applyAllSuggestionsAtOnce')}>
              {isApplyingAll ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
              {t('CycleCalibrationDialog.apply')} {required.length ? t('CycleCalibrationDialog.required', { length: required.length }) : t('CycleCalibrationDialog.all', { length: visible.length })}
            </Button>
          )}
        />
      }
    >
      {isLoading && !plan ? <LoadingSkeleton rows={3} /> : !plan ? null : (
        <>
      {!plan.configured ? (
          <p className="text-caption">
            {t('CycleCalibrationDialog.turnOnTheQuotaIn')} <b>{t('CycleCalibrationDialog.settingsUnitRatingBellCurve')}</b> {t('CycleCalibrationDialog.ifYouWantToEnforceThe')}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Tóm tắt lệch khung — đọc một dòng là biết vì sao có đề xuất bên dưới. */}
            {(overSlots.length > 0 || underSlots.length > 0) && (
              <ul className="flex flex-wrap gap-2">
                {overSlots.map(s => (
                  <li key={s.level} className="inline-flex items-center gap-1.5 rounded-control border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-error)]">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.level} {s.currentCount}/{s.maxCount} {t('CycleCalibrationDialog.over')} {s.currentCount - s.maxCount}
                  </li>
                ))}
                {underSlots.map(s => (
                  <li key={s.level} className="inline-flex items-center gap-1.5 rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-warning)]">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.level} {s.currentCount}/{s.minCount} {t('CycleCalibrationDialog.short')} {s.minCount - s.currentCount}
                  </li>
                ))}
              </ul>
            )}
  
            {visible.length === 0 ? (
              <p className={cn('flex items-center gap-2 text-sm font-medium', plan.withinFrame && plan.evaluated > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-muted-foreground)]')}>
                {plan.withinFrame && plan.evaluated > 0 && <CheckCircle2 size={16} aria-hidden="true" />}
                {plan.evaluated === 0
                  ? t('CycleCalibrationDialog.scoreMembersForTheCycleFirst')
                  : plan.withinFrame
                    ? t('CycleCalibrationDialog.theDistributionIsWithinTheQuota2')
                    : plan.suggestions.length > 0
                      ? t('CycleCalibrationDialog.allSuggestionsWereSkippedInThis')
                      : t('CycleCalibrationDialog.stillOutsideTheQuotaButNo')}
              </p>
            ) : (
              <>
                {required.length > 0 && (
                  <SuggestionGroup
                    title={t('CycleCalibrationDialog.requiredToGetWithinTheQuota')} tone="error" items={required}
                    hint={plan.mode === 'block' ? t('CycleCalibrationDialog.theQuotaIsBlockingResultsCannot') : t('CycleCalibrationDialog.theQuotaIsWarningOnlyResults')}
                    canEdit={canEdit} busy={busy} applyingUserId={applyingUserId}
                    onApply={onApply} onApplyAll={onApplyAll} onSkip={skip} onOpenMember={onOpenMember}
                  />
                )}
                {optional.length > 0 && (
                  <SuggestionGroup
                    title={t('CycleCalibrationDialog.optionalFillTheLevelsThatAre')} tone="warning" items={optional}
                    hint={t('CycleCalibrationDialog.moveUpTheStrongestPersonFrom')}
                    canEdit={canEdit} busy={busy} applyingUserId={applyingUserId}
                    onApply={onApply} onApplyAll={onApplyAll} onSkip={skip} onOpenMember={onOpenMember}
                  />
                )}
              </>
            )}
          </div>
        )}
  
        </>
      )}
    </Dialog>
  )
}

function FrameBadge({ plan }: { plan: CalibrationPlan }) {
  const { t } = useTranslation('kpi')
  if (!plan.configured) return null
  const cls = 'text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-2.5 py-1'
  if (plan.evaluated === 0) {
    return <span className={cn(cls, 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]')}>{t('CycleCalibrationDialog.noScore')}</span>
  }
  if (plan.blocked) {
    return (
      <span className={cn(cls, 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]')}>
        <ShieldAlert size={12} aria-hidden="true" /> {t('CycleCalibrationDialog.aboveTheCeiling')}
      </span>
    )
  }
  if (plan.withinFrame) {
    return (
      <span className={cn(cls, 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]')}>
        <Check size={12} aria-hidden="true" /> {t('CycleCalibrationDialog.withinCurve')}
      </span>
    )
  }
  return <span className={cn(cls, 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]')}>{t('CycleCalibrationDialog.outsideQuota')}</span>
}

function SuggestionGroup({
  title, hint, tone, items, canEdit, busy, applyingUserId, onApply, onApplyAll, onSkip, onOpenMember,
}: {
  title: string
  hint: string
  tone: 'error' | 'warning'
  items: CalibrationSuggestion[]
  canEdit: boolean
  busy: boolean
  applyingUserId: string | null
  onApply: (s: CalibrationSuggestion) => Promise<unknown>
  onApplyAll: (list: CalibrationSuggestion[]) => Promise<unknown>
  onSkip: (userId: string) => void
  onOpenMember: (userId: string) => void
}) {
  const { t } = useTranslation('kpi')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className={cn('text-sm font-semibold', tone === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]')}>
          {title} <span className="text-caption font-medium">({items.length})</span>
          <span className="text-caption ml-2 font-medium">{hint}</span>
        </h4>
        {canEdit && items.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => onApplyAll(items)} disabled={busy}>
            <CheckCheck aria-hidden="true" /> {t('CycleCalibrationDialog.applyTheWholeGroup')}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-card border border-[var(--color-border)]">
        {items.map(s => {
          const mine = applyingUserId === s.userId
          const down = s.direction === 'DOWN'
          return (
            <li key={s.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => onOpenMember(s.userId)}
                className="min-w-0 flex-1 text-left"
                title={t('CycleCalibrationDialog.openTheScoringFormToAdjust')}
              >
                <p className="truncate text-sm font-medium text-[var(--color-foreground)] hover:underline">{s.userName}</p>
                <p className="truncate text-caption">{s.reason}</p>
              </button>

              <div className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
                <LevelChip label={s.fromLevel} color={s.fromColor} />
                {down ? <ArrowDown size={13} className="text-[var(--color-error)]" aria-hidden="true" />
                      : <ArrowUp size={13} className="text-[var(--color-success)]" aria-hidden="true" />}
                <LevelChip label={s.toLevel} color={s.toColor} />
              </div>

              <div className="w-28 text-right text-sm tabular-nums">
                {s.suggestedRating != null ? (
                  <>
                    <span className="text-[var(--color-muted-foreground)]">{s.currentRating ?? '—'}</span>
                    <span className="mx-1 text-[var(--color-subtle-foreground)]">→</span>
                    <span className="font-semibold text-[var(--color-foreground)]">{s.suggestedRating}</span>
                    <span className="text-caption">/5</span>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--color-muted-foreground)]">{s.currentScore ?? '—'}</span>
                    <span className="mx-1 text-[var(--color-subtle-foreground)]">→</span>
                    <span className="font-semibold text-[var(--color-foreground)]">{s.suggestedScore ?? '—'}</span>
                  </>
                )}
              </div>

              {canEdit && (
                <div className="flex items-center gap-0.5">
                  <Button variant="outline" size="sm" type="button" onClick={() => onApply(s)} disabled={busy}>
                    {mine ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                    {t('CycleCalibrationDialog.apply')}
                  </Button>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => onSkip(s.userId)} disabled={busy} aria-label={t('CycleCalibrationDialog.skipThisSuggestion')} title={t('CycleCalibrationDialog.skip')}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function LevelChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-control border px-2 py-0.5"
      style={{ color, backgroundColor: `${color}14`, borderColor: `${color}33` }}
    >
      {label}
    </span>
  )
}
