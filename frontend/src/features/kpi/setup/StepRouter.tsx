import { Navigate } from 'react-router-dom'
import { useKpiSetupFlow } from './useKpiSetupFlow'
import ActionStep from './steps/ActionStep'
import CycleStep from './steps/CycleStep'
import PeriodStep from './steps/PeriodStep'
import CriteriaStep from './steps/CriteriaStep'
import ReviewStep from './steps/ReviewStep'
import SubmitStep from './steps/SubmitStep'
import SelfEvalStep from './steps/SelfEvalStep'

/**
 * Chọn component cho bước hiện tại.
 *
 * Một route duy nhất `/kpi-setup/:flowId/:stepId` thay vì khai từng bước trong router: danh sách
 * bước giờ suy ra từ quyền và cấu hình tổ chức tại thời điểm chạy, nên router không thể biết
 * trước có những bước nào.
 */
export default function StepRouter() {
  const { currentFlow, currentStep, steps, isLoading } = useKpiSetupFlow()

  if (isLoading) return null

  // Luồng không tồn tại (gõ tay, hoặc quyền vừa đổi) → về màn chọn luồng.
  if (!currentFlow) return <Navigate to="/kpi-setup" replace />

  // Bước không thuộc luồng này → về bước đầu của luồng.
  if (!currentStep) {
    const first = steps[0]
    return <Navigate to={first ? `/kpi-setup/${currentFlow.id}/${first.id}` : '/kpi-setup'} replace />
  }

  if (currentStep.kind !== 'builtin') return <ActionStep step={currentStep} />

  switch (currentStep.builtin) {
    case 'cycle': return <CycleStep />
    case 'period': return <PeriodStep />
    case 'criteria': return <CriteriaStep />
    case 'review': return <ReviewStep />
    case 'submit': return <SubmitStep />
    case 'self-eval': return <SelfEvalStep />
    default: return <Navigate to="/kpi-setup" replace />
  }
}
