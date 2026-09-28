import { LocaleNumberInput } from '@/components/ui/number-input'
import { useState } from 'react'
import { Loader2, ShieldAlert, PenLine, Undo2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useWaterfall, useOverrideMutation } from '../hooks/useBscCascade'
import { BscEmptyPerspectivePolicy } from '../types'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface BscWaterfallModalProps {
  open: boolean
  onClose: () => void
  evaluationId: string | null
}

/** Lý do ghi đè: danh mục cố định để báo cáo gom nhóm được, kèm ô diễn giải tự do. */
const REASON_CODES = perLanguage(() => ([
  { code: 'CALIBRATION', label: i18n.t('bsc:BscWaterfallModal.committeeCalibration') },
  { code: 'SPECIAL_CONTRIBUTION', label: i18n.t('bsc:BscWaterfallModal.specialContributionOutsideKpis') },
  { code: 'DATA_ISSUE', label: i18n.t('bsc:BscWaterfallModal.sourceDataWrongMissing') },
  { code: 'NEW_JOINER', label: i18n.t('bsc:BscWaterfallModal.newHireLongLeave') },
  { code: 'TRANSFER', label: i18n.t('bsc:BscWaterfallModal.unitTransferMidCycle') },
  { code: 'OTHER', label: i18n.t('bsc:BscWaterfallModal.otherReason') },
]))

const fmt = (v?: number | null, digits = 1) => (v == null ? '—' : v.toFixed(digits))

/**
 * Diễn giải đầy đủ điểm của một cá nhân — màn hình quyết định nhân viên có chấp nhận kết quả hay không.
 *
 * <p>Trình bày đúng thứ tự của mô hình: điểm gốc → cap 120 → điểm công nhận → ghi đè. Điểm cá nhân
 * KHÔNG bị nhân hệ số của phòng/công ty. Hạng mục chặn nằm TÁCH RIÊNG bên dưới vì nó không đụng vào
 * điểm, chỉ hạ trần xếp loại — vẽ nó như một bước trừ điểm là mô tả sai mô hình.
 */
export default function BscWaterfallModal({ open, onClose, evaluationId }: BscWaterfallModalProps) {
  const { t } = useTranslation('bsc')
  const { data, isLoading } = useWaterfall(open && evaluationId ? evaluationId : undefined)
  const override = useOverrideMutation()
  const { hasPermission } = usePermission()
  const canOverride = hasPermission('BSC:OVERRIDE_SCORE')

  const [editing, setEditing] = useState(false)
  const [score, setScore] = useState<string>('')
  const [reasonCode, setReasonCode] = useState(REASON_CODES()[0]!.code)
  const [comment, setComment] = useState('')

  if (!open) return null

  const submitOverride = () => {
    if (!evaluationId) return
    const value = score.trim() === '' ? null : Number(score)
    override.mutate(
      { evaluationId, data: { score: value, reasonCode, comment: comment.trim() || undefined } },
      { onSuccess: () => setEditing(false) },
    )
  }

  const clearOverride = () => {
    if (!evaluationId) return
    // Huỷ ghi đè vẫn phải có lý do — nó cũng là một quyết định làm đổi điểm đã công bố.
    override.mutate({ evaluationId, data: { score: null, reasonCode: 'OTHER', comment: t('BscWaterfallModal.cancelOverride') } })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('BscWaterfallModal.bscScoreBreakdown')}
      description={
        <>
          {data?.userName || '—'}
          {data?.orgUnitName ? ` · ${data.orgUnitName}` : ''}
          {data?.kpiPeriodName ? ` · ${data.kpiPeriodName}` : ''}
        </>
      }
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-[var(--color-subtle-foreground)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* Hạng mục rỗng là thứ hay làm người xem sốc nhất: làm đúng một hạng mục 25% mà
                điểm gốc vẫn 150. Nói thẳng ra ngay trên đầu, trước cả chuỗi tính. */}
            {(() => {
              const empty = data.perspectives.filter(p => p.achievementPercent == null)
              if (empty.length === 0) return null
              const presentWeight = data.perspectives
                .filter(p => p.achievementPercent != null)
                .reduce((sum, p) => sum + (p.weightPercentage ?? 0), 0)
              const renormalize = data.emptyPerspectivePolicy !== BscEmptyPerspectivePolicy.ZERO_FILL
              return (
                <div className="rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] dark:border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)] p-4">
                  <p className="text-xs font-semibold text-[var(--color-warning)] mb-1">
                    {empty.length} {t('BscWaterfallModal.itemsWithoutAnyKpi')} {empty.map(p => p.name).join(', ')}
                  </p>
                  <p className="text-xs font-medium text-[var(--color-warning)] leading-relaxed">
                    {renormalize
                      ? <>{t('BscWaterfallModal.theScorecardIsSetTo')} <b>{t('BscWaterfallModal.skipEmptyItems')}</b>{t('BscWaterfallModal.soTheScoreIsComputedOnly')}{' '}
                          <b>{fmt(presentWeight, 0)}%</b> {t('BscWaterfallModal.weightThatHasDataAndThen')} <b>{t('BscWaterfallModal.countAs0Points')}</b> {t('BscWaterfallModal.inTheScorecard')}</>
                      : <>{t('BscWaterfallModal.theScorecardIsSetTo')} <b>{t('BscWaterfallModal.countEmptyItemsAs0')}</b>{t('BscWaterfallModal.soTheItemsAbovePulledThe')}</>}
                  </p>
                </div>
              )
            })()}

            {/* ── Chuỗi tính điểm ───────────────────────────── */}
            <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
              <Step
                label={t('BscWaterfallModal.employeesRawScore')}
                value={fmt(data.rawBscScore)}
                hint={t('BscWaterfallModal.bscScoreComputedFromIndividualKpis')}
              />
              <Step
                label={t('BscWaterfallModal.cap', { recognizedCapPercent: fmt(data.recognizedCapPercent, 0) })}
                value={fmt(data.cappedScore)}
                hint={t('BscWaterfallModal.anythingAboveTheCapIsCut')}
                muted={data.rawBscScore != null && data.cappedScore != null && data.rawBscScore <= data.cappedScore}
              />
              <Step
                label={t('BscWaterfallModal.recognizedScore')}
                value={fmt(data.recognizedScore)}
                hint={t('BscWaterfallModal.minRawScoreCapDepartmentCompany')}
                strong
              />
              {data.overrideScore != null && (
                <Step
                  label={t('BscWaterfallModal.scoreAfterOverride')}
                  value={fmt(data.overrideScore)}
                  hint={`${data.overrideReasonCode || ''}${data.overrideComment ? ` — ${data.overrideComment}` : ''}`
                    + (data.overriddenByName ? ` · ${data.overriddenByName}` : '')}
                  strong
                  accent="amber"
                />
              )}
            </div>

            <div className="flex items-baseline justify-between px-1">
              <span className="text-eyebrow">{t('BscWaterfallModal.finalScore')}</span>
              <span className="text-3xl font-semibold text-[var(--color-primary)]">{fmt(data.finalScore)}</span>
            </div>

            {/* ── Hạng mục chặn: tách riêng, KHÔNG nằm trong chuỗi nhân ── */}
            <div className={cn('rounded-card border p-4',
              data.gatePassed === false
                ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] dark:border-[var(--color-error-border)] dark:bg-[var(--color-error-bg)]'
                : 'border-[var(--color-border)]')}>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert size={14} className={data.gatePassed === false ? 'text-[var(--color-error)]' : 'text-[var(--color-subtle-foreground)]'} />
                <span className="text-xs font-semibold text-[var(--color-foreground)]">{t('BscWaterfallModal.gateItems')}</span>
              </div>
              {data.gatePassed === false ? (
                <p className="text-xs font-medium text-[var(--color-error)]">
                  {t('BscWaterfallModal.notMet')} {data.gateFailedItems}
                  {data.gateCapRating != null && (
                    <> {t('BscWaterfallModal.ratingCapLoweredToLevel')} {data.gateCapRating}</>
                  )}
                  <span className="block mt-1 text-[var(--color-muted-foreground)] font-medium">
                    {t('BscWaterfallModal.theScoreIsNotReducedOnly')}
                  </span>
                </p>
              ) : (
                <p className="text-caption">
                  {t('BscWaterfallModal.noGateItemWasMissed')}
                </p>
              )}
              {data.matrixRating != null && (
                <p className="text-caption mt-1">{t('BscWaterfallModal.currentRatingLevel')} {data.matrixRating}</p>
              )}
            </div>

            {/* ── Ràng buộc trọng số liên kết BSC ───────────── */}
            {data.linkedWeightPercent != null && (
              <div className={cn('rounded-card border p-4 text-xs font-medium',
                data.linkedWeightSatisfied === false
                  ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]'
                  : 'border-[var(--color-border)] text-[var(--color-subtle-foreground)]')}>
                {t('BscWaterfallModal.kpiWeightLinkedToBsc')} {fmt(data.linkedWeightPercent, 0)}%
                {data.linkedWeightRequired != null && <> {t('BscWaterfallModal.minimum')} {fmt(data.linkedWeightRequired, 0)}%</>}
                {data.linkedWeightSatisfied === false && (
                  <span className="block mt-0.5 font-medium">
                    {t('BscWaterfallModal.mostOfThisPersonsKpisAre')}
                  </span>
                )}
              </div>
            )}

            {/* ── Ghi đè thủ công ───────────────────────────── */}
            {canOverride && (
              <div className="rounded-card border border-[var(--color-border)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-foreground)]">{t('BscWaterfallModal.overrideScore')}</span>
                  {!editing && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setScore(data.overrideScore?.toString() ?? '') }}>
                        <PenLine aria-hidden="true" /> {data.overrideScore != null ? t('BscWaterfallModal.edit') : t('BscWaterfallModal.override')}
                      </Button>
                      {data.overrideScore != null && (
                        <Button variant="secondary" size="sm" onClick={clearOverride} disabled={override.isPending}>
                          <Undo2 aria-hidden="true" /> {t('BscWaterfallModal.cancelOverride')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="space-y-2">
                    <p className="text-caption">
                      {t('BscWaterfallModal.anOverrideIsAnExceptionThat')}
                    </p>
                    <div className="flex gap-2">
                      <LocaleNumberInput type="number" step="any" value={score} onChange={e => setScore(e.target.value)}
                        placeholder={fmt(data.recognizedScore)}
                        className="w-28 px-3 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-semibold outline-none" />
                      <Select value={reasonCode} onValueChange={setReasonCode}>
                        <SelectTrigger className="flex-1 h-[38px] rounded-card px-3 text-xs font-medium bg-[var(--color-muted)] border-[var(--color-border)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[1100]">
                          {REASON_CODES().map(r => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                      placeholder={t('BscWaterfallModal.explainInDetail')}
                      className="w-full px-3 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium outline-none" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>{t('BscWaterfallModal.cancel')}</Button>
                      <Button size="sm" onClick={submitOverride} disabled={override.isPending}>
                        {override.isPending ? t('BscWaterfallModal.saving') : t('BscWaterfallModal.saveOverride')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Breakdown hạng mục ────────────────────────── */}
            {data.perspectives?.length > 0 && (
              <div className="rounded-card border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {data.perspectives.map(p => (
                  <div key={p.perspectiveId} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                    <span className="flex-1 text-xs font-medium text-[var(--color-foreground)] truncate">
                      {p.name}
                      {p.isGate && (
                        <span className={cn('ml-1.5 text-xs font-medium',
                          p.gatePassed === false ? 'text-[var(--color-error)]' : 'text-[var(--color-subtle-foreground)]')}>
                          {t('BscWaterfallModal.gate')}
                        </span>
                      )}
                    </span>
                    <span className="text-caption">{fmt(p.weightPercentage, 0)}%</span>
                    <span className={cn('w-24 text-right text-xs font-semibold',
                      p.achievementPercent == null
                        ? 'text-xs font-medium text-[var(--color-warning)]'
                        : 'text-[var(--color-foreground)]')}>
                      {p.achievementPercent == null ? t('BscWaterfallModal.noKpi') : fmt(p.achievementPercent)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}

function Step({ label, value, hint, strong, muted, accent }: {
  label: string
  value: string
  hint?: string
  strong?: boolean
  muted?: boolean
  accent?: 'amber'
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-[var(--color-border)]',
      strong && 'bg-[var(--color-muted)]',
      accent === 'amber' && 'bg-[var(--color-warning-bg)]',
      muted && 'opacity-60')}>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs truncate', strong ? 'font-semibold text-[var(--color-foreground)]' : 'font-semibold text-[var(--color-muted-foreground)]')}>
          {label}
        </p>
        {hint && <p className="text-caption truncate">{hint}</p>}
      </div>
      <span className={cn('shrink-0 tabular-nums',
        strong ? 'text-base font-semibold text-[var(--color-foreground)]' : 'text-sm font-medium text-[var(--color-foreground)]')}>
        {value}
      </span>
    </div>
  )
}
