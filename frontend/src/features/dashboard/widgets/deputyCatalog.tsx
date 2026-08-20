import {
  Gauge, Users, CalendarClock, FileWarning, Target, History, Trophy, Layers,
  Bell, Sparkles, Compass, Coins, Banknote, Flame, AlertTriangle, PiggyBank, HandCoins, Gift,
} from 'lucide-react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetCatalogEntry, LayoutPreset } from '@/components/common/dashboard/DashboardCustomizeChrome'
import type { OrgFlags } from './staffCatalog'
import { useDeputyDashboard } from '../context/DeputyDashboardContext'
import {
  DeputyScopeOverviewWidget, DeputyScopeKpisWidget, DeputyScopeMembersWidget,
  DeputyScopeDeadlineWidget, DeputyPendingKpisWidget,
} from './deputy/DeputyWidgets'
import {
  StaffDeadlineWidget, StaffRejectedWidget, StaffTasksWidget,
} from './staff/StaffWidgets'
import {
  StaffKpiProgressWidget, StaffScoreHistoryWidget, StaffCheckinWidget, StaffWalletWidget,
} from './staff/StaffExtraWidgets'
import {
  StaffCashWalletWidget, StaffAiUsageWidget, StaffBscWidget, StaffOkrWidget,
} from './staff/StaffFinanceWidgets'
import { StaffScoreBreakdownWidget } from './staff/StaffScoreBreakdownWidget'
import { NotificationsWidget, RewardGrantsPendingWidget, RedemptionQueueWidget } from './shared/OpsWidgets'
import { CycleUserRankingWidget } from './shared/CycleRewardWidgets'
import { HeadMyBudgetWidget } from './head/HeadOpsWidgets'

/**
 * Danh mục widget của PHÓ ĐƠN VỊ.
 *
 * <p>Nguyên tắc phân biệt với trưởng đơn vị:
 * <ul>
 *   <li>Phạm vi hẹp hơn — chỉ mảng Phó được giao đảm nhiệm, không phải toàn đơn vị.</li>
 *   <li>Không có widget "duyệt cuối" của trưởng đơn vị (hàng đợi phê duyệt đơn vị,
 *       độ phủ giao KPI, bảng nhân sự toàn đơn vị). Những thứ đó không thuộc thẩm quyền
 *       của Phó nên hiện ra chỉ tạo kỳ vọng sai.</li>
 *   <li>Widget cá nhân giữ nguyên như nhân viên — Phó vẫn có KPI của riêng mình.</li>
 * </ul>
 */
const GROUP = {
  scope: 'Mảng tôi phụ trách',
  personal: 'Việc của tôi',
  result: 'Kết quả của tôi',
  utility: 'Thưởng & Tiện ích',
} as const

interface DeputyWidgetDef {
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

/** Đề nghị thưởng: Phó chỉ thấy khi thật sự có quyền duyệt, ngược lại là kỳ vọng sai. */
function DeputyRewardApprovalWidget() {
  const { canApproveReward } = useDeputyDashboard()
  if (!canApproveReward) return null
  return <RewardGrantsPendingWidget />
}

function DeputyRedemptionWidget() {
  const { canApproveReward } = useDeputyDashboard()
  if (!canApproveReward) return null
  return <RedemptionQueueWidget />
}

const DEPUTY_WIDGETS: DeputyWidgetDef[] = [
  // ── Mảng tôi phụ trách ──
  {
    i: 'deputy-scope', title: 'Mảng tôi phụ trách', groupLabel: GROUP.scope,
    description: 'Số chỉ tiêu, số người và tiến độ nộp báo cáo trung bình của mảng.',
    icon: <Gauge size={20} />, w: 5, h: 12, render: () => <DeputyScopeOverviewWidget />,
  },
  {
    i: 'deputy-scope-kpis', title: 'Tiến độ nộp báo cáo trong mảng', groupLabel: GROUP.scope,
    description: 'Từng chỉ tiêu trong mảng đã nộp bao nhiêu kỳ báo cáo trên số kỳ yêu cầu.',
    icon: <Gauge size={20} />, w: 7, h: 12, render: () => <DeputyScopeKpisWidget />,
  },
  {
    i: 'deputy-scope-deadline', title: 'Mảng sắp đến hạn', groupLabel: GROUP.scope,
    description: 'Chỉ tiêu trong mảng quá hạn hoặc hết hạn trong 7 ngày tới.',
    icon: <CalendarClock size={20} />, w: 6, h: 12, render: () => <DeputyScopeDeadlineWidget />,
  },
  {
    i: 'deputy-pending', title: 'Chỉ tiêu đang vướng', groupLabel: GROUP.scope,
    description: 'Chỉ tiêu trong mảng đang chờ duyệt hoặc bị trả lại, kèm người duyệt.',
    icon: <FileWarning size={20} />, w: 6, h: 12, render: () => <DeputyPendingKpisWidget />,
  },
  {
    i: 'deputy-members', title: 'Người trong mảng của tôi', groupLabel: GROUP.scope,
    description: 'Những người cùng đảm nhiệm chỉ tiêu với bạn — không phải toàn bộ đơn vị.',
    icon: <Users size={20} />, w: 6, h: 13, render: () => <DeputyScopeMembersWidget />,
  },

  // ── Việc của tôi ──
  {
    i: 'deputy-my-deadline', title: 'Việc của tôi sắp đến hạn', groupLabel: GROUP.personal,
    description: 'KPI cá nhân quá hạn và hết hạn trong 7 ngày tới.',
    icon: <CalendarClock size={20} />, w: 6, h: 12, render: () => <StaffDeadlineWidget />,
  },
  {
    i: 'deputy-my-rejected', title: 'Cần sửa & nộp lại', groupLabel: GROUP.personal,
    description: 'Bài nộp của bạn bị từ chối kèm lý do.',
    icon: <AlertTriangle size={20} />, w: 4, h: 11, render: () => <StaffRejectedWidget />,
  },
  {
    i: 'deputy-my-tasks', title: 'Nhiệm vụ còn lại', groupLabel: GROUP.personal,
    description: 'KPI cá nhân chưa tới hạn gấp.',
    icon: <Target size={20} />, w: 8, h: 13, render: () => <StaffTasksWidget />,
  },

  // ── Kết quả của tôi ──
  {
    i: 'deputy-my-kpi-progress', title: 'Tiến độ chỉ tiêu của tôi', groupLabel: GROUP.result,
    description: 'Từng chỉ tiêu cá nhân đã đạt bao nhiêu trên mục tiêu.',
    icon: <Gauge size={20} />, w: 8, h: 13, render: () => <StaffKpiProgressWidget />,
  },
  {
    i: 'deputy-my-breakdown', title: 'Điểm gần nhất cấu thành thế nào', groupLabel: GROUP.result,
    description: 'Tách riêng điểm hệ thống, hành vi, BSC và mức hoàn thành KPI.',
    icon: <Layers size={20} />, w: 4, h: 15, render: () => <StaffScoreBreakdownWidget />,
  },
  {
    i: 'deputy-my-score-history', title: 'Điểm được chấm gần đây', groupLabel: GROUP.result,
    description: 'Lịch sử điểm quản lý chấm cho bạn, kèm nhận xét và xu hướng.',
    icon: <History size={20} />, w: 4, h: 13, render: () => <StaffScoreHistoryWidget />,
  },
  {
    i: 'deputy-cycle-ranking', title: 'Xếp hạng chốt kỳ', groupLabel: GROUP.result,
    description: 'Vị trí của bạn trong bảng xếp hạng điểm chốt kỳ.',
    icon: <Trophy size={20} />, w: 8, h: 13, render: () => <CycleUserRankingWidget title="Xếp hạng chốt kỳ" />,
  },
  {
    i: 'deputy-bsc', title: 'Điểm BSC theo viễn cảnh', groupLabel: GROUP.result,
    description: 'Điểm từng viễn cảnh BSC và trọng số tương ứng.',
    icon: <Compass size={20} />, w: 4, h: 12,
    requires: f => f.enableBsc,
    render: () => <StaffBscWidget />,
  },
  {
    i: 'deputy-okr', title: 'Key Result tôi đóng góp', groupLabel: GROUP.result,
    description: 'Tiến độ các Key Result của đơn vị mà bạn góp phần.',
    icon: <Target size={20} />, w: 8, h: 13,
    requires: f => f.enableOkr,
    render: () => <StaffOkrWidget />,
  },

  // ── Thưởng & Tiện ích ──
  {
    i: 'deputy-reward-pending', title: 'Đề nghị thưởng chờ duyệt', groupLabel: GROUP.utility,
    description: 'Chỉ hiện khi bạn thật sự có quyền duyệt thưởng.',
    icon: <HandCoins size={20} />, w: 6, h: 12,
    requires: f => f.enableReward,
    render: () => <DeputyRewardApprovalWidget />,
  },
  {
    i: 'deputy-redemptions', title: 'Đơn đổi quà chờ xử lý', groupLabel: GROUP.utility,
    description: 'Chỉ hiện khi bạn thật sự có quyền duyệt thưởng.',
    icon: <Gift size={20} />, w: 6, h: 12,
    requires: f => f.enableReward,
    render: () => <DeputyRedemptionWidget />,
  },
  {
    i: 'deputy-my-budget', title: 'Ngân sách thưởng của tôi', groupLabel: GROUP.utility,
    description: 'Điểm thưởng bạn còn được trao trong kỳ này.',
    icon: <PiggyBank size={20} />, w: 4, h: 11,
    requires: f => f.enableReward,
    render: () => <HeadMyBudgetWidget />,
  },
  {
    i: 'deputy-checkin', title: 'Điểm danh hôm nay', groupLabel: GROUP.utility,
    description: 'Chuỗi ngày liên tiếp và nút điểm danh nhận điểm.',
    icon: <Flame size={20} />, w: 4, h: 10,
    requires: f => f.enableReward,
    render: () => <StaffCheckinWidget />,
  },
  {
    i: 'deputy-wallet', title: 'Điểm thưởng của tôi', groupLabel: GROUP.utility,
    description: 'Số điểm khả dụng và tổng tích luỹ.',
    icon: <Coins size={20} />, w: 4, h: 10,
    requires: f => f.enableReward,
    render: () => <StaffWalletWidget />,
  },
  {
    i: 'deputy-cash-wallet', title: 'Ví tiền của tôi', groupLabel: GROUP.utility,
    description: 'Số dư, điểm quy đổi được và trạng thái lệnh nạp.',
    icon: <Banknote size={20} />, w: 4, h: 11,
    requires: f => f.enableCashWallet,
    render: () => <StaffCashWalletWidget />,
  },
  {
    i: 'deputy-ai-usage', title: 'Hạn mức AI của tôi', groupLabel: GROUP.utility,
    description: 'Token đã dùng trong tháng so với hạn mức được cấp.',
    icon: <Sparkles size={20} />, w: 4, h: 10,
    requires: f => f.enableAi,
    render: () => <StaffAiUsageWidget />,
  },
  {
    i: 'deputy-notifications', title: 'Thông báo', groupLabel: GROUP.utility,
    description: 'Số thông báo chưa đọc và lối vào trang thông báo.',
    icon: <Bell size={20} />, w: 4, h: 8, render: () => <NotificationsWidget />,
  },
]

const toWidget = (d: DeputyWidgetDef, x = 0, y = 0): DashboardWidget => ({
  i: d.i, type: d.i, title: d.title, x, y, w: d.w, h: d.h, visible: true,
})

export function getDeputyWidgets(flags: OrgFlags): DashboardWidget[] {
  return DEPUTY_WIDGETS.filter(d => !d.requires || d.requires(flags)).map(d => toWidget(d))
}

export function getDeputyCatalog(flags: OrgFlags): WidgetCatalogEntry[] {
  return DEPUTY_WIDGETS
    .filter(d => !d.requires || d.requires(flags))
    .map(d => ({ template: toWidget(d), icon: d.icon, description: d.description, groupLabel: d.groupLabel }))
}

export function renderDeputyWidget(i: string): React.ReactNode {
  return DEPUTY_WIDGETS.find(d => d.i === i)?.render() ?? null
}

function layoutOf(ids: string[]): DashboardWidget[] {
  let y = 0
  let rowX = 0
  let rowH = 0
  const out: DashboardWidget[] = []
  const wrap = () => { y += rowH; rowX = 0; rowH = 0 }

  ids.forEach(id => {
    const def = DEPUTY_WIDGETS.find(d => d.i === id)
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
 * <p>Phó đeo hai vai cùng lúc, nên mỗi vai được đúng một hàng: hàng một là mảng phụ trách
 * (tổng quan + tiến độ từng chỉ tiêu), hàng hai đặt cạnh nhau việc của mảng và việc của
 * chính mình — để không quên vai nào.
 */
export function getDeputyDefaultLayout(flags: OrgFlags): DashboardWidget[] {
  const base = layoutOf([
    'deputy-scope', 'deputy-scope-kpis',
    'deputy-scope-deadline', 'deputy-my-deadline',
  ])
  return base.length ? base : getDeputyWidgets(flags)
}

export function getDeputyPresets(): LayoutPreset[] {
  return [
    {
      key: 'scope',
      label: 'Bám mảng phụ trách',
      description: 'Tập trung vào chỉ tiêu, người và deadline của mảng bạn quản.',
      widgets: layoutOf(['deputy-scope', 'deputy-scope-kpis', 'deputy-scope-deadline', 'deputy-pending', 'deputy-members']),
    },
    {
      key: 'personal',
      label: 'Việc của tôi',
      description: 'Ưu tiên KPI cá nhân và kết quả đánh giá của chính bạn.',
      widgets: layoutOf(['deputy-my-deadline', 'deputy-my-rejected', 'deputy-my-kpi-progress', 'deputy-my-breakdown', 'deputy-my-tasks']),
    },
    {
      key: 'minimal',
      label: 'Tối giản',
      description: 'Chỉ tổng quan mảng và việc cá nhân sắp đến hạn.',
      widgets: layoutOf(['deputy-scope', 'deputy-my-deadline']),
    },
  ]
}
