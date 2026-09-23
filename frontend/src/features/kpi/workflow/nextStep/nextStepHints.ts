import type { KpiCriteria, KpiPeriod } from '@/types/kpi'
import type { WorkflowStage, WorkflowStageCode } from '../types'
import type { WorkflowContext } from '../hooks/useWorkflowNavigator'

/** Việc vừa làm xong, kèm KẾT QUẢ của nó — kết quả mới là thứ quyết định có gợi ý hay không. */
export type NextStepEvent =
  | { type: 'KPI_CREATED'; kpi: KpiCriteria }
  | { type: 'PERIOD_CREATED'; period: Pick<KpiPeriod, 'id' | 'name'> }
  | { type: 'CYCLE_CREATED'; cycle: { id: string; name: string } }

export interface NextStepHint {
  /** Bước đích — để lấy biểu tượng và tên bước. */
  stage: WorkflowStageCode
  title: string
  description?: string
  actionLabel: string
  /** URL đích, đã mang theo bối cảnh (đợt, kỳ, chỉ tiêu). */
  to: string
}

export interface NextStepContext {
  userId: string | undefined
  hasPermission: (permission: string) => boolean
  isEnabled: (code: WorkflowStageCode) => boolean
  byCode: Map<WorkflowStageCode, WorkflowStage>
  buildUrl: (stage: WorkflowStage, context?: WorkflowContext, from?: WorkflowStageCode, openCreate?: boolean) => string
}

/**
 * Sự kiện + bối cảnh → gợi ý bước tiếp theo, hoặc `null` nếu không có việc gì cho CHÍNH người này.
 *
 * Phần khó không phải là nói bước tiếp theo là gì, mà là biết khi nào KHÔNG nói. Cùng một thao tác
 * "tạo chỉ tiêu" cho ba kết quả:
 *
 * - Trưởng phòng có quyền tự duyệt, giao cho mình → chỉ tiêu ĐÃ DUYỆT và người thực hiện là họ
 *   → việc kế tiếp là nộp báo cáo → có gợi ý.
 * - Nhân viên → chỉ tiêu còn NHÁP / chờ duyệt → bước kế tiếp là của cấp trên → im lặng.
 * - Sếp giao cho cấp dưới → đã duyệt nhưng người thực hiện là NGƯỜI KHÁC → không có gì để nộp → im lặng.
 *
 * `nextReachableStage` của navigator chỉ xét cấu hình + quyền, nên với sếp vẫn trả về "Nộp báo
 * cáo". Hàm này đặt thêm lớp xét KẾT QUẢ lên trên và dùng lại mọi thứ bên dưới. Thuần, không React.
 */
export function resolveNextStepHint(event: NextStepEvent, ctx: NextStepContext): NextStepHint | null {
  const reachable = (code: WorkflowStageCode): WorkflowStage | null => {
    const stage = ctx.byCode.get(code)
    if (!stage || !ctx.isEnabled(code)) return null
    return ctx.hasPermission(stage.navPermission) ? stage : null
  }

  switch (event.type) {
    case 'KPI_CREATED': {
      const { kpi } = event
      // Cả ba điều kiện phải cùng đúng — thiếu một là chưa có việc gì cho người này.
      if (kpi.status !== 'APPROVED') return null
      if (!ctx.userId || !kpi.assigneeIds?.includes(ctx.userId)) return null
      const stage = reachable('SUBMISSION')
      if (!stage) return null
      return {
        stage: 'SUBMISSION',
        title: `Nộp báo cáo cho «${kpi.name}»`,
        description: 'Chỉ tiêu đã có hiệu lực và được giao cho bạn.',
        actionLabel: 'Nộp ngay',
        to: `/submissions/new?kpiId=${kpi.id}`,
      }
    }

    case 'PERIOD_CREATED': {
      const stage = reachable('CRITERIA_DRAFT')
      if (!stage) return null
      return {
        stage: 'CRITERIA_DRAFT',
        title: `Giao chỉ tiêu cho đợt «${event.period.name}»`,
        description: 'Đợt đã sẵn sàng, chưa có chỉ tiêu nào bám vào.',
        actionLabel: 'Giao chỉ tiêu',
        to: ctx.buildUrl(stage, { periodId: event.period.id }, 'PERIOD_SETUP', true),
      }
    }

    case 'CYCLE_CREATED': {
      const stage = reachable('PERIOD_SETUP')
      if (!stage) return null
      return {
        stage: 'PERIOD_SETUP',
        title: `Tạo đợt cho kỳ «${event.cycle.name}»`,
        description: 'Kỳ cần ít nhất một đợt để chỉ tiêu bám vào.',
        actionLabel: 'Tạo đợt',
        to: ctx.buildUrl(stage, { cycleId: event.cycle.id }, 'CYCLE_SETUP', true),
      }
    }

    default:
      return null
  }
}
