import {
  TrendingUp, Users, Star, ListChecks, BarChart3,
  SlidersHorizontal, Gauge, Grid3x3, Award, Building2, Network, ShieldCheck, Scale,
  LayoutGrid, Medal, ClipboardList, UserRoundSearch,
} from 'lucide-react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetCatalogEntry, LayoutPreset } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { DashboardScope } from '../api/dashboardLayoutApi'
import { AnalyticsWidget } from './shared/AnalyticsWidget'
import { DashboardFilterWidget } from './shared/DashboardFilterWidget'
import { MyTodoWidget } from './shared/MyTodoWidget'
import { TeamFocusWidget } from './shared/TeamFocusWidget'
import type { FilterScope } from '../context/DashboardFilterContext'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
  /** Có quyền `BSC:MANAGE` không — cùng quyền mà cây nav đặt cho mục "Thẻ điểm BSC". */
  canManageBsc: boolean
}

const GROUP = perLanguage(() => ({
  filter: i18n.t('dashboard:analyticsCatalog.filters'),
  unit: i18n.t('dashboard:analyticsCatalog.unit'),
  personal: i18n.t('dashboard:analyticsCatalog.personal'),
  risk: i18n.t('dashboard:analyticsCatalog.riskRanking'),
  drill: i18n.t('dashboard:analyticsCatalog.unitComparison'),
  bsc: i18n.t('dashboard:analyticsCatalog.bscScorecard'),
} as const))

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

const ANALYTICS_WIDGETS = perLanguage((): AnalyticsWidgetDef[] => ([
  // ── Bộ lọc ─────────────────────────────────────────────────────────────
  {
    i: 'filter-unit', title: i18n.t('dashboard:analyticsCatalog.unitFilter'), groupLabel: GROUP().filter, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.chooseThePeriodPeriodRangeCycle'),
    icon: <SlidersHorizontal size={20} />, w: 12, h: 4,
    render: () => <DashboardFilterWidget scope="unit" />,
  },
  {
    i: 'filter-personal', title: i18n.t('dashboard:analyticsCatalog.personalFilter'), groupLabel: GROUP().filter,
    description: i18n.t('dashboard:analyticsCatalog.chooseThePeriodPeriodRangeCycle2'),
    icon: <SlidersHorizontal size={20} />, w: 12, h: 4,
    filterScope: 'personal',
    render: () => <DashboardFilterWidget scope="personal" />,
  },

  // ── Đơn vị · bản KPI (tổ chức TẮT OKR) — tab "KPI đơn vị" ──
  {
    i: 'unit-kpi-metrics', title: i18n.t('dashboard:analyticsCatalog.unitKpiMetrics'), groupLabel: GROUP().unit, okr: false, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.progressPerformanceKpiStatusAtRisk'),
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'trend-chart', title: i18n.t('dashboard:analyticsCatalog.unitKpisAcrossCycles'), groupLabel: GROUP().unit, okr: false, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.isTheUnitGoingUpOr'),
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },
  {
    i: 'unit-perf', title: i18n.t('dashboard:analyticsCatalog.childUnitsPerformanceProgressSubmissions'), groupLabel: GROUP().unit, okr: false, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.childUnitsSideBySideOn'),
    icon: <BarChart3 size={20} />, w: 12, h: 13,
  },
  {
    i: 'member-dist', title: i18n.t('dashboard:analyticsCatalog.peopleByRole'), groupLabel: GROUP().unit, okr: false, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.howManyPeopleEachUnitHas'),
    icon: <Users size={20} />, w: 6, h: 11,
  },

  // ── Đơn vị · bản OKR (tổ chức BẬT OKR) — tab "Mục tiêu đơn vị" ──
  {
    i: 'sub-metrics', title: i18n.t('dashboard:analyticsCatalog.unitObjectiveMetrics'), groupLabel: GROUP().unit, okr: true, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.progressPerformanceObjectivesCompletedAtRisk'),
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'sub-trend', title: i18n.t('dashboard:analyticsCatalog.unitObjectivesAcrossCycles'), groupLabel: GROUP().unit, okr: true, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.isTheUnitGoingUpOr2'),
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },
  {
    i: 'sub-detail', title: i18n.t('dashboard:analyticsCatalog.unitObjectiveAndKrTree'), groupLabel: GROUP().unit, okr: true, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.objectivesKeyResultsKpisOfThe'),
    icon: <ListChecks size={20} />, w: 12, h: 20,
  },
  {
    i: 'sub-unit-perf', title: i18n.t('dashboard:analyticsCatalog.childUnitsPerformanceProgressSubmissions'), groupLabel: GROUP().unit, okr: true, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.childUnitsSideBySideOn'),
    icon: <BarChart3 size={20} />, w: 12, h: 13,
  },
  {
    i: 'sub-member', title: i18n.t('dashboard:analyticsCatalog.peopleByRole'), groupLabel: GROUP().unit, okr: true, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.howManyPeopleEachUnitHas'),
    icon: <Users size={20} />, w: 6, h: 11,
  },

  // ── Rủi ro & xếp hạng (chỉ có ở tab "KPI đơn vị") ──
  {
    i: 'rank-table', title: i18n.t('dashboard:analyticsCatalog.peopleRanking'), groupLabel: GROUP().risk, okr: false, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.whoIsAtTheTopAnd'),
    icon: <Star size={20} />, w: 12, h: 13,
  },
  {
    // Không gắn cờ `okr`: widget này nói về NGƯỜI nên có mặt ở cả hai chế độ — nguồn của nó lấy
    // cả KPI gắn key result (xem `everyKpi` trong TeamFocusWidget).
    i: 'team-focus', title: i18n.t('dashboard:analyticsCatalog.peopleNeedingIntervention'), groupLabel: GROUP().risk, unitScope: true,
    description: i18n.t('dashboard:analyticsCatalog.onlyThePeopleWithProblemsIn'),
    icon: <UserRoundSearch size={20} />, w: 12, h: 17,
    render: () => <TeamFocusWidget />,
  },

  // ── Cá nhân · bản KPI (tổ chức TẮT OKR) — tab "Kết quả của tôi" ──
  {
    i: 'mykpi-todo', title: i18n.t('dashboard:analyticsCatalog.toDo'), groupLabel: GROUP().personal, okr: false, filterScope: 'personal',
    description: i18n.t('dashboard:analyticsCatalog.kpisWaitingOnYouInThe'),
    icon: <ClipboardList size={20} />, w: 12, h: 16,
    render: () => <MyTodoWidget source="kpi" />,
  },
  {
    i: 'mykpi-metrics', title: i18n.t('dashboard:analyticsCatalog.myKpiMetrics'), groupLabel: GROUP().personal, okr: false, filterScope: 'personal',
    description: i18n.t('dashboard:analyticsCatalog.totalKpisProgressPerformanceInProgress'),
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'mykpi-trend', title: i18n.t('dashboard:analyticsCatalog.myKpisAcrossCycles'), groupLabel: GROUP().personal, okr: false, filterScope: 'personal',
    description: i18n.t('dashboard:analyticsCatalog.areYouGoingUpOrDown'),
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },

  // ── Cá nhân · bản OKR (tổ chức BẬT OKR) — tab "Mục tiêu của tôi" ──
  {
    i: 'myobj-todo', title: i18n.t('dashboard:analyticsCatalog.toDo'), groupLabel: GROUP().personal, okr: true, filterScope: 'personal',
    description: i18n.t('dashboard:analyticsCatalog.kpisUnderYourObjectivesWaitingTo'),
    icon: <ClipboardList size={20} />, w: 12, h: 16,
    render: () => <MyTodoWidget source="objective" />,
  },
  {
    i: 'myobj-metrics', title: i18n.t('dashboard:analyticsCatalog.myObjectiveMetrics'), groupLabel: GROUP().personal, okr: true, filterScope: 'personal',
    description: i18n.t('dashboard:analyticsCatalog.yourProgressPerformanceKpiStatusAnd'),
    icon: <Gauge size={20} />, w: 12, h: 5,
  },
  {
    i: 'myobj-trend', title: i18n.t('dashboard:analyticsCatalog.myObjectivesAcrossCycles'), groupLabel: GROUP().personal, okr: true, filterScope: 'personal',
    description: i18n.t('dashboard:analyticsCatalog.areYouGoingUpOrDown2'),
    icon: <TrendingUp size={20} />, w: 12, h: 15,
  },

  // ── So sánh giữa các đơn vị — cây đơn vị + chi tiết đơn vị đang chọn (cùng component với tab) ──
  {
    i: 'drill-tree', title: i18n.t('dashboard:analyticsCatalog.unitTree'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.chooseAUnitForEveryUnit'),
    icon: <Network size={20} />, w: 4, h: 20,
  },
  {
    i: 'drill-summary', title: i18n.t('dashboard:analyticsCatalog.unitBeingViewed'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.levelUnitNameHeadcountAndTotal'),
    icon: <Building2 size={20} />, w: 8, h: 4,
  },
  {
    i: 'drill-classification', title: i18n.t('dashboard:analyticsCatalog.peopleRatingDistribution'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.ratingsByDistributionOfPeopleAt'),
    icon: <Award size={20} />, w: 12, h: 16,
  },
  {
    i: 'drill-cascade', title: i18n.t('dashboard:analyticsCatalog.kpiCascadingDelegationFlow'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.whichUnitsTheKpiWeightFlows'),
    icon: <Network size={20} />, w: 12, h: 12,
  },
  {
    i: 'drill-employees', title: i18n.t('dashboard:analyticsCatalog.eachMemberPerformanceProgressKpiCount'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.eachPersonInTheUnitPerformance'),
    icon: <Users size={20} />, w: 8, h: 16,
  },
  {
    i: 'drill-matrix', title: i18n.t('dashboard:analyticsCatalog.conductCompletionMatrix'), groupLabel: GROUP().drill, qualitative: true,
    description: i18n.t('dashboard:analyticsCatalog.theNumberOfPeopleInEach'),
    icon: <Grid3x3 size={20} />, w: 12, h: 18,
  },
  {
    i: 'drill-children', title: i18n.t('dashboard:analyticsCatalog.ratingOfEachChildUnit'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.ratingsOfTheUnitsDirectlyBelow'),
    icon: <Building2 size={20} />, w: 6, h: 12,
  },
  {
    i: 'drill-compare', title: i18n.t('dashboard:analyticsCatalog.performanceOfEachChildUnit'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.performanceOfChildUnitsSideBy'),
    icon: <BarChart3 size={20} />, w: 6, h: 12,
  },
  {
    i: 'drill-boxplot', title: i18n.t('dashboard:analyticsCatalog.scoreSpreadWithinEachChildUnit'), groupLabel: GROUP().drill,
    description: i18n.t('dashboard:analyticsCatalog.whetherScoresInEachChildUnit'),
    icon: <BarChart3 size={20} />, w: 12, h: 12,
  },

  // ── Thẻ điểm BSC (cùng component với tab; mô hình thẻ điểm) ──
  {
    i: 'bsc-overview', title: i18n.t('dashboard:analyticsCatalog.bscHealthOfThePeriod'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.thePeriodsBscAchievementNumberOf'),
    icon: <Gauge size={20} />, w: 12, h: 6,
  },
  {
    i: 'bsc-units', title: i18n.t('dashboard:analyticsCatalog.scorecardAchievementOfEachUnit'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.whichUnitsAchieveAndWhichFall'),
    icon: <BarChart3 size={20} />, w: 7, h: 11,
  },
  {
    i: 'bsc-gates', title: i18n.t('dashboard:analyticsCatalog.unitsBlockedByGateItems'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.whichUnitsAreBlockedByGate'),
    icon: <ShieldCheck size={20} />, w: 5, h: 11,
  },
  {
    i: 'bsc-items', title: i18n.t('dashboard:analyticsCatalog.eachKpiAgainstTargetAndFloor'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.whichKpisAreMetAndWhich'),
    icon: <LayoutGrid size={20} />, w: 12, h: 10,
  },
  {
    i: 'bsc-trend', title: i18n.t('dashboard:analyticsCatalog.achievementAcrossPeriods'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.whetherAchievementIsGoingUpOr'),
    icon: <TrendingUp size={20} />, w: 7, h: 12,
  },
  {
    i: 'bsc-cascade', title: i18n.t('dashboard:analyticsCatalog.kpiCascadeCoverage'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.whetherEachKpiCascadedToUnits'),
    icon: <Scale size={20} />, w: 5, h: 12,
  },
  {
    i: 'bsc-ranking', title: i18n.t('dashboard:analyticsCatalog.peopleRankingByBscScore'), groupLabel: GROUP().bsc, bsc: true,
    description: i18n.t('dashboard:analyticsCatalog.peopleRankedByBscScoreOr'),
    icon: <Medal size={20} />, w: 12, h: 14,
  },
]))

/** Mọi id trang chủ biết vẽ — nơi khác dùng để kiểm trước khi ghim một widget vào đây. */
export const ANALYTICS_WIDGET_IDS = perLanguage((): ReadonlySet<string> => (new Set(ANALYTICS_WIDGETS().map(d => d.i))))

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
  return ANALYTICS_WIDGETS().filter(d => isAvailable(d, flags, scope)).map(d => toWidget(d))
}

/** Thư viện widget cho nút "Thêm biểu đồ". */
export function getAnalyticsCatalog(flags: OrgFlags, scope: ViewerScope): WidgetCatalogEntry[] {
  return ANALYTICS_WIDGETS()
    .filter(d => isAvailable(d, flags, scope))
    .map(d => ({ template: toWidget(d), icon: d.icon, description: d.description, groupLabel: d.groupLabel }))
}

/**
 * Vẽ một ô trên lưới. Trả `null` với id không còn dùng được — bố cục lưu từ bản deploy cũ,
 * hoặc cờ tổ chức vừa đổi (bật OKR là nửa danh mục đổi sang cặp Mục tiêu).
 */
export function renderAnalyticsWidget(i: string, flags: OrgFlags, scope: ViewerScope): React.ReactNode {
  const def = ANALYTICS_WIDGETS().find(d => d.i === i)
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
    const def = ANALYTICS_WIDGETS().find(d => d.i === id)
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
    ? { metrics: 'sub-metrics', trend: 'sub-trend', perf: 'sub-unit-perf' }
    : { metrics: 'unit-kpi-metrics', trend: 'trend-chart', perf: 'unit-perf' }
  const personal = flags.enableOkr
    ? { metrics: 'myobj-metrics', trend: 'myobj-trend', todo: 'myobj-todo' }
    : { metrics: 'mykpi-metrics', trend: 'mykpi-trend', todo: 'mykpi-todo' }

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
        return [personal.metrics, 'filter-personal', personal.todo, personal.trend]
    }
  })()

  const base = layoutOf(ids, flags, scope)
  /*
    Người không có quyền xem dữ liệu đơn vị (hoặc cờ tổ chức vừa đổi) sẽ bị `layoutOf` bỏ hết
    ô cấp đơn vị — kể cả hàng thẻ chỉ số. Kiểm tra ô đầu chứ không chỉ kiểm tra rỗng: còn sót
    mỗi cái biểu đồ mà mất hàng chỉ số thì bố cục đã sai ý định, phải rơi hẳn về bản cá nhân.
  */
  if (base[0]?.i === ids[0]) return base
  return layoutOf([personal.metrics, 'filter-personal', personal.todo, personal.trend], flags, scope)
}

/** Bố cục gợi ý trong thư viện widget. Bỏ hẳn preset nào không còn ô nào dùng được. */
export function getAnalyticsPresets(flags: OrgFlags, scope: ViewerScope): LayoutPreset[] {
  const raw: { key: string; label: string; description: string; ids: string[] }[] = [
    flags.enableOkr
      ? {
          key: 'unit', label: i18n.t('dashboard:analyticsCatalog.unitObjectivesIManage'),
          description: i18n.t('dashboard:analyticsCatalog.exactlyTheContentOfUnitObjectives'),
          ids: ['filter-unit', 'sub-metrics', 'sub-trend', 'sub-detail', 'sub-member', 'sub-unit-perf'],
        }
      : {
          key: 'unit', label: i18n.t('dashboard:analyticsCatalog.unitsIManage'),
          description: i18n.t('dashboard:analyticsCatalog.exactlyTheContentOfUnitsI'),
          ids: ['filter-unit', 'unit-kpi-metrics', 'trend-chart', 'unit-perf', 'member-dist', 'rank-table'],
        },
    flags.enableOkr
      ? {
          key: 'personal', label: i18n.t('dashboard:analyticsCatalog.myObjectives'),
          description: i18n.t('dashboard:analyticsCatalog.theMyObjectivesSectionInStatistics'),
          ids: ['filter-personal', 'myobj-todo', 'myobj-metrics', 'myobj-trend'],
        }
      : {
          key: 'personal', label: i18n.t('dashboard:analyticsCatalog.myResults'),
          description: i18n.t('dashboard:analyticsCatalog.theMyResultsSectionInStatistics'),
          ids: ['filter-personal', 'mykpi-todo', 'mykpi-metrics', 'mykpi-trend'],
        },
    {
      key: 'drill', label: i18n.t('dashboard:analyticsCatalog.unitComparison'),
      description: i18n.t('dashboard:analyticsCatalog.exactlyTheContentOfUnitComparison'),
      ids: ['filter-unit', 'drill-tree', 'drill-summary', 'drill-classification', 'drill-employees', 'drill-matrix', 'drill-children', 'drill-compare'],
    },
    {
      key: 'bsc', label: i18n.t('dashboard:analyticsCatalog.bscScorecard'),
      description: i18n.t('dashboard:analyticsCatalog.exactlyTheContentOfBscScorecard'),
      ids: ['filter-unit', 'bsc-overview', 'bsc-units', 'bsc-gates', 'bsc-items', 'bsc-trend', 'bsc-cascade'],
    },
    {
      key: 'risk', label: i18n.t('dashboard:analyticsCatalog.risk'),
      description: i18n.t('dashboard:analyticsCatalog.whoNeedsInterventionFirstUnitsAnd'),
      ids: ['filter-unit', 'team-focus', 'rank-table'],
    },
  ]

  return raw
    .map(p => ({ key: p.key, label: p.label, description: p.description, widgets: layoutOf(p.ids, flags, scope) }))
    // Preset chỉ còn mỗi ô bộ lọc thì coi như rỗng — không mời người dùng áp một bố cục trống
    .filter(p => p.widgets.filter(w => !w.i.startsWith('filter-')).length > 0)
}
