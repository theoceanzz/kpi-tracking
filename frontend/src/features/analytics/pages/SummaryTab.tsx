import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSummaryStats, useSummaryRankings } from '../hooks/useAnalytics'
import { cn, getInitials } from '@/lib/utils'
import { KpiTypeTags } from '../components/KpiTypeTags'
import { toChildNodes } from '../components/KpiChildList'
import { KpiChildTableRows } from '../components/KpiChildTableRows'
import { KpiResponsibleCell } from '../components/KpiResponsibleCell'
import { KpiPeriodCell } from '../components/KpiPeriodCell'
import { KpiWeightPill } from '../components/KpiWeightPill'
import {
  Target, Star, AlertCircle, Users, TrendingUp,
  ChevronRight, AlertTriangle, Medal, ArrowUpRight, ArrowDownRight,
  ChevronDown, Filter, ArrowUpDown, Loader2,
  X, CheckCircle, LayoutDashboard
} from 'lucide-react'
import AnalyticsTabSkeleton, { TableLoadingRows } from '@/components/common/AnalyticsTabSkeleton'
import type { RankingItem } from '@/types/stats'
import type { WidgetType } from '@/types/datasource'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AiAssistantWidget from '../components/AiAssistantWidget'
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import UnitComparisonBarChart from '../components/UnitComparisonBarChart'
import MemberRoleChart from '../components/MemberRoleChart'
import { SparseTableFiller } from '../components/SparseTableFiller'
import Pagination from '@/components/common/Pagination'
import { orgUnitKpiApi } from '@/features/dashboard/api/orgUnitKpiApi'
import type { OrgUnitAssigneeStat, OrgUnitSubmissionStat, UnitRiskRow, MemberRiskRow, OverdueKpiForUnit, OverdueKpiForMember } from '@/features/dashboard/api/orgUnitKpiApi'
import OrgUnitKpiDrawer from '../components/OrgUnitKpiDrawer'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { SortHeader } from '@/components/common/SortHeader'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { useDashboardCustomization } from '@/components/common/dashboard/useDashboardCustomization'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { format } from 'date-fns'

const CONFIG_REPORT_NAME = '__SUMMARY_DASHBOARD_CONFIG__'

type SortField = 'progress' | 'performance' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 5

export type SummaryWidgetType =
  | 'TREND_CHART'
  | 'KPI_DETAIL'
  | 'UNIT_PERFORMANCE'
  | 'UNIT_KPI'
  | 'MEMBER_DIST'
  | 'ROLE_DIST'
  | 'UNIT_RISK'
  | 'WARNING_LIST'
  | 'RANKING_TABLE'

type SummaryWidget = DashboardWidget

const DEFAULT_SUMMARY_WIDGETS: SummaryWidget[] = [
  { i: 'trend-chart', type: 'TREND_CHART', title: 'Xu hướng KPI theo thời gian', x: 0, y: 0, w: 12, h: 15, visible: true },
  { i: 'kpi-detail', type: 'KPI_DETAIL', title: 'Bảng chi tiết KPI đơn vị', x: 0, y: 15, w: 12, h: 18, visible: true },
  { i: 'unit-perf', type: 'UNIT_PERFORMANCE', title: 'Hiệu suất & Tiến độ đơn vị', x: 0, y: 34, w: 12, h: 13, visible: true },
  { i: 'member-dist', type: 'MEMBER_DIST', title: 'Nhân sự & vai trò theo đơn vị', x: 0, y: 47, w: 12, h: 10, visible: true },
  { i: 'unit-risk', type: 'UNIT_RISK', title: 'Rủi ro đơn vị', x: 0, y: 57, w: 12, h: 11, visible: true },
  { i: 'warning-list', type: 'WARNING_LIST', title: 'Rủi ro thành viên', x: 0, y: 68, w: 12, h: 11, visible: true },
  { i: 'rank-table', type: 'RANKING_TABLE', title: 'Bảng xếp hạng nhân sự', x: 0, y: 79, w: 12, h: 13, visible: true },
]

// Các widget cốt lõi luôn có mặt (bổ sung cho cấu hình cũ chưa có sau khi thêm mới).
const CORE_WIDGET_IDS = ['trend-chart', 'kpi-detail']

// KPI_DETAIL là loại widget riêng của FE — DB check constraint chưa có giá trị này nên lưu xuống dưới
// enum sẵn có 'TABLE'. Khi tải lên, loại thật được suy lại từ id widget (cfg.i) nên giá trị lưu không
// ảnh hưởng hiển thị. Nhờ vậy không cần đổi enum backend / migration DB.
// KPI_DETAIL là loại widget riêng của FE — DB check constraint chưa có giá trị này nên lưu xuống dưới
// enum sẵn có 'TABLE'. Khi tải lên, loại thật được suy lại từ id widget (cfg.i) nên giá trị lưu không
// ảnh hưởng hiển thị. Nhờ vậy không cần đổi enum backend / migration DB.
const toBackendWidgetType = (t: string): WidgetType =>
  t === 'KPI_DETAIL' ? 'TABLE' : (t as WidgetType)

// Migration cấu hình cũ: bỏ ROLE_DIST (đã gộp vào MEMBER_DIST), nâng sàn chiều cao TREND_CHART,
// và luôn có widget cốt lõi (xu hướng + bảng chi tiết).
const summaryPostProcess = (mapped: SummaryWidget[], defaults: SummaryWidget[]): SummaryWidget[] => {
  const hasLegacyRoleDist = mapped.some(w => w.type === 'ROLE_DIST')
  let result = mapped
    .filter(w => w.type !== 'ROLE_DIST')
    .map(w => (hasLegacyRoleDist && w.type === 'MEMBER_DIST')
      ? { ...w, w: 12, x: 0, title: 'Nhân sự & vai trò theo đơn vị' }
      : w)
    .map(w => (w.type === 'TREND_CHART' && (w.h ?? 0) < 15) ? { ...w, h: 15 } : w)
  CORE_WIDGET_IDS.forEach(id => {
    if (!result.some(w => w.i === id)) {
      const def = defaults.find(d => d.i === id)
      if (def) {
        const maxY = result.length ? Math.max(...result.map(w => w.y + w.h)) : 0
        result = [...result, { ...def, y: maxY }]
      }
    }
  })
  return result
}

// Danh mục widget cho modal "Thêm biểu đồ".
const SUMMARY_CATALOG: { template: SummaryWidget; icon: React.ReactNode }[] = DEFAULT_SUMMARY_WIDGETS.map(t => ({
  template: t,
  icon: t.type === 'KPI_DETAIL' ? <Target size={24} />
    : t.type === 'MEMBER_DIST' ? <Users size={24} />
    : t.type === 'UNIT_RISK' ? <AlertTriangle size={24} />
    : t.type === 'WARNING_LIST' ? <AlertCircle size={24} />
    : t.type === 'RANKING_TABLE' ? <Star size={24} />
    : <TrendingUp size={24} />,
}))

export default function SummaryTab() {
  const [selectedUnitId] = useState<string | undefined>(undefined)

  // ── Global filter state ───────────────────────────────────────────────────
  const [onlyApproved, setOnlyApproved] = useState(false)
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const [filterStuck, setFilterStuck] = useState(false)
  const filterSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = filterSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]) setFilterStuck(!entries[0].isIntersecting) },
      { threshold: 0, rootMargin: '-65px 0px 0px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // ── New KPI data ──────────────────────────────────────────────────────────
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => orgUnitKpiApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })

  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'chart', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => orgUnitKpiApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })

  // ── Detail table state ────────────────────────────────────────────────────
  const [filterOrgUnitId, setFilterOrgUnitId] = useState<string | undefined>(undefined)
  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tablePage, setTablePage] = useState(0)

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['orgUnitKpi', 'details', from, to, onlyApproved, periodId, periodIdTo, filterOrgUnitId, sortField, sortDir, filterShared, tablePage],
    queryFn: () => orgUnitKpiApi.getDetailedKpis({
      from, to, onlyApproved, periodId, periodIdTo,
      filterOrgUnitId,
      sortBy: sortField ?? undefined,
      sortDir,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: tablePage,
      size: PAGE_SIZE,
    }),
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setTablePage(0)
  }

  const clearTableFilters = () => {
    setFilterOrgUnitId(undefined)
    setFilterShared('ALL')
    setTablePage(0)
  }

  const hasTableFilters = !!(filterOrgUnitId || filterShared !== 'ALL')

  // ── Shared chart hover state (Top 5 sync) ────────────────────────────────
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null)

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  // ── Existing summary data (unchanged widgets) ─────────────────────────────
  const { data: mainData, isLoading: isMainLoading } = useSummaryStats(selectedUnitId)
  // ── Widget config (dùng hook + chrome dùng chung) ─────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện thống kê tổng hợp',
    defaultWidgets: DEFAULT_SUMMARY_WIDGETS,
    toBackendWidgetType,
    postProcess: summaryPostProcess,
  })
  const { isEditMode, handleTogglePin } = dash

  // Nội dung bảng chi tiết KPI (không bọc card/tiêu đề — ChartWrapper lo phần đó).
  const renderKpiDetailBody = () => (
    <div className="flex-1 flex flex-col min-h-0 -mx-6 -mb-6">
      {/* Bộ lọc */}
      <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <Select
          value={filterOrgUnitId ?? ALL_UNITS}
          onValueChange={v => { setFilterOrgUnitId(v === ALL_UNITS ? undefined : v); setTablePage(0) }}
        >
          <SelectTrigger className="h-9 max-w-[220px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
            {kpiPage?.availableOrgUnits?.map(o => (
              <UnitSelectItem key={o.code} o={o} />
            ))}
          </SelectContent>
        </Select>

        {hasTableFilters && (
          <button onClick={clearTableFilters} className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <X size={13} /> Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-xs font-black uppercase text-slate-500">
                <th className="px-6 py-4">Tên KPI</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4 whitespace-nowrap">
                  <SortHeader field="period" active={sortField} dir={sortDir} onToggle={toggleSort}>Đợt</SortHeader>
                </th>
                <th className="px-6 py-4 min-w-[220px]">
                  <SortHeader field="progress" active={sortField} dir={sortDir} onToggle={toggleSort}>Tiến độ</SortHeader>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isKpisLoading
                ? <TableLoadingRows cols={6} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <OrgUnitKpiRow key={kpi.kpiId} kpi={kpi} onClick={() => setSelectedKpiId(kpi.kpiId)} onSelectKpi={setSelectedKpiId} />
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
              <MobileOrgUnitKpiCard key={kpi.kpiId} kpi={kpi} onClick={() => setSelectedKpiId(kpi.kpiId)} />
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
        <Pagination
          currentPage={tablePage}
          totalPages={kpiPage?.totalPages ?? 1}
          onPageChange={setTablePage}
          totalElements={kpiPage?.totalElements ?? 0}
          size={PAGE_SIZE}
          itemLabel="KPI"
        />
      )}
    </div>
  )

  const renderWidgetContent = (widget: SummaryWidget) => {
    switch (widget.type) {
      case 'TREND_CHART': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-indigo-500" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đơn vị" fillHeight />
        </ChartWrapper>
      )
      case 'KPI_DETAIL': return (
        <ChartWrapper
          title="Bảng chi tiết KPI đơn vị"
          icon={<Target size={20} className="text-indigo-600" />}
          widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}
          extraHeaderContent={<span className="text-xs font-bold text-slate-400">{kpiPage?.totalElements ?? 0} KPI</span>}
        >
          {renderKpiDetailBody()}
        </ChartWrapper>
      )
      case 'UNIT_PERFORMANCE': return (
        <ChartWrapper title="Hiệu suất, tiến độ & tình hình nộp theo đơn vị" icon={<TrendingUp size={20} className="text-emerald-500" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <UnitComparisonBarChart orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} hoveredUnit={hoveredUnit} onHoverUnit={setHoveredUnit} />
        </ChartWrapper>
      )
      case 'UNIT_KPI': return null // gộp vào UNIT_PERFORMANCE (Hiệu suất & Tiến độ đơn vị)
      case 'MEMBER_DIST': return (
        <ChartWrapper title="Nhân sự & vai trò theo đơn vị" icon={<Users size={20} className="text-purple-600" />} widget={widget} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <MemberRoleChart data={mainData?.roleDistribution} />
        </ChartWrapper>
      )
      case 'ROLE_DIST': return null // đã gộp vào MEMBER_DIST (Nhân sự & vai trò)
      case 'UNIT_RISK': return <UnitRiskSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      case 'WARNING_LIST': return <WarningListSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      case 'RANKING_TABLE': return <EmployeeRankingTableSection orgUnitId={selectedUnitId} from={from} to={to} onlyApproved={onlyApproved} periodId={periodId} periodIdTo={periodIdTo} isEditMode={isEditMode} widget={widget} onTogglePin={handleTogglePin} />
      default: return null
    }
  }

  if (isMainLoading && !mainData) return <AnalyticsTabSkeleton variant="default" className="p-6" />

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Thống kê tổng hợp</h2>
        <DashboardEditToolbar api={dash} />
      </div>

      {/* ── Sentinel: 1px above filter to detect when filter becomes sticky ── */}
      <div ref={filterSentinelRef} className="h-px" aria-hidden />

      {/* ── Global Filter (sticky) ────────────────────────────────────────── */}
      <div className={cn(
        "sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all duration-200",
        filterStuck
          ? "p-3 shadow-lg shadow-slate-200/80 dark:shadow-slate-900/80 border-slate-300 dark:border-slate-700"
          : "p-4 shadow-sm"
      )}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg text-indigo-600 dark:text-indigo-400 transition-all duration-200",
              filterStuck ? "bg-indigo-50/60 dark:bg-indigo-900/20" : "bg-indigo-50 dark:bg-indigo-900/30"
            )}>
              <LayoutDashboard size={filterStuck ? 16 : 18} />
            </div>
            <div>
              <h2 className={cn("font-bold text-slate-900 dark:text-white transition-all duration-200", filterStuck ? "text-sm" : "text-base")}>
                Bộ lọc KPI đơn vị
              </h2>
              {!filterStuck && (
                <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho metrics, biểu đồ và bảng chi tiết</p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
                checked={onlyApproved}
                onChange={e => setOnlyApproved(e.target.checked)}
              />
              Chỉ tính bài nộp đã duyệt
            </label>
            {controls}
          </div>
        </div>
      </div>

      {/* ── Metrics ───────────────────────────────────────────────────────── */}
      {isMetricsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-[var(--color-muted)] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><TrendingUp size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Tiến độ trung bình</p>
              <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Target size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Hiệu suất trung bình (đánh giá)</p>
              <p className="text-2xl font-black">{metrics?.averagePerformance?.toFixed(1) ?? 0}%</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><CheckCircle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Trạng thái KPI</p>
              <p className="text-sm font-black">{metrics?.runningKpis ?? 0} Đang chạy</p>
              <p className="text-sm font-black text-emerald-600">{metrics?.completedKpis ?? 0} Hoàn thành</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">KPI Rủi ro / Chậm</p>
              <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><Users size={24} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500">Tổng nhân sự</p>
              <p className="text-2xl font-black">{mainData?.totalMembers ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Biểu đồ xu hướng & bảng chi tiết KPI giờ là widget trong lưới tuỳ chỉnh bên dưới. */}

      {/* ── Lưới widget tuỳ chỉnh ─────────────────────────────────────────── */}
      <DashboardCustomizeChrome api={dash} renderWidget={renderWidgetContent} catalog={SUMMARY_CATALOG} ready={!!mainData} />

      <AiAssistantWidget />

      {selectedKpiId && (
        <OrgUnitKpiDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={from}
          globalTo={to}
          globalOnlyApproved={onlyApproved}
          globalPeriodId={periodId}
          globalPeriodIdTo={periodIdTo}
        />
      )}
    </div>
  )
}

// ── KPI Detail Table Row ──────────────────────────────────────────────────────

function MobileOrgUnitKpiCard({ kpi, onClick }: { kpi: any; onClick?: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'

  return (
    <div className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/30 cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-sm text-slate-900 dark:text-white truncate min-w-0">{kpi.kpiName}</p>
        <span className="shrink-0">
          <KpiResponsibleCell orgUnitName={kpi.orgUnitName} />
        </span>
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

function OrgUnitKpiRow({ kpi, onClick, onSelectKpi }: { kpi: any; onClick?: () => void; onSelectKpi?: (id: string) => void }) {
  const hasChildren = !!(kpi.children && kpi.children.length > 0)
  const [isExpanded, setIsExpanded] = React.useState(hasChildren) // KPI cha/thác nước mặc định mở sẵn
  const [expandedParticipant, setExpandedParticipant] = React.useState<Record<string, boolean>>({})

  const { data: drawerData, isLoading: isLoadingParticipants } = useQuery({
    queryKey: ['orgUnitKpi', 'drawer', kpi.kpiId],
    queryFn: () => orgUnitKpiApi.getKpiDrawerData(kpi.kpiId),
    enabled: isExpanded,
    staleTime: 5 * 60 * 1000,
  })

  const submissionsByParticipant = React.useMemo(() => {
    const map: Record<string, OrgUnitSubmissionStat[]> = {}
    drawerData?.topSubmissions?.forEach((sub: OrgUnitSubmissionStat) => {
      ;(map[sub.submitterName] ??= []).push(sub)
    })
    return map
  }, [drawerData])

  // KPI thưởng: backend trả tiến độ/hiệu suất = null (không tính), hiển thị gạch ngang.
  const isBonus = kpi.progress == null
  const pct  = Math.round(kpi.progress    || 0)

  return (
    <React.Fragment>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={onClick}>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(prev => !prev) }}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 shadow-sm"
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors dark:text-white truncate max-w-[180px]">{kpi.kpiName}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <KpiTypeTags
                  isReverseKpi={kpi.isReverseKpi}
                  isBonusKpi={kpi.isBonusKpi}
                  parentRelationType={kpi.parentRelationType}
                  childRelationType={kpi.childRelationType}
                />
                <KpiWeightPill weight={kpi.weight} />
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <KpiResponsibleCell orgUnitName={kpi.orgUnitName} />
        </td>
        <td className="px-6 py-4">
          <KpiPeriodCell periodName={kpi.periodName} start={kpi.periodStart} end={kpi.periodEnd} />
        </td>
        <td className="px-6 py-4">
          {isBonus ? (
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
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
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
      </tr>

      {/* ── KPI con: render thành dòng bảng căn thẳng cột với cha ───────────── */}
      {isExpanded && hasChildren && (
        <KpiChildTableRows
          nodes={toChildNodes(kpi.children)}
          onSelect={onSelectKpi}
          headingColSpan={4}
          heading={kpi.childRelationType === 'DELEGATION' ? 'KPI con (thác nước)' : 'KPI con'}
          variant={{ showPersonColumn: true, accent: 'indigo', baseIndent: 24 }}
        />
      )}

      {/* ── Expanded participants row ────────────────────────────────────── */}
      {isExpanded && kpi.childRelationType !== 'DECOMPOSITION' && (
        <tr className="bg-slate-50/60 dark:bg-slate-800/10 border-l-[3px] border-l-indigo-400 dark:border-l-indigo-500/50">
          <td colSpan={4} className="px-8 py-5">
            {isLoadingParticipants ? (
              <div className="py-3 animate-pulse space-y-2">
                <div className="h-10 bg-[var(--color-muted)] rounded-xl" />
                <div className="h-10 bg-[var(--color-muted)] rounded-xl opacity-60" />
              </div>
            ) : (
              <>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500" />
                  {kpi.childRelationType === 'DELEGATION' ? 'Người chịu trách nhiệm' : 'Các thành viên đảm nhiệm'}
                </div>
                {!drawerData?.assigneeStats?.length ? (
                  <p className="text-sm text-slate-400 py-2 pl-3">Không có thành viên nào</p>
                ) : (
                  <div className="space-y-3 pl-3">
                    {drawerData.assigneeStats.map((p: OrgUnitAssigneeStat) => {
                      const subs = submissionsByParticipant[p.fullName] || []
                      const isPartExp = expandedParticipant[p.userId]
                      return (
                        <div key={p.userId} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-all">
                          {/* Participant header */}
                          <div
                            className={cn(
                              'p-4 flex items-center justify-between transition-colors',
                              subs.length ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : '',
                              isPartExp && 'border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30'
                            )}
                            onClick={() => subs.length && setExpandedParticipant(prev => ({ ...prev, [p.userId]: !prev[p.userId] }))}
                          >
                            <div className="flex items-center gap-3 min-w-[280px]">
                              {subs.length > 0 ? (
                                <button className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0">
                                  {isPartExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : <div className="w-6 h-6 flex-shrink-0" />}
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600 shadow-sm flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm flex-shrink-0">
                                  {p.fullName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight mb-0.5">{p.fullName}</div>
                                {p.roleName && <div className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded inline-block">{p.roleName}</div>}
                              </div>
                            </div>

                            <div className="flex-1 flex items-center justify-between px-6 border-l border-slate-100 dark:border-slate-700/50">
                              {p.orgUnitName && (
                                <div className="min-w-[140px] pr-4">
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Đơn vị</div>
                                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.orgUnitName}</div>
                                </div>
                              )}
                              <div className="flex-1 max-w-[360px]">
                                <div className="flex justify-between items-center mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                                  <span>Tiến độ cá nhân</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(p.completionRate)}%</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-700',
                                      p.completionRate >= 100 ? 'bg-emerald-500' : p.completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                    )}
                                    style={{ width: `${Math.min(p.completionRate, 100)}%` }}
                                  />
                                </div>
                                <div className={cn('text-[11px] font-bold mt-1.5',
                                  p.completionRate >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                                  p.completionRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                )}>
                                  {p.actualValue?.toLocaleString('vi-VN')} {kpi.unit}
                                </div>
                              </div>
                              <div className="flex flex-col items-center ml-8 min-w-[80px]">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Hiệu suất</span>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{Math.round(p.performanceRate)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Submissions */}
                          {isPartExp && subs.length > 0 && (
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 pt-3 pb-5">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-10">Lịch sử bài nộp</div>
                              <div className="space-y-2.5 pl-10 pr-4">
                                {subs.map((sub, idx) => (
                                  <div key={idx} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 shadow-sm hover:shadow-md transition-shadow gap-4">
                                    <div className="min-w-[180px] pr-4">
                                      <div className="font-bold text-[13px] text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                                        {`Bài nộp #${idx + 1}`}
                                      </div>
                                    </div>
                                    <div className="min-w-[140px] pr-4">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Thời gian nộp</div>
                                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                      </div>
                                    </div>
                                    <div className="flex-1 px-5 border-x border-slate-100 dark:border-slate-700/50">
                                      <div className="flex justify-between items-center text-[11px] font-medium uppercase tracking-wider mb-1 text-slate-500">
                                        <span>Đóng góp</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{sub.contributionProgress.toFixed(1)}%</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                          className={cn('h-full rounded-full',
                                            sub.contributionProgress >= 100 ? 'bg-emerald-500' : sub.contributionProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                          )}
                                          style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }}
                                        />
                                      </div>
                                      <div className={cn('text-[10.5px] font-bold mt-1',
                                        sub.contributionProgress >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                                        sub.contributionProgress >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                      )}>
                                        +{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}
                                      </div>
                                    </div>
                                    <div className="min-w-[100px] flex flex-col items-center">
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hiệu suất</span>
                                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{sub.performance.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </React.Fragment>
  )
}


// ── Widget sub-components (unchanged, no date filter) ─────────────────────────

function TableSkeletonRows({ cols, count = 5 }: { cols: number; count?: number }) {
  const widths = ['75%', '55%', '65%', '50%', '70%']
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse"
                style={{ width: j === 0 ? '30%' : widths[j % widths.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

type RiskSortField = 'progress' | 'overdueCount' | 'overdueRate'

// Sentinel cho mục "Tất cả đơn vị" — shadcn/Radix Select không cho phép value rỗng.
const ALL_UNITS = '__ALL__'

function UnitSelectItem({ o }: { o: { code: string; name: string; depth?: number } }) {
  const prefix = '-'.repeat(o.depth ?? 0)
  return <SelectItem value={o.code}>{prefix}{o.name}</SelectItem>
}

function RiskSortBtn({ field, active, dir, onToggle, children }: {
  field: RiskSortField; active: RiskSortField; dir: 'asc' | 'desc'
  onToggle: (f: RiskSortField) => void; children: React.ReactNode
}) {
  const isActive = active === field
  return (
    <button onClick={() => onToggle(field)} className="flex items-center gap-1 group hover:text-indigo-500 transition-colors whitespace-nowrap">
      {children}
      <span className="ml-0.5">
        {isActive ? (dir === 'asc' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />) : <ArrowUpDown size={11} className="opacity-30 group-hover:opacity-60" />}
      </span>
    </button>
  )
}

function UnitRiskExpandedRow({ unitId, colSpan }: { unitId: string; colSpan: number }) {
  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'unitOverdue', unitId],
    queryFn: () => orgUnitKpiApi.getUnitOverdueKpis(unitId),
  })
  const kpis = (data || []) as OverdueKpiForUnit[]
  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="mx-4 mb-3 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 overflow-hidden">
          {isFetching ? (
            <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Đang tải...</div>
          ) : kpis.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 font-semibold">Không có KPI trễ hạn</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] font-black uppercase text-red-400 border-b border-red-100 dark:border-red-900/40">
                  <th className="px-4 py-2 text-left">Tên KPI</th>
                  <th className="px-4 py-2 text-left">Hạn chót</th>
                  <th className="px-4 py-2 text-left">Giao cho</th>
                  <th className="px-4 py-2 text-right">Mục tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100/60 dark:divide-red-900/20">
                {kpis.map((k) => (
                  <tr key={k.kpiId} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                    <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300">{k.kpiName}</td>
                    <td className="px-4 py-2 text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">
                      {k.deadline ? format(new Date(k.deadline), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {k.assigneeNames.length > 0 ? k.assigneeNames.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {k.targetValue.toLocaleString()} {k.unit || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

export function UnitRiskSection({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, isEditMode, widget, onTogglePin, bare }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string; isEditMode?: boolean; widget?: SummaryWidget; onTogglePin?: (w: SummaryWidget) => void; bare?: boolean }) {
  const [page, setPage] = React.useState(0)
  const [sortBy, setSortBy] = React.useState<RiskSortField>('progress')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [expandedUnit, setExpandedUnit] = React.useState<string | null>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'units', orgUnitId, from, to, onlyApproved, periodId, periodIdTo, page, sortBy, sortDir],
    queryFn: () => orgUnitKpiApi.getUnitRisks({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, page, size: 5, sortBy, sortDir }),
    placeholderData: (prev) => prev,
  })

  const toggleSort = (field: RiskSortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
    setPage(0)
  }

  const rows = (data?.content || []) as UnitRiskRow[]

  const body = (
      <div className="flex-1 flex flex-col gap-3">
        <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-[9px] font-black uppercase text-slate-400">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left">Đơn vị</th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueCount" active={sortBy} dir={sortDir} onToggle={toggleSort}>Trễ hạn</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueRate" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tỉ lệ trễ</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="progress" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tiến độ TB</RiskSortBtn>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={5} count={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold">Không có dữ liệu rủi ro</td></tr>
              ) : rows.map((r) => (
                <React.Fragment key={r.unitId}>
                  <tr className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedUnit(expandedUnit === r.unitId ? null : r.unitId)}
                        className={cn('p-1 rounded-lg transition-all', expandedUnit === r.unitId ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}
                      >
                        <ChevronDown size={13} className={cn('transition-transform', expandedUnit === r.unitId && 'rotate-180')} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{r.unitName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md font-black">{r.overdueCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-black', r.overdueRate > 50 ? 'text-red-600' : r.overdueRate > 20 ? 'text-amber-600' : 'text-slate-500')}>{r.overdueRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', r.avgProgress >= 80 ? 'bg-emerald-500' : r.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(r.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-[11px]', r.avgProgress >= 80 ? 'text-emerald-600' : r.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600')}>{r.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  {expandedUnit === r.unitId && <UnitRiskExpandedRow unitId={r.unitId} colSpan={5} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <Pagination currentPage={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} totalElements={data?.totalElements ?? 0} size={5} itemLabel="đơn vị" />
        )}
      </div>
  )
  if (bare) return <div className="h-full flex flex-col overflow-auto custom-scrollbar">{body}</div>
  return (
    <ChartWrapper title="Rủi ro đơn vị" icon={<AlertTriangle size={20} className="text-red-500" />} widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}>
      {body}
    </ChartWrapper>
  )
}

function MemberOverdueKpiRow({ kpi, colSpan }: { kpi: OverdueKpiForMember; colSpan: number }) {
  const [showSubs, setShowSubs] = React.useState(false)
  return (
    <React.Fragment>
      <tr className="hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-colors">
        <td className="px-3 py-2">
          <button
            onClick={() => setShowSubs(v => !v)}
            className={cn('p-1 rounded-md transition-all', showSubs ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50')}
          >
            <ChevronDown size={12} className={cn('transition-transform', showSubs && 'rotate-180')} />
          </button>
        </td>
        <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300">{kpi.kpiName}</td>
        <td className="px-4 py-2 text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">
          {kpi.deadline ? format(new Date(kpi.deadline), 'dd/MM/yyyy') : '—'}
        </td>
        <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {kpi.targetValue.toLocaleString()} {kpi.unit || ''}
        </td>
      </tr>
      {showSubs && (
        <tr>
          <td colSpan={colSpan} className="px-0 py-0">
            <div className="mx-6 mb-2 rounded-lg border border-orange-100 dark:border-orange-900/30 bg-white dark:bg-slate-900 overflow-hidden">
              {kpi.submissions.length === 0 ? (
                <div className="px-4 py-2 text-[11px] text-slate-400 font-semibold">Chưa có bài nộp</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[8px] font-black uppercase text-orange-400 border-b border-orange-100 dark:border-orange-900/30">
                      <th className="px-4 py-1.5 text-right">Giá trị thực tế</th>
                      <th className="px-4 py-1.5 text-left">Thời gian nộp</th>
                      <th className="px-4 py-1.5 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50 dark:divide-orange-900/20">
                    {kpi.submissions.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-1.5 text-right font-bold text-slate-700 dark:text-slate-300">{s.actualValue.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {s.submittedAt ? format(new Date(s.submittedAt), 'dd/MM/yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black',
                            s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            s.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {s.status === 'APPROVED' ? 'Đã duyệt' : s.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  )
}

function MemberRiskExpandedRow({ userId, orgUnitId, colSpan }: { userId: string; orgUnitId?: string; colSpan: number }) {
  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'memberOverdue', userId, orgUnitId],
    queryFn: () => orgUnitKpiApi.getMemberOverdueKpis(userId, orgUnitId),
  })
  const kpis = (data || []) as OverdueKpiForMember[]
  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="mx-4 mb-3 rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10 overflow-hidden">
          {isFetching ? (
            <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Đang tải...</div>
          ) : kpis.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 font-semibold">Không có KPI trễ hạn</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] font-black uppercase text-orange-400 border-b border-orange-100 dark:border-orange-900/40">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-4 py-2 text-left">Tên KPI</th>
                  <th className="px-4 py-2 text-left">Hạn chót</th>
                  <th className="px-4 py-2 text-right">Mục tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100/60 dark:divide-orange-900/20">
                {kpis.map((k) => (
                  <MemberOverdueKpiRow key={k.kpiId} kpi={k} colSpan={4} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

export function WarningListSection({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, isEditMode, widget, onTogglePin, bare }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string; isEditMode?: boolean; widget?: SummaryWidget; onTogglePin?: (w: SummaryWidget) => void; bare?: boolean }) {
  const [page, setPage] = React.useState(0)
  const [sortBy, setSortBy] = React.useState<RiskSortField>('progress')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [filterOrgUnitId, setFilterOrgUnitId] = React.useState<string | undefined>(undefined)
  const [expandedMember, setExpandedMember] = React.useState<string | null>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['orgUnitKpi', 'risks', 'members', orgUnitId, from, to, onlyApproved, periodId, periodIdTo, filterOrgUnitId, page, sortBy, sortDir],
    queryFn: () => orgUnitKpiApi.getMemberRisks({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, filterOrgUnitId, page, size: 5, sortBy, sortDir }),
    placeholderData: (prev) => prev,
  })

  const toggleSort = (field: RiskSortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
    setPage(0)
  }

  const rows = (data?.content || []) as MemberRiskRow[]
  const filterUnits = data?.availableOrgUnits || []

  const body = (
      <div className="flex-1 flex flex-col gap-3">
        <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-[9px] font-black uppercase text-slate-400">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left">Thành viên</th>
                <th className="px-4 py-3 text-left">Đơn vị</th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueCount" active={sortBy} dir={sortDir} onToggle={toggleSort}>Trễ hạn</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="overdueRate" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tỉ lệ trễ</RiskSortBtn>
                </th>
                <th className="px-4 py-3 text-center">
                  <RiskSortBtn field="progress" active={sortBy} dir={sortDir} onToggle={toggleSort}>Tiến độ TB</RiskSortBtn>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={6} count={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold">Không có dữ liệu rủi ro</td></tr>
              ) : rows.map((r) => (
                <React.Fragment key={r.userId}>
                  <tr className="hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedMember(expandedMember === r.userId ? null : r.userId)}
                        className={cn('p-1 rounded-lg transition-all', expandedMember === r.userId ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50')}
                      >
                        <ChevronDown size={13} className={cn('transition-transform', expandedMember === r.userId && 'rotate-180')} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.avatarUrl
                          ? <img src={r.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-[10px] font-black text-orange-600 flex-shrink-0">{r.fullName.charAt(0).toUpperCase()}</div>
                        }
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[90px]">{r.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[80px] text-[10px]">{r.orgUnitName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md font-black">{r.overdueCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-black', r.overdueRate > 50 ? 'text-red-600' : r.overdueRate > 20 ? 'text-amber-600' : 'text-slate-500')}>{r.overdueRate.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', r.avgProgress >= 80 ? 'bg-emerald-500' : r.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(r.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-[11px]', r.avgProgress >= 80 ? 'text-emerald-600' : r.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600')}>{r.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  {expandedMember === r.userId && <MemberRiskExpandedRow userId={r.userId} orgUnitId={orgUnitId} colSpan={6} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <Pagination currentPage={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} totalElements={data?.totalElements ?? 0} size={5} itemLabel="thành viên" />
        )}
      </div>
  )
  if (bare) return <div className="h-full flex flex-col overflow-auto custom-scrollbar">{body}</div>
  return (
    <ChartWrapper
      title="Rủi ro thành viên"
      icon={<AlertCircle size={20} className="text-orange-500" />}
      widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}
      extraHeaderContent={
        filterUnits.length > 0 ? (
          <Select
            value={filterOrgUnitId ?? ALL_UNITS}
            onValueChange={v => { setFilterOrgUnitId(v === ALL_UNITS ? undefined : v); setPage(0) }}
          >
            <SelectTrigger className="h-8 max-w-[160px] gap-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
              {filterUnits.map(u => <UnitSelectItem key={u.code} o={u} />)}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {body}
    </ChartWrapper>
  )
}

export function EmployeeRankingTableSection({ orgUnitId, from, to, onlyApproved, periodId, periodIdTo, isEditMode, widget, onTogglePin, bare }: { orgUnitId?: string; from?: string; to?: string; onlyApproved?: boolean; periodId?: string; periodIdTo?: string; isEditMode?: boolean; widget?: SummaryWidget; onTogglePin?: (w: SummaryWidget) => void; bare?: boolean }) {
  const [rankingUnitId, setRankingUnitId] = useState<string | undefined>(undefined)
  const [sf, setSf] = useState<'performance' | 'avgProgress'>('performance')
  const [sd, setSd] = useState<'ASC' | 'DESC'>('DESC')
  const [rankPage, setRankPage] = useState(0)
  const RANK_PAGE_SIZE = 5

  // Sort + phân trang đã chuyển sang backend; render thẳng trang hiện tại trả về.
  const { data, isFetching } = useSummaryRankings(orgUnitId, rankingUnitId, from, to, onlyApproved, periodId, rankPage, RANK_PAGE_SIZE, sf, sd, periodIdTo);

  const pagedRankings = (data?.rankings ?? []) as RankingItem[]
  const totalRankPages = data?.totalPages ?? 0
  const totalRankElements = data?.totalElements ?? 0

  const handleSort = (field: 'performance' | 'avgProgress') => {
    if (sf === field) setSd(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    else { setSf(field); setSd('DESC') }
    setRankPage(0)
  }

  const sortIcon = (field: 'performance' | 'avgProgress') => sf === field
    ? (sd === 'DESC' ? <ArrowDownRight size={10} className="inline ml-1" /> : <ArrowUpRight size={10} className="inline ml-1" />)
    : <ArrowUpDown size={10} className="inline ml-1 opacity-30" />

  const body = (
      <div className="flex-1 flex flex-col gap-3">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Hạng</th>
                <th className="px-6 py-4">Nhân viên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('avgProgress')}>
                  Tiến độ trung bình {sortIcon('avgProgress')}
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('performance')}>
                  Hiệu suất {sortIcon('performance')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isFetching ? (
                <TableSkeletonRows cols={5} count={5} />
              ) : pagedRankings.map((item, i) => {
                const globalRank = rankPage * RANK_PAGE_SIZE + i
                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs",
                        globalRank === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                        globalRank === 1 ? "bg-slate-400 text-white" :
                        globalRank === 2 ? "bg-orange-400 text-white" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>{globalRank + 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center font-black text-indigo-600 text-xs">{getInitials(item.name)}</div>
                        <p className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-500 text-xs">{item.subText}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',
                            item.avgProgress >= 80 ? 'bg-emerald-500' :
                            item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                        </div>
                        <span className={cn('font-black text-xs',
                          item.avgProgress >= 80 ? 'text-emerald-600' :
                          item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                        )}>{item.avgProgress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-black",
                        item.performance >= 80 ? "bg-emerald-50 text-emerald-600" :
                        item.performance >= 50 ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      )}>{item.performance.toFixed(1)}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pagedRankings.length === 0 && !isFetching && (
            <div className="py-16 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng</div>
          )}
        </div>

        <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
          {isFetching ? (
            <div className="p-6 text-sm text-slate-400">Đang tải...</div>
          ) : pagedRankings.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold italic">Không có dữ liệu xếp hạng</div>
          ) : (
            pagedRankings.map((item, i) => {
              const globalRank = rankPage * RANK_PAGE_SIZE + i
              return (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                      globalRank === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                      globalRank === 1 ? "bg-slate-400 text-white" :
                      globalRank === 2 ? "bg-orange-400 text-white" :
                      "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}>{globalRank + 1}</div>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center font-black text-indigo-600 text-xs shrink-0">{getInitials(item.name)}</div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[11px] font-bold text-slate-400 truncate">{item.subText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',
                        item.avgProgress >= 80 ? 'bg-emerald-500' :
                        item.avgProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )} style={{ width: `${Math.min(item.avgProgress, 100)}%` }} />
                    </div>
                    <span className={cn('font-black text-xs shrink-0',
                      item.avgProgress >= 80 ? 'text-emerald-600' :
                      item.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'
                    )}>{item.avgProgress.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-black",
                      item.performance >= 80 ? "bg-emerald-50 text-emerald-600" :
                      item.performance >= 50 ? "bg-amber-50 text-amber-600" :
                      "bg-red-50 text-red-600"
                    )}>Hiệu suất {item.performance.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {totalRankPages > 1 && (
          <Pagination currentPage={rankPage} totalPages={totalRankPages} onPageChange={setRankPage} totalElements={totalRankElements} size={RANK_PAGE_SIZE} itemLabel="nhân viên" />
        )}
      </div>
  )
  if (bare) return <div className="h-full flex flex-col overflow-auto custom-scrollbar">{body}</div>
  return (
    <ChartWrapper
      title="Bảng xếp hạng nhân sự"
      icon={<Medal size={20} className="text-indigo-600" />}
      widget={widget!} onTogglePin={onTogglePin!} isEditMode={!!isEditMode}
      extraHeaderContent={
        <Select
          value={rankingUnitId ?? ALL_UNITS}
          onValueChange={v => { setRankingUnitId(v === ALL_UNITS ? undefined : v); setRankPage(0) }}
        >
          <SelectTrigger className="h-auto gap-2 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm max-w-[200px]">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
            {(data?.rankingOptions || []).map((opt: any) => (
              <UnitSelectItem key={opt.id} o={{ code: opt.id, name: opt.name, depth: opt.depth }} />
            ))}
          </SelectContent>
        </Select>
      }
    >
      {body}
    </ChartWrapper>
  );
}

