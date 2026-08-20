import {
  Building2, Users, Award, FileText, Target, AlertCircle, CheckCircle, LineChart,
  BarChart2, ShieldAlert, Wallet, UsersRound, Timer,
  Bell, Gift, HandCoins, Sparkles, Compass, AlertOctagon, Landmark, Grid3x3,
  ClipboardList, Trophy,
} from 'lucide-react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetCatalogEntry, LayoutPreset } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { AnalyticsWidget } from './shared/AnalyticsWidget'
import type { OrgFlags } from './staffCatalog'
import {
  DirectorStatsWidget, DirectorAlertsWidget, DirectorCompletionWidget, DirectorSubmissionsWidget,
  DirectorTopWidget, DirectorUnitsWidget, DirectorEmployeesWidget, DirectorEvalProgressWidget,
} from './director/DirectorWidgets'
import {
  DirectorPeriodTrendWidget, DirectorScoreDistributionWidget, DirectorEvalBlockersWidget,
  DirectorCoverageWidget, DirectorOverdueWidget, DirectorRewardBudgetWidget,
} from './director/DirectorExtraWidgets'
import {
  DirectorSepayQueueWidget, DirectorCashSummaryWidget, DirectorMatrixWidget,
} from './director/DirectorOpsWidgets'
import {
  NotificationsWidget, RewardGrantsPendingWidget, RedemptionQueueWidget,
  AiQuotaOverviewWidget, BscBalanceWidget, OkrObjectivesWidget,
} from './shared/OpsWidgets'
import {
  CycleUnitStatusWidget, CycleUserRankingWidget, RewardLeaderboardWidget, RewardMonthlyWidget,
} from './shared/CycleRewardWidgets'
import { useDirectorDashboard } from '../context/DirectorDashboardContext'

const GROUP = {
  overview: 'Tổng quan',
  action: 'Cần xử lý',
  risk: 'Rủi ro',
  people: 'Con người',
  unit: 'Đơn vị',
  trend: 'Xu hướng & Biểu đồ',
  utility: 'Tiện ích',
} as const

interface DirectorWidgetDef {
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

const DIRECTOR_WIDGETS: DirectorWidgetDef[] = [
  // ── Tổng quan ──
  {
    i: 'dir-stats', title: 'Chỉ số tổ chức', groupLabel: GROUP.overview,
    description: 'Phòng ban, nhân sự, chỉ tiêu KPI và tỷ lệ quá hạn.',
    icon: <Building2 size={20} />, w: 12, h: 5, render: () => <DirectorStatsWidget />,
  },
  {
    i: 'dir-period-trend', title: 'Xu hướng qua các kỳ', groupLabel: GROUP.overview,
    description: 'Kỳ này so với các kỳ trước — hoàn thành và hiệu suất, kèm chênh lệch.',
    icon: <LineChart size={20} />, w: 7, h: 13, render: () => <DirectorPeriodTrendWidget />,
  },
  {
    i: 'dir-completion', title: 'Tỷ lệ hoàn thành', groupLabel: GROUP.overview,
    description: 'Tỷ lệ toàn công ty và phân rã theo từng đơn vị.',
    icon: <Target size={20} />, w: 5, h: 13, render: () => <DirectorCompletionWidget />,
  },
  {
    i: 'dir-submissions', title: 'Phân tích bài nộp', groupLabel: GROUP.overview,
    description: 'Tỷ trọng bài đã duyệt / chờ duyệt / bị từ chối.',
    icon: <FileText size={20} />, w: 7, h: 13, render: () => <DirectorSubmissionsWidget />,
  },

  // ── Rủi ro ──
  {
    i: 'dir-alerts', title: 'Cảnh báo nghiêm trọng', groupLabel: GROUP.risk,
    description: 'Mọi tín hiệu tiêu cực đã xếp hạng ưu tiên: cần gấp, cần xem xét, theo dõi.',
    icon: <AlertCircle size={20} />, w: 12, h: 16, render: () => <DirectorAlertsWidget />,
  },
  {
    i: 'dir-overdue', title: 'Tỷ lệ KPI quá hạn', groupLabel: GROUP.risk,
    description: 'Mức quá hạn toàn tổ chức và danh sách đơn vị rủi ro cao.',
    icon: <ShieldAlert size={20} />, w: 4, h: 13, render: () => <DirectorOverdueWidget />,
  },

  // ── Đơn vị ──
  {
    i: 'dir-eval-progress', title: 'Tiến độ chấm điểm', groupLabel: GROUP.unit,
    description: 'Bao nhiêu nhân sự đã được chấm trong kỳ đang chạy, còn lại bao nhiêu.',
    icon: <CheckCircle size={20} />, w: 4, h: 11, render: () => <DirectorEvalProgressWidget />,
  },
  {
    i: 'dir-eval-blockers', title: 'Đơn vị chưa chấm xong', groupLabel: GROUP.unit,
    description: 'Đơn vị nào đang chặn việc chốt kỳ, và còn thiếu bao nhiêu người.',
    icon: <Timer size={20} />, w: 4, h: 13, render: () => <DirectorEvalBlockersWidget />,
  },
  {
    i: 'dir-units', title: 'Cơ cấu đơn vị', groupLabel: GROUP.unit,
    description: 'Lưới các đơn vị kèm tiến độ và lối vào trang quản lý từng đơn vị.',
    icon: <Building2 size={20} />, w: 12, h: 20, render: () => <DirectorUnitsWidget />,
  },

  // ── Con người ──
  {
    i: 'dir-score-distribution', title: 'Phân bố điểm toàn công ty', groupLabel: GROUP.people,
    description: 'Tổ chức đang đồng đều hay phân hoá — điều mà điểm trung bình che mất.',
    icon: <BarChart2 size={20} />, w: 4, h: 13, render: () => <DirectorScoreDistributionWidget />,
  },
  {
    i: 'dir-coverage', title: 'Độ phủ giao KPI', groupLabel: GROUP.people,
    description: 'Ai chưa được giao KPI nào, phân rã theo đơn vị.',
    icon: <UsersRound size={20} />, w: 4, h: 15, render: () => <DirectorCoverageWidget />,
  },
  {
    i: 'dir-top', title: 'Top hiệu suất', groupLabel: GROUP.people,
    description: '5 nhân sự điểm cao nhất, bấm để xem chi tiết bài nộp.',
    icon: <Award size={20} />, w: 12, h: 17, render: () => <DirectorTopWidget />,
  },
  {
    i: 'dir-employees', title: 'Quản lý nhân sự', groupLabel: GROUP.people,
    description: 'Bảng nhân sự có tìm kiếm, lọc đơn vị, nhắc nhở và xuất Excel.',
    icon: <Users size={20} />, w: 12, h: 24, render: () => <DirectorEmployeesWidget />,
  },

  {
    i: 'dir-matrix', title: 'Xếp loại ma trận hiệu suất', groupLabel: GROUP.people,
    description: 'Phân bố 9-box/25-box: tổ chức đang tập trung ở ô nào.',
    icon: <Grid3x3 size={20} />, w: 4, h: 15, render: () => <DirectorMatrixWidget />,
  },
  {
    i: 'dir-bsc', title: 'Điểm BSC toàn tổ chức', groupLabel: GROUP.overview,
    description: 'Điểm từng viễn cảnh BSC và số KPI chưa gắn viễn cảnh.',
    icon: <Compass size={20} />, w: 4, h: 14,
    requires: f => f.enableBsc,
    render: () => <BscBalanceWidget title="Điểm BSC toàn tổ chức" />,
  },
  {
    i: 'dir-okr', title: 'Objective cấp công ty', groupLabel: GROUP.overview,
    description: 'Tiến độ từng Objective và cái nào chưa tiến triển.',
    icon: <Target size={20} />, w: 8, h: 14,
    requires: f => f.enableOkr,
    render: () => <DirectorOkrWidget />,
  },

  {
    i: 'dir-cycle-status', title: 'Trạng thái chốt kỳ theo đơn vị', groupLabel: GROUP.unit,
    description: 'Đơn vị nào đã chốt đánh giá kỳ, đơn vị nào đang chặn việc chốt.',
    icon: <ClipboardList size={20} />, w: 6, h: 14, render: () => <CycleUnitStatusWidget title="Trạng thái chốt kỳ theo đơn vị" />,
  },
  {
    i: 'dir-cycle-ranking', title: 'Xếp hạng chốt kỳ', groupLabel: GROUP.people,
    description: 'Xếp hạng nhân sự theo điểm chốt kỳ, kèm số người chưa có điểm.',
    icon: <Trophy size={20} />, w: 6, h: 14, render: () => <CycleUserRankingWidget title="Xếp hạng chốt kỳ" />,
  },
  {
    i: 'dir-reward-leaderboard', title: 'Nhận thưởng nhiều nhất', groupLabel: GROUP.utility,
    description: 'Ai được thưởng nhiều điểm nhất trong kỳ đang chạy.',
    icon: <HandCoins size={20} />, w: 4, h: 13,
    requires: f => f.enableReward,
    render: () => <RewardLeaderboardWidget />,
  },
  {
    i: 'dir-reward-monthly', title: 'Điểm phát ra / tiêu đi', groupLabel: GROUP.utility,
    description: 'Điểm thưởng phát và tiêu theo từng tháng trong 6 tháng gần nhất.',
    icon: <LineChart size={20} />, w: 4, h: 13,
    requires: f => f.enableReward,
    render: () => <RewardMonthlyWidget />,
  },

  // ── Cần xử lý ngay ──
  {
    i: 'dir-reward-pending', title: 'Đề nghị thưởng chờ duyệt', groupLabel: GROUP.action,
    description: 'Đề nghị vượt hạn mức đang chờ quyết định của bạn.',
    icon: <HandCoins size={20} />, w: 6, h: 12,
    requires: f => f.enableReward,
    render: () => <RewardGrantsPendingWidget />,
  },
  {
    i: 'dir-sepay-queue', title: 'Nạp tiền chưa đối soát', groupLabel: GROUP.action,
    description: 'Giao dịch SePay chưa khớp lệnh hoặc lệch số tiền — tiền đang treo.',
    icon: <AlertOctagon size={20} />, w: 6, h: 12,
    requires: f => f.enableCashWallet,
    render: () => <DirectorSepayQueueWidget />,
  },
  {
    i: 'dir-redemptions', title: 'Đơn đổi quà chờ xử lý', groupLabel: GROUP.action,
    description: 'Yêu cầu đổi quà đang chờ duyệt hoặc giao.',
    icon: <Gift size={20} />, w: 6, h: 12,
    requires: f => f.enableReward,
    render: () => <RedemptionQueueWidget />,
  },
  {
    i: 'dir-notifications', title: 'Thông báo', groupLabel: GROUP.utility,
    description: 'Số thông báo chưa đọc và lối vào trang thông báo.',
    icon: <Bell size={20} />, w: 4, h: 8, render: () => <NotificationsWidget />,
  },

  // ── Tiện ích ──
  {
    i: 'dir-cash-summary', title: 'Dòng tiền ví', groupLabel: GROUP.utility,
    description: 'Tổng số dư, đã nạp và đã quy đổi điểm toàn tổ chức.',
    icon: <Landmark size={20} />, w: 4, h: 13,
    requires: f => f.enableCashWallet,
    render: () => <DirectorCashSummaryWidget />,
  },
  {
    i: 'dir-ai-quota', title: 'Hạn mức AI toàn tổ chức', groupLabel: GROUP.utility,
    description: 'Ngân sách token công ty, đã phân bổ bao nhiêu và ai dùng nhiều nhất.',
    icon: <Sparkles size={20} />, w: 4, h: 15,
    requires: f => f.enableAi,
    render: () => <AiQuotaOverviewWidget />,
  },
  {
    i: 'dir-reward-budget', title: 'Ngân sách thưởng', groupLabel: GROUP.utility,
    description: 'Đã dùng bao nhiêu trên tổng điểm thưởng được phân bổ.',
    icon: <Wallet size={20} />, w: 4, h: 11,
    requires: f => f.enableReward,
    render: () => <DirectorRewardBudgetWidget />,
  },

  // ── Biểu đồ từ trang Thống kê ──
  {
    i: 'trend-chart', title: 'Xu hướng KPI theo thời gian', groupLabel: GROUP.trend,
    description: 'Biểu đồ xu hướng KPI đơn vị, lấy từ trang Thống kê.',
    icon: <LineChart size={20} />, w: 12, h: 15,
    render: () => <AnalyticsWidget id="trend-chart" title="Xu hướng KPI theo thời gian" />,
  },
  {
    i: 'unit-perf', title: 'Hiệu suất & tiến độ đơn vị', groupLabel: GROUP.trend,
    description: 'So sánh hiệu suất giữa các đơn vị, lấy từ trang Thống kê.',
    icon: <LineChart size={20} />, w: 12, h: 13,
    render: () => <AnalyticsWidget id="unit-perf" title="Hiệu suất & tiến độ đơn vị" />,
  },
  {
    i: 'member-dist', title: 'Nhân sự & vai trò', groupLabel: GROUP.people,
    description: 'Cơ cấu nhân sự theo vai trò, lấy từ trang Thống kê.',
    icon: <Users size={20} />, w: 12, h: 11,
    render: () => <AnalyticsWidget id="member-dist" title="Nhân sự & vai trò" />,
  },
  {
    i: 'unit-risk', title: 'Rủi ro đơn vị', groupLabel: GROUP.risk,
    description: 'Đơn vị có tỷ lệ quá hạn cao, lấy từ trang Thống kê.',
    icon: <AlertCircle size={20} />, w: 12, h: 11,
    render: () => <AnalyticsWidget id="unit-risk" title="Rủi ro đơn vị" />,
  },
  {
    i: 'warning-list', title: 'Rủi ro thành viên', groupLabel: GROUP.risk,
    description: 'Thành viên có KPI quá hạn, lấy từ trang Thống kê.',
    icon: <AlertCircle size={20} />, w: 12, h: 11,
    render: () => <AnalyticsWidget id="warning-list" title="Rủi ro thành viên" />,
  },
  {
    i: 'rank-table', title: 'Bảng xếp hạng nhân sự', groupLabel: GROUP.people,
    description: 'Bảng xếp hạng đầy đủ, lấy từ trang Thống kê.',
    icon: <Award size={20} />, w: 12, h: 13,
    render: () => <AnalyticsWidget id="rank-table" title="Bảng xếp hạng nhân sự" />,
  },
]

/** OKR cấp công ty cần organizationId, lấy từ context thay vì bắt widget tự tra. */
function DirectorOkrWidget() {
  const { organization } = useDirectorDashboard()
  return <OkrObjectivesWidget scope="organization" id={organization?.id} title="Objective cấp công ty" />
}

const toWidget = (d: DirectorWidgetDef, x = 0, y = 0): DashboardWidget => ({
  i: d.i, type: d.i, title: d.title, x, y, w: d.w, h: d.h, visible: true,
})

export function getDirectorWidgets(flags: OrgFlags): DashboardWidget[] {
  return DIRECTOR_WIDGETS.filter(d => !d.requires || d.requires(flags)).map(d => toWidget(d))
}

export function getDirectorCatalog(flags: OrgFlags): WidgetCatalogEntry[] {
  return DIRECTOR_WIDGETS
    .filter(d => !d.requires || d.requires(flags))
    .map(d => ({ template: toWidget(d), icon: d.icon, description: d.description, groupLabel: d.groupLabel }))
}

export function renderDirectorWidget(i: string): React.ReactNode {
  return DIRECTOR_WIDGETS.find(d => d.i === i)?.render() ?? null
}

function layoutOf(ids: string[]): DashboardWidget[] {
  let y = 0
  let rowX = 0
  let rowH = 0
  const out: DashboardWidget[] = []
  const wrap = () => { y += rowH; rowX = 0; rowH = 0 }

  ids.forEach(id => {
    const def = DIRECTOR_WIDGETS.find(d => d.i === id)
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
 * Bố cục mặc định — CỐ TÌNH ngắn, gói trong ba hàng.
 *
 * <p>Thứ tự bám đúng cách giám đốc đọc: chỉ số tổ chức → CHỖ NÀO ĐANG CHÁY (cảnh báo đã xếp
 * hạng ưu tiên, đặt ngay trên màn hình đầu) → rồi mới tới bối cảnh (xu hướng qua các kỳ và
 * phân rã theo đơn vị).
 *
 * <p>"Top hiệu suất" và "Quản lý nhân sự" CỐ Ý không nằm mặc định: cả hai là bảng dài để tra
 * cứu, cộng lại chiếm hơn một màn hình rưỡi mà không trả lời câu hỏi nào cấp bách.
 */
export function getDirectorDefaultLayout(flags: OrgFlags): DashboardWidget[] {
  const base = layoutOf([
    'dir-stats',
    'dir-alerts',
    'dir-period-trend', 'dir-completion',
  ])
  return base.length ? base : getDirectorWidgets(flags)
}

export function getDirectorPresets(): LayoutPreset[] {
  return [
    {
      key: 'executive',
      label: 'Điều hành',
      description: 'Nhấn vào xu hướng kỳ, cảnh báo và mức quá hạn toàn tổ chức.',
      widgets: layoutOf(['dir-stats', 'dir-period-trend', 'dir-overdue', 'dir-reward-pending', 'dir-sepay-queue', 'dir-alerts']),
    },
    {
      key: 'closing',
      label: 'Chốt kỳ',
      description: 'Dành cho lúc sắp hết kỳ: ai chưa chấm xong, đơn vị nào đang chặn.',
      widgets: layoutOf(['dir-stats', 'dir-cycle-status', 'dir-eval-blockers', 'dir-cycle-ranking', 'dir-coverage', 'dir-employees']),
    },
    {
      key: 'people',
      label: 'Nhân sự',
      description: 'Nhấn vào phân bố điểm, top hiệu suất và bảng nhân sự.',
      widgets: layoutOf(['dir-stats', 'dir-score-distribution', 'dir-coverage', 'dir-top', 'dir-employees']),
    },
    {
      key: 'minimal',
      label: 'Tối giản',
      description: 'Chỉ chỉ số chính và cảnh báo nghiêm trọng.',
      widgets: layoutOf(['dir-stats', 'dir-alerts']),
    },
  ]
}
