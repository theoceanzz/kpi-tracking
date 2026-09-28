import { Scissors } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateField } from '@/components/common/DateTimePicker'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { cn } from '@/lib/utils'
import { LockedHint } from './CycleLockHint'
import type { PeriodDraft } from '../hooks/usePeriodDecisions'
import { endOfDayIso, fitsIn, fmtDay, startOfDayIso, toDay } from '../utils/cycleLockDates'
import {
  BUCKET_LABEL, BUCKET_ORDER, PROGRESS_LABEL,
  type CycleLockPreview, type CycleRef, type PeriodLockAction, type PeriodPreview,
} from '../types/cycleLock'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Các mảnh giao diện khoá kỳ, dùng chung giữa hộp thoại Khoá kỳ và Khoá kết quả ở đơn vị gốc. */

const ACTION_LABEL = perLanguage((): Record<PeriodLockAction, string> => ({
  TRANSFER: i18n.t('kpi:CycleLockParts.moveToAnotherCycle'),
  CLOSE: i18n.t('kpi:CycleLockParts.closeAsIs'),
  CANCEL: i18n.t('kpi:CycleLockParts.cancelPeriod'),
}))

export function LockEffects() {
  const { t } = useTranslation('kpi')
  return (
    <ul className="list-disc space-y-1 pl-5 text-caption">
      <li>{t('CycleLockParts.kpisCanNoLongerBeCreated')}</li>
      <li>{t('CycleLockParts.periodsCannotBeCreatedEditedThe')}</li>
      <li>{t('CycleLockParts.reportsCanStillBeViewedAnd')}</li>
      <li>{t('CycleLockParts.theCyclesDeadlineRemindersTurnOff')}</li>
    </ul>
  )
}

export function PeriodTable({ periods }: { periods: PeriodPreview[] }) {
  const { t } = useTranslation('kpi')
  return (
    <div className="overflow-x-auto rounded-card border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
            <th scope="col" className="px-3 py-2 text-left text-eyebrow">{t('CycleLockParts.aPeriod')}</th>
            <th scope="col" className="px-3 py-2 text-left text-eyebrow">{t('CycleLockParts.progress')}</th>
            <th scope="col" className="px-3 py-2 text-left text-eyebrow">{t('CycleLockParts.kpisByStatus')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {periods.map(p => (
            <tr key={p.periodId}>
              <td className="px-3 py-2 align-top">
                <p className="font-medium text-[var(--color-foreground)]">{p.name}</p>
                <p className="text-caption tabular-nums">{fmtDay(p.startDate)} – {fmtDay(p.endDate)}</p>
              </td>
              <td className="px-3 py-2 align-top">
                <Badge variant={p.progress === 'COMPLETED' ? 'success' : p.progress === 'IN_PROGRESS' ? 'warning' : 'secondary'}>
                  {PROGRESS_LABEL()[p.progress]}
                </Badge>
              </td>
              <td className="px-3 py-2 align-top">
                <BucketChips counts={p.bucketCounts} total={p.kpiCount} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BucketChips({ counts, total }: { counts: PeriodPreview['bucketCounts']; total: number }) {
  const { t } = useTranslation('kpi')
  if (total === 0) return <span className="text-caption">{t('CycleLockParts.noKpis')}</span>
  return (
    <div className="flex flex-wrap gap-1">
      {BUCKET_ORDER.filter(b => (counts[b] ?? 0) > 0).map(b => (
        <Badge key={b} variant={b === 'COMPLETED' || b === 'CLOSED' ? 'secondary' : b === 'AWAITING_EVALUATION' ? 'info' : 'outline'}>
          {BUCKET_LABEL()[b]}: <span className="tabular-nums">{counts[b]}</span>
        </Badge>
      ))}
    </div>
  )
}

export function PeriodDecisionRow({ period, draft, targets, problem, onChange }: {
  period: PeriodPreview
  draft: PeriodDraft | undefined
  targets: CycleRef[]
  problem: string | null
  onChange: (patch: Partial<PeriodDraft>) => void
}) {
  const { t: tr } = useTranslation('kpi')
  const target = targets.find(t => t.id === draft?.targetCycleId)
  const start = draft?.start ? startOfDayIso(draft.start) : period.startDate
  const end = draft?.end ? endOfDayIso(draft.end) : period.endDate
  const needsDates = draft?.action === 'TRANSFER' && !!target && (!fitsIn(period.startDate, period.endDate, target) || !!draft.start || !!draft.end)
  const actions: { key: PeriodLockAction; disabled: boolean; hint?: string }[] = [
    { key: 'TRANSFER', disabled: targets.length === 0, hint: tr('CycleLockParts.noValidTargetCycleSameType') },
    { key: 'CLOSE', disabled: false },
    { key: 'CANCEL', disabled: !period.canCancel, hint: tr('CycleLockParts.onlyPeriodsThatHaveNotStarted') },
  ]

  const pickTarget = (id: string) => {
    const t = targets.find(x => x.id === id)
    // Đợt không vừa kỳ đích ⇒ điền sẵn ngày đã kẹp vào kỳ đích để người dùng chỉ cần xác nhận/chỉnh.
    if (t && !fitsIn(period.startDate, period.endDate, t)) {
      onChange({ targetCycleId: id, start: toDay(t.startDate), end: toDay(t.endDate) })
    } else {
      onChange({ targetCycleId: id, start: undefined, end: undefined })
    }
  }

  return (
    <div className={cn('space-y-3 rounded-card border p-3', problem ? 'border-[var(--color-border)]' : 'border-[var(--color-success-border)]')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{period.name}</p>
          <p className="text-caption tabular-nums">{fmtDay(period.startDate)} – {fmtDay(period.endDate)} · {PROGRESS_LABEL()[period.progress]}</p>
        </div>
        <BucketChips counts={period.bucketCounts} total={period.kpiCount} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-card bg-[var(--color-muted)] p-1" role="radiogroup" aria-label={tr('CycleLockParts.howToHandlePeriod', { name: period.name })}>
        {actions.map(a => (
          <LockedHint key={a.key} reason={a.disabled ? a.hint ?? null : null} className="w-full">
            <ChoiceChip
              variant="segment"
              className="w-full"
              selected={draft?.action === a.key}
              disabled={a.disabled}
              role="radio"
              aria-checked={draft?.action === a.key}
              onClick={() => onChange({ action: a.key })}
            >
              <span className="truncate">{ACTION_LABEL()[a.key]}</span>
            </ChoiceChip>
          </LockedHint>
        ))}
      </div>

      {draft?.action === 'TRANSFER' && (
        <div className="space-y-2">
          <Select value={draft.targetCycleId ?? ''} onValueChange={pickTarget}>
            <SelectTrigger className="w-full" aria-label={tr('CycleLockParts.targetCycle')}><SelectValue placeholder={tr('CycleLockParts.chooseTargetCycle')} /></SelectTrigger>
            <SelectContent>
              {targets.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name} ({fmtDay(t.startDate)} – {fmtDay(t.endDate)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period.willSplitOnTransfer ? (
            <p className="flex items-start gap-1.5 text-caption">
              <Scissors className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {tr('CycleLockParts.thePeriodHasEvaluatedKpisSo')} {period.unfinishedKpiCount} {tr('CycleLockParts.unfinishedKpisMoveToANew')}
              {' '}{period.kpiCount - period.unfinishedKpiCount} {tr('CycleLockParts.finishedKpisStayAndTheOld')}
            </p>
          ) : (
            <p className="text-caption">{tr('CycleLockParts.moveTheWholePeriodWith')} {period.kpiCount} {tr('CycleLockParts.kpisKeepingEachKpisStatus')}</p>
          )}
          {needsDates && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-label block">{tr('CycleLockParts.periodStart')}</label>
                <DateField value={draft.start ?? toDay(start)} onChange={v => onChange({ start: v })}
                  min={toDay(target?.startDate)} max={toDay(target?.endDate)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-label block">{tr('CycleLockParts.periodEnd')}</label>
                <DateField value={draft.end ?? toDay(end)} onChange={v => onChange({ end: v })}
                  min={toDay(target?.startDate)} max={toDay(target?.endDate)} className="w-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {draft?.action === 'CLOSE' && (
        <p className="text-caption">
          {period.unfinishedKpiCount} {tr('CycleLockParts.unfinishedKpisWillBeMarkedClosed')}
        </p>
      )}
      {draft?.action === 'CANCEL' && (
        <p className="text-caption">{tr('CycleLockParts.thePeriodIsCancelled')} {period.kpiCount > 0 ? tr('CycleLockParts.draftKpisDeleted', { count: period.kpiCount }) : tr('CycleLockParts.thePeriodHasNoKpis')}</p>
      )}
      {draft?.action && problem && <p className="text-caption text-[var(--color-error)]">{problem}</p>}
    </div>
  )
}

export function LockSummary({ preview, unfinished, drafts }: {
  preview: CycleLockPreview; unfinished: PeriodPreview[]; drafts: Record<string, PeriodDraft>
}) {
  const { t: tr } = useTranslation('kpi')
  const byAction = (a: PeriodLockAction) => unfinished.filter(p => drafts[p.periodId]?.action === a)
  const transfers = byAction('TRANSFER')
  const closes = byAction('CLOSE')
  const cancels = byAction('CANCEL')
  const targetNames = [...new Set(transfers.map(p => preview.targetCycles.find(t => t.id === drafts[p.periodId]?.targetCycleId)?.name))]
    .filter(Boolean).map(n => `"${n}"`).join(', ')
  const splitCount = transfers.filter(p => p.willSplitOnTransfer).length
  const closedKpis = closes.reduce((s, p) => s + p.unfinishedKpiCount, 0)

  return (
    <div className="space-y-4">
      <ul className="space-y-2 text-sm text-[var(--color-foreground)]">
        {transfers.length > 0 && (
          <li>{tr('CycleLockParts.will')} <strong>{tr('CycleLockParts.move')} {transfers.length} {tr('CycleLockParts.periods')}</strong> {tr('CycleLockParts.toCycle')} {targetNames}
            {splitCount > 0 && <> {tr('CycleLockParts.ofWhich')} {splitCount} {tr('CycleLockParts.periodsAreSplit')}</>}.</li>
        )}
        {closes.length > 0 && <li>{tr('CycleLockParts.will')} <strong>{tr('CycleLockParts.close')} {closes.length} {tr('CycleLockParts.periods')}</strong> — {closedKpis} {tr('CycleLockParts.unfinishedKpisNotScored')}</li>}
        {cancels.length > 0 && <li>{tr('CycleLockParts.will')} <strong>{tr('CycleLockParts.cancel')} {cancels.length} {tr('CycleLockParts.periods')}</strong> {tr('CycleLockParts.notStarted')}</li>}
        <li>{tr('CycleLockParts.then')} <strong>{tr('CycleLockParts.lockCycle')}{preview.cycleName}"</strong>.</li>
      </ul>
      <p className="text-caption">
        {tr('CycleLockParts.everyStepRunsInOneGo')}
      </p>
      <LockEffects />
    </div>
  )
}
