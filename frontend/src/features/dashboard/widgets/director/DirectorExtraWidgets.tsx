import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LineChart, BarChart2, ShieldAlert, Wallet, UsersRound, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rewardApi } from '@/features/rewards/api/rewardApi'
import { WidgetShell } from '../../components/WidgetShell'
import { useDirectorDashboard } from '../../context/DirectorDashboardContext'
import {
  DistributionChart, LabeledBar, MetricTile, DeltaBadge, compactNumber, progressTone,
  type DistributionBucket,
} from '../shared/Primitives'

// ── Xu hướng theo kỳ ──────────────────────────────────────────────────────────
/**
 * Câu hỏi đầu tiên của giám đốc là "kỳ này so với kỳ trước thế nào". Dữ liệu `trendData`
 * đã có sẵn trong tổng hợp nhưng trang chủ chưa từng dùng — trước giờ chỉ có số của kỳ hiện tại,
 * không có mốc so sánh nào.
 */
export function DirectorPeriodTrendWidget() {
  const { summary, isSummaryLoading } = useDirectorDashboard()
  const points = summary?.trendData ?? []

  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const maxValue = Math.max(100, ...points.map(p => Math.max(p.kpiCompletion, p.performance)))

  return (
    <WidgetShell
      title="Xu hướng qua các kỳ"
      icon={<LineChart size={17} />}
      isLoading={isSummaryLoading}
      isEmpty={points.length === 0}
      emptyMessage="Chưa đủ dữ liệu nhiều kỳ để dựng xu hướng."
    >
      {latest && (
        <div className="shrink-0 grid grid-cols-2 gap-3 mb-4">
          <div>
            <MetricTile label="Hoàn thành KPI" value={`${Math.round(latest.kpiCompletion)}%`} tone="indigo" />
            <div className="mt-1.5"><DeltaBadge current={latest.kpiCompletion} previous={previous?.kpiCompletion} /></div>
          </div>
          <div>
            <MetricTile label="Hiệu suất" value={`${Math.round(latest.performance)}%`} tone="emerald" />
            <div className="mt-1.5"><DeltaBadge current={latest.performance} previous={previous?.performance} /></div>
          </div>
        </div>
      )}

      {/* Hai cột cạnh nhau mỗi kỳ: hoàn thành (indigo) và hiệu suất (emerald) */}
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        <div className="flex items-end justify-between gap-3 flex-1 min-h-[100px]">
          {points.map(p => (
            <div key={p.period} className="flex-1 flex items-end justify-center gap-1 min-w-0 h-full">
              <div
                className="w-1/2 max-w-[18px] rounded-t bg-indigo-600 transition-all duration-700 motion-reduce:transition-none"
                style={{ height: `${Math.max(3, (p.kpiCompletion / maxValue) * 100)}%` }}
                role="img"
                aria-label={`${p.period}: hoàn thành ${Math.round(p.kpiCompletion)} phần trăm`}
              />
              <div
                className="w-1/2 max-w-[18px] rounded-t bg-emerald-500 transition-all duration-700 motion-reduce:transition-none"
                style={{ height: `${Math.max(3, (p.performance / maxValue) * 100)}%` }}
                role="img"
                aria-label={`${p.period}: hiệu suất ${Math.round(p.performance)} phần trăm`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {points.map(p => (
            <span key={p.period} className="flex-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-400 truncate min-w-0">
              {p.period}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-2.5">
          <Legend color="bg-indigo-600" label="Hoàn thành" />
          <Legend color="bg-emerald-500" label="Hiệu suất" />
        </div>
      </div>
    </WidgetShell>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-2.5 h-2.5 rounded-sm', color)} aria-hidden="true" />
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    </span>
  )
}

// ── Phân bố điểm toàn công ty ─────────────────────────────────────────────────
export function DirectorScoreDistributionWidget() {
  const { allEmployees, employees, organization, isLoading } = useDirectorDashboard()
  const pool = allEmployees.length ? allEmployees : employees
  const max = organization?.evaluationMaxScore ?? 100

  const buckets = useMemo<DistributionBucket[]>(() => {
    const scored = pool.filter(e => e.averageScore !== null)
    const pct = (e: typeof scored[number]) => ((e.averageScore ?? 0) / max) * 100
    return [
      { label: 'Dưới 50%', count: scored.filter(e => pct(e) < 50).length, tone: 'red' },
      { label: '50–70%', count: scored.filter(e => pct(e) >= 50 && pct(e) < 70).length, tone: 'amber' },
      { label: '70–90%', count: scored.filter(e => pct(e) >= 70 && pct(e) < 90).length, tone: 'indigo' },
      { label: 'Từ 90%', count: scored.filter(e => pct(e) >= 90).length, tone: 'emerald' },
    ]
  }, [pool, max])

  const scoredCount = buckets.reduce((s, b) => s + b.count, 0)
  const weakShare = scoredCount ? Math.round(((buckets[0]!.count + buckets[1]!.count) / scoredCount) * 100) : 0

  return (
    <WidgetShell
      title="Phân bố điểm toàn công ty"
      icon={<BarChart2 size={17} />}
      isLoading={isLoading}
      isEmpty={scoredCount === 0}
      emptyMessage="Chưa có nhân sự nào được chấm điểm."
      actions={scoredCount > 0 ? (
        <span className={cn(
          'px-2.5 py-1 rounded-lg text-[10px] font-black tabular-nums',
          weakShare >= 40
            ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        )}>
          {weakShare}% dưới 70%
        </span>
      ) : undefined}
    >
      <DistributionChart buckets={buckets} unitLabel="người" />
    </WidgetShell>
  )
}

// ── Đơn vị đang chặn tiến độ chấm điểm ────────────────────────────────────────
/**
 * Chốt kỳ bị chặn bởi vài đơn vị chưa chấm xong, nhưng con số tổng "đã chấm 41/84"
 * không cho biết phải đi thúc ai.
 */
export function DirectorEvalBlockersWidget() {
  const { orgUnitStats, allEmployees, isLoading } = useDirectorDashboard()

  const blockers = useMemo(() => {
    const byUnit = new Map<string, { assigned: number; scored: number }>()
    allEmployees.forEach(e => {
      if (e.assignedKpi <= 0) return
      const name = (e.orgUnitName || 'Chưa gán').trim()
      const cur = byUnit.get(name) ?? { assigned: 0, scored: 0 }
      cur.assigned += 1
      if (e.averageScore !== null) cur.scored += 1
      byUnit.set(name, cur)
    })

    return [...byUnit.entries()]
      .map(([name, v]) => ({
        name,
        pending: v.assigned - v.scored,
        percent: v.assigned ? Math.round((v.scored / v.assigned) * 100) : 100,
        ...v,
      }))
      .filter(u => u.pending > 0)
      .sort((a, b) => b.pending - a.pending)
  }, [allEmployees, orgUnitStats])

  return (
    <WidgetShell
      title="Đơn vị chưa chấm xong"
      icon={<Timer size={17} />}
      isLoading={isLoading}
      isEmpty={blockers.length === 0}
      emptyMessage="Mọi đơn vị đã chấm điểm đầy đủ."
      actions={blockers.length > 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 text-[10px] font-black tabular-nums">
          {blockers.reduce((s, u) => s + u.pending, 0)} người
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1">
        {blockers.map(u => (
          <li key={u.name}>
            <LabeledBar
              label={u.name}
              percent={u.percent}
              tone={progressTone(u.percent)}
              right={`còn ${u.pending}/${u.assigned}`}
            />
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Độ phủ KPI toàn công ty ───────────────────────────────────────────────────
/** Nhân sự chưa được giao KPI nào thì không nằm trong bất kỳ báo cáo hiệu suất nào. */
export function DirectorCoverageWidget() {
  const { allEmployees, employees, orgUnitStats, isLoading } = useDirectorDashboard()
  const pool = allEmployees.length ? allEmployees : employees

  const byUnit = useMemo(() => {
    const map = new Map<string, { total: number; covered: number }>()
    pool.forEach(e => {
      const name = (e.orgUnitName || 'Chưa gán').trim()
      const cur = map.get(name) ?? { total: 0, covered: 0 }
      cur.total += 1
      if (e.assignedKpi > 0) cur.covered += 1
      map.set(name, cur)
    })
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v, percent: v.total ? Math.round((v.covered / v.total) * 100) : 0 }))
      .sort((a, b) => a.percent - b.percent)
  }, [pool])

  const total = pool.length
  const covered = pool.filter(e => e.assignedKpi > 0).length
  const overall = total ? Math.round((covered / total) * 100) : 0

  return (
    <WidgetShell
      title="Độ phủ giao KPI"
      icon={<UsersRound size={17} />}
      isLoading={isLoading}
      isEmpty={total === 0}
      emptyMessage="Chưa có dữ liệu nhân sự."
    >
      <div className="shrink-0 grid grid-cols-3 gap-3 mb-4">
        <MetricTile label="Đã có KPI" value={`${overall}%`} tone={progressTone(overall)} />
        <MetricTile label="Chưa được giao" value={total - covered} tone={total - covered > 0 ? 'red' : 'emerald'} />
        <MetricTile label="Đơn vị" value={orgUnitStats?.length ?? byUnit.length} tone="slate" />
      </div>
      <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1">
        {byUnit.map(u => (
          <li key={u.name}>
            <LabeledBar label={u.name} percent={u.percent} tone={progressTone(u.percent)} right={`${u.covered}/${u.total}`} />
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Tỷ lệ KPI quá hạn ─────────────────────────────────────────────────────────
export function DirectorOverdueWidget() {
  const { summary, isSummaryLoading } = useDirectorDashboard()
  const rate = summary?.overdueKpiRate ?? 0
  const risks = summary?.unitRisks ?? []

  const high = risks.filter(r => r.riskLevel === 'HIGH')

  return (
    <WidgetShell
      title="Tỷ lệ KPI quá hạn"
      icon={<ShieldAlert size={17} />}
      isLoading={isSummaryLoading}
      isEmpty={!summary}
    >
      <div className="shrink-0 mb-4">
        <p className={cn(
          'text-4xl font-black tabular-nums',
          rate >= 30 ? 'text-red-600 dark:text-red-400' : rate >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
        )}>
          {Math.round(rate)}%
        </p>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
          chỉ tiêu toàn tổ chức đang quá hạn
        </p>
      </div>

      {high.length > 0 ? (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 shrink-0">
            Đơn vị rủi ro cao ({high.length})
          </p>
          <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
            {high.map(r => (
              <li key={r.name} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate min-w-0">{r.name}</span>
                <span className="shrink-0 text-[10px] font-black tabular-nums text-red-600 dark:text-red-400">
                  {r.overdueCount} quá hạn
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-4">
          Không có đơn vị nào ở mức rủi ro cao.
        </p>
      )}
    </WidgetShell>
  )
}

// ── Ngân sách thưởng ──────────────────────────────────────────────────────────
export function DirectorRewardBudgetWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rewards', 'budgets'],
    queryFn: () => rewardApi.getBudgets(),
  })

  const totals = useMemo(() => {
    const list = data ?? []
    return list.reduce(
      (acc, b) => {
        acc.allocated += b.allocatedPoints ?? 0
        acc.used += b.usedPoints ?? 0
        acc.remaining += b.remainingPoints ?? 0
        return acc
      },
      { allocated: 0, used: 0, remaining: 0 }
    )
  }, [data])

  const percent = totals.allocated ? Math.round((totals.used / totals.allocated) * 100) : 0

  return (
    <WidgetShell
      title="Ngân sách thưởng"
      icon={<Wallet size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={(data?.length ?? 0) === 0}
      emptyMessage="Chưa có ngân sách thưởng nào được phân bổ."
      actions={
        <Link
          to="/rewards"
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          Quản lý
        </Link>
      }
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <LabeledBar
          label="Đã dùng trên tổng phân bổ"
          percent={percent}
          // Dùng nhiều ngân sách không phải điều xấu, chỉ cảnh báo khi sắp cạn
          tone={percent >= 90 ? 'red' : percent >= 70 ? 'amber' : 'indigo'}
          right={`${compactNumber(totals.used)}/${compactNumber(totals.allocated)} điểm`}
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Còn lại" value={compactNumber(totals.remaining)} tone="emerald" />
          <MetricTile label="Số gói ngân sách" value={data?.length ?? 0} tone="slate" />
        </div>
      </div>
    </WidgetShell>
  )
}
