import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiWorkflow } from './useKpiWorkflow'
import type { WorkflowStage, WorkflowStageCode } from '../types'

/** Bối cảnh mang theo khi sang bước sau. Khoá nào không có thì bỏ qua. */
export interface WorkflowContext {
  periodId?: string | null
  cycleId?: string | null
  kpiId?: string | null
}

/** Tên tham số URL dùng chung cho cả luồng — xem bảng quy ước trong kế hoạch. */
export const WORKFLOW_PARAMS = {
  period: 'periodId',
  cycle: 'cycleId',
  kpi: 'kpiId',
  /** Mở sẵn form tạo khi vừa tới bước mới. */
  openCreate: 'new',
  /** Mã bước vừa rời, để trang đích hiện lối quay lại. */
  from: 'from',
} as const

/**
 * Nơi DUY NHẤT trả lời "làm xong bước này thì đi đâu tiếp".
 *
 * Đích lấy từ `nextStage()` của cấu hình luồng chứ không viết cứng, nên tổ chức tắt bước duyệt chỉ
 * tiêu thì gửi duyệt xong sẽ nhảy thẳng sang bước nộp báo cáo — không cần sửa một dòng nào ở các
 * trang gọi tới.
 *
 * Bổ sung đúng một điều mà `nextStage()` chưa làm: bỏ qua những bước người dùng không có quyền mở.
 * Không có nó thì nhân viên nộp báo cáo xong sẽ bị ném sang màn duyệt và nhận trang 403.
 */
export function useWorkflowNavigator() {
  const navigate = useNavigate()
  const { hasPermission } = useHasPermission()
  const { enabledStages, byCode } = useKpiWorkflow()

  /** Bước kế tiếp mà người dùng THẬT SỰ vào được, bỏ qua các bước bị chặn quyền. */
  const nextReachableStage = useCallback(
    (from: WorkflowStageCode): WorkflowStage | undefined => {
      const index = enabledStages.findIndex((s) => s.code === from)
      if (index < 0) return undefined
      return enabledStages.slice(index + 1).find((s) => hasPermission(s.navPermission))
    },
    [enabledStages, hasPermission],
  )

  /** Bước đầu tiên đang bật mà người dùng vào được — dùng cho nút "Bắt đầu thiết lập KPI". */
  const firstReachableStage = useCallback(
    (): WorkflowStage | undefined => enabledStages.find((s) => hasPermission(s.navPermission)),
    [enabledStages, hasPermission],
  )

  const buildUrl = useCallback(
    (stage: WorkflowStage, context: WorkflowContext = {}, from?: WorkflowStageCode, openCreate = true) => {
      const [path, query] = stage.route.split('?')
      const params = new URLSearchParams(query)

      if (context.periodId) params.set(WORKFLOW_PARAMS.period, context.periodId)
      if (context.cycleId) params.set(WORKFLOW_PARAMS.cycle, context.cycleId)
      if (context.kpiId) params.set(WORKFLOW_PARAMS.kpi, context.kpiId)
      if (openCreate) params.set(WORKFLOW_PARAMS.openCreate, '1')
      if (from) params.set(WORKFLOW_PARAMS.from, from)

      // Bước Tự đánh giá chỉ mở được modal khi có đợt; thiếu đợt thì bỏ action đi cho khỏi
      // dẫn tới một liên kết bấm vào không phản ứng gì.
      if (params.get('action') === 'self-eval' && !params.get(WORKFLOW_PARAMS.period)) {
        params.delete('action')
      }

      const rest = params.toString()
      return rest ? `${path}?${rest}` : (path ?? stage.route)
    },
    [],
  )

  /**
   * Sang bước kế tiếp. Trả về `true` nếu đã điều hướng.
   *
   * Trả `false` khi không còn bước nào đi tiếp được — trang gọi tự quyết định làm gì (thường là
   * giữ nguyên hành vi cũ), thay vì bị kẹt lại mà không biết vì sao.
   */
  const goToNext = useCallback(
    (from: WorkflowStageCode, context: WorkflowContext = {}, options?: { openCreate?: boolean }) => {
      const stage = nextReachableStage(from)
      if (!stage) return false
      navigate(buildUrl(stage, context, from, options?.openCreate ?? true))
      return true
    },
    [nextReachableStage, buildUrl, navigate],
  )

  /** Sang một bước cụ thể — dùng cho nút khởi động luồng và các lối quay lại. */
  const goToStage = useCallback(
    (code: WorkflowStageCode, context: WorkflowContext = {}, options?: { openCreate?: boolean }) => {
      const stage = byCode.get(code)
      if (!stage) return false
      navigate(buildUrl(stage, context, undefined, options?.openCreate ?? false))
      return true
    },
    [byCode, buildUrl, navigate],
  )

  return { goToNext, goToStage, nextReachableStage, firstReachableStage, buildUrl }
}
