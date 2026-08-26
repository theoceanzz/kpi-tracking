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
  if (v == null) return 'text-slate-400'
  if (v < 50) return 'text-rose-500'
  if (v < 70) return 'text-amber-500'
  if (v < 90) return 'text-emerald-500'
  return 'text-blue-600 dark:text-blue-400'
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center min-h-[160px] text-sm text-slate-400 font-medium text-center px-4">{children}</div>
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
          'inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full',
          mode === 'SHADOW'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        )}>
          {mode === 'SHADOW' ? 'Chạy song song (SHADOW)' : 'Chính thức (OFFICIAL)'}
        </span>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><Gauge size={22} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Điểm BSC trung bình</p>
            <p className={cn('text-2xl font-black tabular-nums', scoreColor(balance?.averageBscScore))}>{fmt(balance?.averageBscScore)}</p>
            <p className="text-[10px] font-bold text-slate-400">{balance?.evaluationCount ?? 0} đánh giá</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Award size={22} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Hạng mục mạnh nhất</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{balance?.strongestPerspective ?? '—'}</p>
            <p className="text-[11px] font-black text-emerald-600">{fmt(balance?.strongestScore)}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><AlertTriangle size={22} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Hạng mục yếu nhất</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{balance?.weakestPerspective ?? '—'}</p>
            <p className="text-[11px] font-black text-rose-500">{fmt(balance?.weakestScore)}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><ShieldCheck size={22} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Độ phủ hạng mục</p>
            <p className="text-2xl font-black tabular-nums">{fmt(balance?.coveragePercent)}%</p>
            <p className="text-[10px] font-bold text-slate-400">{balance?.unmappedKpiCount ?? 0} KPI chưa gán</p>
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
            <div key={p.perspectiveId} className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between gap-2 pl-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{p.name}</h4>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                    Trọng số {fmt(p.weightPercentage)}% · {p.kpiCount ?? 0} KPI
                  </p>
                </div>
                <p className={cn('text-2xl font-black tabular-nums shrink-0', scoreColor(ach))}>
                  {ach != null ? Math.round(ach) : '—'}<span className="text-sm">%</span>
                </p>
              </div>
              <div className="mt-3 ml-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ach || 0)}%`, backgroundColor: color }} />
              </div>
              <div className="flex items-center justify-between mt-2 ml-2 text-[10px] font-bold text-slate-400">
                <span>Đóng góp</span>
                <span className="text-slate-600 dark:text-slate-300">{fmt(p.weightedScore)} đ</span>
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
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 self-start shrink-0">
        {(['UNIT', 'MEMBER'] as const).map(l => (
          <button
            key={l} onClick={() => setLevel(l)} aria-pressed={level === l}
            className={cn('text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer',
              level === l ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500')}
          >
            {l === 'UNIT' ? 'Theo đơn vị' : 'Theo nhân sự'}
          </button>
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
        <p className={cn('text-4xl font-black tabular-nums', (balance?.coveragePercent ?? 100) >= 100 ? 'text-emerald-500' : 'text-amber-500')}>
          {fmt(balance?.coveragePercent)}%
        </p>
        <p className="text-xs text-slate-400 font-bold mt-1">độ phủ · {mapped}/{total} KPI đã gán</p>
      </div>
      {balance?.unmappedKpiNames?.length ? (
        <div className="mt-3 flex-1 min-h-0 overflow-auto custom-scrollbar space-y-1.5">
          {balance.unmappedKpiNames.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/15 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" /> <span className="truncate">{n}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-center text-emerald-600 font-bold">Tất cả KPI tính điểm đều đã gán hạng mục ✓</p>
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
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 self-start shrink-0">
        {([['bscScore', 'Điểm BSC'], ['systemScore', 'Điểm hệ thống']] as const).map(([k, lb]) => (
          <button
            key={k} onClick={() => { setSortBy(k); setPage(0) }} aria-pressed={sortBy === k}
            className={cn('text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer',
              sortBy === k ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500')}
          >
            {lb}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
            <tr className="text-[11px] font-black uppercase text-slate-500">
              <th className="px-3 py-3 w-10">#</th>
              <th className="px-3 py-3">Nhân sự</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Điểm BSC</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Điểm HT</th>
              <th className="px-3 py-3 hidden lg:table-cell">Breakdown hạng mục</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(ranking?.content || []).map((row, idx) => (
              <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-3 py-3 text-sm font-black text-slate-400 tabular-nums">{page * RANK_PAGE_SIZE + idx + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{row.fullName}</p>
                  <p className="text-[11px] text-slate-400">{row.email}</p>
                </td>
                <td className={cn('px-3 py-3 text-right text-sm font-black tabular-nums', scoreColor(row.bscScore))}>{fmt(row.bscScore)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-slate-500">{fmt(row.systemScore)}</td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    {(ranking?.perspectives || []).map(p => {
                      const v = row.perspectiveScores?.[p.id]
                      if (v == null) return null
                      return (
                        <span
                          key={p.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
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
              <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Không có dữ liệu xếp hạng</td></tr>
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
