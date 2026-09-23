import {
  Award,
  CalendarRange,
  ClipboardCheck,
  Layers,
  ListChecks,
  MessageSquare,
  Star,
  Target,
  UserCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { WorkflowStageCode } from './types'

/**
 * Biểu tượng cho từng bước — phần DUY NHẤT của danh mục bước còn nằm ở frontend.
 *
 * Mọi thứ khác (route, quyền, phụ thuộc, nhãn, thứ tự) đến từ `GET /kpi-workflow/stages` để hai
 * bên không lệch nhau. Biểu tượng ở lại đây vì nó là component React, không phải dữ liệu.
 * Giữ đúng biểu tượng mà Sidebar đang dùng cho từng route, để giao diện không đổi mặt sau refactor.
 */
const ICONS: Record<WorkflowStageCode, (size: number) => ReactNode> = {
  CYCLE_SETUP: (s) => <CalendarRange size={s} />,
  PERIOD_SETUP: (s) => <Layers size={s} />,
  CRITERIA_DRAFT: (s) => <Target size={s} />,
  CRITERIA_APPROVAL: (s) => <ClipboardCheck size={s} />,
  CRITERIA_ADJUSTMENT: (s) => <MessageSquare size={s} />,
  SUBMISSION: (s) => <ListChecks size={s} />,
  SUBMISSION_REVIEW: (s) => <ClipboardCheck size={s} />,
  SELF_EVALUATION: (s) => <UserCheck size={s} />,
  MANAGER_EVALUATION: (s) => <Star size={s} />,
  CYCLE_EVALUATION: (s) => <Award size={s} />,
}

export function stageIcon(code: WorkflowStageCode, size = 18): ReactNode {
  return ICONS[code]?.(size) ?? <Target size={size} />
}

/** Mô tả ngắn hiện trên sơ đồ luồng và bảng chi tiết của màn hình cấu hình. */
export const STAGE_HINTS: Record<WorkflowStageCode, string> = {
  CYCLE_SETUP: 'Tạo kỳ (tháng/quý/năm) để gom nhiều đợt KPI.',
  PERIOD_SETUP: 'Tạo đợt KPI — mốc thời gian mà mọi hoạt động KPI bám vào.',
  CRITERIA_DRAFT: 'Soạn và giao chỉ tiêu KPI cho đơn vị, cá nhân.',
  CRITERIA_APPROVAL: 'Cấp trên duyệt chỉ tiêu trước khi có hiệu lực. Tắt bước này thì chỉ tiêu tạo ra là đã duyệt.',
  CRITERIA_ADJUSTMENT: 'Cho phép xin điều chỉnh mục tiêu của chỉ tiêu đã duyệt.',
  SUBMISSION: 'Nhân viên nộp báo cáo kết quả theo từng chỉ tiêu.',
  SUBMISSION_REVIEW: 'Quản lý duyệt bản nộp. Tắt bước này thì bản nộp được duyệt tự động.',
  SELF_EVALUATION: 'Nhân viên tự chấm điểm cuối đợt.',
  MANAGER_EVALUATION: 'Quản lý chấm điểm nhân viên cuối đợt.',
  CYCLE_EVALUATION: 'Tổng hợp và chốt kết quả đánh giá theo kỳ.',
}

/**
 * Ai thường làm bước này — hiện dưới tên bước trên sơ đồ luồng.
 *
 * Là danh xưng chung cho người đọc, KHÔNG phải tên vai trò của tổ chức (dự án cố ý không hardcode
 * tên vai trò; tổ chức tự đặt tên nên tên không đáng tin). Quyền thật để làm bước nằm ở
 * `actionPermission` do backend trả về.
 */
export const STAGE_ACTORS: Record<WorkflowStageCode, string> = {
  CYCLE_SETUP: 'Quản trị / Nhân sự',
  PERIOD_SETUP: 'Quản trị / Nhân sự',
  CRITERIA_DRAFT: 'Quản lý & nhân viên',
  CRITERIA_APPROVAL: 'Cấp trên trực tiếp',
  CRITERIA_ADJUSTMENT: 'Cấp trên trực tiếp',
  SUBMISSION: 'Nhân viên',
  SUBMISSION_REVIEW: 'Quản lý đơn vị',
  SELF_EVALUATION: 'Nhân viên',
  MANAGER_EVALUATION: 'Quản lý đơn vị',
  CYCLE_EVALUATION: 'Ban giám đốc / Nhân sự',
}
