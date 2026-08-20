import {
  Target, CalendarClock, Zap, AlertTriangle, FileText, TrendingUp,
  Gauge, History, Trophy, Flame, Coins, Bell, CalendarPlus,
  Banknote, Gift, Sparkles, Compass, Layers, Trophy as TrophyIcon,
} from 'lucide-react'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetCatalogEntry, LayoutPreset } from '@/components/common/dashboard/DashboardCustomizeChrome'
import { AnalyticsWidget } from './shared/AnalyticsWidget'
import {
  StaffStatsWidget, StaffPeriodWidget, StaffDeadlineWidget,
  StaffRejectedWidget, StaffTasksWidget, StaffHistoryWidget,
} from './staff/StaffWidgets'
import {
  StaffKpiProgressWidget, StaffScoreHistoryWidget, StaffMyRankWidget,
  StaffCheckinWidget, StaffWalletWidget, StaffUpcomingWidget, StaffNotificationsWidget,
} from './staff/StaffExtraWidgets'
import {
  StaffCashWalletWidget, StaffRedemptionWidget, StaffAiUsageWidget,
  StaffBscWidget, StaffOkrWidget,
} from './staff/StaffFinanceWidgets'
import { StaffScoreBreakdownWidget } from './staff/StaffScoreBreakdownWidget'
import { CycleUserRankingWidget } from './shared/CycleRewardWidgets'

/** Nhãn nhóm trong thư viện widget — gom theo câu hỏi người dùng đang muốn trả lời. */
const GROUP = {
  overview: 'Tổng quan',
  action: 'Cần xử lý',
  result: 'Kết quả của tôi',
  trend: 'Xu hướng & Biểu đồ',
  utility: 'Tiện ích',
} as const

interface StaffWidgetDef {
  i: string
  title: string
  description: string
  groupLabel: string
  icon: React.ReactNode
  /** Kích thước mặc định trên lưới 12 cột, `h` tính theo hàng 32px. */
  w: number
  h: number
  render: () => React.ReactNode
  /** Cờ tổ chức bắt buộc để widget xuất hiện. */
  requires?: (flags: OrgFlags) => boolean
}

export interface OrgFlags {
  enableOkr: boolean
  enableBsc: boolean
  enableReward: boolean
  enableQualitative: boolean
  enableCashWallet: boolean
  enableAi: boolean
}

const STAFF_WIDGETS: StaffWidgetDef[] = [
  // ── Tổng quan ──
  {
    i: 'staff-stats', title: 'Chỉ số của tôi', groupLabel: GROUP.overview,
    description: 'Mục tiêu hoàn thành, quá hạn, tỷ lệ duyệt, tiến độ chỉ tiêu và điểm trung bình.',
    icon: <Target size={20} />, w: 12, h: 5, render: () => <StaffStatsWidget />,
  },
  {
    i: 'staff-period', title: 'Kỳ đánh giá', groupLabel: GROUP.overview,
    description: 'Còn bao nhiêu ngày, và bạn đang nhanh hay chậm so với tiến độ thời gian.',
    icon: <CalendarClock size={20} />, w: 4, h: 10, render: () => <StaffPeriodWidget />,
  },

  // ── Cần xử lý ──
  {
    i: 'staff-deadline', title: 'Sắp đến hạn', groupLabel: GROUP.action,
    description: 'Việc quá hạn và việc hết hạn trong 7 ngày tới, kèm nút nộp ngay.',
    icon: <CalendarClock size={20} />, w: 8, h: 10, render: () => <StaffDeadlineWidget />,
  },
  {
    i: 'staff-rejected', title: 'Cần sửa & nộp lại', groupLabel: GROUP.action,
    description: 'Bài nộp bị từ chối kèm lý do, bấm vào để sửa ngay.',
    icon: <AlertTriangle size={20} />, w: 4, h: 12, render: () => <StaffRejectedWidget />,
  },
  {
    i: 'staff-tasks', title: 'Nhiệm vụ còn lại', groupLabel: GROUP.action,
    description: 'Các việc chưa tới hạn gấp — không lặp lại nội dung của "Sắp đến hạn".',
    icon: <Zap size={20} />, w: 8, h: 14, render: () => <StaffTasksWidget />,
  },
  {
    i: 'staff-upcoming', title: 'Sắp bắt đầu', groupLabel: GROUP.action,
    description: 'Chỉ tiêu sẽ mở trong thời gian tới, để bạn chuẩn bị trước.',
    icon: <CalendarPlus size={20} />, w: 4, h: 11, render: () => <StaffUpcomingWidget />,
  },

  // ── Kết quả của tôi ──
  {
    i: 'staff-kpi-progress', title: 'Tiến độ chỉ tiêu của tôi', groupLabel: GROUP.result,
    description: 'Từng chỉ tiêu đã đạt bao nhiêu trên mục tiêu — số liệu thật, không phải số bài nộp.',
    icon: <Gauge size={20} />, w: 8, h: 12, render: () => <StaffKpiProgressWidget />,
  },
  {
    i: 'staff-score-history', title: 'Điểm được chấm gần đây', groupLabel: GROUP.result,
    description: 'Lịch sử điểm quản lý chấm cho bạn, kèm nhận xét và xu hướng.',
    icon: <History size={20} />, w: 4, h: 14, render: () => <StaffScoreHistoryWidget />,
  },
  {
    i: 'staff-score-breakdown', title: 'Điểm gần nhất cấu thành thế nào', groupLabel: GROUP.result,
    description: 'Tách riêng điểm hệ thống, hành vi, BSC và mức hoàn thành KPI để biết mất điểm ở đâu.',
    icon: <Layers size={20} />, w: 4, h: 15, render: () => <StaffScoreBreakdownWidget />,
  },
  {
    i: 'staff-my-rank', title: 'Vị trí của tôi', groupLabel: GROUP.result,
    description: 'Bạn đứng thứ mấy trong đơn vị và cách trung bình bao nhiêu điểm.',
    icon: <Trophy size={20} />, w: 4, h: 11, render: () => <StaffMyRankWidget />,
  },
  {
    i: 'staff-cycle-ranking', title: 'Xếp hạng chốt kỳ', groupLabel: GROUP.result,
    description: 'Vị trí của bạn trong bảng xếp hạng điểm chốt kỳ của đơn vị.',
    icon: <TrophyIcon size={20} />, w: 8, h: 13, render: () => <CycleUserRankingWidget title="Xếp hạng chốt kỳ" />,
  },
  {
    i: 'staff-history', title: 'Lịch sử cập nhật', groupLabel: GROUP.result,
    description: 'Nhật ký các báo cáo bạn gửi gần đây (không gồm bài bị từ chối).',
    icon: <FileText size={20} />, w: 4, h: 14, render: () => <StaffHistoryWidget />,
  },

  // ── Tiện ích ──
  {
    i: 'staff-checkin', title: 'Điểm danh hôm nay', groupLabel: GROUP.utility,
    description: 'Chuỗi ngày liên tiếp và nút điểm danh nhận điểm.',
    icon: <Flame size={20} />, w: 4, h: 10,
    requires: f => f.enableReward,
    render: () => <StaffCheckinWidget />,
  },
  {
    i: 'staff-wallet', title: 'Điểm thưởng của tôi', groupLabel: GROUP.utility,
    description: 'Số điểm khả dụng và tổng tích luỹ.',
    icon: <Coins size={20} />, w: 4, h: 10,
    requires: f => f.enableReward,
    render: () => <StaffWalletWidget />,
  },
  {
    i: 'staff-bsc', title: 'Điểm BSC theo viễn cảnh', groupLabel: GROUP.result,
    description: 'Điểm từng viễn cảnh BSC và trọng số tương ứng.',
    icon: <Compass size={20} />, w: 4, h: 12,
    requires: f => f.enableBsc,
    render: () => <StaffBscWidget />,
  },
  {
    i: 'staff-okr', title: 'Key Result tôi đóng góp', groupLabel: GROUP.result,
    description: 'Tiến độ các Key Result của đơn vị mà bạn góp phần.',
    icon: <Target size={20} />, w: 8, h: 13,
    requires: f => f.enableOkr,
    render: () => <StaffOkrWidget />,
  },
  {
    i: 'staff-cash-wallet', title: 'Ví tiền của tôi', groupLabel: GROUP.utility,
    description: 'Số dư, điểm quy đổi được và trạng thái lệnh nạp.',
    icon: <Banknote size={20} />, w: 4, h: 11,
    requires: f => f.enableCashWallet,
    render: () => <StaffCashWalletWidget />,
  },
  {
    i: 'staff-redemption', title: 'Đổi quà của tôi', groupLabel: GROUP.utility,
    description: 'Các đơn đổi quà gần đây và trạng thái xử lý.',
    icon: <Gift size={20} />, w: 4, h: 12,
    requires: f => f.enableReward,
    render: () => <StaffRedemptionWidget />,
  },
  {
    i: 'staff-ai-usage', title: 'Hạn mức AI của tôi', groupLabel: GROUP.utility,
    description: 'Token đã dùng trong tháng so với hạn mức được cấp.',
    icon: <Sparkles size={20} />, w: 4, h: 10,
    requires: f => f.enableAi,
    render: () => <StaffAiUsageWidget />,
  },
  {
    i: 'staff-notifications', title: 'Thông báo', groupLabel: GROUP.utility,
    description: 'Số thông báo chưa đọc và lối vào trang thông báo.',
    icon: <Bell size={20} />, w: 4, h: 8, render: () => <StaffNotificationsWidget />,
  },

  // ── Biểu đồ từ trang Thống kê ──
  {
    i: 'mykpi-trend', title: 'Xu hướng KPI theo thời gian', groupLabel: GROUP.trend,
    description: 'Biểu đồ xu hướng KPI của tôi, lấy từ trang Thống kê.',
    icon: <TrendingUp size={20} />, w: 12, h: 14,
    requires: f => !f.enableOkr,
    render: () => <AnalyticsWidget id="mykpi-trend" title="Xu hướng KPI theo thời gian" />,
  },
  {
    i: 'myobj-trend', title: 'Xu hướng mục tiêu của tôi', groupLabel: GROUP.trend,
    description: 'Biểu đồ xu hướng mục tiêu cá nhân, lấy từ trang Thống kê.',
    icon: <TrendingUp size={20} />, w: 12, h: 14,
    requires: f => f.enableOkr,
    render: () => <AnalyticsWidget id="myobj-trend" title="Xu hướng mục tiêu của tôi" />,
  },
]

const toWidget = (d: StaffWidgetDef, x = 0, y = 0): DashboardWidget => ({
  i: d.i, type: d.i, title: d.title, x, y, w: d.w, h: d.h, visible: true,
})

/** Toàn bộ widget hợp lệ của vai trò sau khi lọc theo cờ tổ chức. */
export function getStaffWidgets(flags: OrgFlags): DashboardWidget[] {
  return STAFF_WIDGETS.filter(d => !d.requires || d.requires(flags)).map(d => toWidget(d))
}

export function getStaffCatalog(flags: OrgFlags): WidgetCatalogEntry[] {
  return STAFF_WIDGETS
    .filter(d => !d.requires || d.requires(flags))
    .map(d => ({ template: toWidget(d), icon: d.icon, description: d.description, groupLabel: d.groupLabel }))
}

/** Tra cứu nội dung khi lưới render một ô. */
export function renderStaffWidget(i: string): React.ReactNode {
  return STAFF_WIDGETS.find(d => d.i === i)?.render() ?? null
}

/** Dựng layout từ danh sách id, xếp chồng theo thứ tự khai báo. */
function layoutOf(ids: string[]): DashboardWidget[] {
  let y = 0
  let rowX = 0
  let rowH = 0
  const out: DashboardWidget[] = []
  const wrap = () => { y += rowH; rowX = 0; rowH = 0 }

  ids.forEach(id => {
    const def = STAFF_WIDGETS.find(d => d.i === id)
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
 * <p>Trang chủ dài bốn màn hình thì phần dưới không ai đọc, mà vẫn tốn request. Ở đây chỉ giữ
 * ba câu hỏi đầu tiên của nhân viên: "tôi đang ở đâu" (chỉ số) → "hôm nay phải làm gì"
 * (sắp đến hạn, còn bao lâu) → "kết quả thật của tôi ra sao" (tiến độ chỉ tiêu, bài cần sửa).
 * Nhật ký, xếp hạng, biểu đồ xu hướng đều nằm sẵn trong thư viện, thêm lại bằng một cú bấm.
 */
export function getStaffDefaultLayout(flags: OrgFlags): DashboardWidget[] {
  const base = layoutOf([
    'staff-stats',
    'staff-deadline', 'staff-period',
    'staff-kpi-progress', 'staff-rejected',
  ])
  return base.length ? base : getStaffWidgets(flags)
}

export function getStaffPresets(flags: OrgFlags): LayoutPreset[] {
  const trend = flags.enableOkr ? 'myobj-trend' : 'mykpi-trend'
  return [
    {
      key: 'daily',
      label: 'Việc hằng ngày',
      description: 'Ưu tiên việc sắp đến hạn, bài cần sửa lại và việc sắp mở.',
      widgets: layoutOf(['staff-stats', 'staff-deadline', 'staff-period', 'staff-rejected', 'staff-upcoming', 'staff-tasks']),
    },
    {
      key: 'result',
      label: 'Kết quả của tôi',
      description: 'Nhấn vào tiến độ chỉ tiêu, điểm được chấm và vị trí trong đơn vị.',
      widgets: layoutOf(['staff-stats', 'staff-kpi-progress', 'staff-score-breakdown', 'staff-my-rank', 'staff-score-history', trend]),
    },
    {
      key: 'minimal',
      label: 'Tối giản',
      description: 'Chỉ chỉ số chính, việc sắp đến hạn và tiến độ chỉ tiêu.',
      widgets: layoutOf(['staff-stats', 'staff-deadline', 'staff-kpi-progress']),
    },
  ]
}
