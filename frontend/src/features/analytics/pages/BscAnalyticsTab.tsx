import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Gauge, TrendingUp, Layers, Scale, AlertTriangle, Award, ShieldCheck, Medal,
  Building2, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import Pagination from '@/components/common/Pagination'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import PerspectiveRadar from '../components/PerspectiveRadar'
import {
  useBscBalance, useBscTrend, useBscUnitComparison, useBscVsSystem, useBscRankings,
} from '../hooks/useAnalytics'

const ALL_UNITS = '__ALL__'
const RANK_PAGE_SIZE = 10
const DEFAULT_COLOR = '#8b5cf6'

const fmt = (v?: number | null) => (v == null ? '—' : (Math.round(v * 10) / 10).toString())

/** Màu theo ngưỡng điểm (đồng bộ BSC Dashboard). */
const scoreColor = (v?: number | null) => {
  if (v == null) return 'text-slate-400'
  if (v < 50) return 'text-rose-500'
  if (v < 70) return 'text-amber-500'
  if (v < 90) return 'text-emerald-500'
  return 'text-blue-600 dark:text-blue-400'
}

function ScoringModeBadge({ mode }: { mode?: string | null }) {
  if (!mode) return null
  const shadow = mode === 'SHADOW'
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full',
      shadow ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
             : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    )}>
      {shadow ? 'Chạy song song (SHADOW)' : 'Chính thức (OFFICIAL)'}
    </span>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, children, extra }: { icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">{icon} {children}</h3>
      {extra}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-full min-h-[180px] text-sm text-slate-400 font-medium text-center px-4">{children}</div>
}

export default function BscAnalyticsTab() {
  const { periodId, periodIdTo, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-10' })
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined)
  const [vsLevel, setVsLevel] = useState<'UNIT' | 'MEMBER'>('UNIT')
  const [rankPage, setRankPage] = useState(0)
  const [rankSort, setRankSort] = useState<'bscScore' | 'systemScore'>('bscScore')

  const scope = { orgUnitId: selectedUnitId, periodId, periodIdTo }

  const { data: tree } = useOrgUnitTree()
  const flatUnits = useMemo(() => {
    const out: { id: string; name: string; depth: number }[] = []
    const walk = (nodes: any[] | undefined, depth: number) =>
      nodes?.forEach(n => { out.push({ id: n.id, name: n.name, depth }); walk(n.children, depth + 1) })
    walk(tree as any, 0)
    return out
  }, [tree])

  const { data: balance, isLoading: loadingBalance } = useBscBalance(scope)
  const { data: trend } = useBscTrend({ ...scope, groupBy })
  const { data: comparison } = useBscUnitComparison(scope)
  const { data: vsSystem } = useBscVsSystem({ ...scope, level: vsLevel })
  const { data: ranking } = useBscRankings({ ...scope, sortBy: rankSort, sortDir: 'desc', page: rankPage, size: RANK_PAGE_SIZE })

  const radarData = useMemo(
    () => (balance?.perspectives || []).map(p => ({ name: p.name, value: p.averageScore != null ? Math.round(p.averageScore * 10) / 10 : 0 })),
    [balance]
  )

  const trendData = useMemo(
    () => (trend?.points || []).map(pt => ({ label: pt.label, overall: pt.overall ?? null, ...pt.values })),
    [trend]
  )

  const comparisonData = useMemo(
    () => (comparison?.units || []).map(u => ({ name: u.orgUnitName, overallBsc: u.overallBsc ?? null, ...u.values })),
    [comparison]
  )

  const vsData = useMemo(
    () => (vsSystem?.rows || []).map(r => ({ name: r.name, bscScore: r.bscScore ?? null, systemScore: r.systemScore ?? null })),
    [vsSystem]
  )

  if (loadingBalance && !balance) return <AnalyticsTabSkeleton variant="default" className="p-6" />

  const noData = balance && balance.evaluationCount === 0 && (balance.perspectives?.length ?? 0) === 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header + badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="text-indigo-600" size={22} /> Thống kê theo hạng mục (BSC)
          </h2>
          <ScoringModeBadge mode={balance?.scoringMode} />
        </div>
      </div>

      {/* Bộ lọc — cùng khuôn với bộ lọc của tab Phân cấp: sticky, `flex-wrap` để hàng
          điều khiển tự xuống dòng khi hẹp thay vì bóp tiêu đề. */}
      <div id="tour-analytics-filter" className="sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 justify-between p-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-900/30">
            <Filter size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-white leading-tight text-base">Bộ lọc hạng mục</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5 w-full lg:w-auto">
          <Select value={selectedUnitId ?? ALL_UNITS} onValueChange={v => setSelectedUnitId(v === ALL_UNITS ? undefined : v)}>
            <SelectTrigger className="h-10 sm:max-w-[240px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold">
              <Building2 size={14} className="text-indigo-500 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_UNITS}>Tất cả đơn vị (mình quản lý)</SelectItem>
              {flatUnits.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  <span style={{ paddingLeft: u.depth * 12 }}>{u.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {controls}
        </div>
      </div>

      {noData && (
        <Card>
          <EmptyState>
            Chưa có dữ liệu BSC cho phạm vi/kỳ đang chọn.<br />
            Hãy tạo bộ tiêu chí cho kỳ và thực hiện đánh giá để sinh điểm hạng mục.
          </EmptyState>
        </Card>
      )}

      {/* ── Thẻ chỉ số cân bằng ─────────────────────────────────────────── */}
      <div id="tour-analytics-metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><Gauge size={24} /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">Điểm BSC trung bình</p>
            <p className={cn('text-2xl font-black tabular-nums', scoreColor(balance?.averageBscScore))}>{fmt(balance?.averageBscScore)}</p>
            <p className="text-[10px] font-bold text-slate-400">{balance?.evaluationCount ?? 0} đánh giá</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Award size={24} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Hạng mục mạnh nhất</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{balance?.strongestPerspective ?? '—'}</p>
            <p className="text-[11px] font-black text-emerald-600">{fmt(balance?.strongestScore)}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><AlertTriangle size={24} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Hạng mục yếu nhất</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{balance?.weakestPerspective ?? '—'}</p>
            <p className="text-[11px] font-black text-rose-500">{fmt(balance?.weakestScore)}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><ShieldCheck size={24} /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">Độ phủ hạng mục</p>
            <p className="text-2xl font-black tabular-nums">{fmt(balance?.coveragePercent)}%</p>
            <p className="text-[10px] font-bold text-slate-400">{balance?.unmappedKpiCount ?? 0} KPI chưa gán</p>
          </div>
        </div>
      </div>

      {/* ── Cân bằng: radar + card hạng mục ─────────────────────────────── */}
      <div id="tour-bsc-balance" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <SectionTitle icon={<TrendingUp size={14} className="text-indigo-500" />}>Radar cân bằng</SectionTitle>
          {radarData.length ? <PerspectiveRadar data={radarData} /> : <EmptyState>Chưa có điểm hạng mục</EmptyState>}
        </Card>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(balance?.perspectives || []).map(p => {
            const ach = p.averageScore
            const color = p.color || DEFAULT_COLOR
            return (
              <div key={p.perspectiveId} className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: color }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{p.name}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Trọng số {fmt(p.weightPercentage)}% · {p.kpiCount ?? 0} KPI</p>
                  </div>
                  <p className={cn('text-2xl font-black tabular-nums shrink-0', scoreColor(ach))}>{ach != null ? Math.round(ach) : '—'}<span className="text-sm">%</span></p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ach || 0)}%`, backgroundColor: color }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] font-bold text-slate-400">
                  <span>Đóng góp</span>
                  <span className="text-slate-600 dark:text-slate-300">{fmt(p.weightedScore)} đ</span>
                </div>
              </div>
            )
          })}
          {!(balance?.perspectives?.length) && <div className="sm:col-span-2"><Card><EmptyState>Chưa có hạng mục nào có dữ liệu</EmptyState></Card></div>}
        </div>
      </div>

      {/* ── Xu hướng điểm hạng mục theo kỳ ──────────────────────────────── */}
      <Card>
        <SectionTitle icon={<TrendingUp size={14} className="text-indigo-500" />}>Xu hướng điểm hạng mục theo kỳ</SectionTitle>
        {trendData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
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
        ) : <EmptyState>Chọn từ 2 kỳ trở lên để xem xu hướng</EmptyState>}
      </Card>

      {/* ── So sánh hạng mục giữa các đơn vị ────────────────────────────── */}
      <Card>
        <SectionTitle icon={<Building2 size={14} className="text-emerald-500" />}>So sánh hạng mục giữa các đơn vị</SectionTitle>
        {comparisonData.length ? (
          <ResponsiveContainer width="100%" height={Math.max(300, comparisonData.length * 46)}>
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
        ) : <EmptyState>Chưa có đơn vị nào có dữ liệu BSC</EmptyState>}
      </Card>

      {/* ── Kiểm chứng SHADOW: BSC vs hệ thống + coverage guard ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <SectionTitle
            icon={<Scale size={14} className="text-violet-500" />}
            extra={
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                {(['UNIT', 'MEMBER'] as const).map(l => (
                  <button key={l} onClick={() => setVsLevel(l)} className={cn(
                    'text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors',
                    vsLevel === l ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'
                  )}>{l === 'UNIT' ? 'Theo đơn vị' : 'Theo nhân sự'}</button>
                ))}
              </div>
            }
          >Đối chiếu BSC vs điểm hệ thống</SectionTitle>
          {vsData.length ? (
            <ResponsiveContainer width="100%" height={Math.max(280, vsData.length * 44)}>
              <BarChart data={vsData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} horizontal={false} />
                <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, n: any) => [`${v == null ? '—' : Math.round(Number(v) * 10) / 10}`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="bscScore" name="Điểm BSC" fill="#6366f1" radius={[0, 3, 3, 0]} />
                <Bar dataKey="systemScore" name="Điểm hệ thống" fill="#94a3b8" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState>Chưa có điểm để đối chiếu</EmptyState>}
        </Card>
        <Card>
          <SectionTitle icon={<ShieldCheck size={14} className="text-amber-500" />}>KPI chưa gán hạng mục</SectionTitle>
          <div className="text-center py-2">
            <p className={cn('text-4xl font-black tabular-nums', (balance?.coveragePercent ?? 100) >= 100 ? 'text-emerald-500' : 'text-amber-500')}>{fmt(balance?.coveragePercent)}%</p>
            <p className="text-xs text-slate-400 font-bold mt-1">độ phủ · {balance?.mappedKpiCount ?? 0}/{(balance?.mappedKpiCount ?? 0) + (balance?.unmappedKpiCount ?? 0)} KPI đã gán</p>
          </div>
          {balance?.unmappedKpiNames?.length ? (
            <div className="mt-3 max-h-[220px] overflow-auto custom-scrollbar space-y-1.5">
              {balance.unmappedKpiNames.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/15 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0" /> <span className="truncate">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-center text-emerald-600 font-bold">Tất cả KPI tính điểm đều đã gán hạng mục ✓</p>
          )}
        </Card>
      </div>

      {/* ── Xếp hạng nhân sự theo điểm BSC ───────────────────────────────── */}
      <Card>
        <SectionTitle
          icon={<Medal size={14} className="text-amber-500" />}
          extra={
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              {([['bscScore', 'Điểm BSC'], ['systemScore', 'Điểm hệ thống']] as const).map(([k, lb]) => (
                <button key={k} onClick={() => { setRankSort(k); setRankPage(0) }} className={cn(
                  'text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors',
                  rankSort === k ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'
                )}>{lb}</button>
              ))}
            </div>
          }
        >Xếp hạng nhân sự theo điểm BSC</SectionTitle>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-[11px] font-black uppercase text-slate-500">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Điểm BSC</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Điểm HT</th>
                <th className="px-4 py-3">Breakdown hạng mục</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(ranking?.content || []).map((row, idx) => (
                <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-sm font-black text-slate-400">{rankPage * RANK_PAGE_SIZE + idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{row.fullName}</p>
                    <p className="text-[11px] text-slate-400">{row.email}</p>
                  </td>
                  <td className={cn('px-4 py-3 text-right text-sm font-black tabular-nums', scoreColor(row.bscScore))}>{fmt(row.bscScore)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-500">{fmt(row.systemScore)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(ranking?.perspectives || []).map(p => {
                        const v = row.perspectiveScores?.[p.id]
                        if (v == null) return null
                        return (
                          <span key={p.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${p.color || DEFAULT_COLOR}22`, color: p.color || DEFAULT_COLOR }}>
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
            currentPage={rankPage}
            totalPages={ranking?.totalPages ?? 1}
            onPageChange={setRankPage}
            totalElements={ranking?.totalElements ?? 0}
            size={RANK_PAGE_SIZE}
            itemLabel="nhân sự"
          />
        )}
      </Card>

      <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
        <Layers size={12} /> Số liệu gộp từ điểm đánh giá đã lưu theo hạng mục — nhất quán với chỉ số "hiệu suất theo đánh giá".
      </p>
    </div>
  )
}
