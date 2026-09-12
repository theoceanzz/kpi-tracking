import { useState, useMemo } from 'react'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { useQuery } from '@tanstack/react-query'
import DumbbellDotPlot from '@/components/charts/primitives/DumbbellDotPlot'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
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
import AnalyticsTabHeader from '../components/AnalyticsTabHeader'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'
type SharedFilter = 'ALL' | 'SHARED' | 'PERSONAL'

const PAGE_SIZE = 10

// Chế độ biểu đồ lấy trọn danh sách thay vì phân trang. Trần này chỉ để chặn trường hợp bất
// thường; chạm trần thì biểu đồ báo rõ chứ không cắt cụt im lặng.
const CHART_FETCH_SIZE = 200

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
  const { periodId, periodIdTo, from, to, groupBy, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const perf = usePerformanceScale()
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  const { view: detailView, setView: setDetailView } = useChartTableView('myobj-detail')

  // Table controls
  const [filterObjective, setFilterObjective] = useState('')
  const [filterKr, setFilterKr] = useState('')
  const [filterShared, setFilterShared] = useState<SharedFilter>('ALL')
  const [sortField, setSortField] = useState<SortField | null>('period') // ưu tiên đợt/ngày gần nhất
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['personalObjective', 'metrics', from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => personalObjectiveApi.getMetrics({ from, to, onlyApproved, periodId, periodIdTo }),
  })
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalObjective', 'chart', from, to, onlyApproved, periodId, periodIdTo, groupBy],
    queryFn: () => personalObjectiveApi.getComboChart({ from, to, onlyApproved, periodId, periodIdTo, groupBy }),
  })
  // Chế độ biểu đồ lấy TRỌN danh sách, chế độ bảng phân trang như cũ — phân trang là affordance của
  // bảng, đưa vào biểu đồ thì mỗi trang chỉ còn là một mảnh vụn không so được với nhau.
  const chartMode = detailView === 'chart'
  const effectivePage = chartMode ? 0 : page
  const effectiveSize = chartMode ? CHART_FETCH_SIZE : PAGE_SIZE

  const { data: kpiPage, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalObjective', 'details', from, to, onlyApproved, periodId, periodIdTo, sortField, sortDir, filterObjective, filterKr, filterShared, effectivePage, effectiveSize],
    queryFn: () => personalObjectiveApi.getDetailedKpis({
      from, to, onlyApproved, periodId, periodIdTo,
      sortBy: sortField ?? undefined,
      sortDir,
      objectiveCode: filterObjective || undefined,
      keyResultCode: filterKr || undefined,
      sharedType: filterShared === 'ALL' ? undefined : filterShared,
      page: effectivePage,
      size: effectiveSize,
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

  // ── Tuỳ chỉnh giao diện (lưới widget dùng chung) ──────────────────────────
  const dash = useDashboardCustomization({
    configReportName: CONFIG_REPORT_NAME,
    reportDescription: 'Cấu hình giao diện Mục tiêu của tôi',
    defaultWidgets: DEFAULT_WIDGETS,
    toBackendWidgetType,
  })
  const { isEditMode, handleTogglePin } = dash

  // Nội dung bảng chi tiết (không bọc card/tiêu đề — ChartWrapper lo phần đó).
  const renderDetailBody = () => (
    <div className="flex-1 flex flex-col min-h-0 -mx-6 -mb-6">
      <div className="px-6 pb-4 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3">
        <Select value={filterObjective || 'ALL'} onValueChange={v => handleObjectiveChange(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="h-9 bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-semibold w-full sm:w-[300px]">
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
          <SelectTrigger className="h-9 bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-semibold w-full sm:w-[300px]">
            <SelectValue placeholder="Tất cả Key Result" />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]">
            <SelectItem value="ALL">Tất cả Key Result</SelectItem>
            {krOptions.map(o => (
              <SelectItem key={o.code} value={o.code}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-0.5 p-1 bg-[var(--color-muted)] rounded-control">
          {([['ALL', 'Tất cả'], ['SHARED', 'Mục tiêu chung'], ['PERSONAL', 'Mục tiêu riêng']] as [SharedFilter, string][]).map(([v, label]) => (
            <ChoiceChip selected={filterShared === v} variant="segment" size="sm" className="py-1" key={v} onClick={() => { setFilterShared(v); setPage(0) }}>
              {label}
            </ChoiceChip>
          ))}
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={clearFilters}>
            <X aria-hidden="true" /> Xóa bộ lọc
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-muted)]">
              <tr className="text-eyebrow">
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
            <tbody className="divide-y divide-[var(--color-border)]">
              {isKpisLoading
                ? <TableLoadingRows cols={6} count={2} />
                : kpiPage?.content?.map(kpi => (
                    <ExpandableKpiRow key={kpi.kpiId} kpi={kpi} onExpand={() => setSelectedKpiId(kpi.kpiId)} onSelectKpi={setSelectedKpiId} />
                  ))}
              {!isKpisLoading && (kpiPage?.totalElements ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-[var(--color-subtle-foreground)]">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {isKpisLoading ? (
            <div className="p-6 text-sm text-[var(--color-subtle-foreground)]">Đang tải...</div>
          ) : kpiPage?.content?.length ? (
            kpiPage.content.map(kpi => (
              <MobileKpiCard key={kpi.kpiId} kpi={kpi} onExpand={() => setSelectedKpiId(kpi.kpiId)} />
            ))
          ) : (
            <div className="text-center py-8 text-[var(--color-subtle-foreground)]">Không có dữ liệu</div>
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

  // Mỗi KPI một đoạn nối thực tế → mục tiêu: chiều dài đoạn CHÍNH LÀ phần còn phải làm.
  // Thanh tiến độ trong bảng nói cùng nội dung nhưng phải đọc từng dòng mới xếp hạng được mức độ gấp.
  const renderGapBody = () => {
    const rows = (kpiPage?.content ?? []).filter(k => k.kpiType !== 'QUALITATIVE' && k.targetValue > 0)
    const qualitativeCount = (kpiPage?.content ?? []).length - rows.length
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {isKpisLoading ? (
          <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-subtle-foreground)] font-semibold italic">Không có KPI định lượng nào trong kỳ này</div>
        ) : (
          <DumbbellDotPlot
            xLabel="Tiến độ (%)"
            data={rows.map(k => ({
              id: k.kpiId,
              name: k.kpiName,
              subText: [k.keyResultName, k.periodName].filter(Boolean).join(' · '),
              from: k.actualValue,
              to: k.targetValue,
              unit: k.unit,
            }))}
            fromLabel="Thực tế" toLabel="Mục tiêu"
            onSelect={d => { if (d.id) setSelectedKpiId(d.id) }}
          />
        )}
        {qualitativeCount > 0 && (
          <p className="text-caption font-medium text-center">
            {qualitativeCount} KPI định tính không hiện ở đây — xem trong chế độ bảng.
          </p>
        )}
        {(kpiPage?.totalElements ?? 0) > CHART_FETCH_SIZE && (
          <p className="text-xs text-[var(--color-warning)] font-medium text-center">
            Có {kpiPage?.totalElements} KPI, biểu đồ chỉ vẽ {CHART_FETCH_SIZE} mục đầu — xem đủ ở chế độ bảng.
          </p>
        )}
      </div>
    )
  }

  const renderWidget = (w: DashboardWidget) => {
    switch (w.type) {
      case 'MYOBJ_TREND': return (
        <ChartWrapper chromeless title="Xu hướng KPI theo thời gian" icon={<TrendingUp size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}>
          <AnalyticsComboChart data={chartData?.points || []} isLoading={isChartLoading} itemName="KPI đảm nhiệm" fillHeight />
        </ChartWrapper>
      )
      case 'MYOBJ_DETAIL': return (
        <ChartWrapper title="KPI đang đảm nhiệm" icon={<Target size={20} className="text-[var(--color-primary)]" />} widget={w} onTogglePin={handleTogglePin} isEditMode={isEditMode}
          extraHeaderContent={
            <>
              <span className="text-caption">{kpiPage?.totalElements ?? 0} KPI</span>
              <ViewToggleButtons view={detailView} onChange={setDetailView} />
            </>
          }>
          {detailView === 'chart' ? renderGapBody() : renderDetailBody()}
        </ChartWrapper>
      )
      default: return null
    }
  }

  if (isMetricsLoading || isChartLoading)
    return <AnalyticsTabSkeleton variant="objectives" className="p-6" />

  return (
    <div className="space-y-4">
      <AnalyticsTabHeader
        title="Mục tiêu của tôi"
        description="Tiến độ, hiệu suất và các KPI thuộc mục tiêu bạn đảm nhận; bộ lọc thời gian áp cho mọi biểu đồ bên dưới."
        actions={<DashboardEditToolbar api={dash} />}
        filters={<>{controls}</>}
      />

      {/* Metrics Row */}
      <div id="tour-analytics-metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tiến độ trung bình" value={`${metrics?.averageProgress?.toFixed(1) ?? 0}%`} icon={<TrendingUp />} color="indigo" />
        <StatCard label="Hiệu suất trung bình (đánh giá)" value={perf.format(metrics?.averagePerformance ?? 0)} icon={<Target />} color="emerald" />
        <StatCard
          label="Trạng thái KPI"
          value={<p className="text-stat truncate">{metrics?.runningKpis ?? 0} <span className="text-sm font-normal text-[var(--color-muted-foreground)]">đang chạy</span></p>}
          sub={<span className="text-[var(--color-success)]">{metrics?.completedKpis ?? 0} hoàn thành</span>}
          icon={<CheckCircle />}
          color="amber"
        />
        <StatCard label="KPI rủi ro / chậm" value={metrics?.riskKpis ?? 0} icon={<AlertTriangle />} color="red" highlight={(metrics?.riskKpis ?? 0) > 0} />
      </div>

      {/* Lưới widget tuỳ chỉnh: Xu hướng + Bảng chi tiết */}
      <div id="tour-analytics-widgets">
        <DashboardCustomizeChrome api={dash} renderWidget={renderWidget} catalog={CATALOG} />
      </div>

      {selectedKpiId && (
        <MyObjectiveDrawer
          kpiId={selectedKpiId}
          onClose={() => setSelectedKpiId(null)}
          globalFrom={from}
          globalTo={to}
          globalPeriodId={periodId}
          globalPeriodIdTo={periodIdTo}
        />
      )}
    </div>
  )
}



function MobileKpiCard({ kpi, onExpand }: { kpi: any; onExpand: () => void }) {
  const pct = Math.round(kpi.progress || 0)
  const fmt = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'

  return (
    <div className="p-4 space-y-3 active:bg-[var(--color-muted)]" onClick={onExpand}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm text-[var(--color-foreground)] truncate">{kpi.kpiName}</p>
          <p className="text-caption mt-0.5">{kpi.objectiveName} ({kpi.objectiveCode})</p>
          <p className="text-caption">{kpi.keyResultName} • {kpi.keyResultCode}</p>
        </div>
        {kpi.shared ? (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium shrink-0">
            <Users size={10} /> Chung
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-xs font-medium shrink-0">
            <User size={10} /> Riêng
          </div>
        )}
      </div>

      <p className="text-caption">{fmt(kpi.periodStart)} — {fmt(kpi.periodEnd)}</p>

      <div className="flex items-center gap-4 pt-1 border-t border-[var(--color-border)]">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-caption">Tiến độ</span>
            <span className="text-xs font-semibold">{pct}%</span>
          </div>
          <div className="h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${Math.min(pct, 100)}%` }} />
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
      <tr className="hover:bg-[var(--color-muted)] transition-colors">
        <td className="px-6 py-4">
          <Button variant="secondary" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </Button>
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={onExpand}>
          <div className="font-medium text-sm text-[var(--color-foreground)] hover:text-[var(--color-primary)] transition-colors truncate max-w-[200px]">{kpi.kpiName}</div>
          <div className="text-caption mt-1">{kpi.objectiveName} ({kpi.objectiveCode})</div>
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
          <div className="text-caption mt-1">{kpi.keyResultCode}</div>
        </td>
        <td className="px-6 py-4">
          <KpiPeriodCell periodName={kpi.periodName} start={kpi.periodStart} end={kpi.periodEnd} />
        </td>
        <td className="px-6 py-4">
          {isQual ? (
            <div className="flex flex-col gap-1">
              <span className="text-eyebrow">Mức đánh giá</span>
              <QualitativeResultChip level={kpi.qualitativeLevelName} />
            </div>
          ) : isBonus ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs font-semibold">
                Thưởng
              </span>
              <div className="text-caption">
                Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">{pct}%</span>
              </div>
              <div className="text-caption mt-1">
                Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}
              </div>
            </>
          )}
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium">
              <Users size={12} /> Mục tiêu chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-xs font-medium">
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
          <td colSpan={6} className="p-0 border-b border-[var(--color-border)]">
            <div className="bg-[var(--color-muted)] p-6 flex flex-col gap-6 border-l-4 border-[var(--color-primary)]">
              <div className="w-full space-y-4">
                <h4 className="text-eyebrow">Lịch sử bài nộp của tôi</h4>
                {kpi.mySubmissions && kpi.mySubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {kpi.mySubmissions.map((sub: any) => (
                      <div key={sub.id} className="bg-[var(--color-card)] p-4 rounded-card shadow-sm border border-[var(--color-border)] flex items-center justify-between gap-4">
                        <div className="w-[120px]">
                          <p className="text-sm font-medium">{sub.code}</p>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-eyebrow mb-1">Thời gian nộp</p>
                          <p className="text-xs font-medium text-[var(--color-foreground)]">
                            {new Date(sub.submitDate).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })}
                          </p>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[200px]">
                            <p className="text-eyebrow mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={sub.qualitativeLevelName} />
                          </div>
                        ) : (
                          <div className="flex-1 max-w-[200px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-caption">Đóng góp</span>
                              <span className="text-xs font-semibold">{sub.contributionProgress?.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-[var(--color-muted)] rounded-full">
                              <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                            </div>
                            <p className="text-xs font-medium text-[var(--color-primary)] mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                          </div>
                        )}
                        <div>
                          <span className={cn(
                            'px-2 py-1 rounded-control text-xs font-medium',
                            sub.status === 'APPROVED' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                            sub.status === 'REJECTED' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                          )}>
                            {sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-subtle-foreground)]">Chưa có bài nộp nào.</div>
                )}
              </div>

              {kpi.shared && kpi.childRelationType !== 'DECOMPOSITION' && (
                <div className="w-full space-y-4 pt-6 border-t border-[var(--color-border)]">
                  <h4 className="text-eyebrow">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates?.map((tm: any) => (
                      <div key={tm.userId} className="bg-[var(--color-card)] p-4 rounded-card shadow-sm border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl ? (
                            <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-medium">
                              {tm.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{tm.fullName}</p>
                            <p className="text-caption">{tm.employeeCode}</p>
                          </div>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-xs font-medium text-[var(--color-foreground)]">{tm.role}</p>
                          <p className="text-caption">{tm.department}</p>
                        </div>
                        {isQual ? (
                          <div className="flex-1 max-w-[250px]">
                            <p className="text-eyebrow mb-1">Mức đánh giá</p>
                            <QualitativeResultChip level={tm.qualitativeLevelName} />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 max-w-[250px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-caption">Tiến độ cá nhân</span>
                                <span className="text-xs font-semibold">{tm.progress?.toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-[var(--color-muted)] rounded-full">
                                <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${Math.min(tm.progress, 100)}%` }} />
                              </div>
                              <p className="text-xs font-medium text-[var(--color-primary)] mt-1">{tm.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                            </div>
                            <div className="text-center sm:text-right w-[100px]">
                              <p className="text-caption">Hiệu suất (đánh giá)</p>
                              <p className="text-sm font-semibold text-[var(--color-primary)]">{tm.performance != null ? `${tm.performance.toFixed(1)}%` : '—'}</p>
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
