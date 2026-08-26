import { useState, useMemo } from 'react'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { useQuery } from '@tanstack/react-query'
import {
  Target, TrendingUp, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight,
  User, Users, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { QualitativeResultChip } from '../components/QualitativeResultChip'
import { toChildNodes } from '../components/KpiChildList'
import { KpiChildTableRows } from '../components/KpiChildTableRows'
import { KpiPeriodCell } from '../components/KpiPeriodCell'
import { KpiWeightPill } from '../components/KpiWeightPill'

import MyObjectiveDrawer from '../components/MyObjectiveDrawer'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import { SparseTableFiller } from '../components/SparseTableFiller'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import Pagination from '@/components/common/Pagination'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { SortHeader } from '@/components/common/SortHeader'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { useDashboardCustomization } from '@/components/common/dashboard/useDashboardCustomization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { WidgetType } from '@/types/datasource'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { format } from 'date-fns'

type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 10

const CONFIG_REPORT_NAME = '__MY_OBJECTIVES_DASHBOARD_CONFIG__'
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'myobj-trend', type: 'MYOBJ_TREND', title: 'Xu hướng KPI theo thời gian', x: 0, y: 0, w: 12, h: 15, visible: true },
  { i: 'myobj-detail', type: 'MYOBJ_DETAIL', title: 'Bảng chi tiết KPI đang đảm nhiệm', x: 0, y: 15, w: 12, h: 18, visible: true },
]
// Loại FE → enum WidgetType hợp lệ ở DB (không cần migration): trend→TREND_CHART, detail→TABLE.
const toBackendWidgetType = (t: string): WidgetType => t === 'MYOBJ_TREND' ? 'TREND_CHART' : 'TABLE'
const CATALOG: { template: DashboardWidget; icon: React.ReactNode }[] = DEFAULT_WIDGETS.map(t => ({
  template: t,
  icon: t.type === 'MYOBJ_TREND' ? <TrendingUp size={24} /> : <Target size={24} />,
}))

export default function MyObjectivesTab() {
  const onlyApproved = false
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-10' })
  const perf = usePerformanceScale()
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['personalObjective', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => personalObjectiveApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalObjective', 'chart', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => personalObjectiveApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  // ── Tuỳ chỉnh giao diện (lưới widget dùng chung) ──────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện Mục tiêu của tôi',
    defaultWidgets: DEFAULT_WIDGETS,
    toBackendWidgetType,
  })
  const { isEditMode, handleTogglePin } = dash

  const renderWidget = (w: DashboardWidget) => {
    switch (w.type) {
      case 'MYOBJ_TREND': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-indigo-500" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đảm nhiệm" fillHeight />
        </ChartWrapper>
      )
      case 'MYOBJ_DETAIL': return <MyObjectiveDetailSection from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} isEditMode={isEditMode} widget={w} onTogglePin={handleTogglePin} />
      default: return null
    }
  }

  if (isMetricsLoading || isChartLoading)
    return <AnalyticsTabSkeleton variant="objectives" className="p-6" />

  return (
    <div className="space-y-6">
      {/* Tiêu đề + nút Tuỳ chỉnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Mục tiêu của tôi</h2>
        <DashboardEditToolbar api={dash} />
      </div>

      {/* Global Filter Toolbar */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 justify-between p-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-900/30">
            <Target size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-white leading-tight text-base">Bộ lọc mục tiêu của tôi</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5 w-full lg:w-auto lg:shrink-0">
          <div className="w-full sm:w-auto">
            {controls}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tiến độ trung bình</p>
            <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Target size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Hiệu suất trung bình (đánh giá)</p>
            <p className="text-2xl font-black">{perf.format(metrics?.averagePerformance ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Trạng thái KPI</p>
            <p className="text-sm font-black">{metrics?.runningKpis ?? 0} Đang chạy</p>
            <p className="text-sm font-black text-emerald-600">{metrics?.completedKpis ?? 0} Hoàn thành</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">KPI Rủi ro / Chậm</p>
            <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Bảng chi tiết */}
      <DashboardCustomizeChrome api={dash} renderWidget={renderWidget} catalog={CATALOG} />
    </div>
  )
}


/**
 * Bảng chi tiết mục tiêu cá nhân — tự quản bộ lọc/sắp xếp/phân trang/drawer.
 *
 * <p>Tách khỏi thân tab để trang chủ dùng lại được nguyên vẹn (`bare`); xem
 * `OrgUnitKpiDetailSection` bên SummaryTab cho cùng lý do.
 */
export function MyObjectiveDetailSection({
  from, to, onlyApproved = false, periodId, periodIdTo, isEditMode, widget, onTogglePin, bare,
}: {
  from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string
  isEditMode?: boolean; widget?: DashboardWidget; onTogglePin?: (w: DashboardWidget) => void; bare?: boolean
}) {
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  // Table controls
  const [filterObjective, setFilterObjective] = useState('')
  const [filterKr, setFilterKr] = useState('')
  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalObjective', 'details', from, to, onlyApproved, periodId, periodIdTo, sortField, sortDir, filterObjective, filterKr, filterShared, page],
    queryFn: () => personalObjectiveApi.getDetailedKpis({
      from, to, onlyApproved, periodId, periodIdTo,
      sortBy: sortField ?? undefined,
      sortDir,
      objectiveCode: filterObjective || undefined,
      keyResultCode: filterKr || undefined,
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

  const handleObjectiveChange = (val: string) => {
    setFilterObjective(val)
    setFilterKr('')
    setPage(0)
  }

  const clearFilters = () => {
    setFilterObjective('')
    setFilterKr('')
    setFilterShared('ALL')
    setPage(0)
  }

  const hasFilters = !!(filterObjective || filterKr || filterShared !== 'ALL')

  // KR options: filter by selected objective if any
  const krOptions = useMemo(() => {
    if (!kpiPage?.availableKeyResults) return []
    if (!filterObjective) return kpiPage.availableKeyResults
    // Need KRs that belong to selected objective — backend returns all KRs, frontend narrows by current page data
    // We use the full availableKeyResults (unfiltered) so user can still pick any KR
    return kpiPage.availableKeyResults
  }, [kpiPage?.availableKeyResults, filterObjective])

  const body = (
    <div className={cn("flex-1 flex flex-col min-h-0", bare ? "-mx-5 sm:-mx-6 -mb-5 sm:-mb-6" : "-mx-6 -mb-6")}>
      <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <Select value={filterObjective || 'ALL'} onValueChange={v => handleObjectiveChange(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold w-full sm:w-[300px]">
            <SelectValue placeholder="Tất cả mục tiêu" />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]">
            <SelectItem value="ALL">Tất cả mục tiêu</SelectItem>
            {kpiPage?.availableObjectives?.map(o => (
              <SelectItem key={o.code} value={o.code}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterKr || 'ALL'} onValueChange={v => { setFilterKr(v === 'ALL' ? '' : v); setPage(0) }}>
          <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold w-full sm:w-[300px]">
            <SelectValue placeholder="Tất cả Key Result" />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]">
            <SelectItem value="ALL">Tất cả Key Result</SelectItem>
            {krOptions.map(o => (
              <SelectItem key={o.code} value={o.code}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {([['ALL', 'Tất cả'], ['SHARED', 'Mục tiêu chung'], ['PERSONAL', 'Mục tiêu riêng']] as [SharedFilter, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setFilterShared(v); setPage(0) }}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-black transition-all',
                filterShared === v
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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
                <th className="px-6 py-4">Mục tiêu hướng tới</th>
                <th className="px-6 py-4">Kết quả chính (KR)</th>
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
                ? <TableLoadingRows cols={7} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <ExpandableKpiRow key={kpi.kpiId} kpi={kpi} onExpand={() => setSelectedKpiId(kpi.kpiId)} onSelectKpi={setSelectedKpiId} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {isKpisLoading ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : kpiPage?.content?.length ? (
            kpiPage.content.map(kpi => (
              <MobileKpiCard key={kpi.kpiId} kpi={kpi} onExpand={() => setSelectedKpiId(kpi.kpiId)} />
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
    <MyObjectiveDrawer
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
      <ChartWrapper title="Bảng chi tiết KPI đang đảm nhiệm" icon={<Target size={20} className="text-indigo-600" />} widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}
        extraHeaderContent={<span className="text-xs font-bold text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>}>
        {body}
      </ChartWrapper>
      {drawer}
    </>
  )
}




function MobileKpiCard({ kpi, onExpand }: { kpi: any; onExpand: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'

  return (
    <div className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/30" onClick={onExpand}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{kpi.kpiName}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{kpi.objectiveName} ({kpi.objectiveCode})</p>
          <p className="text-[11px] text-slate-500">{kpi.keyResultName} • {kpi.keyResultCode}</p>
        </div>
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
            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandableKpiRow({ kpi, onExpand, onSelectKpi }: { kpi: any; onExpand: () => void; onSelectKpi?: (id: string) => void }) {
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
        <td className="px-6 py-4 cursor-pointer" onClick={onExpand}>
          <div className="font-bold text-sm text-slate-900 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors dark:text-white truncate max-w-[200px]">{kpi.kpiName}</div>
          <div className="text-[11px] text-slate-500 mt-1">{kpi.objectiveName} ({kpi.objectiveCode})</div>
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
          <div className="text-sm font-medium">{kpi.keyResultName}</div>
          <div className="text-[11px] text-slate-500 mt-1">{kpi.keyResultCode}</div>
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
                Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-black">{pct}%</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase">
              <Users size={12} /> Mục tiêu chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
              <User size={12} /> Mục tiêu riêng
            </div>
          )}
        </td>
      </tr>
      {expanded && hasChildren && (
        <KpiChildTableRows
          nodes={toChildNodes(kpi.children)}
          onSelect={onSelectKpi}
          headingColSpan={6}
          variant={{ leadingChevronCol: true, showPersonColumn: false, extraColsAfterName: 1, trailingEmptyCols: 1, accent: 'indigo', baseIndent: 28 }}
        />
      )}
      {expanded && (!hasChildren || (kpi.mySubmissions?.length ?? 0) > 0 || kpi.shared) && (
        <tr>
          <td colSpan={6} className="p-0 border-b border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 border-l-4 border-indigo-500">
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
                          <div className="flex-1 max-w-[200px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-500">Đóng góp</span>
                              <span className="text-[10px] font-black">{sub.contributionProgress?.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                            </div>
                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                          </div>
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

              {kpi.shared && kpi.childRelationType !== 'DECOMPOSITION' && (
                <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates?.map((tm: any) => (
                      <div key={tm.userId} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl ? (
                            <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">
                              {tm.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{tm.fullName}</p>
                            <p className="text-[10px] text-slate-500">{tm.employeeCode}</p>
                          </div>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{tm.role}</p>
                          <p className="text-[10px] text-slate-500">{tm.department}</p>
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
                              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-1">{tm.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                            </div>
                            <div className="text-center sm:text-right w-[100px]">
                              <p className="text-[10px] text-slate-500">Hiệu suất (đánh giá)</p>
                              <p className="text-sm font-black text-indigo-500">{tm.performance != null ? `${tm.performance.toFixed(1)}%` : '—'}</p>
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
