import type { WorkflowStageCode } from '../workflow/types'
import type { NotificationCounts } from '@/hooks/useNotificationDots'

export type SetupFlowId = 'SETUP' | 'ASSIGN' | 'APPROVE' | 'REPORT' | 'EVALUATE'

/** Bước dựng sẵn trong wizard (làm tại chỗ) so với bước dẫn sang màn hình có sẵn. */
export type SetupStepKind = 'builtin' | 'action' | 'wait'

export interface SetupStep {
  id: string
  label: string
  hint: string
  kind: SetupStepKind
  /** Chỉ với `builtin`: component nào render bước này. */
  builtin?: 'cycle' | 'period' | 'criteria' | 'review'
  /** Chỉ với `action`/`wait`: màn hình có sẵn để mở. */
  route?: string
  ctaLabel?: string
  /** Khoá đếm trong `useNotificationDots` — hiện số việc đang chờ ngay trên bước. */
  counter?: keyof NotificationCounts
  /** Quyền cần có; thiếu thì bước bị bỏ khỏi luồng. */
  requires?: string[]
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
export const SETUP_FLOWS: SetupFlow[] = [
  {
    id: 'SETUP',
    label: 'Thiết lập kỳ & đợt',
    description: 'Tạo khung thời gian để mọi chỉ tiêu bám vào',
    requiresAny: ['KPI_PERIOD:CREATE'],
    steps: [
      {
        id: 'cycle',
        label: 'Kỳ',
        hint: 'Gom nhiều đợt để đánh giá tổng thể. Bỏ qua được.',
        kind: 'builtin',
        builtin: 'cycle',
        stage: 'CYCLE_SETUP',
        requires: ['KPI_CYCLE:CREATE'],
      },
      {
        id: 'period',
        label: 'Đợt',
        hint: 'Mốc thời gian mà mọi chỉ tiêu bám vào',
        kind: 'builtin',
        builtin: 'period',
        stage: 'PERIOD_SETUP',
      },
    ],
  },

  {
    id: 'ASSIGN',
    label: 'Giao chỉ tiêu',
    description: 'Soạn chỉ tiêu cho đợt rồi gửi đi duyệt',
    requiresAny: ['KPI:CREATE'],
    // Có quyền tự duyệt thì chỉ tiêu vừa tạo đã có hiệu lực ngay, không có khoảng chờ nào ngăn
    // cách với việc nộp báo cáo — nên hai luồng nhập làm một mạch thay vì bắt quay ra chọn lại.
    mergedWhenHasAny: ['KPI:APPROVE_OWN'],
    mergedLabel: 'Giao chỉ tiêu & nộp báo cáo',
    mergedDescription: 'Chỉ tiêu bạn tạo có hiệu lực ngay, nên nộp báo cáo được luôn trong cùng một mạch',
    steps: [
      {
        id: 'period',
        label: 'Chọn đợt',
        hint: 'Chỉ tiêu phải thuộc về một đợt',
        kind: 'builtin',
        builtin: 'period',
        stage: 'PERIOD_SETUP',
      },
      {
        id: 'criteria',
        label: 'Chỉ tiêu',
        hint: 'Thêm liên tục cho tới khi đủ 100% trọng số',
        kind: 'builtin',
        builtin: 'criteria',
        stage: 'CRITERIA_DRAFT',
      },
      {
        id: 'review',
        label: 'Gửi duyệt',
        hint: 'Xem lại toàn bộ rồi gửi cấp trên',
        kind: 'builtin',
        builtin: 'review',
        stage: 'CRITERIA_APPROVAL',
        // Có quyền tự duyệt thì chỉ tiêu ra đời đã ở trạng thái ĐÃ DUYỆT — không có gì để gửi.
        skipWhenHasAny: ['KPI:APPROVE_OWN'],
      },
      {
        id: 'waiting',
        label: 'Chờ duyệt',
        hint: 'Cấp trên đang xem xét. Bạn quay lại sau, không phải ngồi đợi ở đây.',
        kind: 'wait',
        route: '/kpi-criteria',
        ctaLabel: 'Xem trạng thái chỉ tiêu',
        stage: 'CRITERIA_APPROVAL',
        skipWhenHasAny: ['KPI:APPROVE_OWN'],
      },

      // Hai bước dưới đây vốn thuộc luồng Nộp báo cáo. Chúng chỉ xuất hiện ở đây khi người dùng
      // có quyền tự duyệt — lúc đó luồng Nộp báo cáo tự ẩn đi để không bày ra hai lối vào cho
      // cùng một việc.
      {
        id: 'my-kpi',
        label: 'KPI của tôi',
        hint: 'Chỉ tiêu vừa tạo đã có hiệu lực — nộp báo cáo được ngay',
        kind: 'action',
        route: '/my-kpi',
        ctaLabel: 'Mở KPI của tôi',
        counter: 'myPendingTasks',
        stage: 'SUBMISSION',
        onlyWhenHasAny: ['KPI:APPROVE_OWN'],
      },
      {
        id: 'self-eval',
        label: 'Tự đánh giá',
        hint: 'Chấm điểm cho chính mình khi đã nộp xong cả đợt',
        kind: 'action',
        route: '/evaluations',
        ctaLabel: 'Mở trang đánh giá',
        stage: 'SELF_EVALUATION',
        onlyWhenHasAny: ['KPI:APPROVE_OWN'],
      },
    ],
  },

  {
    id: 'APPROVE',
    label: 'Duyệt chỉ tiêu',
    description: 'Xét duyệt chỉ tiêu và yêu cầu điều chỉnh của cấp dưới',
    requiresAny: ['KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT'],
    counter: 'pendingKpis',
    steps: [
      {
        id: 'pending-criteria',
        label: 'Chỉ tiêu chờ duyệt',
        hint: 'Duyệt hoặc từ chối từng chỉ tiêu cấp dưới gửi lên',
        kind: 'action',
        route: '/kpi-criteria/pending',
        ctaLabel: 'Mở màn duyệt chỉ tiêu',
        counter: 'pendingKpis',
        stage: 'CRITERIA_APPROVAL',
        requires: ['KPI:APPROVE_CRITERIA'],
      },
      {
        id: 'pending-adjustments',
        label: 'Điều chỉnh chờ duyệt',
        hint: 'Yêu cầu đổi mục tiêu của chỉ tiêu đã duyệt',
        kind: 'action',
        route: '/kpi-adjustments/pending',
        ctaLabel: 'Mở màn duyệt điều chỉnh',
        counter: 'pendingAdjustments',
        stage: 'CRITERIA_ADJUSTMENT',
        requires: ['KPI:APPROVE_ADJUSTMENT'],
      },
    ],
  },

  {
    id: 'REPORT',
    label: 'Nộp báo cáo',
    description: 'Báo cáo kết quả cho từng chỉ tiêu rồi tự đánh giá',
    requiresAny: ['SUBMISSION:CREATE', 'KPI:VIEW_MY'],
    counter: 'myPendingTasks',
    // Đã nằm gọn trong luồng Giao chỉ tiêu với người có quyền tự duyệt — bày thêm thẻ riêng ở đây
    // là hai lối vào cho cùng một việc.
    hiddenWhenHasAny: ['KPI:APPROVE_OWN'],
    steps: [
      {
        id: 'my-kpi',
        label: 'KPI của tôi',
        hint: 'Xem những chỉ tiêu bạn được giao và còn phải nộp',
        kind: 'action',
        route: '/my-kpi',
        ctaLabel: 'Mở KPI của tôi',
        counter: 'myPendingTasks',
        stage: 'SUBMISSION',
      },
      {
        id: 'self-eval',
        label: 'Tự đánh giá',
        hint: 'Chấm điểm cho chính mình khi đã nộp xong cả đợt',
        kind: 'action',
        route: '/evaluations',
        ctaLabel: 'Mở trang đánh giá',
        stage: 'SELF_EVALUATION',
      },
    ],
  },

  {
    id: 'EVALUATE',
    label: 'Duyệt báo cáo & đánh giá',
    description: 'Xét bản nộp của nhân viên rồi chấm điểm cuối đợt, cuối kỳ',
    // KHÔNG dùng `EVALUATION:CREATE` làm điều kiện: nhân viên cũng có quyền đó, vì nó là quyền
    // dùng cho TỰ đánh giá. Lấy nó làm tín hiệu quản lý sẽ bày luồng này ra cho cả nhân viên.
    // `SUBMISSION:REVIEW` và `CYCLE_EVAL:FINALIZE` mới thật sự chỉ có ở cấp quản lý.
    requiresAny: ['SUBMISSION:REVIEW', 'CYCLE_EVAL:FINALIZE'],
    counter: 'pendingSubmissions',
    steps: [
      {
        id: 'pending-submissions',
        label: 'Báo cáo chờ duyệt',
        hint: 'Xét bản nộp của nhân viên trong đơn vị',
        kind: 'action',
        route: '/submissions/org-unit',
        ctaLabel: 'Mở màn phê duyệt',
        counter: 'pendingSubmissions',
        stage: 'SUBMISSION_REVIEW',
        requires: ['SUBMISSION:REVIEW'],
      },
      {
        id: 'evaluate-staff',
        label: 'Đánh giá nhân viên',
        hint: 'Chấm điểm cuối đợt cho từng người',
        kind: 'action',
        route: '/evaluations',
        ctaLabel: 'Mở trang đánh giá',
        stage: 'MANAGER_EVALUATION',
        // Cùng lý do như trên: chấm điểm NGƯỜI KHÁC là việc của quản lý, và backend còn đòi thêm
        // người chấm phải là trưởng đơn vị. `SUBMISSION:REVIEW` là tín hiệu sát nhất mà frontend
        // kiểm được, vì cấp bậc trong đơn vị thì chỉ backend biết.
        requires: ['SUBMISSION:REVIEW'],
      },
      {
        id: 'cycle-eval',
        label: 'Đánh giá kỳ',
        hint: 'Tổng hợp nhiều đợt rồi chốt kết quả của cả kỳ',
        kind: 'action',
        route: '/kpi-cycles/evaluation',
        ctaLabel: 'Mở đánh giá kỳ',
        stage: 'CYCLE_EVALUATION',
        requires: ['CYCLE_EVAL:VIEW'],
      },
    ],
  },
]
