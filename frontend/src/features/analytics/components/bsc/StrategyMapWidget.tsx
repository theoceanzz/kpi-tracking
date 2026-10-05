import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, Minus, ShieldAlert, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GraphObjective } from '../../api/bscGoalGraphApi'
import { useBscGoalGraph } from '../../hooks/useBscGoalGraph'
import {
  buildAdjacency, objectivesByPerspective, originKey, relatedIds, statusLabelKey, statusTone, thresholdHint,
} from './goalGraphModel'
import ObjectiveDetailPanel from './ObjectiveDetailPanel'

/**
 * Bản đồ chiến lược: mục tiêu xếp theo lĩnh vực BSC, mỗi thẻ nói một mục tiêu đang ở đâu.
 *
 * <p>Dựng bằng lưới CSS chứ không phải thư viện sơ đồ, vì mô hình dữ liệu chỉ có quan hệ phân rã
 * (một cha) — không có cạnh nhân quả giữa các lĩnh vực để mà định tuyến. Dải ngang co giãn được,
 * in được, chụp ảnh được, và không có cuộc đua đo kích thước nào.
 *
 * <p>Rê chuột làm nổi nhánh liên quan (tổ tiên + hậu duệ) và làm mờ phần còn lại, thay cho việc
 * vẽ sẵn mọi đường nối.
 */
export default function StrategyMapWidget({ scope, limit, status, meta }: {
  scope: { orgUnitId?: string; periodId?: string; periodIdTo?: string }
  limit?: number
  status?: string
  meta?: React.ReactNode
}) {
  const { t } = useTranslation('analytics')
  const { data: graph, isLoading } = useBscGoalGraph({ ...scope, limit, status: status as never })
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const adj = useMemo(() => buildAdjacency(graph), [graph])
  const related = useMemo(() => relatedIds(hovered, adj), [hovered, adj])
  const byPerspective = useMemo(() => objectivesByPerspective(graph), [graph])

  if (!isLoading && (!graph?.scorecardId || graph.objectives.length === 0)) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {meta}
        <p className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-6">
          {graph?.scorecardId ? t('goalGraph.noObjectiveMatchesFilter') : t('goalGraph.noScorecardForThisPeriod')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-400">
        {graph?.periodName && <span>{t('bscWidgets.period')} <span className="text-[var(--color-muted-foreground)]">{graph.periodName}</span></span>}
        {graph?.achievementPercent != null && (
          <span>{t('goalGraph.scorecardAchievement')} <span className="text-[var(--color-foreground)] font-semibold tabular-nums">{fmt(graph.achievementPercent)}</span></span>
        )}
        {graph?.provisional && <span className="text-amber-600 dark:text-amber-400">{t('goalGraph.draftResult')}</span>}
        {graph && <span title={t('goalGraph.thresholdsComeFromServer')}>{thresholdHint(graph.thresholds)}</span>}
        {(graph?.hiddenObjectiveCount ?? 0) > 0 && (
          <span>{t('goalGraph.objectivesHidden', { count: graph?.hiddenObjectiveCount })}</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar space-y-3" onMouseLeave={() => setHovered(null)}>
        {(graph?.perspectives ?? []).map(p => {
          const items = byPerspective.get(p.code) ?? []
          if (!items.length) return null
          return (
            <section key={p.code} className="rounded-widget border border-[var(--color-border)] overflow-hidden">
              <header
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 border-l-4"
                style={{ borderLeftColor: p.color ?? 'var(--color-border)' }}
              >
                <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{p.name}</h4>
                <span className="text-xs font-medium text-slate-400">
                  {t('goalGraph.weightShare', { value: fmt(p.weightPercentage) })}
                </span>
                {p.achievementPercent != null && (
                  <span className="text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]">
                    {fmt(p.achievementPercent)}
                  </span>
                )}
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 p-2">
                {items.map(o => (
                  <ObjectiveCard
                    key={o.id}
                    objective={o}
                    dimmed={hovered != null && !related.has(o.id)}
                    onHover={setHovered}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {selected && (
        <ObjectiveDetailPanel itemId={selected} scope={scope} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function ObjectiveCard({ objective: o, dimmed, onHover, onSelect }: {
  objective: GraphObjective
  dimmed: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('analytics')
  const tone = statusTone(o.status)
  const origin = originKey(o.origin)
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(o.id)}
      onFocus={() => onHover(o.id)}
      onClick={() => onSelect(o.id)}
      className={cn(
        'text-left rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-opacity',
        'hover:border-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] cursor-pointer',
        'ring-1 ring-inset', tone.ring,
        dimmed && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-foreground)] leading-5">
          {o.derivedCode && <span className="text-slate-400 font-medium">{o.derivedCode}. </span>}
          {o.name}
        </p>
        <span className={cn('text-base font-semibold tabular-nums shrink-0', tone.text)}>{fmt(o.achievementPercent)}</span>
      </div>

      <p className="mt-1 text-xs font-medium text-slate-400 tabular-nums">
        {o.actualValue != null || o.targetValue != null
          ? `${num(o.actualValue)} / ${num(o.targetValue)}${o.unit ? ` ${o.unit}` : ''}`
          : t('goalGraph.noDataYet')}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-400">
        <span>{t('goalGraph.weight')} {fmt(o.weightPercentage)}</span>
        {o.orgUnitName && <span className="truncate max-w-[9rem]">{o.orgUnitName}</span>}
        {o.trend && <TrendMark trend={o.trend.direction} delta={o.trend.deltaPercent} />}
        {o.isGate && (
          <span className={cn('inline-flex items-center gap-1', o.gatePassed === false ? 'text-rose-500' : '')}>
            <ShieldAlert size={11} aria-hidden="true" /> {t('goalGraph.gateItem')}
          </span>
        )}
        {origin && <span>{t(origin)}</span>}
        {o.childCount > 0 && <span>{t('goalGraph.cascadedToUnits', { count: o.childCount })}</span>}
        <span className={tone.text}>{t(statusLabelKey(o.status))}</span>
      </div>
    </button>
  )
}

function TrendMark({ trend, delta }: { trend: string; delta?: number | null }) {
  const { t } = useTranslation('analytics')
  if (trend === 'NEW') return <span>{t('goalGraph.firstPeriod')}</span>
  const Icon = trend === 'UP' ? ArrowUpRight : trend === 'DOWN' ? ArrowDownRight : Minus
  const color = trend === 'UP' ? 'text-emerald-600' : trend === 'DOWN' ? 'text-rose-500' : ''
  return (
    <span className={cn('inline-flex items-center gap-0.5 tabular-nums', color)}>
      <Icon size={11} aria-hidden="true" />
      {delta != null ? `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}` : ''}
    </span>
  )
}

/** Nút "Phân tích bằng AI" của BRD — đặt ở bảng chi tiết, dùng lối tắt AI sẵn có. */
export { Sparkles as StrategyMapAiIcon }

const fmt = (v?: number | null) => (v == null ? '—' : `${Math.round(v * 10) / 10}%`)
const num = (v?: number | null) => (v == null ? '—' : new Intl.NumberFormat().format(Math.round(v * 100) / 100))
