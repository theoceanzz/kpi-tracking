import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowRight, History } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getApiErrorMessage } from '@/lib/apiError'
import type { KpiCycle } from '@/types/kpi'
import { kpiCycleApi } from '../api/kpiCycleApi'
import type { KpiCycleEvent, KpiCycleEventAction } from '../types/cycleLock'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const ACTION_LABEL = perLanguage((): Record<KpiCycleEventAction, string> => ({
  LOCK: i18n.t('kpi:CycleHistoryDialog.cycleLock'),
  EXTEND: i18n.t('kpi:CycleHistoryDialog.extendCycle'),
  REOPEN: i18n.t('kpi:CycleHistoryDialog.reopenCycle'),
  PERIOD_TRANSFER: i18n.t('kpi:CycleHistoryDialog.moveWholePeriod'),
  PERIOD_SPLIT: i18n.t('kpi:CycleHistoryDialog.splitPeriod'),
  PERIOD_CLOSE: i18n.t('kpi:CycleHistoryDialog.closePeriod'),
  PERIOD_CANCEL: i18n.t('kpi:CycleHistoryDialog.cancelPeriod'),
}))

const fmtDate = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—')
const fmtTime = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy HH:mm')

function describe(e: KpiCycleEvent): string {
  const n = e.affectedKpiIds?.length ?? 0
  switch (e.action) {
    case 'EXTEND': {
      const periods = (e.detail?.extendedPeriods as unknown[] | undefined)?.length ?? 0
      return i18n.t('kpi:CycleHistoryDialog.cycleEndDate', { oldEndDate: fmtDate(e.oldEndDate), newEndDate: fmtDate(e.newEndDate), value: periods ? i18n.t('kpi:CycleHistoryDialog.extendedTheDeadlineOfUnfinishedPeriods', { count: periods }) : '' })
    }
    case 'LOCK':
      return (e.detail?.rootUnitName ? i18n.t('kpi:CycleHistoryDialog.lockedTheResultsOfRootUnit', { rootUnitName: e.detail.rootUnitName }) : '')
        + (e.detail?.option === 'ALL_COMPLETED' ? i18n.t('kpi:CycleHistoryDialog.allPeriodsWereCompleted') : i18n.t('kpi:CycleHistoryDialog.unfinishedPeriodsWereHandled'))
    case 'REOPEN':
      return i18n.t('kpi:CycleHistoryDialog.closedKpisAndMovedPeriodsAre', { value: e.reason ?? i18n.t('kpi:CycleHistoryDialog.reopenCycle2') })
    case 'PERIOD_TRANSFER':
      return i18n.t('kpi:CycleHistoryDialog.periodWithKpisMovedToCycle', { periodName: e.periodName, n, targetCycleName: e.targetCycleName })
    case 'PERIOD_SPLIT':
      return i18n.t('kpi:CycleHistoryDialog.unfinishedKpisOfPeriodMovedTo', { n, periodName: e.periodName, newPeriodName: e.newPeriodName, targetCycleName: e.targetCycleName })
    case 'PERIOD_CLOSE':
      return i18n.t('kpi:CycleHistoryDialog.periodKpisClosedAsClosedBy', { periodName: e.periodName, n })
    case 'PERIOD_CANCEL':
      return i18n.t('kpi:CycleHistoryDialog.periodWasCancelled', { periodName: e.periodName, value: n ? i18n.t('kpi:CycleHistoryDialog.deletedDraftKpis', { count: n }) : '' })
  }
}

/**
 * Lịch sử kỳ: mục chỉ đọc "Đợt đã chuyển đi" (link sang kỳ nhận) và toàn bộ nhật ký khoá / gia hạn /
 * mở lại. Bấm tên kỳ nhận để xem tiếp lịch sử của kỳ đó ngay trong hộp thoại.
 */
export function CycleHistoryDialog({ cycle, onClose }: { cycle: KpiCycle; onClose: () => void }) {
  const { t } = useTranslation('kpi')
  const [current, setCurrent] = useState<{ id: string; name: string }>({ id: cycle.id, name: cycle.name })
  const { data: events = [], isLoading, isError, error } = useQuery({
    queryKey: ['kpiCycleEvents', current.id],
    queryFn: () => kpiCycleApi.events(current.id),
  })
  const movedOut = events.filter(e => e.action === 'PERIOD_TRANSFER' || e.action === 'PERIOD_SPLIT')

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('CycleHistoryDialog.cycleHistory')}
      description={current.name}
      footer={
        <DialogFooter
          secondary={current.id !== cycle.id
            ? <Button variant="outline" onClick={() => setCurrent({ id: cycle.id, name: cycle.name })}>{t('CycleHistoryDialog.backToCycle')}{cycle.name}"</Button>
            : undefined}
          primary={<Button variant="outline" onClick={onClose}>{t('CycleHistoryDialog.close')}</Button>}
        />
      }
    >
      {isLoading ? (
        <p className="text-caption py-6 text-center">{t('CycleHistoryDialog.loading')}</p>
      ) : isError ? (
        <p className="text-sm text-[var(--color-error)]">{getApiErrorMessage(error, t('CycleHistoryDialog.couldNotLoadTheCycleHistory'))}</p>
      ) : (
        <div className="space-y-5">
          {movedOut.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-label">{t('CycleHistoryDialog.periodsMovedOut')}</h3>
              <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
                {movedOut.map(e => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
                    <span className="font-medium text-[var(--color-foreground)]">{e.periodName}</span>
                    <Badge variant="secondary">{e.action === 'PERIOD_SPLIT' ? t('CycleHistoryDialog.splitUnfinishedKpis', { value: e.affectedKpiIds?.length ?? 0 }) : t('CycleHistoryDialog.moveWholePeriod')}</Badge>
                    <ArrowRight className="size-3.5 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
                    {e.targetCycleId ? (
                      <button
                        type="button"
                        className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
                        onClick={() => setCurrent({ id: e.targetCycleId!, name: e.targetCycleName ?? '' })}
                      >
                        {e.targetCycleName}
                      </button>
                    ) : <span className="text-caption">{t('CycleHistoryDialog.cycleDeleted')}</span>}
                    {e.newPeriodName && <span className="text-caption">{t('CycleHistoryDialog.period')}{e.newPeriodName}"</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-label">{t('CycleHistoryDialog.log')}</h3>
            {events.length === 0 ? (
              <p className="text-caption">{t('CycleHistoryDialog.noLockExtensionOrReopenActions')}</p>
            ) : (
              <ol className="space-y-3">
                {events.map(e => (
                  <li key={e.id} className="flex gap-3">
                    <History className="mt-0.5 size-4 shrink-0 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--color-foreground)]">
                        <span className="font-semibold">{ACTION_LABEL()[e.action]}</span> — {describe(e)}
                      </p>
                      <p className="text-caption">{e.actorName ?? t('CycleHistoryDialog.system')} · {fmtTime(e.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Dialog>
  )
}
