import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormat } from '@/i18n/useFormat'
import AiShortcutButton from '../AiShortcutButton'
import { useBscObjectiveContributors } from '../../hooks/useBscGoalGraph'
import { statusLabelKey, statusTone } from './goalGraphModel'

/**
 * Bảng chi tiết của một mục tiêu: đơn vị nhận phân rã → người → KPI.
 *
 * <p>Mở NGAY trong ô (lớp phủ bên phải), không điều hướng đi đâu — BRD muốn drill-down bằng panel
 * chứ không phải mở trang mới. Mọi con số do server tính; %đạt của từng KPI đi qua đúng bộ tính
 * điểm của lõi nên trùng khít số đã sinh ra điểm BSC.
 */
export default function ObjectiveDetailPanel({ itemId, scope, onClose }: {
  itemId: string
  scope: { orgUnitId?: string; periodId?: string; periodIdTo?: string }
  onClose: () => void
}) {
  const { t } = useTranslation('analytics')
  const { percent, number } = useFormat()
  const { data, isLoading } = useBscObjectiveContributors(itemId, scope)
  const o = data?.objective
  const tone = statusTone(o?.status ?? 'NO_DATA')
  const fmt = (v?: number | null) => (v == null ? '—' : percent(v))
  const num = (v?: number | null) => (v == null ? '—' : number(v))

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-[26rem] z-10 flex flex-col bg-[var(--color-card)] border-l border-[var(--color-border)] shadow-lg">
      <header className="flex items-start gap-2 p-3 border-b border-[var(--color-border)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-foreground)] leading-5">
            {o?.derivedCode && <span className="text-slate-400 font-medium">{o.derivedCode}. </span>}
            {o?.name ?? t('goalGraph.objective')}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-400">
            {[o?.perspectiveName, o?.orgUnitName].filter(Boolean).join(' · ')}
          </p>
        </div>
        {o && (
          <AiShortcutButton
            size="sm"
            variant="ghost"
            label={t('goalGraph.analyzeWithAi')}
            prompt={t('goalGraph.aiObjectivePrompt', {
              objective: o.name ?? '',
              unit: o.orgUnitName ?? t('goalGraph.theCompany'),
            })}
          />
        )}
        <button onClick={onClose} aria-label={t('goalGraph.close')} className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] cursor-pointer shrink-0">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-3 space-y-4 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={cn('text-2xl font-semibold tabular-nums', tone.text)}>{fmt(o?.achievementPercent)}</span>
          <span className="text-xs font-medium text-slate-400 tabular-nums">
            {num(o?.actualValue)} / {num(o?.targetValue)}{o?.unit ? ` ${o.unit}` : ''}
          </span>
          <span className={cn('text-xs font-medium', tone.text)}>{t(statusLabelKey(o?.status ?? 'NO_DATA'))}</span>
          {o?.provisional && <span className="text-xs font-medium text-amber-600">{t('goalGraph.draftResult')}</span>}
        </div>

        {isLoading && <p className="text-xs text-slate-400">{t('goalGraph.loading')}</p>}

        <Section title={t('goalGraph.contributingUnits')} empty={!data?.units.length} emptyText={t('goalGraph.noUnitCascaded')}>
          {data?.units.map(u => (
            <Row key={`${u.scorecardId}-${u.orgUnitId}`}
                 name={u.orgUnitName ?? u.scorecardName ?? '—'}
                 sub={[u.linkType, u.contributionPercent != null ? t('goalGraph.contributes', { value: fmt(u.contributionPercent) }) : null]
                   .filter(Boolean).join(' · ')}
                 value={fmt(u.achievementPercent)}
                 danger={u.gatePassed === false} />
          ))}
        </Section>

        <Section title={t('goalGraph.people')} empty={!data?.people.length} emptyText={t('goalGraph.noPersonYet')}>
          {data?.people.map(p => (
            <Row key={p.userId} name={p.fullName ?? '—'}
                 sub={t('goalGraph.kpiCount', { count: p.kpiCount })}
                 value={fmt(p.attainmentPercent)} />
          ))}
        </Section>

        <Section title={t('goalGraph.kpisInThisObjective')} empty={!data?.kpis.length} emptyText={t('goalGraph.noKpiLinked')}>
          {data?.kpis.map(k => (
            <Row key={k.kpiId} name={k.name ?? '—'}
                 sub={[k.assigneeNames, k.weight != null ? t('goalGraph.weight') + ' ' + fmt(k.weight) : null]
                   .filter(Boolean).join(' · ')}
                 value={k.attainmentPercent == null ? t('goalGraph.notScored') : fmt(k.attainmentPercent)} />
          ))}
        </Section>

        {(data?.hiddenUnitCount ?? 0) > 0 && (
          <p className="text-xs text-slate-400">{t('goalGraph.unitsOutsideYourScope', { count: data?.hiddenUnitCount })}</p>
        )}
      </div>
    </div>
  )
}

function Section({ title, empty, emptyText, children }: {
  title: string; empty: boolean; emptyText: string; children: React.ReactNode
}) {
  return (
    <section>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{title}</h5>
      {empty ? <p className="text-xs text-slate-400">{emptyText}</p> : <div className="space-y-1">{children}</div>}
    </section>
  )
}

function Row({ name, sub, value, danger }: { name: string; sub?: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-control px-2 py-1.5 hover:bg-[var(--color-muted)]">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-foreground)] truncate">{name}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
      <span className={cn('text-xs font-semibold tabular-nums shrink-0', danger && 'text-rose-500')}>{value}</span>
    </div>
  )
}
