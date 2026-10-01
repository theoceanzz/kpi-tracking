import {
  Workflow,
  LayoutDashboard,
  Hash,
  Building2,
  Users,
  Target,
  FileText,
  BookOpen,
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
  HeartHandshake,
  ArrowRightLeft,
} from 'lucide-react'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
  /**
   * Mục này dành cho ai — hiện thành dòng "Dành cho: …" trên thẻ. Dùng khi một trang có nhiều
   * mục nghe na ná nhau (Thống kê): người dùng cần biết mục nào là của mình trước khi bấm vào.
   */
  audience?: string
  /** Sáng cả khi đang ở route con (ví dụ /bsc sáng khi đứng ở /bsc/dashboard). */
  matchPrefix?: boolean
  okrOnly?: boolean
  bscOnly?: boolean
  aiOnly?: boolean
  rewardOnly?: boolean
  walletOnly?: boolean
  conductOnly?: boolean
  /** Chỉ hiện khi tổ chức bật đánh giá 360. */
  feedback360Only?: boolean
  /** Nhãn gốc trước khi bị ghi đè — Sidebar gán khi lọc cây. */
  originalLabel?: string
}

export interface NavFeatureFlags {
  enableOkr?: boolean
  enableBsc?: boolean
  enableReward?: boolean
  enableCashWallet?: boolean
  enableAi?: boolean
  enableConduct?: boolean
  enableFeedback360?: boolean
}

/** Bộ ba quyền quản trị mà các route thiết lập cũ đòi ĐỦ cả ba. */
const ADMIN_ALL = ['ORG:VIEW', 'USER:VIEW', 'ROLE:VIEW']

export const navItems = perLanguage((): NavItem[] => ([
  {
    id: 'dashboard',
    label: i18n.t('layout:navigation.overview'),
    path: '/dashboard',
    icon: <LayoutDashboard size={20} />,
    permission: 'DASHBOARD:VIEW',
    end: true,
  },
  {
    id: 'setup',
    label: i18n.t('layout:navigation.setup'),
    icon: <Settings size={20} />,
    children: [
      // Chín màn hình thiết lập công ty gom về MỘT dòng sidebar; chúng thành các mục
      // trong trang /company. Khách hàng nhìn menu bớt rối, mà không màn hình nào mất đi.
      {
        id: 'setup-company',
        label: i18n.t('layout:navigation.companySetup'),
        path: '/company',
        icon: <Building2 size={18} />,
        matchPrefix: true,
        labelKey: 'setup-company',
        legacyKeys: [i18n.t('layout:navigation.companySetup')],
        permission: 'COMPANY:VIEW',
        sections: [
          { id: 'info', label: i18n.t('layout:navigation.companyInformation'), icon: <Building2 size={18} />, permission: 'COMPANY:VIEW', legacyKeys: ['/company'], group: i18n.t('layout:navigation.organization') , description: i18n.t('layout:navigation.nameBusinessCodeAndEnabledFeatures') },
          { id: 'ranks', label: i18n.t('layout:navigation.companyLevels'), icon: <Layers size={18} />, permission: 'COMPANY:VIEW', group: i18n.t('layout:navigation.organization') , description: i18n.t('layout:navigation.levelsInTheCompanyAndTheir') },
          { id: 'roles', label: i18n.t('layout:navigation.rolePermissions'), icon: <Shield size={18} />, permission: 'ROLE:VIEW', legacyKeys: ['/roles'], group: i18n.t('layout:navigation.people') , description: i18n.t('layout:navigation.rolesAndThePermissionsAttachedTo') },
          { id: 'org-structure', label: i18n.t('layout:navigation.organizationStructure'), icon: <Network size={18} />, permission: 'ORG:VIEW', legacyKeys: ['/org-structure'], group: i18n.t('layout:navigation.people') , description: i18n.t('layout:navigation.treeOfUnitsDepartmentsAndOwners') },
          { id: 'users', label: i18n.t('layout:navigation.employeeManagement'), icon: <Users size={18} />, permission: 'USER:VIEW', legacyKeys: ['/users'], group: i18n.t('layout:navigation.people') , description: i18n.t('layout:navigation.employeeListAddingNewOnesAnd') },
          { id: 'delegations', label: i18n.t('layout:navigation.crossUnitDelegation'), icon: <ArrowRightLeft size={18} />, permission: 'ROLE:ASSIGN', group: i18n.t('layout:navigation.people') , description: i18n.t('layout:navigation.letAPersonAlsoManageUnits') },
          // KHÔNG kế thừa khoá '/settings': nhãn cũ ở đó đặt tên cho CẢ trang cấu hình
          // bốn tab, gán vào riêng mục Sidebar là sai nghĩa.
          { id: 'sidebar', label: i18n.t('layout:navigation.sidebarManagement'), icon: <LayoutPanelLeft size={18} />, permission: 'COMPANY:UPDATE', group: i18n.t('layout:navigation.system') , description: i18n.t('layout:navigation.renameSidebarItemsAndTheItems') },
          { id: 'notifications', label: i18n.t('layout:navigation.notificationSettings'), icon: <Bell size={18} />, permission: 'COMPANY:UPDATE', group: i18n.t('layout:navigation.system') , description: i18n.t('layout:navigation.whichEventsSendNotificationsAndThrough') },
          { id: 'email', label: i18n.t('layout:navigation.emailSettings'), icon: <Mail size={18} />, permission: 'COMPANY:UPDATE', group: i18n.t('layout:navigation.system') , description: i18n.t('layout:navigation.templateContentOfTheEmailsThe') },
          { id: 'api', label: i18n.t('layout:navigation.apiSettings'), icon: <Link2 size={18} />, permission: 'COMPANY:UPDATE', group: i18n.t('layout:navigation.system') , description: i18n.t('layout:navigation.larkConnectionAndExternalIntegrations') },
          { id: 'ai-docs', label: i18n.t('layout:navigation.aiAssistantDocuments'), icon: <BookOpen size={18} />, permission: 'COMPANY:UPDATE', group: i18n.t('layout:navigation.system') , description: i18n.t('layout:navigation.companyRegulationsJobDescriptionsAndStrategy') },
          // Từng là dòng sidebar riêng `/kpi-workflow` (nhãn "Luồng KPI") — `legacyKeys` giữ lại
          // nhãn tổ chức đã đặt. Quyền là phép HOẶC: người cấu hình luồng (WORKFLOW:MANAGE) và
          // quản trị công ty (COMPANY:UPDATE) đều thấy; thiếu WORKFLOW:MANAGE thì mục tự chuyển
          // sang chỉ-xem.
          { id: 'kpi-workflow', label: i18n.t('layout:navigation.workflowSettings'), icon: <Workflow size={18} />, permission: ['WORKFLOW:MANAGE', 'COMPANY:UPDATE'], legacyKeys: ['/kpi-workflow'], group: i18n.t('layout:navigation.system') , description: i18n.t('layout:navigation.turnOnOffAndOrderThe') },
        ],
      },
      // Cùng cách gom như "Thiết lập công ty": cả bảng cấu hình lẫn các công cụ quản lý
      // về MỘT dòng sidebar.
      {
        id: 'setup-tools',
        label: i18n.t('layout:navigation.toolSetup'),
        path: '/settings/tools',
        icon: <Wrench size={18} />,
        matchPrefix: true,
        labelKey: 'setup-tools',
        legacyKeys: ['/settings/modules', '/settings/scoring'],
        sections: [
          // Quyền của cụm cấu hình giữ đúng cổng cũ của route /settings/tools
          // (ORG:VIEW + USER:VIEW + ROLE:VIEW, đủ cả ba) — gộp trang không được nới quyền.
          { id: 'modules', label: i18n.t('layout:navigation.modulesFeatures'), icon: <ToggleRight size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, legacyKeys: ['/settings/modules'], group: i18n.t('layout:navigation.configuration'), description: i18n.t('layout:navigation.turnOnOffOkrBscBehavioral') },
          // Định lượng và định tính gộp một mục, hai tab bên trong — xem ScoringSettingsPage.
          { id: 'scoring', label: i18n.t('layout:navigation.scoringScales'), icon: <SlidersHorizontal size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, legacyKeys: ['/settings/scoring', 'quantitative'], group: i18n.t('layout:navigation.configuration'), description: i18n.t('layout:navigation.quantitativeScaleAndQualitativeEvaluationLevels') },
          { id: 'matrix', label: i18n.t('layout:navigation.evaluationMatrix'), icon: <Grid3x3 size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, group: i18n.t('layout:navigation.configuration'), description: i18n.t('layout:navigation.mapsConductScoreAndKpiTo') },
          { id: 'unit-class', label: i18n.t('layout:navigation.unitRating'), icon: <Scale size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, group: i18n.t('layout:navigation.configuration'), description: i18n.t('layout:navigation.ratingStandardsAppliedToEachUnit') },
          // Chỉ hiện khi tổ chức bật OKR hoặc BSC — xem `visible` ở ToolSettingsPage. Cây nav
          // không có cờ "bật A HOẶC B" nên vế đó do trang quyết định.
          { id: 'code-rules', label: i18n.t('layout:navigation.codeGenerationRules'), icon: <Hash size={18} />, permission: ADMIN_ALL, requireAllPermissions: true, group: i18n.t('layout:navigation.configuration'), description: i18n.t('layout:navigation.autoGeneratedCodePatternsForObjectives') },

          // Sáu công cụ quản lý. Quyền lấy đúng theo cổng route cũ của từng cái.
          { id: 'kpi-cycles', label: i18n.t('layout:navigation.evaluationCyclePeriodManagement'), icon: <CalendarRange size={18} />, permission: ['KPI_CYCLE:CREATE', 'KPI_PERIOD:CREATE'], legacyKeys: ['/kpi-cycles', '/kpi-periods'], group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.combinedEvaluationCyclesAndThePeriods') },
          { id: 'okr', label: i18n.t('layout:navigation.okrManagement'), icon: <Target size={18} />, permission: 'OKR:MANAGE', okrOnly: true, legacyKeys: ['/okr'], group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.objectivesAndKeyResultsOfThe') },
          // Trưởng đơn vị cũng vào đây — họ phải tự lập được BSC của phòng mình (kịch bản (b) và (c)
          // của mô hình phân rã). Vào rồi thì mỗi nút bên trong tự gác quyền của nó, và backend
          // chặn tiếp: người chỉ có MANAGE_UNIT không đụng được bộ tiêu chí của đơn vị khác.
          { id: 'bsc', label: i18n.t('layout:navigation.bscManagement'), icon: <LayoutGrid size={18} />, permission: ['BSC:MANAGE', 'BSC:MANAGE_UNIT'], bscOnly: true, legacyKeys: ['/bsc', i18n.t('layout:navigation.bscManagement')], group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.buildScorecardsPerCycleItemsAcross') },
          { id: 'rewards', label: i18n.t('layout:navigation.rewardManagement'), icon: <Gift size={18} />, permission: ['REWARD:GRANT', 'REWARD:APPROVE', 'REWARD:CONFIG', 'REWARD:VIEW'], rewardOnly: true, legacyKeys: ['/rewards'], group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.rewardProposalsBudgetsCheckInsAnd') },
          { id: 'wallet', label: i18n.t('layout:navigation.walletManagement'), icon: <Landmark size={18} />, permission: ['WALLET:VIEW', 'WALLET:CONFIG', 'WALLET:RECONCILE'], walletOnly: true, legacyKeys: ['/wallet'], group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.peopleBalancesTopUpConfigurationAnd') },
          { id: 'ai-quota', label: i18n.t('layout:navigation.aiTokenManagement'), icon: <Coins size={18} />, permission: 'AI_QUOTA:ALLOCATE', aiOnly: true, legacyKeys: ['/ai-quota'], group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.allocateAiTokenQuotasToLower') },
          { id: 'ai-review', label: i18n.t('layout:navigation.aiSubmissionReview'), icon: <Bot size={18} />, permission: ['AI_REVIEW:CONFIG', 'AI_CRITERIA:MANAGE'], aiOnly: true, group: i18n.t('layout:navigation.tools'), description: i18n.t('layout:navigation.aiReadsSubmissionsAndAppliesRules') },
        ],
      },
    ],
  },
  // Năm màn hình vận hành KPI cũng gom về MỘT dòng, cùng khuôn với hai nhánh thiết lập.
  {
    id: 'performance',
    label: i18n.t('layout:navigation.performanceManagement'),
    path: '/performance',
    icon: <Gauge size={20} />,
    matchPrefix: true,
    labelKey: 'performance',
    sections: [
      { id: 'kpi-criteria', label: i18n.t('layout:navigation.kpiSetup'), icon: <Target size={18} />, permission: 'KPI:VIEW', legacyKeys: ['/kpi-criteria'], group: i18n.t('layout:navigation.kpis'), description: i18n.t('layout:navigation.createAndAssignKpisToEmployees') },
      { id: 'kpi-criteria-pending', label: i18n.t('layout:navigation.kpiApproval'), icon: <ClipboardCheck size={18} />, permission: 'KPI:APPROVE_CRITERIA', legacyKeys: ['/kpi-criteria/pending'], group: i18n.t('layout:navigation.kpis'), description: i18n.t('layout:navigation.queueOfKpisSubmittedBySubordinates') },
      { id: 'kpi-adjustments-pending', label: i18n.t('layout:navigation.kpiAdjustments'), icon: <MessageSquare size={18} />, permission: 'KPI:APPROVE_ADJUSTMENT', legacyKeys: ['/kpi-adjustments/pending', '/kpi-criteria/adjustments'], group: i18n.t('layout:navigation.kpis'), description: i18n.t('layout:navigation.pendingRequestsToChangeKpisMid') },
      { id: 'submissions-org-unit', label: i18n.t('layout:navigation.periodEvaluation'), icon: <ClipboardCheck size={18} />, permission: 'SUBMISSION:REVIEW', legacyKeys: ['/submissions/org-unit'], group: i18n.t('layout:navigation.evaluation'), description: i18n.t('layout:navigation.approveSubmissionsAndScoreEachPeriod') },
      { id: 'cycle-evaluation', label: i18n.t('layout:navigation.cycleEvaluation'), icon: <Award size={18} />, permission: 'CYCLE_EVAL:VIEW', legacyKeys: ['/kpi-cycles/evaluation'], group: i18n.t('layout:navigation.evaluation'), description: i18n.t('layout:navigation.combineSeveralPeriodsIntoTheWhole') },
      { id: 'feedback360', label: i18n.t('layout:navigation.n360Feedback'), icon: <Users size={18} />, permission: ['FEEDBACK360:MANAGE', 'FEEDBACK360:VIEW'], feedback360Only: true, group: i18n.t('layout:navigation.evaluation'), description: i18n.t('layout:navigation.campaignsCollectingFeedbackFromManagersPeers') },
    ],
  },
  // Không gian cá nhân: công việc và ví của chính mình, gộp về MỘT dòng như ba nhánh
  // trên. KHÔNG gắn cờ rewardOnly/walletOnly ở đây — cờ ở cấp dòng là phép AND, gắn vào
  // sẽ giấu cả trang khi tổ chức chỉ bật ví mà tắt thưởng. Cờ để ở từng mục.
  {
    id: 'my-space',
    label: i18n.t('layout:navigation.mine'),
    path: '/me',
    icon: <UserCircle size={20} />,
    matchPrefix: true,
    sections: [
      { id: 'my-kpi', label: i18n.t('layout:navigation.myKpis'), icon: <ListChecks size={18} />, permission: 'KPI:VIEW_MY', legacyKeys: ['/my-kpi'], group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.yourAssignedKpisAndCurrentProgress') },
      // Hai mục "của tôi" cho OKR/BSC: cùng dữ liệu KPI của tôi nhưng xếp theo mục tiêu / hạng
      // mục, để ai cũng thấy mình đang góp vào đâu và còn phải nộp gì. Ẩn khi tổ chức tắt module.
      // Cùng quyền với KPI của tôi: trang dành cho người NHẬN KPI; giám đốc/ban lãnh đạo xem OKR/BSC
      // toàn công ty ở Phân tích và Thiết lập công cụ, không cần mục này.
      { id: 'my-okr', label: i18n.t('layout:navigation.myOkrs'), icon: <Target size={18} />, permission: 'KPI:VIEW_MY', okrOnly: true, group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.objectivesAndKeyResultsYouContribute') },
      { id: 'my-bsc', label: i18n.t('layout:navigation.myBsc'), icon: <LayoutGrid size={18} />, permission: 'KPI:VIEW_MY', bscOnly: true, group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.yourUnitsScorecardByPeriodAnd') },
      { id: 'my-submissions', label: i18n.t('layout:navigation.myReports'), icon: <FileText size={18} />, permission: 'SUBMISSION:VIEW_MY', legacyKeys: ['/submissions'], group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.submissionsYouSentAndTheirApproval') },
      { id: 'evaluations', label: i18n.t('layout:navigation.myEvaluations'), icon: <Star size={18} />, permission: 'EVALUATION:VIEW_MY', legacyKeys: ['/evaluations'], group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.theScoresAndRatingsYouReceived') },
      { id: 'my-adjustments', label: i18n.t('layout:navigation.myAdjustments'), icon: <History size={18} />, permission: 'KPI:VIEW_MY', legacyKeys: ['/my-adjustments'], group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.kpiChangeRequestsYouSentAnd') },
      // `KPI:VIEW_MY` chứ không phải `EVALUATION:VIEW_MY`: trưởng đơn vị KHÔNG có quyền
      // sau (xem UNIT_HEAD_PERSONAL_PERMS ở backend) nhưng vẫn phải tự chấm hạnh kiểm.
      { id: 'my-conduct', label: i18n.t('layout:navigation.myConduct'), icon: <HeartHandshake size={18} />, permission: 'KPI:VIEW_MY', conductOnly: true, group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.selfScoreYourConductAndGive') },
      { id: 'my-feedback360', label: i18n.t('layout:navigation.my360Feedback'), icon: <Users size={18} />, permission: ['FEEDBACK360:VIEW_MY', 'KPI:VIEW_MY'], feedback360Only: true, group: i18n.t('layout:navigation.work'), description: i18n.t('layout:navigation.n360FormsToCompleteForColleagues') },
      { id: 'my-rewards', label: i18n.t('layout:navigation.myPoints'), icon: <Gift size={18} />, permission: 'REWARD:VIEW_MY', rewardOnly: true, legacyKeys: ['/rewards/me'], group: i18n.t('layout:navigation.wallet'), description: i18n.t('layout:navigation.rewardPointBalanceGiftShopAnd') },
      { id: 'my-cash-wallet', label: i18n.t('layout:navigation.myWallet'), icon: <Wallet size={18} />, permission: 'WALLET:VIEW_MY', walletOnly: true, legacyKeys: ['/wallet/me'], group: i18n.t('layout:navigation.wallet'), description: i18n.t('layout:navigation.cashBalanceTopUpsAndConversion') },
    ],
  },
  // Các góc nhìn phân tích cũng là mục trong trang, cùng khuôn với ba nhánh trên —
  // trước đây là một hàng tab riêng, lệch hẳn với phần còn lại của app.
  {
    id: 'analytics',
    label: i18n.t('layout:navigation.statistics'),
    path: '/analytics',
    icon: <TrendingUp size={20} />,
    permission: 'DASHBOARD:VIEW',
    end: true,
    sections: [
      // Cặp OKR và cặp KPI loại trừ nhau theo cờ `enableOkr` của tổ chức, nên cụm này
      // thực tế chỉ hiện tối đa hai mục. Việc chọn cặp nào do trang quyết định qua
      // `visible` — cây nav không có cờ "chỉ khi TẮT OKR" để diễn đạt vế còn lại.
      //
      // Mỗi mục trả lời MỘT câu hỏi khác nhau và chữ đầu của nhãn khác nhau (Kết quả / Đơn vị /
      // So sánh / Thẻ điểm): tên na ná nhau ("KPI của tôi" cạnh "KPI đơn vị…") từng làm người
      // dùng tưởng mục nào cũng phải xem. `audience` nói thẳng mục đó dành cho ai. Thanh tab con
      // chỉ hiện các mục cùng nhóm, nên "So sánh giữa các đơn vị" đứng cạnh "Đơn vị tôi quản lý":
      // đơn vị mình thế nào, rồi so với đơn vị khác.
      //
      // Hai mục cá nhân gác bằng SUBMISSION:CREATE: chỉ người NỘP báo cáo mới có kết quả riêng để
      // xem; sếp giao chỉ tiêu mà không nộp thì không có gì ở đây ngoài một trang trống.
      { id: 'my-objectives', label: i18n.t('layout:navigation.myObjectives'), icon: <Target size={18} />, okrOnly: true, permission: 'SUBMISSION:CREATE', group: i18n.t('layout:navigation.personal'), description: i18n.t('layout:navigation.objectivesAndKeyResultsYouHold'), audience: i18n.t('layout:navigation.peopleWhoSubmitReports') },
      { id: 'my', label: i18n.t('layout:navigation.myResults'), icon: <TrendingUp size={18} />, permission: 'SUBMISSION:CREATE', group: i18n.t('layout:navigation.personal'), description: i18n.t('layout:navigation.kpisAssignedToYouSubmissionsAnd'), audience: i18n.t('layout:navigation.peopleWhoSubmitReports') },
      { id: 'subordinate', label: i18n.t('layout:navigation.unitObjectivesIManage'), icon: <Users size={18} />, okrOnly: true, permission: ['KPI:VIEW', 'SUBMISSION:REVIEW'], group: i18n.t('layout:navigation.unit'), description: i18n.t('layout:navigation.objectivesOkrOfTheUnitAnd'), audience: i18n.t('layout:navigation.unitHeadsDeputiesBoardOfDirectors') },
      { id: 'summary', label: i18n.t('layout:navigation.unitsIManage'), icon: <LayoutDashboard size={18} />, permission: ['KPI:VIEW', 'SUBMISSION:REVIEW'], group: i18n.t('layout:navigation.unit'), description: i18n.t('layout:navigation.whereTheWholeUnitYouAre'), audience: i18n.t('layout:navigation.unitHeadsDeputiesBoardOfDirectors') },
      { id: 'drilldown', label: i18n.t('layout:navigation.unitComparison'), icon: <Building2 size={18} />, group: i18n.t('layout:navigation.unit'), description: i18n.t('layout:navigation.unitsSideBySideRatingsMatrix'), audience: i18n.t('layout:navigation.boardOfDirectorsHeadsOfUnits') },
      // `labelKey` riêng vì `id: 'bsc'` trùng với mục "Quản lý BSC" bên Thiết lập công cụ.
      // Khoá lưu nhãn mặc định lấy theo id ⇒ hai mục dùng CHUNG một nhãn tuỳ chỉnh, đổi
      // tên mục này là đổi luôn mục kia. Giữ nguyên id để `?section=bsc` không đổi.
      { id: 'bsc', labelKey: 'analytics-bsc', label: i18n.t('layout:navigation.bscScorecard'), icon: <Gauge size={18} />, permission: 'BSC:MANAGE', bscOnly: true, group: i18n.t('layout:navigation.wholeCompany'), description: i18n.t('layout:navigation.isTheCompanyOnStrategyScorecard'), audience: i18n.t('layout:navigation.boardOfDirectors') },
    ],
  },
  // Thư viện tài liệu 3 phạm vi (tri thức cho K.AI). Không gắn aiOnly: tài liệu vẫn xem/tải được khi tổ chức
  // tắt AI. Mọi người đăng nhập đều có ít nhất tab Công ty; tab nào hiện do backend quyết.
  { id: 'documents', label: i18n.t('layout:navigation.documents'), path: '/documents', icon: <BookOpen size={20} />, permission: 'DASHBOARD:VIEW', end: true },
  { id: 'ai-assistant', label: 'K.AI', path: '/ai-assistant', icon: <Bot size={20} />, permission: 'DASHBOARD:VIEW', end: true, aiOnly: true },
]))

/** Mục nav có bị tắt bởi cờ tính năng của tổ chức không. */
export function isFeatureEnabled(item: NavItem, flags: NavFeatureFlags): boolean {
  if (item.okrOnly && !flags.enableOkr) return false
  if (item.bscOnly && !flags.enableBsc) return false
  if (item.rewardOnly && !flags.enableReward) return false
  if (item.walletOnly && !flags.enableCashWallet) return false
  if (item.aiOnly && !flags.enableAi) return false
  if (item.conductOnly && !flags.enableConduct) return false
  if (item.feedback360Only && !flags.enableFeedback360) return false
  return true
}

/** Khoá dùng để tra nhãn tuỳ chỉnh — path với mục lá, id với nhóm và mục trong trang. */
export function navItemKey(item: NavItem): string {
  return item.labelKey || item.path || item.id
}

/** Mọi path trong cây, phẳng. Mục trong trang không có path nên không tính. */
export function flatNavPaths(items: NavItem[] = navItems()): string[] {
  return items.flatMap(i => [
    ...(i.path ? [i.path] : []),
    ...(i.children ? flatNavPaths(i.children) : []),
  ])
}

/** Tìm mục nav theo id, xuyên cả nhóm con lẫn mục trong trang. */
export function findNavItem(id: string, items: NavItem[] = navItems()): NavItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    const found = findNavItem(id, [...(item.children ?? []), ...(item.sections ?? [])])
    if (found) return found
  }
  return undefined
}

export interface NavLabelEntry {
  /** Khoá lưu ở `sidebar_settings.menu_key`. */
  key: string
  defaultLabel: string
  /** Cụm bên trong trang (`NavItem.group`) — chỉ mục trong trang mới có. */
  group?: string
  legacyKeys?: string[]
}

/** Một NƠI các mục xuất hiện: thanh sidebar, hoặc bên trong một trang cụ thể. */
export interface NavLabelScope {
  id: string
  title: string
  hint: string
  entries: NavLabelEntry[]
}

const toEntry = (item: NavItem): NavLabelEntry => ({
  key: navItemKey(item),
  defaultLabel: item.label,
  group: item.group,
  legacyKeys: item.legacyKeys,
})

/**
 * Các mục có thể đổi nhãn, gom theo NƠI chúng hiện ra, cho mục "Quản lý Sidebar".
 *
 * Trước đây hàm này trả một danh sách phẳng kèm cột "phân loại" lấy theo nhóm cấp 1.
 * Từ khi phần lớn màn hình chuyển thành mục trong trang, cách đó hết tác dụng: hơn hai
 * mươi dòng cùng mang phân loại "Thiết lập" mà không cho biết dòng nào nằm trên sidebar,
 * dòng nào nằm trong trang nào. Nay mỗi nơi là một khối riêng.
 *
 * Vẫn dẫn xuất từ chính `navItems` nên thêm/bớt mục là bảng tự cập nhật.
 */
export function collectNavLabelScopes(flags: NavFeatureFlags): NavLabelScope[] {
  const sidebar: NavLabelEntry[] = []
  const pages: NavLabelScope[] = []

  const walk = (items: NavItem[]) => {
    for (const item of items) {
      if (!isFeatureEnabled(item, flags)) continue
      // `children` hiện thẳng trên sidebar; `sections` thì không — chúng là khu vực bên
      // trong trang, chọn bằng `?section=`.
      sidebar.push(toEntry(item))
      if (item.children?.length) walk(item.children)

      const sections = (item.sections ?? []).filter(s => isFeatureEnabled(s, flags))
      if (sections.length) {
        pages.push({
          id: navItemKey(item),
          title: item.label,
          hint: i18n.t('layout:navigation.shownOnTheCardGridAnd', { label: item.label }),
          entries: sections.map(toEntry),
        })
      }
    }
  }
  walk(navItems())

  const scopes: NavLabelScope[] = [
    {
      id: '__sidebar__',
      title: i18n.t('layout:navigation.navigationBar'),
      hint: i18n.t('layout:navigation.theRowsShownDirectlyOnThe'),
      entries: sidebar,
    },
    ...pages,
  ]

  if (import.meta.env.DEV) warnDuplicateLabelKeys(scopes)
  return scopes
}

/**
 * Hai mục cùng khoá sẽ DÙNG CHUNG một nhãn tuỳ chỉnh — sửa mục này là sửa luôn mục kia.
 * Rất dễ dính khi chuyển một tab sidebar thành mục trong trang mà `id` trùng với mục sẵn
 * có ở trang khác (đã xảy ra với `bsc`). Cách chữa: đặt `labelKey` riêng cho một trong hai.
 */
function warnDuplicateLabelKeys(scopes: NavLabelScope[]) {
  const owners = new Map<string, string[]>()
  for (const scope of scopes) {
    for (const entry of scope.entries) {
      owners.set(entry.key, [...(owners.get(entry.key) ?? []), `${scope.title} › ${entry.defaultLabel}`])
    }
  }
  const dups = [...owners].filter(([, list]) => list.length > 1)
  if (dups.length) {
    console.warn('[navigation] Khoá nhãn bị trùng, hãy đặt labelKey riêng:', Object.fromEntries(dups))
  }
}
