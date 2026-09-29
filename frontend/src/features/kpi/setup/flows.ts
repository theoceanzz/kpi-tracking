import type { WorkflowStageCode } from '../workflow/types'
import type { NotificationCounts } from '@/hooks/useNotificationDots'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export type SetupFlowId = 'SETUP' | 'ASSIGN' | 'APPROVE' | 'REPORT' | 'EVALUATE'

/** Bước dựng sẵn trong wizard (làm tại chỗ) so với bước dẫn sang màn hình có sẵn. */
export type SetupStepKind = 'builtin' | 'action' | 'wait'

/**
 * Thứ phải có SẴN trước khi vào một bước — kiểm ở `useKpiSetupFlow.blockReason`.
 *
 * Khai theo bước chứ không viết cứng theo mã bước, vì cùng một bước `my-kpi` xuất hiện ở hai luồng
 * với điều kiện khác hẳn nhau: trong luồng Giao chỉ tiêu nó đứng sau bước tạo chỉ tiêu nên phải đủ
 * 100% trọng số; trong luồng Nộp báo cáo nó là bước ĐẦU TIÊN, chặn lại là khoá chết cả luồng.
 */
export type StepPrereq =
  /** Đã chọn một đợt KPI. */
  | 'period'
  /** Tổng trọng số của đơn vị trong đợt đã đủ đúng 100% — cùng chốt chặn mà backend dùng. */
  | 'weight100'

export interface SetupStep {
  id: string
  label: string
  hint: string
  kind: SetupStepKind
  /** Chỉ với `builtin`: component nào render bước này. */
  builtin?: 'cycle' | 'period' | 'criteria' | 'review' | 'submit' | 'self-eval'
  /** Chỉ với `action`/`wait`: màn hình có sẵn để mở. */
  route?: string
  ctaLabel?: string
  /** Khoá đếm trong `useNotificationDots` — hiện số việc đang chờ ngay trên bước. */
  counter?: keyof NotificationCounts
  /** Quyền cần có; thiếu thì bước bị bỏ khỏi luồng. */
  requires?: string[]
  /** Việc phải làm xong ở bước trước mới vào được bước này. Thiếu thì báo lỗi, không im lặng. */
  needs?: StepPrereq[]
  /** Bước của tổ chức; tổ chức tắt nó thì bước này biến mất. */
  stage?: WorkflowStageCode
  /** Có quyền nào trong này thì BỎ bước — dùng cho "được duyệt luôn thì khỏi chờ duyệt". */
  skipWhenHasAny?: string[]
  /**
   * Ngược với `skipWhenHasAny`: chỉ GIỮ bước khi có một trong các quyền này.
   * Dùng để một luồng nuốt thêm bước của luồng khác khi hai luồng đã liền mạch.
   */
  onlyWhenHasAny?: string[]
}

export interface SetupFlow {
  id: SetupFlowId
  label: string
  description: string
  /** Cần ÍT NHẤT MỘT quyền trong này thì luồng mới xuất hiện với người dùng. */
  requiresAny: string[]
  /** Bộ đếm hiện trên thẻ chọn luồng, để biết ngay có việc đang chờ mình hay không. */
  counter?: keyof NotificationCounts
  /** Ẩn hẳn luồng khi có một trong các quyền này — dùng khi nó đã được gộp vào luồng khác. */
  hiddenWhenHasAny?: string[]
  /** Có quyền trong này thì luồng đã nuốt thêm bước, nên đổi sang nhãn dưới đây. */
  mergedWhenHasAny?: string[]
  mergedLabel?: string
  mergedDescription?: string
  steps: SetupStep[]
}

/**
 * Một luồng sau khi đã lọc theo quyền và cấu hình tổ chức — xem `useKpiSetupFlow`.
 *
 * `merged` là kết quả tính lúc chạy của `mergedWhenHasAny`, không phải dữ liệu khai sẵn. Các bước
 * cần biết điều đó: luồng đã gộp nghĩa là người dùng đang tự đặt chỉ tiêu CHO CHÍNH MÌNH, nên
 * bước Chỉ tiêu điền sẵn tên họ thay vì bắt chọn người nhận.
 */
export interface ResolvedFlow extends SetupFlow {
  merged: boolean
}

/**
 * Các luồng công việc của module KPI, định nghĩa dưới dạng DỮ LIỆU.
 *
 * Luồng của mỗi người SUY RA từ quyền họ đang có, không phải từ tên vai trò — dự án cố ý không
 * hardcode tên vai trò ở đâu cả (xem ghi chú lớp `PermissionChecker` bên backend), và vai trò
 * trong hệ thống này do chính tổ chức đặt tên nên tên không đáng tin.
 *
 * Nhờ vậy ba hình dạng mà người dùng mô tả rơi ra tự nhiên, không cần nhánh `if` cho từng vai trò:
 *
 * - **Nhân viên** có `KPI:CREATE` + `KPI:SUBMIT` nhưng KHÔNG có `KPI:APPROVE_OWN`
 *   ⇒ thấy hai luồng: Giao chỉ tiêu (kèm bước chờ duyệt) và Nộp báo cáo.
 * - **Quản lý cấp trung** thêm `KPI:APPROVE_CRITERIA` + `SUBMISSION:REVIEW`
 *   ⇒ thấy thêm luồng Duyệt chỉ tiêu và Đánh giá; vẫn phải chờ duyệt vì chưa có `APPROVE_OWN`.
 * - **Quản lý cấp cao** có thêm `KPI:APPROVE_OWN` + `KPI_PERIOD:CREATE`
 *   ⇒ thấy đủ, và bước "chờ duyệt" tự biến mất vì chỉ tiêu họ tạo ra đã được duyệt sẵn
 *   (backend làm điều đó ở `InitialStatusStrategy`, không phải mẹo giao diện).
 */
export const SETUP_FLOWS = perLanguage((): SetupFlow[] => ([
  {
    id: 'SETUP',
    label: i18n.t('kpi:flows.setUpCyclesPeriods'),
    description: i18n.t('kpi:flows.createTheTimeFrameEveryKpi'),
    requiresAny: ['KPI_PERIOD:CREATE'],
    steps: [
      {
        id: 'cycle',
        label: i18n.t('kpi:flows.aCycle'),
        hint: i18n.t('kpi:flows.groupsSeveralPeriodsForAnOverall'),
        kind: 'builtin',
        builtin: 'cycle',
        stage: 'CYCLE_SETUP',
        requires: ['KPI_CYCLE:CREATE'],
      },
      {
        id: 'period',
        label: i18n.t('kpi:flows.aPeriod'),
        hint: i18n.t('kpi:flows.theTimeFrameEveryKpiIs'),
        kind: 'builtin',
        builtin: 'period',
        stage: 'PERIOD_SETUP',
      },
    ],
  },

  {
    id: 'ASSIGN',
    label: i18n.t('kpi:flows.assignKpis'),
    description: i18n.t('kpi:flows.draftKpisForThePeriodAnd'),
    requiresAny: ['KPI:CREATE'],
    // Có quyền tự duyệt thì chỉ tiêu vừa tạo đã có hiệu lực ngay, không có khoảng chờ nào ngăn
    // cách với việc nộp báo cáo — nên hai luồng nhập làm một mạch thay vì bắt quay ra chọn lại.
    mergedWhenHasAny: ['KPI:APPROVE_OWN'],
    mergedLabel: i18n.t('kpi:flows.assignKpisAndSubmitReportsFor'),
    mergedDescription: i18n.t('kpi:flows.setYourOwnKpisSubmitResults'),
    steps: [
      {
        id: 'period',
        label: i18n.t('kpi:flows.choosePeriod'),
        hint: i18n.t('kpi:flows.aKpiMustBelongToA'),
        kind: 'builtin',
        builtin: 'period',
        stage: 'PERIOD_SETUP',
      },
      {
        id: 'criteria',
        label: i18n.t('kpi:flows.kpis'),
        hint: i18n.t('kpi:flows.keepAddingUntilTheWeightsTotal'),
        kind: 'builtin',
        builtin: 'criteria',
        stage: 'CRITERIA_DRAFT',
        needs: ['period'],
      },
      {
        id: 'review',
        label: i18n.t('kpi:flows.submitForApproval'),
        hint: i18n.t('kpi:flows.reviewEverythingAndSendItTo'),
        kind: 'builtin',
        builtin: 'review',
        stage: 'CRITERIA_APPROVAL',
        needs: ['period', 'weight100'],
        // Có quyền tự duyệt thì chỉ tiêu ra đời đã ở trạng thái ĐÃ DUYỆT — không có gì để gửi.
        skipWhenHasAny: ['KPI:APPROVE_OWN'],
      },
      {
        id: 'waiting',
        label: i18n.t('kpi:flows.pendingApproval'),
        hint: i18n.t('kpi:flows.yourManagerIsReviewingComeBack'),
        kind: 'wait',
        route: '/kpi-criteria',
        ctaLabel: i18n.t('kpi:flows.viewKpiStatus'),
        stage: 'CRITERIA_APPROVAL',
        needs: ['period'],
        skipWhenHasAny: ['KPI:APPROVE_OWN'],
      },

      // Hai bước dưới đây vốn thuộc luồng Nộp báo cáo. Chúng chỉ xuất hiện ở đây khi người dùng
      // có quyền tự duyệt — lúc đó luồng Nộp báo cáo tự ẩn đi để không bày ra hai lối vào cho
      // cùng một việc.
      {
        id: 'my-kpi',
        label: i18n.t('kpi:flows.submitReport'),
        hint: i18n.t('kpi:flows.fillInResultsForAllKpis'),
        kind: 'builtin',
        builtin: 'submit',
        counter: 'myPendingTasks',
        stage: 'SUBMISSION',
        needs: ['period', 'weight100'],
        onlyWhenHasAny: ['KPI:APPROVE_OWN'],
      },
      {
        id: 'self-eval',
        label: i18n.t('kpi:flows.selfAssessment'),
        hint: i18n.t('kpi:flows.scoreYourselfOnceTheWholePeriod'),
        kind: 'builtin',
        builtin: 'self-eval',
        stage: 'SELF_EVALUATION',
        needs: ['period', 'weight100'],
        onlyWhenHasAny: ['KPI:APPROVE_OWN'],
      },
    ],
  },

  {
    id: 'APPROVE',
    label: i18n.t('kpi:flows.kpiApproval'),
    description: i18n.t('kpi:flows.reviewSubordinatesKpisAndAdjustmentRequests'),
    requiresAny: ['KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT'],
    counter: 'pendingKpis',
    steps: [
      {
        id: 'pending-criteria',
        label: i18n.t('kpi:flows.kpisPendingApproval'),
        hint: i18n.t('kpi:flows.approveOrRejectEachKpiSubmitted'),
        kind: 'action',
        route: '/kpi-criteria/pending',
        ctaLabel: i18n.t('kpi:flows.openTheKpiApprovalScreen'),
        counter: 'pendingKpis',
        stage: 'CRITERIA_APPROVAL',
        requires: ['KPI:APPROVE_CRITERIA'],
      },
      {
        id: 'pending-adjustments',
        label: i18n.t('kpi:flows.adjustmentsPendingApproval'),
        hint: i18n.t('kpi:flows.requestsToChangeTheTargetOf'),
        kind: 'action',
        route: '/kpi-adjustments/pending',
        ctaLabel: i18n.t('kpi:flows.openTheAdjustmentApprovalScreen'),
        counter: 'pendingAdjustments',
        stage: 'CRITERIA_ADJUSTMENT',
        requires: ['KPI:APPROVE_ADJUSTMENT'],
      },
    ],
  },

  {
    id: 'REPORT',
    label: i18n.t('kpi:flows.submitReport'),
    description: i18n.t('kpi:flows.reportResultsForEachKpiAnd'),
    requiresAny: ['SUBMISSION:CREATE', 'KPI:VIEW_MY'],
    counter: 'myPendingTasks',
    // Đã nằm gọn trong luồng Giao chỉ tiêu với người có quyền tự duyệt — bày thêm thẻ riêng ở đây
    // là hai lối vào cho cùng một việc.
    hiddenWhenHasAny: ['KPI:APPROVE_OWN'],
    steps: [
      {
        id: 'my-kpi',
        label: i18n.t('kpi:flows.submitReport'),
        hint: i18n.t('kpi:flows.fillInResultsForAllKpis'),
        kind: 'builtin',
        builtin: 'submit',
        counter: 'myPendingTasks',
        stage: 'SUBMISSION',
      },
      {
        id: 'self-eval',
        label: i18n.t('kpi:flows.selfAssessment'),
        hint: i18n.t('kpi:flows.scoreYourselfOnceTheWholePeriod'),
        kind: 'builtin',
        builtin: 'self-eval',
        stage: 'SELF_EVALUATION',
      },
    ],
  },

  {
    id: 'EVALUATE',
    label: i18n.t('kpi:flows.approveReportsEvaluate'),
    description: i18n.t('kpi:flows.reviewEmployeesSubmissionsAndScoreAt'),
    // KHÔNG dùng `EVALUATION:CREATE` làm điều kiện: nhân viên cũng có quyền đó, vì nó là quyền
    // dùng cho TỰ đánh giá. Lấy nó làm tín hiệu quản lý sẽ bày luồng này ra cho cả nhân viên.
    // `SUBMISSION:REVIEW` và `CYCLE_EVAL:FINALIZE` mới thật sự chỉ có ở cấp quản lý.
    requiresAny: ['SUBMISSION:REVIEW', 'CYCLE_EVAL:FINALIZE'],
    counter: 'pendingSubmissions',
    steps: [
      {
        id: 'pending-submissions',
        label: i18n.t('kpi:flows.reportsPendingApproval'),
        hint: i18n.t('kpi:flows.reviewTheSubmissionsOfEmployeesIn'),
        kind: 'action',
        route: '/submissions/org-unit',
        ctaLabel: i18n.t('kpi:flows.openTheApprovalScreen'),
        counter: 'pendingSubmissions',
        stage: 'SUBMISSION_REVIEW',
        requires: ['SUBMISSION:REVIEW'],
      },
      {
        id: 'evaluate-staff',
        label: i18n.t('kpi:flows.evaluateEmployees'),
        hint: i18n.t('kpi:flows.scoreEachPersonAtTheEnd'),
        kind: 'action',
        route: '/evaluations',
        ctaLabel: i18n.t('kpi:flows.openTheEvaluationPage'),
        stage: 'MANAGER_EVALUATION',
        // Cùng lý do như trên: chấm điểm NGƯỜI KHÁC là việc của quản lý, và backend còn đòi thêm
        // người chấm phải là trưởng đơn vị. `SUBMISSION:REVIEW` là tín hiệu sát nhất mà frontend
        // kiểm được, vì cấp bậc trong đơn vị thì chỉ backend biết.
        requires: ['SUBMISSION:REVIEW'],
      },
      {
        id: 'cycle-eval',
        label: i18n.t('kpi:flows.cycleEvaluation'),
        hint: i18n.t('kpi:flows.summarizeSeveralPeriodsAndFinalizeThe'),
        kind: 'action',
        route: '/kpi-cycles/evaluation',
        ctaLabel: i18n.t('kpi:flows.openCycleEvaluation'),
        stage: 'CYCLE_EVALUATION',
        requires: ['CYCLE_EVAL:VIEW'],
      },
    ],
  },
]))
