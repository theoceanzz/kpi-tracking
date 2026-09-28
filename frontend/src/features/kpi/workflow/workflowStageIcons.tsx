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
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
export const STAGE_HINTS = perLanguage((): Record<WorkflowStageCode, string> => ({
  CYCLE_SETUP: i18n.t('kpi:workflowStageIcons.createCyclesMonthQuarterYearTo'),
  PERIOD_SETUP: i18n.t('kpi:workflowStageIcons.createKpiPeriodsTheTimeFrames'),
  CRITERIA_DRAFT: i18n.t('kpi:workflowStageIcons.draftAndAssignKpisToUnits'),
  CRITERIA_APPROVAL: i18n.t('kpi:workflowStageIcons.managersApproveKpisBeforeTheyTake'),
  CRITERIA_ADJUSTMENT: i18n.t('kpi:workflowStageIcons.allowRequestingAdjustmentsToTheTarget'),
  SUBMISSION: i18n.t('kpi:workflowStageIcons.employeesSubmitResultReportsForEach'),
  SUBMISSION_REVIEW: i18n.t('kpi:workflowStageIcons.managersApproveSubmissionsIfThisStep'),
  SELF_EVALUATION: i18n.t('kpi:workflowStageIcons.employeesSelfScoreAtTheEnd'),
  MANAGER_EVALUATION: i18n.t('kpi:workflowStageIcons.managersScoreEmployeesAtTheEnd'),
  CYCLE_EVALUATION: i18n.t('kpi:workflowStageIcons.summarizeAndFinalizeEvaluationResultsBy'),
}))

/**
 * Ai thường làm bước này — hiện dưới tên bước trên sơ đồ luồng.
 *
 * Là danh xưng chung cho người đọc, KHÔNG phải tên vai trò của tổ chức (dự án cố ý không hardcode
 * tên vai trò; tổ chức tự đặt tên nên tên không đáng tin). Quyền thật để làm bước nằm ở
 * `actionPermission` do backend trả về.
 */
export const STAGE_ACTORS = perLanguage((): Record<WorkflowStageCode, string> => ({
  CYCLE_SETUP: i18n.t('kpi:workflowStageIcons.adminHr'),
  PERIOD_SETUP: i18n.t('kpi:workflowStageIcons.adminHr'),
  CRITERIA_DRAFT: i18n.t('kpi:workflowStageIcons.managersEmployees'),
  CRITERIA_APPROVAL: i18n.t('kpi:workflowStageIcons.directManager'),
  CRITERIA_ADJUSTMENT: i18n.t('kpi:workflowStageIcons.directManager'),
  SUBMISSION: i18n.t('kpi:workflowStageIcons.employee'),
  SUBMISSION_REVIEW: i18n.t('kpi:workflowStageIcons.unitManager'),
  SELF_EVALUATION: i18n.t('kpi:workflowStageIcons.employee'),
  MANAGER_EVALUATION: i18n.t('kpi:workflowStageIcons.unitManager'),
  CYCLE_EVALUATION: i18n.t('kpi:workflowStageIcons.boardOfDirectorsHr'),
}))
