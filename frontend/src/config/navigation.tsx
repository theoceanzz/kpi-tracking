import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  FileText,
  Star,
  ClipboardCheck,
  ListChecks,
  Network,
  Shield,
  MessageSquare,
  History,
  TrendingUp,
  Settings,
  Bot,
  Gauge,
  Coins,
  LayoutGrid,
  CalendarRange,
  Award,
  Gift,
  Wallet,
  Landmark,
  Wrench,
  SlidersHorizontal,
  ToggleRight,
  Scale,
  Layers,
  LayoutPanelLeft,
  Bell,
  Mail,
  Link2,
  Grid3x3,
  UserCircle,
} from 'lucide-react'

/**
 * Cây điều hướng dùng chung cho Sidebar và tab "Thiết lập Sidebar".
 *
 * Trước đây hai nơi giữ hai bản sao độc lập của cây này và đã lệch nhau
 * (khoá chết `/kpi-criteria/adjustments`, nhãn mặc định sai ở vài mục, thiếu
 * hẳn AI/thưởng/ví). Giờ chỉ còn một nguồn duy nhất ở đây.
 */
export interface NavItem {
  /**
   * Khoá ổn định, không đổi khi đổi nhãn hay đổi path. Dùng cho trạng thái
   * bung/thu của nhóm, DOM id cho tour, và làm khoá lưu nhãn tuỳ chỉnh của
   * các nhóm (nhóm không có path).
   */
  id: string
  label: string
  path?: string
  icon: React.ReactNode
  permission?: string | string[]
  /** Với `permission` dạng mảng: cần ĐỦ mọi quyền thay vì chỉ một. */
  requireAllPermissions?: boolean
  end?: boolean
  children?: NavItem[]
  /**
   * Mục con nằm TRONG trang chứ không hiện trên sidebar — mỗi mục là một khu vực của
   * trang, chọn bằng `?section=<id>`. Đây là cách gom nhiều màn hình cấu hình về một
   * dòng sidebar duy nhất mà vẫn cho quản trị viên đổi tên từng mục như trước.
   */
  sections?: NavItem[]
  /**
   * Khoá `sidebar_settings.menu_key` từ cấu trúc cũ. Nhãn tuỳ chỉnh đã lưu
   * trong DB vẫn còn keyed theo các khoá này, nên phải tra cứu dự phòng —
   * nhờ đó không cần migration và tổ chức không mất nhãn đã đặt.
   */
  legacyKeys?: string[]
  /**
   * Ép khoá lưu nhãn tuỳ chỉnh, thay vì mặc định lấy theo path. Cần khi một route đổi
   * ý nghĩa: `/company` xưa là màn hình "Thông tin công ty", nay là cả trang thiết lập —
   * nhãn cũ ở khoá `/company` phải rơi về mục con chứ không phải dòng sidebar.
   */
  labelKey?: string
  /**
   * Cụm của mục trong trang. Chín mục xếp thành một hàng tab dài sẽ khó quét, nên các
   * mục cùng cụm đứng liền nhau và có vạch ngăn giữa hai cụm.
   */
  group?: string
  /** Mô tả ngắn hiện trên thẻ ở màn hình chọn mục. */
  description?: string
  /** Sáng cả khi đang ở route con (ví dụ /bsc sáng khi đứng ở /bsc/dashboard). */
  matchPrefix?: boolean
  okrOnly?: boolean
  bscOnly?: boolean
  aiOnly?: boolean
  rewardOnly?: boolean
  walletOnly?: boolean
  /** Nhãn gốc trước khi bị ghi đè — Sidebar gán khi lọc cây. */
  originalLabel?: string
}

export interface NavFeatureFlags {
  enableOkr?: boolean
  enableBsc?: boolean
  enableReward?: boolean
  enableCashWallet?: boolean
  enableAi?: boolean
}

/** Bộ ba quyền quản trị mà các route thiết lập cũ đòi ĐỦ cả ba. */
const ADMIN_ALL = ['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW']

export const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Tổng quan',
    path: '/dashboard',
    icon: <LayoutDashboard size={20} />,
    permission: 'DASHBOARD:VIEW',
    end: true,
  },
  {
    id: 'setup',
    label: 'Thiết lập',
    icon: <Settings size={20} />,
    children: [
      // Chín màn hình thiết lập công ty gom về MỘT dòng sidebar; chúng thành các mục
      // trong trang /company. Khách hàng nhìn menu bớt rối, mà không màn hình nào mất đi.
      {
        id: 'setup-company',
        label: 'Thiết lập công ty',
        path: '/company',
        icon: <Building2 size={18} />,
        matchPrefix: true,
        labelKey: 'setup-company',
        legacyKeys: ['Thiết lập công ty'],
        permission: 'COMPANY:VIEW',
        sections: [
          { id: 'info', label: 'Thông tin công ty', icon: <Building2 size={18} />, permission: 'COMPANY:VIEW', legacyKeys: ['/company'], group: 'Tổ chức' , description: 'Tên, mã doanh nghiệp và các tính năng đang bật' },
          { id: 'ranks', label: 'Cấp bậc', icon: <Layers size={18} />, permission: 'COMPANY:VIEW', group: 'Tổ chức' , description: 'Các cấp trong công ty và chức danh quản lý tương ứng' },
          { id: 'roles', label: 'Phân quyền vai trò', icon: <Shield size={18} />, permission: 'ROLE:VIEW', legacyKeys: ['/roles'], group: 'Con người' , description: 'Vai trò và quyền hạn kèm theo từng vai trò' },
          { id: 'org-structure', label: 'Cơ cấu tổ chức', icon: <Network size={18} />, permission: 'ORG:VIEW', legacyKeys: ['/org-structure'], group: 'Con người' , description: 'Cây đơn vị, phòng ban và người phụ trách' },
          { id: 'users', label: 'Quản lý nhân viên', icon: <Users size={18} />, permission: 'USER:VIEW', legacyKeys: ['/users'], group: 'Con người' , description: 'Danh sách nhân viên, thêm mới và phân công đơn vị' },
          // KHÔNG kế thừa khoá '/settings': nhãn cũ ở đó đặt tên cho CẢ trang cấu hình
          // bốn tab, gán vào riêng mục Sidebar là sai nghĩa.
          { id: 'sidebar', label: 'Quản lý Sidebar', icon: <LayoutPanelLeft size={18} />, permission: 'COMPANY:UPDATE', group: 'Hệ thống' , description: 'Đổi tên các mục trên menu cho hợp thuật ngữ công ty' },
          { id: 'notifications', label: 'Thiết lập thông báo', icon: <Bell size={18} />, permission: 'COMPANY:UPDATE', group: 'Hệ thống' , description: 'Sự kiện nào gửi thông báo, và gửi qua kênh nào' },
          { id: 'email', label: 'Thiết lập email', icon: <Mail size={18} />, permission: 'COMPANY:UPDATE', group: 'Hệ thống' , description: 'Nội dung mẫu của các email hệ thống gửi đi' },
          { id: 'api', label: 'Thiết lập API', icon: <Link2 size={18} />, permission: 'COMPANY:UPDATE', group: 'Hệ thống' , description: 'Kết nối Lark và các tích hợp bên ngoài' },
        ],
      },
      // Cùng cách gom như "Thiết lập công ty": cả bảng cấu hình lẫn các công cụ quản lý
      // về MỘT dòng sidebar.
      {
        id: 'setup-tools',
        label: 'Thiết lập công cụ',
        path: '/settings/tools',
        icon: <Wrench size={18} />,
        matchPrefix: true,
        labelKey: 'setup-tools',
        legacyKeys: ['/settings/modules', '/settings/scoring'],
        sections: [
          // Quyền của cụm cấu hình giữ đúng cổng cũ của route /settings/tools
          // (ORG:VIEW + USER:VIEW + ROLE:VIEW, đủ cả ba) — gộp trang không được nới quyền.
          { id: 'modules', label: 'Module & tính năng', icon: <ToggleRight size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, legacyKeys: ['/settings/modules'], group: 'Cấu hình', description: 'Bật/tắt OKR, BSC, KPI hành vi, thác nước, thưởng, ví' },
          // Định lượng và định tính gộp một mục, hai tab bên trong — xem ScoringSettingsPage.
          { id: 'scoring', label: 'Thang điểm', icon: <SlidersHorizontal size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, legacyKeys: ['/settings/scoring', 'quantitative'], group: 'Cấu hình', description: 'Thang điểm định lượng và các mức đánh giá định tính' },
          { id: 'matrix', label: 'Ma trận đánh giá', icon: <Grid3x3 size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, group: 'Cấu hình', description: 'Ánh xạ điểm hành vi và % KPI sang xếp loại cuối cùng' },
          { id: 'unit-class', label: 'Xếp loại đơn vị', icon: <Scale size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, group: 'Cấu hình', description: 'Tiêu chuẩn xếp loại áp cho từng đơn vị' },

          // Sáu công cụ quản lý. Quyền lấy đúng theo cổng route cũ của từng cái.
          { id: 'kpi-cycles', label: 'Quản lý kỳ/đợt đánh giá', icon: <CalendarRange size={18} />, permission: ['KPI_CYCLE:CREATE', 'KPI_PERIOD:CREATE'], legacyKeys: ['/kpi-cycles', '/kpi-periods'], group: 'Công cụ', description: 'Kỳ đánh giá tổng hợp và các đợt bên trong mỗi kỳ' },
          { id: 'okr', label: 'Quản lý OKR', icon: <Target size={18} />, permission: 'OKR:MANAGE', okrOnly: true, legacyKeys: ['/okr'], group: 'Công cụ', description: 'Mục tiêu và kết quả then chốt của toàn tổ chức' },
          { id: 'bsc', label: 'Quản lý BSC', icon: <LayoutGrid size={18} />, permission: 'BSC:MANAGE', bscOnly: true, legacyKeys: ['/bsc', 'Quản lý BSC'], group: 'Công cụ', description: 'Thẻ điểm cân bằng, dashboard và bản đồ chiến lược' },
          { id: 'rewards', label: 'Quản lý thưởng', icon: <Gift size={18} />, permission: ['REWARD:GRANT', 'REWARD:APPROVE', 'REWARD:CONFIG', 'REWARD:VIEW'], rewardOnly: true, legacyKeys: ['/rewards'], group: 'Công cụ', description: 'Đề nghị thưởng, hạn mức, điểm danh và quà tặng' },
          { id: 'wallet', label: 'Quản lý ví', icon: <Landmark size={18} />, permission: ['WALLET:VIEW', 'WALLET:CONFIG', 'WALLET:RECONCILE'], walletOnly: true, legacyKeys: ['/wallet'], group: 'Công cụ', description: 'Số dư nhân sự, cấu hình nạp tiền và đối soát' },
          { id: 'ai-quota', label: 'Quản lý token AI', icon: <Coins size={18} />, permission: 'AI_QUOTA:ALLOCATE', aiOnly: true, legacyKeys: ['/ai-quota'], group: 'Công cụ', description: 'Chia hạn mức token AI cho các đơn vị cấp dưới' },
        ],
      },
    ],
  },
  // Năm màn hình vận hành KPI cũng gom về MỘT dòng, cùng khuôn với hai nhánh thiết lập.
  {
    id: 'performance',
    label: 'Quản lý hiệu suất',
    path: '/performance',
    icon: <Gauge size={20} />,
    matchPrefix: true,
    labelKey: 'performance',
    sections: [
      { id: 'kpi-criteria', label: 'Thiết lập chỉ tiêu', icon: <Target size={18} />, permission: 'KPI:VIEW', legacyKeys: ['/kpi-criteria'], group: 'Chỉ tiêu', description: 'Tạo và giao chỉ tiêu cho nhân viên, đơn vị' },
      { id: 'kpi-criteria-pending', label: 'Phê duyệt chỉ tiêu', icon: <ClipboardCheck size={18} />, permission: 'KPI:APPROVE_CRITERIA', legacyKeys: ['/kpi-criteria/pending'], group: 'Chỉ tiêu', description: 'Hàng chờ duyệt chỉ tiêu do cấp dưới gửi lên' },
      { id: 'kpi-adjustments-pending', label: 'Điều chỉnh chỉ tiêu', icon: <MessageSquare size={18} />, permission: 'KPI:APPROVE_ADJUSTMENT', legacyKeys: ['/kpi-adjustments/pending', '/kpi-criteria/adjustments'], group: 'Chỉ tiêu', description: 'Yêu cầu sửa chỉ tiêu giữa chừng chờ xử lý' },
      { id: 'submissions-org-unit', label: 'Đánh giá đợt', icon: <ClipboardCheck size={18} />, permission: 'SUBMISSION:REVIEW', legacyKeys: ['/submissions/org-unit'], group: 'Đánh giá', description: 'Duyệt bài nộp và chấm điểm từng đợt' },
      { id: 'cycle-evaluation', label: 'Đánh giá kỳ', icon: <Award size={18} />, permission: 'CYCLE_EVAL:VIEW', legacyKeys: ['/kpi-cycles/evaluation'], group: 'Đánh giá', description: 'Tổng hợp nhiều đợt thành kết quả của cả kỳ' },
    ],
  },
  // Không gian cá nhân: công việc và ví của chính mình, gộp về MỘT dòng như ba nhánh
  // trên. KHÔNG gắn cờ rewardOnly/walletOnly ở đây — cờ ở cấp dòng là phép AND, gắn vào
  // sẽ giấu cả trang khi tổ chức chỉ bật ví mà tắt thưởng. Cờ để ở từng mục.
  {
    id: 'my-space',
    label: 'Của tôi',
    path: '/me',
    icon: <UserCircle size={20} />,
    matchPrefix: true,
    sections: [
      { id: 'my-kpi', label: 'KPI của tôi', icon: <ListChecks size={18} />, permission: 'KPI:VIEW_MY', legacyKeys: ['/my-kpi'], group: 'Công việc', description: 'Chỉ tiêu được giao và tiến độ hiện tại của bạn' },
      { id: 'my-submissions', label: 'Báo cáo của tôi', icon: <FileText size={18} />, permission: 'SUBMISSION:VIEW_MY', legacyKeys: ['/submissions'], group: 'Công việc', description: 'Các bài nộp đã gửi và trạng thái duyệt' },
      { id: 'evaluations', label: 'Đánh giá của tôi', icon: <Star size={18} />, permission: 'EVALUATION:VIEW_MY', legacyKeys: ['/evaluations'], group: 'Công việc', description: 'Điểm và xếp loại bạn nhận được qua từng đợt' },
      { id: 'my-adjustments', label: 'Điều chỉnh của tôi', icon: <History size={18} />, permission: 'KPI:VIEW_MY', legacyKeys: ['/my-adjustments'], group: 'Công việc', description: 'Đề nghị sửa chỉ tiêu bạn đã gửi và kết quả xử lý' },
      { id: 'my-rewards', label: 'Điểm của tôi', icon: <Gift size={18} />, permission: 'REWARD:VIEW_MY', rewardOnly: true, legacyKeys: ['/rewards/me'], group: 'Ví', description: 'Số dư điểm thưởng, cửa hàng quà và lịch sử đổi' },
      { id: 'my-cash-wallet', label: 'Ví của tôi', icon: <Wallet size={18} />, permission: 'WALLET:VIEW_MY', walletOnly: true, legacyKeys: ['/wallet/me'], group: 'Ví', description: 'Số dư tiền, nạp tiền và quy đổi sang điểm' },
    ],
  },
  // Các góc nhìn phân tích cũng là mục trong trang, cùng khuôn với ba nhánh trên —
  // trước đây là một hàng tab riêng, lệch hẳn với phần còn lại của app.
  {
    id: 'analytics',
    label: 'Phân tích',
    path: '/analytics',
    icon: <TrendingUp size={20} />,
    permission: 'DASHBOARD:VIEW',
    end: true,
    sections: [
      // Cặp OKR và cặp KPI loại trừ nhau theo cờ `enableOkr` của tổ chức, nên cụm này
      // thực tế chỉ hiện tối đa hai mục. Việc chọn cặp nào do trang quyết định qua
      // `visible` — cây nav không có cờ "chỉ khi TẮT OKR" để diễn đạt vế còn lại.
      { id: 'my-objectives', label: 'Mục tiêu của tôi', icon: <Target size={18} />, okrOnly: true, group: 'Kết quả', description: 'Tiến độ mục tiêu và kết quả then chốt của bạn' },
      { id: 'subordinate', label: 'Mục tiêu đơn vị', icon: <Users size={18} />, okrOnly: true, permission: ['KPI:VIEW', 'SUBMISSION:REVIEW'], group: 'Kết quả', description: 'Tiến độ mục tiêu của đơn vị và từng nhân sự' },
      { id: 'my', label: 'KPI của tôi', icon: <TrendingUp size={18} />, group: 'Kết quả', description: 'Tiến độ và điểm KPI của riêng bạn' },
      { id: 'summary', label: 'KPI đơn vị', icon: <LayoutDashboard size={18} />, permission: ['KPI:VIEW', 'SUBMISSION:REVIEW'], group: 'Kết quả', description: 'Tổng hợp KPI của đơn vị bạn phụ trách' },
      { id: 'drilldown', label: 'Phân cấp', icon: <Building2 size={18} />, group: 'Toàn tổ chức', description: 'So sánh hiệu suất giữa các đơn vị theo từng cấp' },
      { id: 'bsc', label: 'Hạng mục (BSC)', icon: <Gauge size={18} />, permission: 'BSC:MANAGE', bscOnly: true, group: 'Toàn tổ chức', description: 'Kết quả theo từng hạng mục của thẻ điểm cân bằng' },
    ],
  },
  { id: 'ai-assistant', label: 'K.AI', path: '/ai-assistant', icon: <Bot size={20} />, permission: 'DASHBOARD:VIEW', end: true, aiOnly: true },
]

/** Mục nav có bị tắt bởi cờ tính năng của tổ chức không. */
export function isFeatureEnabled(item: NavItem, flags: NavFeatureFlags): boolean {
  if (item.okrOnly && !flags.enableOkr) return false
  if (item.bscOnly && !flags.enableBsc) return false
  if (item.rewardOnly && !flags.enableReward) return false
  if (item.walletOnly && !flags.enableCashWallet) return false
  if (item.aiOnly && !flags.enableAi) return false
  return true
}

/** Khoá dùng để tra nhãn tuỳ chỉnh — path với mục lá, id với nhóm và mục trong trang. */
export function navItemKey(item: NavItem): string {
  return item.labelKey || item.path || item.id
}

/** Mọi path trong cây, phẳng. Mục trong trang không có path nên không tính. */
export function flatNavPaths(items: NavItem[] = navItems): string[] {
  return items.flatMap(i => [
    ...(i.path ? [i.path] : []),
    ...(i.children ? flatNavPaths(i.children) : []),
  ])
}

/** Tìm mục nav theo id, xuyên cả nhóm con lẫn mục trong trang. */
export function findNavItem(id: string, items: NavItem[] = navItems): NavItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    const found = findNavItem(id, [...(item.children ?? []), ...(item.sections ?? [])])
    if (found) return found
  }
  return undefined
}

export interface NavMenuEntry {
  key: string
  defaultLabel: string
  category: string
}

/**
 * Danh sách mục có thể đổi nhãn, cho tab "Thiết lập Sidebar". Dẫn xuất từ chính
 * `navItems` nên không bao giờ lệch nữa. `category` lấy theo nhóm cấp 1.
 */
export function collectMenuEntries(flags: NavFeatureFlags, items: NavItem[] = navItems, category?: string): NavMenuEntry[] {
  return items.flatMap(item => {
    if (!isFeatureEnabled(item, flags)) return []
    const isGroup = !!(item.children || item.sections)
    const own: NavMenuEntry = {
      key: navItemKey(item),
      defaultLabel: item.label,
      category: category ?? (isGroup ? item.label : 'Chung'),
    }
    // Mục trong trang cũng đổi tên được như mục trên sidebar — nhãn của chúng hiện ở
    // menu bên trong trang thiết lập.
    const nested = [...(item.children ?? []), ...(item.sections ?? [])]
    const childCategory = category ?? (isGroup ? item.label : 'Chung')
    return [own, ...(nested.length ? collectMenuEntries(flags, nested, childCategory) : [])]
  })
}
