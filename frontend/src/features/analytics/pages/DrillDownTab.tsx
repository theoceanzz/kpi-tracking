import { useMemo, useState, useCallback } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { X, Network, Award, Users, Grid3x3, Building2, BarChart3, BoxSelect } from 'lucide-react'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import { useDrillDown } from '../hooks/useAnalytics'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { useStatsTier } from '../hooks/useStatsTier'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import OrgUnitTreeSidebar from '../components/OrgUnitTreeSidebar'
import {
  DrillUnitSummaryWidget, DrillClassificationWidget, DrillChildrenClassificationWidget, DrillCascadeWidget,
  DrillEmployeeTableWidget, DrillMatrixWidget, DrillUnitCompareWidget, DrillBoxplotWidget,
} from '../components/pinned/drillWidgets'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import DashboardCustomizeChrome, { DashboardEditToolbar } from '@/components/common/dashboard/DashboardCustomizeChrome'
import {
  useAnalyticsGrid, useAnalyticsScopeData, usePositionLayout, widgetFilter, widgetVariant, tableViewControl, flattenUnitTree,
  PAGE_DEFAULT_INTENT, type OptionField,
} from '../grid/analyticsGrid'
import { usePinToHome } from '../grid/usePinToHome'
import WidgetConfigPanel from '../grid/WidgetConfigPanel'
import WidgetConfigSummary from '../grid/WidgetConfigSummary'
import AiShortcutButton from '../components/AiShortcutButton'
import { aiShortcuts } from '../aiShortcuts'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'

/** Cắt cây tại đơn vị gốc (subtree) để không lộ đơn vị ngoài quyền drill của user. */
function subtreeOf(nodes: OrgUnitTreeResponse[], rootId?: string): OrgUnitTreeResponse[] {
  if (!rootId) return nodes
  const find = (list: OrgUnitTreeResponse[]): OrgUnitTreeResponse | null => {
    for (const n of list) {
      if (n.id === rootId) return n
      const r = find(n.children || [])
      if (r) return r
    }
    return null
  }
  const node = find(nodes)
  return node ? [node] : nodes
}

/** Sentinel cho lựa chọn "xếp loại theo đợt" (Select không nhận chuỗi rỗng). */
const BY_PERIOD = '__by_period__'

/**
 * Ô mặc định, theo thứ tự đọc: đơn vị này → người của nó → đơn vị bên dưới. Id trùng danh mục
 * trang chủ để ghim được ngay. Ô nào cần quyền/cờ tổ chức được lọc ở component trước khi đưa vào lưới.
 */
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { i: 'drill-summary', type: 'DRILL_SUMMARY', title: 'Đơn vị đang xem', x: 0, y: 0, w: 12, h: 3, visible: true },
  // Tên ô là nguồn duy nhất (renderWidget lấy `w.title`, trang chủ đặt đúng chuỗi này); chữ đầu
  // mỗi ô khác nhau: Đơn vị đang xem / Phân bố / Luồng / Từng thành viên / Ma trận / Xếp loại /
  // Hiệu suất / Độ phân tán — "Xếp loại đơn vị" cạnh "Xếp loại đơn vị con" từng không phân biệt được.
  { i: 'drill-classification', type: 'DRILL_CLASSIFICATION', title: 'Phân bố xếp loại nhân sự', x: 0, y: 3, w: 12, h: 12, visible: true },
  { i: 'drill-cascade', type: 'DRILL_CASCADE', title: 'Luồng phân rã & uỷ quyền KPI', x: 0, y: 19, w: 12, h: 12, visible: true },
  { i: 'drill-employees', type: 'DRILL_EMPLOYEES', title: 'Từng thành viên: hiệu suất, tiến độ, số KPI', x: 0, y: 31, w: 12, h: 16, visible: true },
  { i: 'drill-matrix', type: 'DRILL_MATRIX', title: 'Ma trận hành vi × hoàn thành', x: 0, y: 47, w: 12, h: 18, visible: true },
  { i: 'drill-children', type: 'DRILL_CHILDREN', title: 'Xếp loại của từng đơn vị con', x: 0, y: 65, w: 6, h: 12, visible: true },
  { i: 'drill-compare', type: 'DRILL_COMPARE', title: 'Hiệu suất từng đơn vị con', x: 6, y: 65, w: 6, h: 12, visible: true },
  { i: 'drill-boxplot', type: 'DRILL_BOXPLOT', title: 'Độ phân tán điểm trong từng đơn vị con', x: 0, y: 77, w: 12, h: 12, visible: false },
]

/**
 * Ô nào hiện mặc định cho ai. Ban giám đốc so các đơn vị con với nhau; trưởng/phó đơn vị nhìn
 * người trong đơn vị mình; nhân viên chỉ cần biết đơn vị mình xếp loại ra sao. Ô nào cần quyền
 * hoặc cờ tổ chức vẫn bị lọc ở component trước, nên id vắng mặt ở đây chỉ đơn giản là bỏ qua.
 */
const POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: ['drill-summary', 'drill-classification', 'drill-children', 'drill-compare', 'drill-matrix'],
  HEAD: ['drill-summary', 'drill-classification', 'drill-employees', 'drill-matrix'],
  DEPUTY: ['drill-summary', 'drill-employees', 'drill-matrix'],
  STAFF: ['drill-summary', 'drill-classification'],
}

const GROUP_OF: Record<string, string> = {
  'drill-summary': 'Số liệu',
  'drill-classification': 'Biểu đồ phân phối',
  'drill-cascade': 'Biểu đồ luồng',
  'drill-employees': 'Biểu đồ xếp hạng',
  'drill-matrix': 'Biểu đồ tương quan',
  'drill-children': 'Biểu đồ so sánh',
  'drill-compare': 'Biểu đồ so sánh',
  'drill-boxplot': 'Biểu đồ phân phối',
}
const PREVIEW_OF: Record<string, 'metricCard' | 'stackedBar' | 'sankey' | 'lollipop' | 'heatmap' | 'bar' | 'boxplot' | 'table'> = {
  'drill-summary': 'metricCard',
  'drill-classification': 'bar',
  'drill-cascade': 'sankey',
  'drill-employees': 'lollipop',
  'drill-matrix': 'heatmap',
  'drill-children': 'table',
  'drill-compare': 'bar',
  'drill-boxplot': 'boxplot',
}
const DESC_OF: Record<string, string> = {
  'drill-summary': 'Cấp, tên đơn vị, số nhân sự và tổng KPI của đơn vị đang xem.',
  'drill-classification': 'Đơn vị này xếp loại gì, và người trong đó dồn về mức nào: bell curve đặt cạnh khung hạn mức, hoặc tỉ trọng các mức qua các đợt.',
  'drill-cascade': 'Trọng số KPI chảy từ đơn vị này xuống đơn vị nào, bao nhiêu.',
  'drill-employees': 'Từng người trong đơn vị xếp cạnh nhau; sắp được theo hiệu suất, tiến độ hay số KPI.',
  'drill-matrix': 'Ai vừa làm tốt vừa cư xử tốt, ai lệch: số người trong từng ô điểm hành vi × mức hoàn thành.',
  'drill-children': 'Mỗi đơn vị ngay bên dưới đang xếp loại gì.',
  'drill-compare': 'Hiệu suất của các đơn vị ngay bên dưới đặt cạnh nhau.',
  'drill-boxplot': 'Điểm trong mỗi đơn vị con dồn đều hay phân tán rộng — hộp càng dài càng chênh lệch.',
}

/** Kỳ chọn trong cài đặt ô; sentinel "theo đợt" → không có kỳ. */
const cycleOf = (w: DashboardWidget) => {
  const v = w.s?.o?.cycleId
  return v && v !== BY_PERIOD ? v : undefined
}

export default function DrillDownTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedUnitId = searchParams.get('unitId') || undefined

  const { periods, cycles } = useAnalyticsScopeData()
  // Không còn bộ lọc cấp trang: khoảng thời gian nằm trong cài đặt từng ô; "mặc định" là hằng số.
  const pageIntent = PAGE_DEFAULT_INTENT
  const { canView: canViewStats } = useStatsTier()
  const perf = usePerformanceScale()

  /*
    Lọc ô theo quyền/cờ NGAY lần render đầu: `hydrate` của lưới chỉ chạy một lần theo scope, nên danh
    sách này phải đúng từ đầu. Cả hai điều kiện đều đồng bộ (auth store; cờ tổ chức đã được
    AnalyticsPage chờ xong trước khi vẽ tab).
  */
  const allowedWidgets = useMemo(() => DEFAULT_WIDGETS.filter(w =>
    (canViewStats || (w.i !== 'drill-cascade' && w.i !== 'drill-boxplot')) &&
    (perf.isMatrix || w.i !== 'drill-matrix')
  ), [canViewStats, perf.isMatrix])
  const catalog = useMemo(() => allowedWidgets.map(t => ({
    template: t, icon: null, groupLabel: GROUP_OF[t.i], preview: PREVIEW_OF[t.i], description: DESC_OF[t.i],
  })), [allowedWidgets])

  const pin = usePinToHome()
  const grid = usePositionLayout(allowedWidgets, POSITION_LAYOUT, 'HEAD')
  const dash = useAnalyticsGrid({ scope: 'ANALYTICS_DRILLDOWN', defaultWidgets: grid.defaultWidgets })
  // Cây điều hướng + gốc drill (phạm vi quyền, do backend quyết định). Gốc lấy theo khoảng mặc định:
  // nó chỉ để biết cắt cây từ đâu, không mang số liệu.
  const def = widgetFilter(undefined, pageIntent, periods, cycles)
  const { data: tree } = useOrgUnitTree({ staleTime: 5 * 60 * 1000 })
  const { data: rootData, isLoading: rootLoading } = useDrillDown(undefined, def.from, def.to, def.periodId, def.periodIdTo)
  const rootUnitId = rootData?.orgUnitId || undefined
  const treeNodes = useMemo(() => subtreeOf(tree || [], rootUnitId), [tree, rootUnitId])
  const treeSelectedId = selectedUnitId ?? rootUnitId
  const unitName = useMemo(
    () => flattenUnitTree(treeNodes).find(u => u.id === treeSelectedId)?.name ?? rootData?.orgUnitName ?? 'Tất cả',
    [treeNodes, treeSelectedId, rootData?.orgUnitName],
  )
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)
  // Dưới `lg` cây đi vào drawer; báo cho lưới biết để nó không trừ bề rộng cột trái nữa.
  const isWide = useMediaQuery('(min-width: 1024px)')

  /**
   * Đổi đơn vị đang chọn (đồng bộ URL để back/forward + chia sẻ link).
   *
   * <p>Phải cập nhật RIÊNG khoá `unitId`. Truyền object literal cho `setSearchParams` sẽ ghi đè
   * TOÀN BỘ query string, nuốt luôn `?section=drilldown` của SettingsSectionLayout: layout không
   * còn tìm thấy mục nào đang mở nên rơi về lưới thẻ, tức là bấm chọn đơn vị lại bị văng ra khỏi tab.
   */
  const select = (id: string) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('unitId', id)
      return p
    })
  }

  // "Phạm vi xếp loại" là khái niệm khác khoảng thời gian (điểm chốt kỳ, bỏ qua bộ lọc đợt) nên là
  // một tuỳ chọn riêng của ô, danh sách kỳ lấy từ API → truyền động vào bảng cấu hình.
  const cycleFields = useMemo<OptionField[]>(() => [{
    key: 'cycleId', label: 'Phạm vi xếp loại', kind: 'select', default: BY_PERIOD,
    choices: [
      { value: BY_PERIOD, label: 'Theo đợt' },
      ...cycles.map(c => ({ value: c.id, label: `Kỳ: ${c.name}` })),
    ],
  }], [cycles])
  const extraFieldsOf = useCallback(
    (i: string) => (i === 'drill-classification' || i === 'drill-children' ? cycleFields : undefined),
    [cycleFields],
  )

  /*
    `useCallback` là bắt buộc chứ không phải tối ưu tuỳ hứng: lưới cache phần tử từng ô theo định
    danh hàm này. Hàm mới mỗi render là mọi biểu đồ vẽ lại mỗi lần tab render.
  */
  const { updateWidgetSettings } = dash
  const renderWidget = useCallback((w: DashboardWidget, ctx: { openConfig: () => void }) => {
    const f = widgetFilter(w, pageIntent, periods, cycles)
    const pf = { from: f.from, to: f.to, periodId: f.periodId, periodIdTo: f.periodIdTo, orgUnitId: selectedUnitId }
    // Chip tóm tắt: khoảng thời gian của ô + tên đơn vị đang xem (chỉ đọc, đổi ở cây bên trái).
    const meta = (
      <WidgetConfigSummary
        widget={w} pageIntent={pageIntent} periods={periods} cycles={cycles}
        unitLabel={unitName} extraFields={extraFieldsOf(w.i)} onOpen={ctx.openConfig}
      />
    )
    switch (w.type) {
      case 'DRILL_SUMMARY': return (
        <div id="tour-drilldown-banner" className="h-full flex flex-col gap-2 min-h-0">
          {meta}
          <DrillUnitSummaryWidget filter={pf} />
        </div>
      )
      case 'DRILL_CLASSIFICATION': return (
        <ChartWrapper title={w.title} icon={<Award size={20} className="text-slate-400" />} meta={meta}>
          <DrillClassificationWidget
            filter={pf} part="unit" cycleId={cycleOf(w)} hideControls
            view={widgetVariant(w) === 'trend' ? 'trend' : 'bell'}
          />
        </ChartWrapper>
      )
      case 'DRILL_CASCADE': return (
        <ChartWrapper title={w.title} icon={<Network size={20} className="text-slate-400" />} meta={meta}>
          <DrillCascadeWidget filter={pf} />
        </ChartWrapper>
      )
      case 'DRILL_EMPLOYEES': return (
        <div id="tour-drilldown-members" className="h-full">
          <ChartWrapper title={w.title} icon={<Users size={20} className="text-slate-400" />} meta={meta}>
            {/* `key` reset tìm kiếm + trang khi đổi đơn vị, đúng như tab cũ làm trong `select()`. */}
            <DrillEmployeeTableWidget
              key={selectedUnitId ?? 'root'}
              filter={pf}
              viewControl={tableViewControl(w, updateWidgetSettings)}
              hideControls
            />
          </ChartWrapper>
        </div>
      )
      case 'DRILL_MATRIX': return (
        <ChartWrapper title={w.title} icon={<Grid3x3 size={20} className="text-slate-400" />} meta={meta}>
          <DrillMatrixWidget filter={pf} variant={widgetVariant(w) as 'cells' | 'scatter'} hideControls />
        </ChartWrapper>
      )
      case 'DRILL_CHILDREN': return (
        <ChartWrapper title={w.title} icon={<Building2 size={20} className="text-slate-400" />} meta={meta}>
          <DrillChildrenClassificationWidget filter={pf} hideControls />
        </ChartWrapper>
      )
      case 'DRILL_COMPARE': return (
        <ChartWrapper title={w.title} icon={<BarChart3 size={20} className="text-slate-400" />} meta={meta}>
          <DrillUnitCompareWidget filter={pf} />
        </ChartWrapper>
      )
      case 'DRILL_BOXPLOT': return (
        <ChartWrapper title={w.title} icon={<BoxSelect size={20} className="text-slate-400" />} meta={meta}>
          <DrillBoxplotWidget filter={pf} />
        </ChartWrapper>
      )
      default: return null
    }
  }, [pageIntent, periods, cycles, selectedUnitId, unitName, extraFieldsOf, updateWidgetSettings])

  // Skeleton chỉ theo truy vấn gốc. Không gate theo đơn vị đang chọn: mỗi lần bấm cây mà remount cả
  // trang thì lưới mất bảng cấu hình đang mở và đo lại bề rộng từ đầu.
  if (rootLoading && !rootData) return <AnalyticsTabSkeleton variant="drilldown" className="p-6" />

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">So sánh giữa các đơn vị</h2>
        <div id="tour-analytics-customize" className="flex items-center gap-3 flex-wrap">
          <AiShortcutButton size="sm" label="Lệch tự chấm" prompt={aiShortcuts.deviation()} title="K.AI chỉ ra đơn vị con tự chấm lệch với điểm quản lý chấm nhiều nhất" />
          <DashboardEditToolbar api={dash} />
        </div>
      </div>

      {/* Master–detail: cây trái là điều hướng của trang, lưới phải là nội dung của đơn vị đang chọn.
          Cây đặt vào khe `sidebar` của lưới: mở bảng cấu hình thì cây tạm nhường chỗ cho bảng, lưới
          giữ nguyên bề rộng — cùng một bảng đẩy như các tab khác, không phải lớp phủ. */}
      <div className="space-y-4 min-w-0">
        <button
          onClick={() => setMobileTreeOpen(true)}
          className="lg:hidden w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm font-semibold text-[var(--color-primary)]"
        >
          <Network size={16} /> Chọn đơn vị: {unitName}
        </button>

        <div id="tour-analytics-widgets">
          <DashboardCustomizeChrome
            api={dash}
            renderWidget={renderWidget}
            catalog={catalog}
            presets={grid.presets}
            recommendedIds={grid.recommendedIds}
            recommendedLabel={grid.recommendedLabel}
            onTogglePin={pin.enabled ? pin.toggle : undefined}
            isPinned={pin.isPinned}
            sidebar={isWide ? (
              <div id="tour-drilldown-tree" className="h-[calc(100vh-2rem)]">
                <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} />
              </div>
            ) : undefined}
            renderConfig={(w, update) => (
              <WidgetConfigPanel
                widget={w} update={update} pageIntent={pageIntent} periods={periods} cycles={cycles}
                extraFields={extraFieldsOf(w.i)}
              />
            )}
          />
        </div>
      </div>

      {/* Drawer cây trên mobile */}
      {mobileTreeOpen && createPortal(
        <div className="fixed inset-0 z-[900] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileTreeOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] p-3">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-end mb-2">
                <button onClick={() => setMobileTreeOpen(false)} aria-label="Đóng" className="p-2 rounded-lg bg-white dark:bg-slate-800 text-[var(--color-muted-foreground)] shadow-sm"><X size={18} /></button>
              </div>
              <div className="flex-1 min-h-0">
                <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} onAfterSelect={() => setMobileTreeOpen(false)} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
