import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Gauge, Award, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import Pagination from '@/components/common/Pagination'
import { useDashboardUnit } from '@/features/dashboard/context/DashboardFilterContext'
import PerspectiveRadar from '../PerspectiveRadar'
import {
  useBscBalance, useBscTrend, useBscUnitComparison, useBscVsSystem, useBscRankings,
} from '../../hooks/useAnalytics'
import type { PinnedFilter } from './pinnedWidgetRegistry'
import { ChoiceChip } from '@/components/ui/choice-chip'

/**
 * Widget của tab "Hạng mục (BSC)".
 *
 * <p>Bên tab, một bộ lọc đợt + một ô chọn đơn vị lái toàn bộ khối. Trên trang chủ hai thứ đó
 * đến từ bộ lọc đơn vị và widget "Cây đơn vị" (xem `DashboardFilterContext`), nên mỗi widget
 * ở đây chỉ nhận `filter` rồi tự gọi đúng truy vấn mà tab đang gọi.
 */

const RANK_PAGE_SIZE = 10
const DEFAULT_COLOR = '#8b5cf6'

const fmt = (v?: number | null) => (v == null ? '—' : (Math.round(v * 10) / 10).toString())

/** Màu theo ngưỡng điểm (đồng bộ với tab BSC). */
const scoreColor = (v?: number | null) => {
  if (v == null) return 'text-[var(--color-subtle-foreground)]'
  if (v < 50) return 'text-[var(--color-error)]'
  if (v < 70) return 'text-[var(--color-warning)]'
  if (v < 90) return 'text-[var(--color-success)]'
  return 'text-[var(--color-info)]'
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center min-h-[160px] text-sm text-[var(--color-subtle-foreground)] font-medium text-center px-4">{children}</div>
}

/** Phạm vi BSC trên trang chủ: đơn vị đang chọn + đợt từ bộ lọc đơn vị. */
function useBscScope(filter?: PinnedFilter) {
  const { unitId } = useDashboardUnit()
  return { orgUnitId: unitId, periodId: filter?.periodId, periodIdTo: filter?.periodIdTo }
}

/** Bốn thẻ chỉ số cân bằng BSC + nhãn chế độ chấm. */
export function BscBalanceMetrics({ filter }: { filter?: PinnedFilter }) {
  const scope = useBscScope(filter)
  const { data: balance } = useBscBalance(scope)
  const mode = balance?.scoringMode

  return (
    <div className="flex-1 min-h-0 space-y-3">
      {mode && (
        <span className={cn(
          'text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
          mode === 'SHADOW'
            ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]'
            : 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]'
        )}>
          {mode === 'SHADOW' ? 'Chạy song song (SHADOW)' : 'Chính thức (OFFICIAL)'}
        </span>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-[var(--color-card)] rounded-card p-4 border border-[var(--color-border)] flex items-center gap-3">
          <div className="w-11 h-9 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center shrink-0"><Gauge size={22} /></div>
          <div className="min-w-0">
            <p className="text-caption">Điểm BSC trung bình</p>
            <p className={cn('text-2xl font-semibold tabular-nums', scoreColor(balance?.averageBscScore))}>{fmt(balance?.averageBscScore)}</p>
            <p className="text-caption">{balance?.evaluationCount ?? 0} đánh giá</p>
          </div>
        </div>
        <div className="bg-[var(--color-card)] rounded-card p-4 border border-[var(--color-border)] flex items-center gap-3">
          <div className="w-11 h-9 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] flex items-center justify-center shrink-0"><Award size={22} /></div>
          <div className="min-w-0">
            <p className="text-caption">Hạng mục mạnh nhất</p>
            <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{balance?.strongestPerspective ?? '—'}</p>
            <p className="text-xs font-semibold text-[var(--color-success)]">{fmt(balance?.strongestScore)}%</p>
          </div>
        </div>
        <div className="bg-[var(--color-card)] rounded-card p-4 border border-[var(--color-border)] flex items-center gap-3">
          <div className="w-11 h-9 rounded-full bg-[var(--color-error-bg)] text-[var(--color-error)] flex items-center justify-center shrink-0"><AlertTriangle size={22} /></div>
          <div className="min-w-0">
            <p className="text-caption">Hạng mục yếu nhất</p>
            <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{balance?.weakestPerspective ?? '—'}</p>
            <p className="text-xs font-semibold text-[var(--color-error)]">{fmt(balance?.weakestScore)}%</p>
          </div>
        </div>
        <div className="bg-[var(--color-card)] rounded-card p-4 border border-[var(--color-border)] flex items-center gap-3">
          <div className="w-11 h-9 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center shrink-0"><ShieldCheck size={22} /></div>
          <div className="min-w-0">
            <p className="text-caption">Độ phủ hạng mục</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(balance?.coveragePercent)}%</p>
            <p className="text-caption">{balance?.unmappedKpiCount ?? 0} KPI chưa gán</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Radar cân bằng giữa các hạng mục. */
export function BscRadarWidget({ filter }: { filter?: PinnedFilter }) {
  const { data: balance } = useBscBalance(useBscScope(filter))
  const rows = useMemo(
    () => (balance?.perspectives || []).map(p => ({ name: p.name, value: p.averageScore != null ? Math.round(p.averageScore * 10) / 10 : 0 })),
    [balance]
  )
  if (!rows.length) return <EmptyState>Chưa có điểm hạng mục</EmptyState>
  return <div className="flex-1 min-h-[220px]"><PerspectiveRadar data={rows} /></div>
}

/** Thẻ từng hạng mục: điểm, trọng số, số KPI và mức đóng góp. */
export function BscPerspectiveCards({ filter }: { filter?: PinnedFilter }) {
  const { data: balance } = useBscBalance(useBscScope(filter))
  const items = balance?.perspectives || []
  if (!items.length) return <EmptyState>Chưa có hạng mục nào có dữ liệu</EmptyState>

  return (
    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(p => {
          const ach = p.averageScore
          const color = p.color || DEFAULT_COLOR
          return (
            <div key={p.perspectiveId} className="relative overflow-hidden bg-[var(--color-card)] rounded-card border border-[var(--color-border)] p-4 shadow-sm">
              <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between gap-2 pl-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <h4 className="text-sm font-semibold text-[var(--color-foreground)] truncate">{p.name}</h4>
                  </div>
                  <p className="mt-0.5 text-caption">
                    Trọng số {fmt(p.weightPercentage)}% · {p.kpiCount ?? 0} KPI
                  </p>
                </div>
                <p className={cn('text-2xl font-semibold tabular-nums shrink-0', scoreColor(ach))}>
                  {ach != null ? Math.round(ach) : '—'}<span className="text-sm">%</span>
                </p>
              </div>
              <div className="mt-3 ml-2 h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ach || 0)}%`, backgroundColor: color }} />
              </div>
              <div className="flex items-center justify-between mt-2 ml-2 text-caption">
                <span>Đóng góp</span>
                <span className="text-[var(--color-muted-foreground)]">{fmt(p.weightedScore)} đ</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Xu hướng điểm từng hạng mục qua các kỳ. */
export function BscTrendWidget({ filter }: { filter?: PinnedFilter }) {
  const scope = useBscScope(filter)
  const { data: trend } = useBscTrend({ ...scope, groupBy: filter?.groupBy })
  const rows = useMemo(
    () => (trend?.points || []).map(pt => ({ label: pt.label, overall: pt.overall ?? null, ...pt.values })),
    [trend]
  )
  if (!rows.length) return <EmptyState>Chọn từ 2 kỳ trở lên để xem xu hướng</EmptyState>

  return (
    <div className="flex-1 min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any, n: any) => [`${v == null ? '—' : Math.round(Number(v) * 10) / 10}%`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {(trend?.perspectives || []).map(p => (
            <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color || DEFAULT_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
          <Line type="monotone" dataKey="overall" name="Điểm BSC" stroke="#0f172a" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** So sánh điểm từng hạng mục giữa các đơn vị. */
export function BscUnitComparisonWidget({ filter }: { filter?: PinnedFilter }) {
  const scope = useBscScope(filter)
  const { data: comparison } = useBscUnitComparison(scope)
  const rows = useMemo(
    () => (comparison?.units || []).map(u => ({ name: u.orgUnitName, overallBsc: u.overallBsc ?? null, ...u.values })),
    [comparison]
  )
  if (!rows.length) return <EmptyState>Chưa có đơn vị nào có dữ liệu BSC</EmptyState>

  return (
    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
      <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 46)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} horizontal={false} />
          <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any, n: any) => [`${v == null ? '—' : Math.round(Number(v) * 10) / 10}%`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {(comparison?.perspectives || []).map(p => (
            <Bar key={p.id} dataKey={p.id} name={p.name} fill={p.color || DEFAULT_COLOR} radius={[0, 3, 3, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Đối chiếu điểm BSC với điểm hệ thống — theo đơn vị hoặc theo nhân sự. */
export function BscVsSystemWidget({ filter }: { filter?: PinnedFilter }) {
  const scope = useBscScope(filter)
  const [level, setLevel] = useState<'UNIT' | 'MEMBER'>('UNIT')
  const { data: vsSystem } = useBscVsSystem({ ...scope, level })
  const rows = useMemo(
    () => (vsSystem?.rows || []).map(r => ({ name: r.name, bscScore: r.bscScore ?? null, systemScore: r.systemScore ?? null })),
    [vsSystem]
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-control p-0.5 self-start shrink-0">
        {(['UNIT', 'MEMBER'] as const).map(l => (
          <ChoiceChip selected={level === l} variant="segment" size="sm" className="py-1" key={l} onClick={() => setLevel(l)} aria-pressed={level === l}>
            {l === 'UNIT' ? 'Theo đơn vị' : 'Theo nhân sự'}
          </ChoiceChip>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState>Chưa có điểm để đối chiếu</EmptyState> : (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 44)}>
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} horizontal={false} />
              <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any, n: any) => [`${v == null ? '—' : Math.round(Number(v) * 10) / 10}`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="bscScore" name="Điểm BSC" fill="#6366f1" radius={[0, 3, 3, 0]} />
              <Bar dataKey="systemScore" name="Điểm hệ thống" fill="#94a3b8" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** Độ phủ hạng mục + danh sách KPI chưa gán. */
export function BscCoverageWidget({ filter }: { filter?: PinnedFilter }) {
  const { data: balance } = useBscBalance(useBscScope(filter))
  const mapped = balance?.mappedKpiCount ?? 0
  const total = mapped + (balance?.unmappedKpiCount ?? 0)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="text-center py-2 shrink-0">
        <p className={cn('text-4xl font-semibold tabular-nums', (balance?.coveragePercent ?? 100) >= 100 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
          {fmt(balance?.coveragePercent)}%
        </p>
        <p className="text-xs text-[var(--color-subtle-foreground)] font-medium mt-1">độ phủ · {mapped}/{total} KPI đã gán</p>
      </div>
      {balance?.unmappedKpiNames?.length ? (
        <div className="mt-3 flex-1 min-h-0 overflow-auto custom-scrollbar space-y-1.5">
          {balance.unmappedKpiNames.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted-foreground)] bg-[var(--color-warning-bg)] rounded-control px-3 py-2">
              <AlertTriangle size={13} className="text-[var(--color-warning)] shrink-0" /> <span className="truncate">{n}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-center text-[var(--color-success)] font-medium">Tất cả KPI tính điểm đều đã gán hạng mục ✓</p>
      )}
    </div>
  )
}

/** Xếp hạng nhân sự theo điểm BSC, kèm breakdown từng hạng mục. */
export function BscRankingWidget({ filter }: { filter?: PinnedFilter }) {
  const scope = useBscScope(filter)
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState<'bscScore' | 'systemScore'>('bscScore')
  const { data: ranking } = useBscRankings({ ...scope, sortBy, sortDir: 'desc', page, size: RANK_PAGE_SIZE })

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-control p-0.5 self-start shrink-0">
        {([['bscScore', 'Điểm BSC'], ['systemScore', 'Điểm hệ thống']] as const).map(([k, lb]) => (
          <ChoiceChip selected={sortBy === k} variant="segment" size="sm" className="py-1" key={k} onClick={() => { setSortBy(k); setPage(0) }} aria-pressed={sortBy === k}>
            {lb}
          </ChoiceChip>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead className="bg-[var(--color-muted)] sticky top-0 z-10">
            <tr className="text-eyebrow">
              <th className="px-3 py-3 w-10">#</th>
              <th className="px-3 py-3">Nhân sự</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Điểm BSC</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Điểm HT</th>
              <th className="px-3 py-3 hidden lg:table-cell">Breakdown hạng mục</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {(ranking?.content || []).map((row, idx) => (
              <tr key={row.userId} className="hover:bg-[var(--color-muted)]">
                <td className="px-3 py-3 text-sm font-semibold text-[var(--color-subtle-foreground)] tabular-nums">{page * RANK_PAGE_SIZE + idx + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{row.fullName}</p>
                  <p className="text-caption">{row.email}</p>
                </td>
                <td className={cn('px-3 py-3 text-right text-sm font-semibold tabular-nums', scoreColor(row.bscScore))}>{fmt(row.bscScore)}</td>
                <td className="px-3 py-3 text-right text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">{fmt(row.systemScore)}</td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    {(ranking?.perspectives || []).map(p => {
                      const v = row.perspectiveScores?.[p.id]
                      if (v == null) return null
                      return (
                        <span
                          key={p.id} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${p.color || DEFAULT_COLOR}22`, color: p.color || DEFAULT_COLOR }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || DEFAULT_COLOR }} />
                          {Math.round(v)}%
                        </span>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {!(ranking?.content?.length) && (
              <tr><td colSpan={5} className="text-center py-8 text-[var(--color-subtle-foreground)] text-sm">Không có dữ liệu xếp hạng</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(ranking?.totalElements ?? 0) > RANK_PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalPages={ranking?.totalPages ?? 1}
          onPageChange={setPage}
          totalElements={ranking?.totalElements ?? 0}
          size={RANK_PAGE_SIZE}
          itemLabel="nhân sự"
        />
      )}
    </div>
  )
}
