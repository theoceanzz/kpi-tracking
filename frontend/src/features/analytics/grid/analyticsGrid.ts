import { useCallback, useMemo } from 'react'
import { useDashboardLayout } from '@/components/common/dashboard/useDashboardLayout'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { AnalyticsGridScope, DashboardLayoutItem } from '@/features/dashboard/api/dashboardLayoutApi'
import { reportApi } from '@/features/reports/api/reportApi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'
import {
  DEFAULT_DATE_INTENT, resolveDateFilter,
  type DateFilterIntent, type ResolvedDateFilter,
} from '../filter/dateFilterModel'
import type { ChartShape } from '@/components/charts/ChartTypePreview'

/**
 * Vớt bố cục từ kho CŨ của các tab Thống kê.
 *
 * <p>Trước đây bố cục được giấu trong một "report" đặt tên đặc biệt: đọc phải kéo về tối đa 100
 * report kèm toàn bộ widget của từng cái, ghi thì đồng bộ lại mọi dòng widget rồi trả về cả report.
 * Đó là endpoint nặng nhất trên trang, và tự lưu sau mỗi lần kéo sẽ bắn thẳng vào nó — nên bố cục
 * đã chuyển sang `user_dashboard_layouts`. Hàm này chỉ chạy đúng MỘT lần cho mỗi người, khi kho
 * mới còn trống, để không ai mất bố cục đã dựng.
 */
async function loadLegacyLayout(reportName: string): Promise<DashboardLayoutItem[] | null> {
  const reports = await reportApi.getAll({ size: 100 })
  const config = reports.content.find(r => r.name === reportName)
  if (!config?.widgets?.length) return null

  const items: DashboardLayoutItem[] = []
  config.widgets.forEach(w => {
    try {
      const chart = JSON.parse(w.chartConfig || '{}') as { i?: string; visible?: boolean }
      const pos = JSON.parse(w.position || '{}') as { x?: number; y?: number; w?: number; h?: number }
      if (!chart.i) return
      items.push({
        i: chart.i,
        x: pos.x ?? 0, y: pos.y ?? 0, w: pos.w ?? 12, h: pos.h ?? 10,
        visible: chart.visible !== false,
      })
    } catch {
      // Một dòng hỏng không được phép làm mất cả bố cục.
    }
  })
  return items.length ? items : null
}

/** Lưới widget của một tab Thống kê: bố cục lưu theo tab, kèm cửa vớt bố cục cũ. */
export function useAnalyticsGrid({ scope, defaultWidgets, legacyReportName }: {
  scope: AnalyticsGridScope
  defaultWidgets: DashboardWidget[]
  /** Tên "report ẩn" của kho cũ để vớt bố cục một lần. Tab chưa từng có report thì bỏ trống. */
  legacyReportName?: string
}) {
  const legacyLoad = useCallback(
    () => (legacyReportName ? loadLegacyLayout(legacyReportName) : Promise.resolve(null)),
    [legacyReportName],
  )
  return useDashboardLayout({
    scope,
    defaultWidgets,
    // Ở tab Thống kê mọi widget đều hợp lệ — không có cờ tổ chức nào lọc bớt như trang chủ.
    availableWidgets: defaultWidgets,
    legacyLoad,
  })
}

/** Đợt và kỳ của tổ chức — nguồn để đổi ý định lọc thành khoảng thời gian thật. */
export function useAnalyticsScopeData(): { periods: KpiPeriod[]; cycles: KpiCycle[] } {
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data } = useKpiPeriods({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 1000, sortBy: 'startDate', direction: 'desc' })
  const periods = useMemo(() => (data?.content ?? []) as KpiPeriod[], [data])
  const cycles = useMemo(() => (cyclesData?.content ?? []) as KpiCycle[], [cyclesData])
  return { periods, cycles }
}

/** Cây đơn vị làm phẳng, thụt lề theo cấp — một nguồn cho mọi ô chọn đơn vị trên trang Thống kê. */
export function flattenUnitTree(nodes: OrgUnitTreeResponse[] | undefined, depth = 0): { id: string; label: string; name: string }[] {
  if (!nodes?.length) return []
  return nodes.flatMap(n => [
    // `label` thụt lề (khoảng trắng cứng) cho dropdown; `name` trần cho chip tóm tắt trên ô.
    { id: n.id, label: `${'   '.repeat(depth)}${n.name}`, name: n.name },
    ...flattenUnitTree(n.children, depth + 1),
  ])
}

/**
 * Danh sách đơn vị cho bảng cấu hình. Trước đây bốn ô chọn đơn vị lấy từ bốn nguồn khác nhau
 * (`rankingOptions`, `availableOrgUnits`, `getDetailFilterUnits`, cây đơn vị) — đó là lý do chúng
 * trông và hành xử khác nhau. Backend lọc theo `orgUnitId` nên cây đầy đủ là đủ cho tất cả.
 */
export function useUnitOptions(): { id: string; label: string }[] {
  const { data } = useOrgUnitTree({ staleTime: 5 * 60 * 1000 })
  return useMemo(() => flattenUnitTree(data), [data])
}

/**
 * Khoảng thời gian áp cho MỘT ô: ý định riêng của ô nếu có, không thì mặc định của trang.
 *
 * <p>Đây là chỗ thay thế thanh lọc chung vừa bỏ — mặc định của trang vẫn tồn tại, chỉ là không
 * chiếm một dải ngang trên đầu nữa.
 */
export function widgetFilter(
  widget: DashboardWidget | undefined,
  fallback: DateFilterIntent,
  periods: KpiPeriod[],
  cycles: KpiCycle[],
): ResolvedDateFilter {
  return resolveDateFilter(widget?.s?.f ?? fallback, periods, cycles)
}

export const PAGE_DEFAULT_INTENT: DateFilterIntent = DEFAULT_DATE_INTENT

/* ── Cách biểu diễn ───────────────────────────────────────────────────────── */

export interface ChartVariantOption {
  key: string
  label: string
  shape: ChartShape
  hint?: string
}

/**
 * Biểu đồ xu hướng vẽ được hai kiểu. Cố ý KHÔNG mở "cột chồng 100%" cho mọi biểu đồ: chuẩn
 * `bieu-do-chuan` cấm ép 100% lên dữ liệu không cộng thành một tổng, nên tập lựa chọn phải bị
 * giới hạn theo bản chất dữ liệu chứ không phải theo sở thích.
 */
const TREND_VARIANTS: ChartVariantOption[] = [
  { key: 'line', label: 'Đường', shape: 'line', hint: 'Xem mức thay đổi qua từng mốc.' },
  { key: 'area', label: 'Miền', shape: 'stackedArea', hint: 'Xem cơ cấu cũ/mới theo tỉ trọng %.' },
]

/** Ma trận xếp loại: đếm theo ô hay chấm từng người — cùng dữ liệu, hai câu hỏi. */
const MATRIX_VARIANTS: ChartVariantOption[] = [
  { key: 'cells', label: 'Ô ma trận', shape: 'heatmap', hint: 'Đếm số người mỗi ô, thấy mật độ.' },
  { key: 'scatter', label: 'Phân tán từng người', shape: 'scatter', hint: 'Mỗi người một chấm, thấy ai lệch khỏi đám đông.' },
]

/** Xu hướng %đạt BSC qua các đợt: chỉ đường tổng, hay tách theo 4 lĩnh vực. */
const BSC_TREND_VARIANTS: ChartVariantOption[] = [
  { key: 'overall', label: 'Tổng', shape: 'line', hint: '%đạt của thẻ điểm qua từng đợt.' },
  { key: 'perspectives', label: 'Theo lĩnh vực', shape: 'line', hint: 'Mỗi lĩnh vực một đường, tổng vẽ đứt.' },
]

/** Mức đạt đơn vị: xếp hạng lollipop, hay bảng đủ trạng thái thẻ và hạng mục chặn. */
const BSC_UNIT_VARIANTS: ChartVariantOption[] = [
  { key: 'lollipop', label: 'Xếp hạng', shape: 'lollipop', hint: 'Mỗi đơn vị một chấm %đạt, vạch 100% là mục tiêu.' },
  { key: 'tree', label: 'Theo cây', shape: 'table', hint: 'Giữ thứ tự công ty → phòng → team, kèm trạng thái và hạng mục chặn.' },
]

/** Xếp loại đơn vị: bell curve của đợt/kỳ đang xét, hay tỉ trọng các mức qua các đợt. */
const CLASSIFICATION_VARIANTS: ChartVariantOption[] = [
  { key: 'bell', label: 'Bell curve', shape: 'bar', hint: 'Phân bố thực tế đặt cạnh khung hạn mức đã cấu hình.' },
  { key: 'trend', label: 'Qua các đợt', shape: 'stackedArea', hint: 'Tỉ trọng từng mức dịch chuyển qua các đợt.' },
]

/** Ô nào cho chọn cách biểu diễn. Ô không có mặt ở đây thì bảng cấu hình chỉ hiện phần lọc. */
export const WIDGET_VARIANTS: Record<string, ChartVariantOption[]> = {
  'trend-chart': TREND_VARIANTS,
  'sub-trend': TREND_VARIANTS,
  'mykpi-trend': TREND_VARIANTS,
  'myobj-trend': TREND_VARIANTS,
  'drill-matrix': MATRIX_VARIANTS,
  'drill-classification': CLASSIFICATION_VARIANTS,
  'bsc-trend': BSC_TREND_VARIANTS,
  'bsc-units': BSC_UNIT_VARIANTS,
}

/* ── Tuỳ chọn riêng của từng loại biểu đồ ─────────────────────────────────── */

/**
 * Một lựa chọn trong bảng cấu hình, khai báo dữ liệu để drawer TỰ SINH UI — cùng cách với
 * `WIDGET_VARIANTS`. Trước đây mỗi lựa chọn kiểu này là một cụm nút hoặc dropdown nằm rải trong
 * thân từng biểu đồ, mỗi cái một dáng.
 */
export interface OptionField {
  key: string
  label: string
  /** `pills` cho 2–3 lựa chọn ngắn; `select` khi dài hơn hoặc nhãn dài. */
  kind: 'pills' | 'select'
  choices: { value: string; label: string }[]
  default: string
  /** Khoá tuỳ chọn khác bị xoá khi trường này đổi — ví dụ đổi Objective thì KR đã chọn hết nghĩa. */
  clears?: string[]
}

const RANK_FIELD: OptionField = {
  key: 'rank', label: 'Hướng xếp', kind: 'pills', default: 'BEST',
  choices: [{ value: 'BEST', label: 'Tốt nhất' }, { value: 'WORST', label: 'Trì trệ' }],
}
const TOPN_FIELD: OptionField = {
  key: 'topN', label: 'Số đơn vị', kind: 'pills', default: 'ALL',
  choices: [{ value: 'ALL', label: 'Tất cả' }, { value: '5', label: 'Top 5' }, { value: '10', label: 'Top 10' }],
}
const METRIC_FIELD: OptionField = {
  key: 'metric', label: 'Xếp theo', kind: 'pills', default: 'performance',
  choices: [{ value: 'performance', label: 'Hiệu suất' }, { value: 'avgProgress', label: 'Tiến độ TB' }],
}
const DIR_FIELD: OptionField = {
  key: 'dir', label: 'Thứ tự', kind: 'pills', default: 'DESC',
  choices: [{ value: 'DESC', label: 'Cao nhất' }, { value: 'ASC', label: 'Thấp nhất' }],
}
const SHARED_FIELD: OptionField = {
  key: 'shared', label: 'Loại KPI', kind: 'pills', default: 'ALL',
  choices: [{ value: 'ALL', label: 'Tất cả' }, { value: 'SHARED', label: 'Chung' }, { value: 'PERSONAL', label: 'Riêng' }],
}

const BSC_SORT_FIELD: OptionField = {
  key: 'sort', label: 'Xếp theo', kind: 'pills', default: 'bscScore',
  choices: [{ value: 'bscScore', label: 'Điểm BSC' }, { value: 'systemScore', label: 'Điểm hệ thống' }],
}

/** Ô nào có tuỳ chọn gì. Ô không có mặt ở đây thì drawer không hiện mục "Tuỳ chọn". */
export const WIDGET_OPTIONS: Record<string, OptionField[]> = {
  'unit-perf': [RANK_FIELD, TOPN_FIELD],
  'sub-unit-perf': [RANK_FIELD, TOPN_FIELD],
  'rank-table': [METRIC_FIELD, DIR_FIELD],
  'mykpi-detail': [SHARED_FIELD],
  'myobj-detail': [SHARED_FIELD],
  'bsc-ranking': [BSC_SORT_FIELD],
}

/** Ô nào có chọn đơn vị. Danh sách đơn vị do tab cấp (`unitOptions`), drawer chỉ vẽ. */
export const WIDGET_HAS_UNIT: ReadonlySet<string> = new Set([
  // Tab Tổng quan: bộ chọn đơn vị cấp trang đã bỏ, mỗi ô tự thu phạm vi (đơn vị + cây con).
  'unit-kpi-metrics', 'trend-chart', 'unit-perf', 'kpi-detail', 'member-dist', 'rank-table',
  'score-histogram', 'self-vs-manager',
  // Tab Mục tiêu đơn vị
  'sub-detail',
  // Tab Hạng mục BSC: cùng cách, mỗi ô tự thu phạm vi. (Tab So sánh các đơn vị KHÔNG có mặt ở
  // đây: đơn vị ở đó là cây điều hướng của trang.)
  'bsc-overview', 'bsc-units', 'bsc-items', 'bsc-trend', 'bsc-cascade', 'bsc-gates', 'bsc-ranking',
])

/** Đơn vị của ô (phạm vi con) — `undefined` = toàn bộ phạm vi quyền của người dùng. */
export const widgetUnit = (widget: DashboardWidget | undefined): string | undefined => widget?.s?.orgUnitId || undefined

/** Giá trị đang chọn của một tuỳ chọn, rơi về mặc định đã khai báo khi ô chưa đặt. */
export function optionOf(widget: DashboardWidget | undefined, key: string): string | undefined {
  const fields = widget ? WIDGET_OPTIONS[widget.i] : undefined
  const field = fields?.find(f => f.key === key)
  const chosen = widget?.s?.o?.[key]
  if (chosen !== undefined && field?.choices.some(c => c.value === chosen)) return chosen
  return field?.default
}

/**
 * Ô nào có cả hai cách xem biểu đồ ↔ bảng.
 *
 * <p>Biểu đồ trả lời "tình hình thế nào" trong một cái liếc, bảng trả lời "con số chính xác là bao
 * nhiêu" — nên đây là lựa chọn của người xem chứ không phải của người dựng, và vì thế nó thuộc về
 * bảng cấu hình.
 */
export const WIDGET_HAS_TABLE: ReadonlySet<string> = new Set([
  'mykpi-detail', 'mykpi-eval-history', 'myobj-detail', 'sub-detail', 'rank-table',
  'drill-employees', 'bsc-ranking', 'bsc-cascade',
])

/**
 * Cầu nối giữa cài đặt của ô và `useChartTableView`.
 *
 * <p>`value` để `undefined` khi ô chưa từng đặt — lúc đó hook rơi về localStorage, giữ nguyên thói
 * quen cũ của người dùng thay vì ép mọi người về "biểu đồ" ở lần deploy này.
 */
export function tableViewControl(
  widget: DashboardWidget | undefined,
  updateWidgetSettings: (i: string, patch: { table?: boolean }) => void,
): { value?: 'chart' | 'table'; onChange?: (v: 'chart' | 'table') => void } {
  if (!widget) return {}
  return {
    value: widget.s?.table === undefined ? undefined : (widget.s.table ? 'table' : 'chart'),
    onChange: v => updateWidgetSettings(widget.i, { table: v === 'table' }),
  }
}

/** Cách biểu diễn đang chọn của một ô, rơi về lựa chọn đầu tiên khi chưa đặt. */
export function widgetVariant(widget: DashboardWidget | undefined): string | undefined {
  const options = widget ? WIDGET_VARIANTS[widget.i] : undefined
  if (!options?.length) return undefined
  const chosen = widget?.s?.v
  return options.some(o => o.key === chosen) ? chosen : options[0]!.key
}
