import {
  TrendingUp, Target, Users, AlertTriangle, AlertCircle, Star, ListChecks, BarChart3,
  SlidersHorizontal, Gauge, Grid3x3, Award, Building2, Network, ShieldCheck, Scale,
  PieChart as PieChartIcon, Activity, LayoutGrid, Medal, ClipboardList, UserRoundSearch,
} from 'lucide-react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetCatalogEntry, LayoutPreset } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { DashboardScope } from '../api/dashboardLayoutApi'
import { AnalyticsWidget } from './shared/AnalyticsWidget'
import { DashboardFilterWidget } from './shared/DashboardFilterWidget'
import { MyTodoWidget } from './shared/MyTodoWidget'
import { TeamFocusWidget } from './shared/TeamFocusWidget'
import type { FilterScope } from '../context/DashboardFilterContext'

/**
 * Trang chủ của MỌI vai trò dùng chung đúng một bộ widget: toàn bộ nội dung của trang
 * Phân tích & Thống kê — bộ lọc, hàng thẻ chỉ số, biểu đồ và bảng.
 *
 * <p>Trước đây mỗi vai trò có một danh mục widget riêng, tự vẽ lại chỉ số và bảng biểu bằng
 * nguồn dữ liệu riêng — cùng một con số hiện khác nhau ở hai trang là chuyện thường. Giờ mỗi
 * widget ở đây là ĐÚNG component và ĐÚNG truy vấn mà tab thống kê đang chạy, tra qua
 * `PINNED_REGISTRY` (xem {@link AnalyticsWidget}).
 *
 * <p>Vì thế điều kiện hiện/ẩn cũng bám theo trang Phân tích, không theo chức danh:
 * - cờ tổ chức `enableOkr` chọn cặp KPI hay cặp Mục tiêu (giống `AnalyticsPage.sections`);
 * - `enableBsc` + quyền `BSC:MANAGE` mở nhóm Hạng mục; ma trận xếp loại mở khi org đủ hai
 *   trục — `enableQualitative` (có cả hai loại KPI) HOẶC `enableConduct` (hạnh kiểm bù trục);
 * - `unitScope` là quyền xem dữ liệu đơn vị (`KPI:VIEW` / `SUBMISSION:REVIEW`), đúng quyền mà
 *   cây nav đặt cho hai mục "KPI đơn vị" và "Mục tiêu đơn vị".
 */

/** Cờ tính năng của tổ chức — quyết định widget nào tồn tại. */
export interface OrgFlags {
  enableOkr: boolean
  enableBsc: boolean
  enableReward: boolean
  enableQualitative: boolean
  /** Chấm hạnh kiểm — cũng cấp một trục cho ma trận xếp loại. */
  enableConduct: boolean
  enableCashWallet: boolean
  enableAi: boolean
}

/** Bối cảnh của người đang xem, ngoài cờ tổ chức. */
export interface ViewerScope {
  /** Có quyền xem số liệu cấp đơn vị không (`KPI:VIEW` hoặc `SUBMISSION:REVIEW`). */
  canViewUnit: boolean
  /** Có quyền `BSC:MANAGE` không — cùng quyền mà cây nav đặt cho mục "Hạng mục (BSC)". */
  canManageBsc: boolean
}

const GROUP = {
  filter: 'Bộ lọc',
  unit: 'Đơn vị',
  personal: 'Cá nhân',
  risk: 'Rủi ro & xếp hạng',
  drill: 'Phân cấp',
  bsc: 'Hạng mục (BSC)',
} as const

interface AnalyticsWidgetDef {
  /** Trùng `chartConfig.i` của tab thống kê — đây là khoá tra trong PINNED_REGISTRY. */
  i: string
  title: string
  description: string
  groupLabel: string
  icon: React.ReactNode
  w: number
  h: number
  /** Bộ lọc thời gian nào lái widget này. Mặc định `unit`. */
  filterScope?: FilterScope
  /** Cần quyền xem dữ liệu cấp đơn vị. */
  unitScope?: boolean
  /** Chỉ có khi tổ chức bật OKR / chỉ khi tắt OKR. Bỏ trống = luôn có. */
  okr?: boolean
  /** Cần tổ chức bật BSC và người xem có quyền BSC:MANAGE. */
  bsc?: boolean
  /** Ô của ma trận xếp loại: cần org đủ hai trục — KPI định tính HOẶC chấm hạnh kiểm. */
  qualitative?: boolean
  /**
   * Không đi qua PINNED_REGISTRY — trang chủ tự vẽ. Dùng cho hai loại ô không có ở tab thống kê:
   * thanh lọc, và các ô "việc cần xử lý" (danh sách hành động chứ không phải biểu đồ).
   */
  render?: () => React.ReactNode
}

const ANALYTICS_WIDGETS: AnalyticsWidgetDef[] = [
  // ── Bộ lọc ─────────────────────────────────────────────────────────────
  {
    i: 'filter-unit', title: 'Bộ lọc đơn vị', groupLabel: GROUP.filter, unitScope: true,
    description: 'Chọn đợt/khoảng đợt/kỳ cho mọi widget cấp đơn vị, phân cấp và hạng mục.',
    icon: <SlidersHorizontal size={20} />, w: 12, h: 4,
    render: () => <DashboardFilterWidget scope="unit" />,
  },
  {
    i: 'filter-personal', title: 'Bộ lọc cá nhân', groupLabel: GROUP.filter,
    description: 'Chọn đợt/khoảng đợt/kỳ cho mọi widget "của tôi".',
    icon: <SlidersHorizontal size={20} />, w: 12, h: 4,
    filterScope: 'personal',
    render: () => <DashboardFilterWidget scope="personal" />,
  },

  // ── Đơn vị · bản KPI (tổ chức TẮT OKR) — tab "KPI đơn vị" ──
  {
    i: 'unit-kpi-metrics', title: 'Chỉ số KPI đơn vị', groupLabel: GROUP.unit, okr: false, unitScope: true,
    description: 'Tiến độ, hiệu suất, trạng thái KPI, số KPI rủi ro và tổng nhân sự.',
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'trend-chart', title: 'Xu hướng KPI đơn vị', groupLabel: GROUP.unit, okr: false, unitScope: true,
    description: 'Số KPI và hiệu suất đơn vị qua từng mốc thời gian hoặc từng đợt.',
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },
  {
    i: 'kpi-detail', title: 'Bảng chi tiết KPI đơn vị', groupLabel: GROUP.unit, okr: false, unitScope: true,
    description: 'Toàn bộ KPI của đơn vị, lọc theo đơn vị con và mở xem chi tiết từng chỉ tiêu.',
    icon: <ListChecks size={20} />, w: 12, h: 18,
  },
  {
    i: 'unit-perf', title: 'Hiệu suất & tiến độ đơn vị', groupLabel: GROUP.unit, okr: false, unitScope: true,
    description: 'So sánh hiệu suất, tiến độ và tình hình nộp giữa các đơn vị.',
    icon: <BarChart3 size={20} />, w: 12, h: 13,
  },
  {
    i: 'member-dist', title: 'Nhân sự & vai trò', groupLabel: GROUP.unit, okr: false, unitScope: true,
    description: 'Cơ cấu nhân sự theo vai trò trong từng đơn vị.',
    icon: <Users size={20} />, w: 6, h: 11,
  },

  // ── Đơn vị · bản OKR (tổ chức BẬT OKR) — tab "Mục tiêu đơn vị" ──
  {
    i: 'sub-metrics', title: 'Chỉ số mục tiêu đơn vị', groupLabel: GROUP.unit, okr: true, unitScope: true,
    description: 'Tiến độ, hiệu suất, mục tiêu hoàn thành, mục tiêu rủi ro và tổng nhân sự.',
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'sub-trend', title: 'Xu hướng mục tiêu đơn vị', groupLabel: GROUP.unit, okr: true, unitScope: true,
    description: 'Số mục tiêu và hiệu suất của cấp dưới qua từng mốc thời gian hoặc từng đợt.',
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },
  {
    i: 'sub-detail', title: 'Chi tiết mục tiêu đơn vị', groupLabel: GROUP.unit, okr: true, unitScope: true,
    description: 'Tiến độ từng mục tiêu và kết quả then chốt của người thuộc quyền bạn.',
    icon: <ListChecks size={20} />, w: 12, h: 20,
  },
  {
    i: 'sub-unit-perf', title: 'Hiệu suất & tiến độ đơn vị', groupLabel: GROUP.unit, okr: true, unitScope: true,
    description: 'So sánh hiệu suất, tiến độ và tình hình nộp giữa các đơn vị.',
    icon: <BarChart3 size={20} />, w: 12, h: 13,
  },
  {
    i: 'sub-member', title: 'Nhân sự & vai trò', groupLabel: GROUP.unit, okr: true, unitScope: true,
    description: 'Cơ cấu nhân sự theo vai trò trong từng đơn vị.',
    icon: <Users size={20} />, w: 6, h: 11,
  },

  // ── Rủi ro & xếp hạng (chỉ có ở tab "KPI đơn vị") ──
  {
    i: 'unit-risk', title: 'Rủi ro đơn vị', groupLabel: GROUP.risk, okr: false, unitScope: true,
    description: 'Đơn vị nào đang trễ hạn nhiều nhất, mở ra xem đúng KPI nào trễ.',
    icon: <AlertTriangle size={20} />, w: 6, h: 12,
  },
  {
    i: 'warning-list', title: 'Rủi ro thành viên', groupLabel: GROUP.risk, okr: false, unitScope: true,
    description: 'Nhân sự đang có KPI quá hạn, kèm chi tiết từng chỉ tiêu.',
    icon: <AlertCircle size={20} />, w: 6, h: 12,
  },
  {
    i: 'rank-table', title: 'Bảng xếp hạng nhân sự', groupLabel: GROUP.risk, okr: false, unitScope: true,
    description: 'Xếp hạng nhân sự theo điểm hiệu suất, lọc được theo đơn vị.',
    icon: <Star size={20} />, w: 12, h: 13,
  },
  {
    // Không gắn cờ `okr`: widget này nói về NGƯỜI nên có mặt ở cả hai chế độ — nguồn của nó lấy
    // cả KPI gắn key result (xem `everyKpi` trong TeamFocusWidget).
    i: 'team-focus', title: 'Nhân sự cần can thiệp', groupLabel: GROUP.risk, unitScope: true,
    description: 'Chỉ những nhân sự đang có vấn đề trong đợt/kỳ đang chọn, xếp theo mức ưu tiên, bung ra xem đúng chỉ tiêu nộp trễ.',
    icon: <UserRoundSearch size={20} />, w: 12, h: 17,
    render: () => <TeamFocusWidget />,
  },

  // ── Cá nhân · bản KPI (tổ chức TẮT OKR) — tab "KPI của tôi" ──
  {
    i: 'mykpi-todo', title: 'Công việc cần làm', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Chỉ tiêu đang chờ bạn trong đợt/kỳ đang chọn: bị từ chối, quá hạn, sắp đến hạn, chậm tiến độ — kèm nút xử lý.',
    icon: <ClipboardList size={20} />, w: 12, h: 16,
    render: () => <MyTodoWidget source="kpi" />,
  },
  {
    i: 'mykpi-metrics', title: 'Chỉ số KPI của tôi', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Tổng KPI, tiến độ, hiệu suất, đang chạy/hoàn thành và số KPI rủi ro.',
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'mykpi-trend', title: 'Xu hướng KPI của tôi', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Số KPI bạn đảm nhiệm và hiệu suất của bạn qua từng mốc thời gian.',
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },
  {
    i: 'mykpi-detail', title: 'Bảng chi tiết KPI của tôi', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Toàn bộ KPI bạn đang đảm nhiệm, tiến độ và phân loại từng chỉ tiêu.',
    icon: <Target size={20} />, w: 12, h: 18,
  },
  {
    i: 'mykpi-submissions', title: 'Trạng thái bài nộp', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Tỷ trọng bài nộp đã duyệt, chờ duyệt và bị từ chối của bạn.',
    icon: <PieChartIcon size={20} />, w: 6, h: 11,
  },
  {
    i: 'mykpi-status-dist', title: 'Phân bổ trạng thái KPI', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Số KPI của bạn theo từng trạng thái.',
    icon: <BarChart3 size={20} />, w: 6, h: 11,
  },
  {
    i: 'mykpi-eval-history', title: 'Lịch sử đánh giá', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Các phiếu đánh giá bạn đã nhận, tìm kiếm và sắp xếp được.',
    icon: <ListChecks size={20} />, w: 6, h: 14,
  },
  {
    i: 'mykpi-eval-trend', title: 'Xu hướng điểm số', groupLabel: GROUP.personal, okr: false, filterScope: 'personal',
    description: 'Điểm đánh giá của bạn qua từng đợt.',
    icon: <Activity size={20} />, w: 6, h: 11,
  },

  // ── Cá nhân · bản OKR (tổ chức BẬT OKR) — tab "Mục tiêu của tôi" ──
  {
    i: 'myobj-todo', title: 'Công việc cần làm', groupLabel: GROUP.personal, okr: true, filterScope: 'personal',
    description: 'KPI thuộc mục tiêu của bạn đang chờ xử lý trong đợt/kỳ đang chọn, xếp theo mức ưu tiên.',
    icon: <ClipboardList size={20} />, w: 12, h: 16,
    render: () => <MyTodoWidget source="objective" />,
  },
  {
    i: 'myobj-metrics', title: 'Chỉ số mục tiêu của tôi', groupLabel: GROUP.personal, okr: true, filterScope: 'personal',
    description: 'Tiến độ, hiệu suất, trạng thái KPI và số KPI rủi ro của bạn.',
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'myobj-trend', title: 'Xu hướng mục tiêu của tôi', groupLabel: GROUP.personal, okr: true, filterScope: 'personal',
    description: 'Số mục tiêu bạn đảm nhiệm và hiệu suất của bạn qua từng mốc thời gian.',
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },
  {
    i: 'myobj-detail', title: 'Bảng chi tiết mục tiêu của tôi', groupLabel: GROUP.personal, okr: true, filterScope: 'personal',
    description: 'Mục tiêu và kết quả then chốt bạn đảm nhiệm, kèm tiến độ từng KPI.',
    icon: <Target size={20} />, w: 12, h: 18,
  },

  // ── Phân cấp — tab "Phân cấp" (cây đơn vị + chi tiết đơn vị đang chọn) ──
  {
    i: 'drill-tree', title: 'Cây đơn vị', groupLabel: GROUP.drill,
    description: 'Chọn đơn vị để mọi widget Phân cấp và Hạng mục bám theo.',
    icon: <Network size={20} />, w: 4, h: 20,
  },
  {
    i: 'drill-summary', title: 'Tóm tắt đơn vị đang xem', groupLabel: GROUP.drill,
    description: 'Cấp, tên đơn vị, số nhân sự và tổng KPI của đơn vị đang chọn.',
    icon: <Building2 size={20} />, w: 8, h: 5,
  },
  {
    i: 'drill-employees', title: 'Thành viên trực thuộc', groupLabel: GROUP.drill,
    description: 'Bảng nhân sự của đơn vị đang chọn, có tìm kiếm và phân trang.',
    icon: <Users size={20} />, w: 8, h: 18,
  },
  {
    i: 'drill-compare', title: 'Hiệu suất đơn vị con', groupLabel: GROUP.drill,
    description: 'So sánh hiệu suất giữa các đơn vị con của đơn vị đang chọn.',
    icon: <BarChart3 size={20} />, w: 6, h: 13,
  },
  {
    i: 'drill-heatmap', title: 'Heatmap tiến độ đơn vị con', groupLabel: GROUP.drill,
    description: 'Bản đồ nhiệt tiến độ theo đơn vị con và từng đợt.',
    icon: <LayoutGrid size={20} />, w: 6, h: 13,
  },
  {
    i: 'drill-classification', title: 'Xếp loại đơn vị', groupLabel: GROUP.drill,
    description: 'Xếp loại theo phân bố xếp loại thành viên — theo đợt hoặc theo kỳ.',
    icon: <Award size={20} />, w: 12, h: 16,
  },
  {
    i: 'drill-matrix', title: 'Ma trận xếp loại', groupLabel: GROUP.drill, qualitative: true,
    description: 'Phân bố 9-box/25-box của đơn vị đang chọn, kèm heatmap ma trận.',
    icon: <Grid3x3 size={20} />, w: 12, h: 18,
  },

  // ── Hạng mục (BSC) — tab "Hạng mục (BSC)" ──
  {
    i: 'bsc-metrics', title: 'Chỉ số cân bằng BSC', groupLabel: GROUP.bsc, bsc: true,
    description: 'Điểm BSC trung bình, hạng mục mạnh/yếu nhất và độ phủ hạng mục.',
    icon: <Gauge size={20} />, w: 12, h: 6,
  },
  {
    i: 'bsc-radar', title: 'Radar cân bằng', groupLabel: GROUP.bsc, bsc: true,
    description: 'Điểm từng hạng mục trên một vòng radar — thấy ngay chỗ lệch.',
    icon: <Target size={20} />, w: 4, h: 13,
  },
  {
    i: 'bsc-perspectives', title: 'Thẻ từng hạng mục', groupLabel: GROUP.bsc, bsc: true,
    description: 'Điểm, trọng số, số KPI và mức đóng góp của từng hạng mục.',
    icon: <LayoutGrid size={20} />, w: 8, h: 13,
  },
  {
    i: 'bsc-trend', title: 'Xu hướng điểm hạng mục', groupLabel: GROUP.bsc, bsc: true,
    description: 'Điểm từng hạng mục và điểm BSC tổng qua các kỳ.',
    icon: <TrendingUp size={20} />, w: 12, h: 14,
  },
  {
    i: 'bsc-unit-comparison', title: 'So sánh hạng mục giữa đơn vị', groupLabel: GROUP.bsc, bsc: true,
    description: 'Điểm từng hạng mục của mỗi đơn vị, xếp cạnh nhau.',
    icon: <BarChart3 size={20} />, w: 12, h: 15,
  },
  {
    i: 'bsc-vs-system', title: 'Đối chiếu BSC vs hệ thống', groupLabel: GROUP.bsc, bsc: true,
    description: 'So điểm BSC với điểm hệ thống theo đơn vị hoặc theo nhân sự.',
    icon: <Scale size={20} />, w: 8, h: 14,
  },
  {
    i: 'bsc-coverage', title: 'KPI chưa gán hạng mục', groupLabel: GROUP.bsc, bsc: true,
    description: 'Độ phủ hạng mục và danh sách KPI còn thiếu hạng mục.',
    icon: <ShieldCheck size={20} />, w: 4, h: 14,
  },
  {
    i: 'bsc-ranking', title: 'Xếp hạng theo điểm BSC', groupLabel: GROUP.bsc, bsc: true,
    description: 'Xếp hạng nhân sự theo điểm BSC, kèm breakdown từng hạng mục.',
    icon: <Medal size={20} />, w: 12, h: 16,
  },
]

const isAvailable = (d: AnalyticsWidgetDef, flags: OrgFlags, scope: ViewerScope): boolean => {
  if (d.okr !== undefined && d.okr !== flags.enableOkr) return false
  if (d.unitScope && !scope.canViewUnit) return false
  if (d.bsc && !(flags.enableBsc && scope.canManageBsc)) return false
  // Ô ma trận cần MỘT trục bất kỳ: KPI định tính, hoặc điểm hạnh kiểm lấp trục còn trống.
  if (d.qualitative && !(flags.enableQualitative || flags.enableConduct)) return false
  return true
}

const toWidget = (d: AnalyticsWidgetDef, x = 0, y = 0): DashboardWidget => ({
  i: d.i, type: d.i, title: d.title, x, y, w: d.w, h: d.h, visible: true,
})

/** Mọi widget vai trò này được phép có — dùng để hydrate bố cục đã lưu. */
export function getAnalyticsWidgets(flags: OrgFlags, scope: ViewerScope): DashboardWidget[] {
  return ANALYTICS_WIDGETS.filter(d => isAvailable(d, flags, scope)).map(d => toWidget(d))
}

/** Thư viện widget cho nút "Thêm biểu đồ". */
export function getAnalyticsCatalog(flags: OrgFlags, scope: ViewerScope): WidgetCatalogEntry[] {
  return ANALYTICS_WIDGETS
    .filter(d => isAvailable(d, flags, scope))
    .map(d => ({ template: toWidget(d), icon: d.icon, description: d.description, groupLabel: d.groupLabel }))
}

/**
 * Vẽ một ô trên lưới. Trả `null` với id không còn dùng được — bố cục lưu từ bản deploy cũ,
 * hoặc cờ tổ chức vừa đổi (bật OKR là nửa danh mục đổi sang cặp Mục tiêu).
 */
export function renderAnalyticsWidget(i: string, flags: OrgFlags, scope: ViewerScope): React.ReactNode {
  const def = ANALYTICS_WIDGETS.find(d => d.i === i)
  if (!def || !isAvailable(def, flags, scope)) return null
  if (def.render) return def.render()
  return (
    <AnalyticsWidget
      id={def.i}
      title={def.title}
      icon={def.icon}
      filterScope={def.filterScope ?? 'unit'}
    />
  )
}

/** Xếp các id đã cho thành hàng 12 cột, bỏ qua id không dùng được với cờ/quyền hiện tại. */
function layoutOf(ids: string[], flags: OrgFlags, scope: ViewerScope): DashboardWidget[] {
  let y = 0
  let rowX = 0
  let rowH = 0
  const out: DashboardWidget[] = []
  const wrap = () => { y += rowH; rowX = 0; rowH = 0 }

  ids.forEach(id => {
    const def = ANALYTICS_WIDGETS.find(d => d.i === id)
    if (!def || !isAvailable(def, flags, scope)) return
    if (rowX + def.w > 12) wrap()
    out.push(toWidget(def, rowX, y))
    rowX += def.w
    // y tiến theo ô CAO NHẤT của hàng, để toạ độ lưu xuống khớp với những gì hiện ra
    rowH = Math.max(rowH, def.h)
    if (rowX >= 12) wrap()
  })
  return out
}

/**
 * Bố cục mặc định theo vai trò — cố tình ngắn, chỉ vài ô đầu tiên.
 *
 * <p>Quản lý mở trang chủ để xem đơn vị mình đang chạy thế nào; nhân sự mở để xem KPI của
 * chính mình. Bảng dài (chi tiết KPI, xếp hạng, BSC, phân cấp) không nằm mặc định: chúng là
 * chỗ để tra cứu, ai cần thì tự thêm từ thư viện.
 */
export function getAnalyticsDefaultLayout(
  dashboardScope: DashboardScope, flags: OrgFlags, scope: ViewerScope,
): DashboardWidget[] {
  // Cặp KPI hay cặp Mục tiêu — chọn theo cờ tổ chức, giống hệt trang Phân tích.
  const unit = flags.enableOkr
    ? { metrics: 'sub-metrics', trend: 'sub-trend', perf: 'sub-unit-perf', detail: 'sub-detail' }
    : { metrics: 'unit-kpi-metrics', trend: 'trend-chart', perf: 'unit-perf', detail: 'kpi-detail' }
  const personal = flags.enableOkr
    ? { metrics: 'myobj-metrics', trend: 'myobj-trend', detail: 'myobj-detail', todo: 'myobj-todo' }
    : { metrics: 'mykpi-metrics', trend: 'mykpi-trend', detail: 'mykpi-detail', todo: 'mykpi-todo' }

  /*
    Ô ĐẦU TIÊN luôn là hàng thẻ chỉ số của vai trò đó: mở trang chủ là thấy ngay mấy con số
    tổng, không phải cuộn. Ngay dưới là thanh lọc, vì đổi đợt/kỳ là việc đầu tiên người ta làm
    sau khi liếc mấy con số đó. Phần còn lại cố tình ngắn — bảng dài và các mục Phân cấp/Hạng
    mục nằm trong thư viện widget, ai cần thì tự thêm.
  */
  const ids = (() => {
    switch (dashboardScope) {
      /*
        Ba vai quản lý đều nhận thêm ô "Nhân sự cần can thiệp" ngay dưới thanh lọc: xem con số
        tổng xong thì câu hỏi kế tiếp luôn là "ai đang kéo con số đó xuống". Nó thay chỗ của
        "Rủi ro thành viên" ở bố cục Trưởng đơn vị — hai ô cùng một nguồn, để cả hai là bắt
        người dùng đọc lại cùng một danh sách hai lần.
      */
      // Giám đốc nhìn toàn tổ chức: chỉ số → ai cần can thiệp → xu hướng → so sánh giữa các đơn vị
      case 'DIRECTOR':
        return [unit.metrics, 'filter-unit', 'team-focus', unit.trend, unit.perf]

      // Trưởng đơn vị lo phòng mình
      case 'HEAD':
        return [unit.metrics, 'filter-unit', 'team-focus', unit.trend]

      // Phó vừa quản một mảng vừa có KPI riêng — bố cục mặc định phản ánh đúng hai vai đó
      case 'DEPUTY':
        return [unit.metrics, 'filter-unit', 'team-focus', 'filter-personal', personal.todo]

      // Nhân viên chỉ có phạm vi của mình: việc phải làm đứng trước mọi biểu đồ
      default:
        return [personal.metrics, 'filter-personal', personal.todo, personal.trend, personal.detail]
    }
  })()

  const base = layoutOf(ids, flags, scope)
  /*
    Người không có quyền xem dữ liệu đơn vị (hoặc cờ tổ chức vừa đổi) sẽ bị `layoutOf` bỏ hết
    ô cấp đơn vị — kể cả hàng thẻ chỉ số. Kiểm tra ô đầu chứ không chỉ kiểm tra rỗng: còn sót
    mỗi cái biểu đồ mà mất hàng chỉ số thì bố cục đã sai ý định, phải rơi hẳn về bản cá nhân.
  */
  if (base[0]?.i === ids[0]) return base
  return layoutOf([personal.metrics, 'filter-personal', personal.todo, personal.trend, personal.detail], flags, scope)
}

/** Bố cục gợi ý trong thư viện widget. Bỏ hẳn preset nào không còn ô nào dùng được. */
export function getAnalyticsPresets(flags: OrgFlags, scope: ViewerScope): LayoutPreset[] {
  const raw: { key: string; label: string; description: string; ids: string[] }[] = [
    flags.enableOkr
      ? {
          key: 'unit', label: 'Mục tiêu đơn vị',
          description: 'Đúng nội dung mục "Mục tiêu đơn vị" bên Phân tích.',
          ids: ['filter-unit', 'sub-metrics', 'sub-trend', 'sub-detail', 'sub-member', 'sub-unit-perf'],
        }
      : {
          key: 'unit', label: 'KPI đơn vị',
          description: 'Đúng nội dung mục "KPI đơn vị" bên Phân tích.',
          ids: ['filter-unit', 'unit-kpi-metrics', 'trend-chart', 'kpi-detail', 'unit-perf', 'member-dist', 'unit-risk', 'warning-list', 'rank-table'],
        },
    flags.enableOkr
      ? {
          key: 'personal', label: 'Mục tiêu của tôi',
          description: 'Mục "Mục tiêu của tôi" bên Phân tích, kèm ô việc cần làm.',
          ids: ['filter-personal', 'myobj-todo', 'myobj-metrics', 'myobj-trend', 'myobj-detail'],
        }
      : {
          key: 'personal', label: 'KPI của tôi',
          description: 'Mục "KPI của tôi" bên Phân tích, kèm ô việc cần làm.',
          ids: ['filter-personal', 'mykpi-todo', 'mykpi-metrics', 'mykpi-trend', 'mykpi-detail', 'mykpi-submissions', 'mykpi-status-dist', 'mykpi-eval-history', 'mykpi-eval-trend'],
        },
    {
      key: 'drill', label: 'Phân cấp',
      description: 'Đúng nội dung mục "Phân cấp" bên Phân tích: cây đơn vị và chi tiết đơn vị.',
      ids: ['filter-unit', 'drill-tree', 'drill-summary', 'drill-employees', 'drill-compare', 'drill-heatmap', 'drill-classification', 'drill-matrix'],
    },
    {
      key: 'bsc', label: 'Hạng mục (BSC)',
      description: 'Đúng nội dung mục "Hạng mục (BSC)" bên Phân tích.',
      ids: ['filter-unit', 'bsc-metrics', 'bsc-radar', 'bsc-perspectives', 'bsc-trend', 'bsc-unit-comparison', 'bsc-vs-system', 'bsc-coverage', 'bsc-ranking'],
    },
    {
      key: 'risk', label: 'Rủi ro',
      description: 'Ai cần can thiệp trước, đơn vị và nhân sự đang trễ hạn, kèm bảng xếp hạng.',
      ids: ['filter-unit', 'team-focus', 'unit-risk', 'warning-list', 'rank-table'],
    },
  ]

  return raw
    .map(p => ({ key: p.key, label: p.label, description: p.description, widgets: layoutOf(p.ids, flags, scope) }))
    // Preset chỉ còn mỗi ô bộ lọc thì coi như rỗng — không mời người dùng áp một bố cục trống
    .filter(p => p.widgets.filter(w => !w.i.startsWith('filter-')).length > 0)
}
