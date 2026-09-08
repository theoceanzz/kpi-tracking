/** Mã các bước của luồng KPI — khớp enum `WorkflowStage` bên backend. */
export type WorkflowStageCode =
  | 'CYCLE_SETUP'
  | 'PERIOD_SETUP'
  | 'CRITERIA_DRAFT'
  | 'CRITERIA_APPROVAL'
  | 'CRITERIA_ADJUSTMENT'
  | 'SUBMISSION'
  | 'SUBMISSION_REVIEW'
  | 'SELF_EVALUATION'
  | 'MANAGER_EVALUATION'
  | 'CYCLE_EVALUATION'

/**
 * Một bước, đã được backend gộp sẵn giữa danh mục tĩnh và lựa chọn của tổ chức.
 *
 * Gộp ở backend nên frontend không tự ghép hai nguồn rồi để chúng lệch nhau — đúng cái đã xảy ra
 * giữa `navItems` trong Sidebar và `menuItems` trong SystemSettingsPage.
 */
export interface WorkflowStage {
  code: WorkflowStageCode
  label: string
  route: string
  extraRoutes: string[]
  /** Quyền để THẤY mục menu. */
  navPermission: string
  /** Quyền để THỰC HIỆN hành động của bước. */
  actionPermission: string
  /** Các bước phải còn bật thì bước này mới có nghĩa. */
  requires: WorkflowStageCode[]
  /** Bước lõi: công tắc bị khoá ở màn hình cấu hình. */
  required: boolean
  enabled: boolean
  order: number
  options: Record<string, unknown>
}

export interface WorkflowUiConfig {
  showRail: boolean
  groupInSidebar: boolean
}

export interface WorkflowConfig {
  schemaVersion: number
  /** Đã sắp theo thứ tự hiển thị của tổ chức. */
  stages: WorkflowStage[]
  ui: WorkflowUiConfig
  warnings: string[]
  /** Người đang đăng nhập có quyền sửa cấu hình này không. */
  canManage: boolean
}

/** Thân yêu cầu cập nhật. Gửi thiếu bước nào thì bước đó giữ nguyên cấu hình đang có. */
export interface UpdateWorkflowConfigRequest {
  stages: Array<{
    code: WorkflowStageCode
    enabled: boolean
    order: number
    options?: Record<string, unknown>
  }>
  ui?: WorkflowUiConfig
}
