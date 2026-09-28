import { useMemo, useState } from 'react'
import type { CycleLockPreview, PeriodDecision, PeriodLockAction, PeriodPreview } from '../types/cycleLock'
import { endOfDayIso, fitsIn, startOfDayIso } from '../utils/cycleLockDates'
import { useTranslation } from 'react-i18next'

/** Quyết định đang soạn cho một đợt dở. Ngày ở dạng yyyy-MM-dd của ô chọn ngày. */
export interface PeriodDraft {
  action?: PeriodLockAction
  targetCycleId?: string
  start?: string
  end?: string
}

/**
 * Trạng thái "chọn cách xử lý từng đợt dở" khi khoá kỳ — dùng chung cho hộp thoại Khoá kỳ và
 * hộp thoại Khoá kết quả ở đơn vị gốc (vốn khoá luôn kỳ).
 */
export function usePeriodDecisions(preview: CycleLockPreview | undefined) {
  const { t } = useTranslation('kpi')
  const [drafts, setDrafts] = useState<Record<string, PeriodDraft>>({})
  const unfinished = useMemo(() => (preview?.periods ?? []).filter(p => p.progress !== 'COMPLETED'), [preview])

  const setDraft = (periodId: string, patch: Partial<PeriodDraft>) =>
    setDrafts(prev => ({ ...prev, [periodId]: { ...prev[periodId], ...patch } }))

  /** Lý do một quyết định chưa đủ để khoá (null = đủ). */
  const draftProblem = (p: PeriodPreview): string | null => {
    const d = drafts[p.periodId]
    if (!d?.action) return t('usePeriodDecisions.noHandlingOptionChosen')
    if (d.action === 'CANCEL' && !p.canCancel) return t('usePeriodDecisions.onlyPeriodsThatHaveNotStarted')
    if (d.action !== 'TRANSFER') return null
    const target = preview?.targetCycles.find(c => c.id === d.targetCycleId)
    if (!target) return t('usePeriodDecisions.noTargetCycleChosen')
    const start = d.start ? startOfDayIso(d.start) : p.startDate
    const end = d.end ? endOfDayIso(d.end) : p.endDate
    if (!start || !end || new Date(end) <= new Date(start)) return t('usePeriodDecisions.invalidPeriodDates')
    if (!fitsIn(start, end, target)) return t('usePeriodDecisions.thePeriodDatesMustBeWithin')
    return null
  }

  const allDecided = unfinished.every(p => draftProblem(p) === null)

  const decisions: PeriodDecision[] = unfinished.map(p => {
    const d = drafts[p.periodId] ?? {}
    return {
      periodId: p.periodId,
      action: d.action!,
      targetCycleId: d.action === 'TRANSFER' ? d.targetCycleId : null,
      newStartDate: d.action === 'TRANSFER' && d.start ? startOfDayIso(d.start) : null,
      newEndDate: d.action === 'TRANSFER' && d.end ? endOfDayIso(d.end) : null,
    }
  })

  return { unfinished, drafts, setDraft, draftProblem, allDecided, decisions }
}
