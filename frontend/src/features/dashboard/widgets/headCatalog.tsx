import {
  Users, Inbox, AlertCircle, UserX, BarChart3, Target, TrendingUp,
  Gauge, CalendarClock, BarChart2, Medal, SendHorizonal, Flame,
  Bell, Gift, HandCoins, Sparkles, Compass, FileWarning, PiggyBank,
  ClipboardList, Trophy,
} from 'lucide-react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetCatalogEntry, LayoutPreset } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { AnalyticsWidget } from './shared/AnalyticsWidget'
import type { OrgFlags } from './staffCatalog'
import { useHeadDashboard } from '../context/HeadDashboardContext'
import {
  HeadQueueWidget, HeadAtRiskWidget, HeadCoverageWidget,
  HeadSubmissionStatusWidget, HeadTeamWidget, HeadMyWorkWidget,
} from './head/HeadWidgets'
import {
  HeadUnitKpisWidget, HeadOverdueKpisWidget, HeadTeamDeadlineWidget,
  HeadScoreDistributionWidget, HeadBenchmarkWidget, HeadNoSubmissionWidget, HeadUnitHealthWidget,
} from './head/HeadExtraWidgets'
import { HeadRejectedKpiWidget, HeadMyBudgetWidget } from './head/HeadOpsWidgets'
import {
  NotificationsWidget, RewardGrantsPendingWidget, RedemptionQueueWidget,
  AiQuotaOverviewWidget, BscBalanceWidget, OkrObjectivesWidget,
} from './shared/OpsWidgets'
import { CycleUnitStatusWidget, CycleUserRankingWidget } from './shared/CycleRewardWidgets'

const GROUP = {
  overview: 'Tổng quan',
  action: 'Cần xử lý',
  people: 'Con người',
  risk: 'Rủi ro',
  trend: 'Xu hướng & Biểu đồ',
  utility: 'Thưởng & Tiện ích',
} as const

interface HeadWidgetDef {
  i: string
  title: string
  description: string
  groupLabel: string
  icon: React.ReactNode
  w: number
  h: number
  render: () => React.ReactNode
  requires?: (flags: OrgFlags) => boolean
}

const HEAD_WIDGETS: HeadWidgetDef[] = [
  // ── Tổng quan ──
  // Giữ id 'head-stats' để bố cục đã lưu của người dùng cũ không bị mất ô này,
  // nhưng nội dung đổi thành khối sức khoẻ đơn vị: bốn thẻ số cũ lặp đúng hai con số
  // mà "Hàng đợi cần tôi xử lý" đã hiển thị.
  {
    i: 'head-stats', title: 'Sức khoẻ đơn vị', groupLabel: GROUP.overview,
    description: 'Tiến độ chỉ tiêu, nhân sự, điểm trung bình đội và số KPI đang rủi ro.',
    icon: <Gauge size={20} />, w: 5, h: 12, render: () => <HeadUnitHealthWidget />,
  },
  {
    i: 'head-submission-status', title: 'Trạng thái báo cáo', groupLabel: GROUP.overview,
    description: 'Tỷ lệ duyệt / chờ / từ chối của toàn đơn vị.',
    icon: <BarChart3 size={20} />, w: 4, h: 18, render: () => <HeadSubmissionStatusWidget />,
  },
  {
    i: 'head-benchmark', title: 'Đơn vị tôi so với đơn vị khác', groupLabel: GROUP.overview,
    description: 'Bạn đứng thứ mấy và cách trung bình chung bao nhiêu.',
    icon: <Medal size={20} />, w: 4, h: 14, render: () => <HeadBenchmarkWidget />,
  },

  // ── Cần xử lý ──
  {
    i: 'head-queue', title: 'Hàng đợi cần tôi xử lý', groupLabel: GROUP.action,
    description: 'Gộp KPI và báo cáo đang chờ bạn, kèm nút hành động ngay.',
    icon: <Inbox size={20} />, w: 7, h: 12, render: () => <HeadQueueWidget />,
  },
  {
    i: 'head-team-deadline', title: 'Đội sắp đến hạn', groupLabel: GROUP.action,
    description: 'Chỉ tiêu của đội hết hạn trong 7 ngày tới kèm tiến độ hiện tại.',
    icon: <CalendarClock size={20} />, w: 6, h: 12, render: () => <HeadTeamDeadlineWidget />,
  },
  {
    i: 'head-no-submission', title: 'Chưa nộp bài nào', groupLabel: GROUP.action,
    description: 'Người có KPI nhưng chưa nộp gì trong kỳ, kèm nút nhắc từng người.',
    icon: <SendHorizonal size={20} />, w: 6, h: 12, render: () => <HeadNoSubmissionWidget />,
  },
  {
    i: 'head-my-work', title: 'Việc của chính tôi', groupLabel: GROUP.action,
    description: 'KPI cá nhân của bạn, không phải chuyển sang dashboard riêng nữa.',
    icon: <Target size={20} />, w: 4, h: 12, render: () => <HeadMyWorkWidget />,
  },

  // ── Rủi ro ──
  {
    i: 'head-overdue-kpis', title: 'Chỉ tiêu đã quá hạn', groupLabel: GROUP.risk,
    description: 'Danh sách KPI quá hạn cụ thể kèm tên người chịu trách nhiệm.',
    icon: <Flame size={20} />, w: 6, h: 12, render: () => <HeadOverdueKpisWidget />,
  },
  {
    i: 'head-at-risk', title: 'Thành viên cần chú ý', groupLabel: GROUP.risk,
    description: 'Ai đang trễ hạn, chưa nộp hoặc điểm thấp trong đơn vị của bạn.',
    icon: <AlertCircle size={20} />, w: 6, h: 12, render: () => <HeadAtRiskWidget />,
  },

  // ── Con người ──
  {
    i: 'head-unit-kpis', title: 'Tiến độ chỉ tiêu đơn vị', groupLabel: GROUP.overview,
    description: 'Từng chỉ tiêu đã đạt bao nhiêu trên mục tiêu — số liệu nghiệp vụ, không phải số bài nộp.',
    icon: <Gauge size={20} />, w: 8, h: 14, render: () => <HeadUnitKpisWidget />,
  },
  {
    i: 'head-score-distribution', title: 'Phân bố điểm của đội', groupLabel: GROUP.people,
    description: 'Đội đang đồng đều hay phân hoá — điều mà điểm trung bình che mất.',
    icon: <BarChart2 size={20} />, w: 4, h: 12, render: () => <HeadScoreDistributionWidget />,
  },
  {
    i: 'head-team', title: 'Hiệu suất đội ngũ', groupLabel: GROUP.people,
    description: 'Bảng nhân sự kèm tiến độ, điểm trung bình và xuất Excel.',
    icon: <Users size={20} />, w: 8, h: 18, render: () => <HeadTeamWidget />,
  },
  {
    i: 'head-coverage', title: 'Độ phủ giao KPI', groupLabel: GROUP.people,
    description: 'Ai trong đơn vị chưa được giao KPI nào.',
    icon: <UserX size={20} />, w: 4, h: 12, render: () => <HeadCoverageWidget />,
  },

  {
    i: 'head-rejected-kpi', title: 'KPI của tôi bị trả lại', groupLabel: GROUP.action,
    description: 'KPI bạn tạo bị cấp trên từ chối, kèm lý do để sửa ngay.',
    icon: <FileWarning size={20} />, w: 6, h: 12, render: () => <HeadRejectedKpiWidget />,
  },
  {
    i: 'head-reward-pending', title: 'Đề nghị thưởng chờ duyệt', groupLabel: GROUP.action,
    description: 'Đề nghị thưởng trong phạm vi của bạn đang chờ quyết định.',
    icon: <HandCoins size={20} />, w: 6, h: 12,
    requires: f => f.enableReward,
    render: () => <RewardGrantsPendingWidget />,
  },
  {
    i: 'head-redemptions', title: 'Đơn đổi quà chờ xử lý', groupLabel: GROUP.action,
    description: 'Yêu cầu đổi quà đang chờ duyệt hoặc giao.',
    icon: <Gift size={20} />, w: 6, h: 12,
    requires: f => f.enableReward,
    render: () => <RedemptionQueueWidget />,
  },

  {
    i: 'head-cycle-ranking', title: 'Xếp hạng chốt kỳ', groupLabel: GROUP.people,
    description: 'Xếp hạng thành viên theo điểm chốt kỳ, ai chưa có điểm hiện ở cuối.',
    icon: <Trophy size={20} />, w: 6, h: 14, render: () => <CycleUserRankingWidget title="Xếp hạng chốt kỳ" />,
  },
  {
    i: 'head-cycle-status', title: 'Trạng thái chốt kỳ', groupLabel: GROUP.overview,
    description: 'Đơn vị của bạn và các đơn vị con đã chốt đánh giá kỳ chưa.',
    icon: <ClipboardList size={20} />, w: 6, h: 13, render: () => <CycleUnitStatusWidget title="Trạng thái chốt kỳ" />,
  },

  // ── Thưởng & Tiện ích ──
  {
    i: 'head-my-budget', title: 'Ngân sách thưởng của tôi', groupLabel: GROUP.utility,
    description: 'Điểm thưởng bạn còn được trao trong kỳ này.',
    icon: <PiggyBank size={20} />, w: 4, h: 11,
    requires: f => f.enableReward,
    render: () => <HeadMyBudgetWidget />,
  },
  {
    i: 'head-ai-quota', title: 'Hạn mức AI của team', groupLabel: GROUP.utility,
    description: 'Đã phân bổ bao nhiêu token cho cấp dưới, còn lại bao nhiêu.',
    icon: <Sparkles size={20} />, w: 4, h: 14,
    requires: f => f.enableAi,
    render: () => <AiQuotaOverviewWidget />,
  },
  {
    i: 'head-notifications', title: 'Thông báo', groupLabel: GROUP.utility,
    description: 'Số thông báo chưa đọc và lối vào trang thông báo.',
    icon: <Bell size={20} />, w: 4, h: 8, render: () => <NotificationsWidget />,
  },
  {
    i: 'head-bsc', title: 'Điểm BSC đơn vị', groupLabel: GROUP.overview,
    description: 'Điểm từng viễn cảnh BSC của đơn vị và số KPI đã gắn.',
    icon: <Compass size={20} />, w: 4, h: 13,
    requires: f => f.enableBsc,
    render: () => <HeadBscWidget />,
  },
  {
    i: 'head-okr', title: 'Objective của đơn vị', groupLabel: GROUP.overview,
    description: 'Tiến độ từng Objective và cái nào chưa tiến triển.',
    icon: <Target size={20} />, w: 8, h: 13,
    requires: f => f.enableOkr,
    render: () => <HeadOkrWidget />,
  },

  // ── Biểu đồ từ trang Thống kê ──
  {
    i: 'sub-trend', title: 'Xu hướng mục tiêu theo thời gian', groupLabel: GROUP.trend,
    description: 'Biểu đồ xu hướng mục tiêu cấp dưới, lấy từ trang Thống kê.',
    icon: <TrendingUp size={20} />, w: 12, h: 14,
    requires: f => f.enableOkr,
    render: () => <AnalyticsWidget id="sub-trend" title="Xu hướng mục tiêu theo thời gian" />,
  },
  {
    i: 'sub-unit-perf', title: 'Hiệu suất & tiến độ đơn vị', groupLabel: GROUP.trend,
    description: 'So sánh hiệu suất giữa các đơn vị, lấy từ trang Thống kê.',
    icon: <TrendingUp size={20} />, w: 12, h: 13,
    render: () => <AnalyticsWidget id="sub-unit-perf" title="Hiệu suất & tiến độ đơn vị" />,
  },
  {
    i: 'sub-member', title: 'Nhân sự & vai trò', groupLabel: GROUP.people,
    description: 'Cơ cấu nhân sự theo vai trò, lấy từ trang Thống kê.',
    icon: <Users size={20} />, w: 12, h: 11,
    render: () => <AnalyticsWidget id="sub-member" title="Nhân sự & vai trò" />,
  },
]

/** BSC và OKR của trưởng đơn vị phải giới hạn theo đơn vị họ quản, lấy từ context. */
function HeadBscWidget() {
  const { orgUnitId, unitName } = useHeadDashboard()
  return <BscBalanceWidget orgUnitId={orgUnitId} title={`Điểm BSC ${unitName}`} />
}

function HeadOkrWidget() {
  const { orgUnitId, unitName } = useHeadDashboard()
  return <OkrObjectivesWidget scope="org-unit" id={orgUnitId} title={`Objective ${unitName}`} />
}

const toWidget = (d: HeadWidgetDef, x = 0, y = 0): DashboardWidget => ({
  i: d.i, type: d.i, title: d.title, x, y, w: d.w, h: d.h, visible: true,
})

export function getHeadWidgets(flags: OrgFlags): DashboardWidget[] {
  return HEAD_WIDGETS.filter(d => !d.requires || d.requires(flags)).map(d => toWidget(d))
}

export function getHeadCatalog(flags: OrgFlags): WidgetCatalogEntry[] {
  return HEAD_WIDGETS
    .filter(d => !d.requires || d.requires(flags))
    .map(d => ({ template: toWidget(d), icon: d.icon, description: d.description, groupLabel: d.groupLabel }))
}

export function renderHeadWidget(i: string): React.ReactNode {
  return HEAD_WIDGETS.find(d => d.i === i)?.render() ?? null
}

function layoutOf(ids: string[]): DashboardWidget[] {
  let y = 0
  let rowX = 0
  let rowH = 0
  const out: DashboardWidget[] = []
  const wrap = () => { y += rowH; rowX = 0; rowH = 0 }

  ids.forEach(id => {
    const def = HEAD_WIDGETS.find(d => d.i === id)
    if (!def) return
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
 * Bố cục mặc định — CỐ TÌNH ngắn, gói trong hai hàng.
 *
 * <p>Trưởng đơn vị mở trang chủ để trả lời hai câu: "tôi phải duyệt gì" và "chỗ nào đang cháy".
 * Hàng một là sức khoẻ đơn vị cạnh hàng đợi phê duyệt; hàng hai là hai nguồn rủi ro khác nhau —
 * chỉ tiêu quá hạn (theo việc) và thành viên cần chú ý (theo người).
 *
 * <p>Bảng "Hiệu suất đội ngũ" CỐ Ý không nằm mặc định: nó là bảng tra cứu để lật từng trang,
 * không phải thứ liếc một cái là ra thông tin, mà lại chiếm gần một màn hình.
 */
export function getHeadDefaultLayout(flags: OrgFlags): DashboardWidget[] {
  const base = layoutOf([
    'head-stats', 'head-queue',
    'head-overdue-kpis', 'head-at-risk',
  ])
  return base.length ? base : getHeadWidgets(flags)
}

export function getHeadPresets(): LayoutPreset[] {
  return [
    {
      key: 'operations',
      label: 'Vận hành hằng ngày',
      description: 'Ưu tiên hàng đợi phê duyệt, việc quá hạn và người chưa nộp.',
      widgets: layoutOf(['head-stats', 'head-queue', 'head-overdue-kpis', 'head-no-submission', 'head-rejected-kpi', 'head-team-deadline', 'head-at-risk']),
    },
    {
      key: 'people',
      label: 'Quản trị nhân sự',
      description: 'Nhấn vào phân bố điểm, độ phủ KPI và hiệu suất từng thành viên.',
      widgets: layoutOf(['head-stats', 'head-score-distribution', 'head-coverage', 'head-team']),
    },
    {
      key: 'result',
      label: 'Kết quả chỉ tiêu',
      description: 'Nhấn vào tiến độ từng chỉ tiêu và vị trí đơn vị so với đơn vị khác.',
      widgets: layoutOf(['head-stats', 'head-unit-kpis', 'head-benchmark', 'head-team-deadline']),
    },
    {
      key: 'minimal',
      label: 'Tối giản',
      description: 'Chỉ sức khoẻ đơn vị, hàng đợi và bảng đội ngũ.',
      widgets: layoutOf(['head-stats', 'head-queue', 'head-team']),
    },
  ]
}
