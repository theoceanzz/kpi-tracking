import { useState, useMemo } from 'react'
import { personalKpiApi } from '@/features/dashboard/api/personalKpiApi'
import { useMyAnalytics } from '../hooks/useAnalytics'
import { useQuery } from '@tanstack/react-query'
import {
  Target, TrendingUp, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight,
  User, Users, X, Star, Search, ChevronLeft,
  Activity, BarChart3 as BarChartIcon, PieChart as PieChartIcon, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { QualitativeResultChip } from '../components/QualitativeResultChip'
import { toChildNodes } from '../components/KpiChildList'
import { KpiChildTableRows } from '../components/KpiChildTableRows'
import { KpiPeriodCell } from '../components/KpiPeriodCell'
import { KpiWeightPill } from '../components/KpiWeightPill'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'

import AnalyticsComboChart from '../components/AnalyticsComboChart'
import { SparseTableFiller } from '../components/SparseTableFiller'
import MyKpiDrawer from '../components/MyKpiDrawer'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import Pagination from '@/components/common/Pagination'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { SortHeader } from '@/components/common/SortHeader'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { useDashboardCustomization } from '@/components/common/dashboard/useDashboardCustomization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { WidgetType } from '@/types/datasource'

import { format } from 'date-fns'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e']

type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 5

const CONFIG_REPORT_NAME = '__MY_KPI_DASHBOARD_CONFIG__'
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'mykpi-trend', type: 'MYKPI_TREND', title: 'Xu hướng KPI theo thời gian', x: 0, y: 0, w: 12, h: 15, visible: true },
  { i: 'mykpi-detail', type: 'MYKPI_DETAIL', title: 'Bảng chi tiết KPI đang đảm nhiệm', x: 0, y: 15, w: 12, h: 18, visible: true },
]
const toBackendWidgetType = (t: string): WidgetType => t === 'MYKPI_TREND' ? 'TREND_CHART' : 'TABLE'
const CATALOG: { template: DashboardWidget; icon: React.ReactNode }[] = DEFAULT_WIDGETS.map(t => ({
  template: t,
  icon: t.type === 'MYKPI_TREND' ? <TrendingUp size={24} /> : <Target size={24} />,
}))

export default function MyStatsTab() {
  const onlyApproved = false
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-10' })
  const perf = usePerformanceScale()

  // ── New KPI analytics (standalone KPIs without KeyResult) ────────────────
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['personalKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => personalKpiApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalKpi', 'chart', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => personalKpiApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  // ── Tuỳ chỉnh giao diện (lưới widget dùng chung) ──────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện KPI của tôi',
    defaultWidgets: DEFAULT_WIDGETS,
    toBackendWidgetType,
  })
  const { isEditMode, handleTogglePin } = dash

  const renderWidget = (w: DashboardWidget) => {
    switch (w.type) {
      case 'MYKPI_TREND': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-violet-500" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đảm nhiệm" fillHeight />
        </ChartWrapper>
      )
      case 'MYKPI_DETAIL': return <MyKpiDetailSection from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} isEditMode={isEditMode} widget={w} onTogglePin={handleTogglePin} />
      default: return null
    }
  }

  if (isMetricsLoading || isChartLoading)
    return <AnalyticsTabSkeleton variant="default" className="p-6" />

  return (
    <div className="space-y-6">
      {/* Tiêu đề + nút Tuỳ chỉnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">KPI của tôi</h2>
        <div id="tour-analytics-customize">
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* ── Global Filter Toolbar ──────────────────────────────────────────── */}
      <div id="tour-analytics-filter" className="sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 justify-between p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Bộ lọc KPI của tôi</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {controls}
        </div>
      </div>

      {/* ── New Metric Cards ────────────────────────────────────────────────── */}
      <div id="tour-analytics-metrics" className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tổng KPI</p>
            <p className="text-2xl font-black">{(metrics?.runningKpis ?? 0) + (metrics?.completedKpis ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tiến độ TB</p>
            <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Target size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Hiệu suất TB (đánh giá)</p>
            <p className="text-2xl font-black">{perf.format(metrics?.averagePerformance ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Đang chạy / HT</p>
            <p className="text-base font-black">{metrics?.runningKpis ?? 0} / {metrics?.completedKpis ?? 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Rủi ro / Chậm</p>
            <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Bảng chi tiết */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome api={dash} renderWidget={renderWidget} catalog={CATALOG} />
      </div>

      {/* Bốn khối còn lại của tab — cũng là widget dùng được ở trang chủ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MyKpiSubmissionPieSection from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} />
        <MyKpiStatusDistSection from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MyKpiEvaluationHistorySection from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} />
        <MyKpiScoreTrendSection from={from} to={to} periodId={periodId} periodIdTo={periodIdTo} />
      </div>
    </div>
  )
}


/**
 * Bảng chi tiết KPI cá nhân — tự quản bộ lọc/sắp xếp/phân trang/drawer.
 *
 * <p>Tách khỏi thân tab để trang chủ dùng lại được nguyên vẹn (`bare`); xem
 * {@link OrgUnitKpiDetailSection} bên SummaryTab cho cùng lý do.
 */
export function MyKpiDetailSection({
  from, to, onlyApproved = false, periodId, periodIdTo, isEditMode, widget, onTogglePin, bare,
}: {
  from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string
  isEditMode?: boolean; widget?: DashboardWidget; onTogglePin?: (w: DashboardWidget) => void; bare?: boolean
}) {
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalKpi', 'details', from, to, onlyApproved, periodId, periodIdTo, sortField, sortDir, filterShared, page],
    queryFn: () => personalKpiApi.getDetailedKpis({
      from, to, onlyApproved, periodId, periodIdTo,
      sortBy: sortField ?? undefined,
      sortDir,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page,
      size: PAGE_SIZE,
    }),
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(0)
  }

  const body = (
    <div className={cn("flex-1 flex flex-col min-h-0", bare ? "-mx-5 sm:-mx-6 -mb-5 sm:-mb-6" : "-mx-6 -mb-6")}>
      <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {([['ALL', 'Tất cả'], ['SHARED', 'Mục tiêu chung'], ['PERSONAL', 'Mục tiêu riêng']] as [SharedFilter, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setFilterShared(v); setPage(0) }}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-black transition-all',
                filterShared === v
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {filterShared !== 'ALL' && (
          <button onClick={() => { setFilterShared('ALL'); setPage(0) }} className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <X size={13} /> Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-xs font-black uppercase text-slate-500">
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Tên KPI</th>
                <th className="px-6 py-4 whitespace-nowrap">
                  <SortHeader field="period" active={sortField} dir={sortDir} onToggle={toggleSort}>Đợt</SortHeader>
                </th>
                <th className="px-6 py-4 min-w-[250px]">
                  <SortHeader field="progress" active={sortField} dir={sortDir} onToggle={toggleSort}>Tiến độ KPI</SortHeader>
                </th>
                <th className="px-6 py-4">Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isKpisLoading
                ? <TableLoadingRows cols={6} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <ExpandableKpiRow key={kpi.kpiId} kpi={kpi} onOpenDrawer={() => setSelectedKpiId(kpi.kpiId)} onSelectKpi={setSelectedKpiId} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {isKpisLoading ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : kpiPage?.content?.length ? (
            kpiPage.content.map(kpi => (
              <MobileKpiCard key={kpi.kpiId} kpi={kpi} onOpenDrawer={() => setSelectedKpiId(kpi.kpiId)} />
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">Không có dữ liệu</div>
          )}
        </div>

        <SparseTableFiller
          message={!isKpisLoading && (kpiPage?.content?.length ?? 0) > 0 && (kpiPage?.content?.length ?? 0) < PAGE_SIZE
            ? `Đã hiển thị tất cả ${kpiPage?.totalElements ?? 0} KPI`
            : null}
        />
      </div>

      {(kpiPage?.totalElements ?? 0) > 0 && (
        <Pagination currentPage={page} totalPages={kpiPage?.totalPages ?? 1} onPageChange={setPage} totalElements={kpiPage?.totalElements ?? 0} size={PAGE_SIZE} itemLabel="KPI" />
      )}
    </div>
  )

  const drawer = selectedKpiId ? (
    <MyKpiDrawer
      kpiId={selectedKpiId}
      onClose={() => setSelectedKpiId(null)}
      globalFrom={from}
      globalTo={to}
      globalPeriodId={periodId}
      globalPeriodIdTo={periodIdTo}
    />
  ) : null

  if (bare) return <>{body}{drawer}</>

  return (
    <>
      <ChartWrapper title="Bảng chi tiết KPI đang đảm nhiệm" icon={<Target size={20} className="text-violet-600" />} widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}
        extraHeaderContent={<span className="text-xs font-bold text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>}>
        {body}
      </ChartWrapper>
      {drawer}
    </>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function MobileKpiCard({ kpi, onOpenDrawer }: { kpi: any; onOpenDrawer: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'

  return (
    <div className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/30" onClick={onOpenDrawer}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-sm text-slate-900 dark:text-white truncate min-w-0">{kpi.kpiName}</p>
        {kpi.shared ? (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[9px] font-black uppercase shrink-0">
            <Users size={10} /> Chung
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase shrink-0">
            <User size={10} /> Riêng
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">{fmt(kpi.periodStart)} — {fmt(kpi.periodEnd)}</p>

      <div className="flex items-center gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Tiến độ</span>
            <span className="text-[10px] font-black">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandableKpiRow({ kpi, onOpenDrawer, onSelectKpi }: { kpi: any; onOpenDrawer: () => void; onSelectKpi?: (id: string) => void }) {
  const hasChildren = !!(kpi.children && kpi.children.length > 0)
  const [expanded, setExpanded] = useState(hasChildren) // KPI cha/thác nước mặc định mở sẵn KPI con
  // KPI thưởng: backend trả tiến độ/hiệu suất = null (không tính), hiển thị gạch ngang.
  const isQual = kpi.kpiType === 'QUALITATIVE'
  const isBonus = !isQual && kpi.progress == null
  const pct  = Math.round(kpi.progress    || 0)

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={onOpenDrawer}>
          <div className="font-bold text-sm text-slate-900 hover:text-violet-500 dark:text-white dark:hover:text-violet-400 transition-colors truncate max-w-[240px]">{kpi.kpiName}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <KpiTypeTags
              isReverseKpi={kpi.isReverseKpi}
              isBonusKpi={kpi.isBonusKpi}
              isQualitative={isQual}
              parentRelationType={kpi.parentRelationType}
              childRelationType={kpi.childRelationType}
            />
            <KpiWeightPill weight={kpi.weight} />
          </div>
        </td>
        <td className="px-6 py-4">
          <KpiPeriodCell periodName={kpi.periodName} start={kpi.periodStart} end={kpi.periodEnd} />
        </td>
        <td className="px-6 py-4">
          {isQual ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Mức đánh giá</span>
              <QualitativeResultChip level={kpi.qualitativeLevelName} />
            </div>
          ) : isBonus ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                Thưởng
              </span>
              <div className="text-[10px] text-slate-500">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-violet-500')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-black">{pct}%</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase">
              <Users size={12} /> Chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
              <User size={12} /> Riêng
            </div>
          )}
        </td>
      </tr>
      {expanded && hasChildren && (
        <KpiChildTableRows
          nodes={toChildNodes(kpi.children)}
          onSelect={onSelectKpi}
          headingColSpan={5}
          variant={{ leadingChevronCol: true, showPersonColumn: false, trailingEmptyCols: 1, accent: 'violet', baseIndent: 28 }}
        />
      )}
      {expanded && (!hasChildren || (kpi.mySubmissions?.length ?? 0) > 0 || kpi.shared) && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 border-l-4 border-violet-500">
              <div className="w-full space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Lịch sử bài nộp của tôi</h4>
                {kpi.mySubmissions && kpi.mySubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {kpi.mySubmissions.map((sub: any) => (
                      <div key={sub.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
                        <div className="w-[120px]">
                          <p className="text-sm font-bold">{sub.code}</p>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Thời gian nộp</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {new Date(sub.submitDate).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })}
                          </p>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[200px]">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={sub.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[200px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-500">Đóng góp</span>
                                <span className="text-[10px] font-black">{sub.contributionProgress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                              </div>
                              <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                            </div>
                            <div className="text-center w-[100px]">
                              <p className="text-[10px] text-slate-500">Hiệu suất</p>
                              <p className="text-sm font-black text-violet-500">{sub.performance?.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                        <div>
                          <span className={cn(
                            'px-2 py-1 rounded text-[10px] font-black uppercase',
                            sub.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            sub.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Chưa có bài nộp nào.</div>
                )}
              </div>

              {kpi.shared && kpi.teammates?.length > 0 && kpi.childRelationType !== 'DECOMPOSITION' && (
                <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates.map((tm: any) => (
                      <div key={tm.userId} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl
                            ? <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                            : <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">{tm.fullName.charAt(0)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{tm.fullName}</p>
                            <p className="text-[10px] text-slate-500">{tm.employeeCode}</p>
                          </div>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[250px]">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={tm.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[250px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-500">Tiến độ cá nhân</span>
                                <span className="text-[10px] font-black">{tm.progress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(tm.progress, 100)}%` }} />
                              </div>
                            </div>
                            <div className="text-center sm:text-right w-[100px]">
                              <p className="text-[10px] text-slate-500">Hiệu suất</p>
                              <p className="text-sm font-black text-violet-500">{tm.performance?.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function OldChartCard({
  title, icon, children, noPadBody,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  noPadBody?: boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-black text-sm flex items-center gap-2">{icon}{title}</h3>
      </div>
      <div className={cn('flex-1', noPadBody ? '' : 'p-5')}>{children}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 gap-2">
      <Info size={24} className="opacity-20" />
      <span className="text-[10px] font-bold uppercase tracking-wider">Chưa có dữ liệu</span>
    </div>
  )
}


function EvaluationTableWidget({ data, title }: { data: any[]; title: string }) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredData = useMemo(() => {
    let result = [...data]
    if (filter) {
      result = result.filter(item =>
        item.kpiName.toLowerCase().includes(filter.toLowerCase()) ||
        item.evaluatorName.toLowerCase().includes(filter.toLowerCase())
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? ''
        const bVal = b[sortConfig.key] ?? ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [data, filter, sortConfig])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key && prev.direction === 'asc'
        ? { key, direction: 'desc' }
        : { key, direction: 'asc' }
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <h3 className="font-black text-sm flex items-center gap-2 shrink-0">
          <Star size={16} className="text-amber-500" /> {title}
        </h3>
        <div className="relative max-w-[200px] w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 z-10">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">
                <SortHeader field="score" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10}>Điểm</SortHeader>
              </th>
              <th className="px-3 py-3">
                <SortHeader field="kpiName" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10}>Đợt</SortHeader>
              </th>
              <th className="px-3 py-3">
                <SortHeader field="evaluatorName" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10}>Người đánh giá</SortHeader>
              </th>
              <th className="px-3 py-3 text-right">
                <SortHeader field="createdAt" active={sortConfig?.key ?? null} dir={sortConfig?.direction ?? 'asc'} onToggle={handleSort} iconSize={10} className="justify-end w-full">Ngày đánh giá</SortHeader>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-sm text-slate-400">Không có dữ liệu</td>
              </tr>
            )}
            {paginatedData.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm',
                    (e.score ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    (e.score ?? 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  )}>{e.score?.toFixed(1) ?? '—'}</div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{e.kpiName}</p>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-400 font-medium">{e.evaluatorName}</td>
                <td className="px-3 py-3 text-right text-[11px] text-slate-500 font-bold">
                  {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Trang {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors shadow-sm border border-transparent hover:border-slate-200">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/*
  Bốn khối dưới đây từng nằm thẳng trong thân tab. Tách thành component tự fetch để trang chủ
  đặt lên lưới được — cùng lý do với `MyKpiDetailSection`. `from/to/...` là bộ lọc thời gian:
  ở tab thì do thanh lọc chung cấp, ở trang chủ thì do widget "Bộ lọc cá nhân" cấp.
*/
interface MyKpiRange {
  from?: string
  to?: string
  periodId?: string
  periodIdTo?: string
  /** Trang chủ tự vẽ khung + tiêu đề (WidgetShell) nên bỏ card riêng của tab. */
  bare?: boolean
}

/** Tỷ trọng bài nộp đã duyệt / chờ duyệt / bị từ chối. */
export function MyKpiSubmissionPieSection({ from, to, periodId, periodIdTo, bare }: MyKpiRange) {
  const { data } = useMyAnalytics(from, to, periodId, periodIdTo)
  const pie = [
    { name: 'Đã duyệt', value: data?.approvedSubmissions ?? 0 },
    { name: 'Chờ duyệt', value: data?.pendingSubmissions ?? 0 },
    { name: 'Từ chối', value: data?.rejectedSubmissions ?? 0 },
  ].filter(v => v.value > 0)

  const body = pie.length === 0 ? <EmptyChart /> : (
    <ResponsiveContainer width="100%" height={bare ? '100%' : 240}>
      <PieChart>
        <Pie
          data={pie} innerRadius="50%" outerRadius="78%" paddingAngle={5} dataKey="value"
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {pie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={32} />
      </PieChart>
    </ResponsiveContainer>
  )

  if (bare) return <div className="flex-1 min-h-0">{body}</div>
  return <OldChartCard title="Trạng thái bài nộp" icon={<PieChartIcon size={16} className="text-indigo-500" />}>{body}</OldChartCard>
}

/** Số KPI theo từng trạng thái. */
export function MyKpiStatusDistSection({ from, to, periodId, periodIdTo, bare }: MyKpiRange) {
  const { data } = useMyAnalytics(from, to, periodId, periodIdTo)
  const dist: Record<string, number> = {}
  for (const k of data?.kpiItems ?? []) dist[k.status] = (dist[k.status] ?? 0) + 1
  const rows = Object.entries(dist).map(([name, value]) => ({ name, value }))

  const body = rows.length === 0 ? <EmptyChart /> : (
    <ResponsiveContainer width="100%" height={bare ? '100%' : 240}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
        <YAxis fontSize={10} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )

  if (bare) return <div className="flex-1 min-h-0">{body}</div>
  return <OldChartCard title="Phân bổ trạng thái KPI" icon={<BarChartIcon size={16} className="text-violet-500" />}>{body}</OldChartCard>
}

/** Bảng lịch sử đánh giá — tự có tìm kiếm, sắp xếp và phân trang. */
export function MyKpiEvaluationHistorySection({ from, to, periodId, periodIdTo, bare }: MyKpiRange) {
  const { data } = useMyAnalytics(from, to, periodId, periodIdTo)
  const table = <EvaluationTableWidget data={data?.evaluationHistory ?? []} title="Lịch sử đánh giá" />
  if (bare) return <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">{table}</div>
  return table
}

/** Điểm đánh giá qua từng đợt. */
export function MyKpiScoreTrendSection({ from, to, periodId, periodIdTo, bare }: MyKpiRange) {
  const { data } = useMyAnalytics(from, to, periodId, periodIdTo)
  // Backend đã gom 1 dòng/đợt và sắp tăng dần theo đợt.
  const rows = (data?.evaluationHistory ?? []).map(e => ({ name: e.kpiName, value: e.score ?? 0 }))

  const body = rows.length === 0 ? <EmptyChart /> : (
    <ResponsiveContainer width="100%" height={bare ? '100%' : 240}>
      <AreaChart data={rows}>
        <defs>
          <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
        <YAxis fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip />
        <Area type="monotone" dataKey="value" name="Điểm" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#evalGrad)" dot={{ r: 4, fill: '#6366f1' }} />
      </AreaChart>
    </ResponsiveContainer>
  )

  if (bare) return <div className="flex-1 min-h-0">{body}</div>
  return <OldChartCard title="Xu hướng điểm số" icon={<Activity size={16} className="text-indigo-500" />}>{body}</OldChartCard>
}
