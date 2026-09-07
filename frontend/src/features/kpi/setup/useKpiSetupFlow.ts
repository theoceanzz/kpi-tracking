import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiWorkflow } from '../workflow/hooks/useKpiWorkflow'
import { WORKFLOW_PARAMS } from '../workflow/hooks/useWorkflowNavigator'
import { SETUP_FLOWS, type SetupFlow, type SetupFlowId, type SetupStep } from './flows'

/**
 * Trạng thái của trình thiết lập: người này đi được những luồng nào, đang ở luồng/bước nào.
 *
 * Hai tầng lọc chồng lên nhau, mỗi tầng một nguồn sự thật khác nhau:
 *
 * 1. **Tổ chức** tắt bước nào (`useKpiWorkflow().isEnabled`) — luật nghiệp vụ, backend cưỡng chế.
 * 2. **Quyền của người dùng** — bước họ không mở được thì đưa vào luồng chỉ để dẫn tới trang 403.
 *
 * Cộng thêm `skipWhenHasAny`: có `KPI:APPROVE_OWN` thì hai bước gửi duyệt và chờ duyệt biến mất,
 * vì chỉ tiêu họ tạo ra đã được duyệt sẵn ngay từ backend.
 */
export function useKpiSetupFlow() {
  const navigate = useNavigate()
  const { flowId, stepId } = useParams<{ flowId?: string; stepId?: string }>()
  const [searchParams] = useSearchParams()
  const { hasPermission } = useHasPermission()
  const { isEnabled, isLoading } = useKpiWorkflow()

  /** Lọc các bước của một luồng theo cấu hình tổ chức + quyền + luật bỏ bước. */
  const resolveSteps = useCallback(
    (flow: SetupFlow): SetupStep[] =>
      flow.steps.filter(step => {
        if (step.stage && !isEnabled(step.stage)) return false
        if (step.requires && !step.requires.some(p => hasPermission(p))) return false
        if (step.skipWhenHasAny?.some(p => hasPermission(p))) return false
        return true
      }),
    [isEnabled, hasPermission],
  )

  /** Các luồng người này thật sự đi được — luồng không còn bước nào thì cũng bỏ luôn. */
  const flows = useMemo(
    () =>
      SETUP_FLOWS.filter(f => f.requiresAny.some(p => hasPermission(p)))
        .map(f => ({ ...f, steps: resolveSteps(f) }))
        .filter(f => f.steps.length > 0),
    [hasPermission, resolveSteps],
  )

  const currentFlow = useMemo(() => flows.find(f => f.id === flowId), [flows, flowId])
  // Ghi nhớ tham chiếu: `?? []` tạo mảng mới mỗi lần render khi chưa chọn luồng, khiến goNext và
  // goBack đổi định danh liên tục và mọi thứ phụ thuộc chúng render lại theo.
  const steps = useMemo(() => currentFlow?.steps ?? [], [currentFlow])
  const currentIndex = steps.findIndex(s => s.id === stepId)
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : undefined

  const cycleId = searchParams.get(WORKFLOW_PARAMS.cycle)
  const periodId = searchParams.get(WORKFLOW_PARAMS.period)
  const orgUnitId = searchParams.get('orgUnitId')

  /**
   * Bước mở được chưa. Chặn nhảy cóc bằng URL: chưa có đợt thì trang chỉ tiêu không có gì để gắn
   * vào và sẽ hỏng theo kiểu khó hiểu.
   */
  const isReachable = useCallback(
    (id: string) => (id === 'criteria' || id === 'review' ? !!periodId : true),
    [periodId],
  )

  /** Giữ nguyên mọi tham số bối cảnh khi đổi bước, chỉ ghi đè cái vừa có thêm. */
  const buildUrl = useCallback(
    (flow: SetupFlowId, step: string, extra?: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams)
      Object.entries(extra ?? {}).forEach(([k, v]) => {
        if (v) params.set(k, v)
        else params.delete(k)
      })
      const query = params.toString()
      return `/kpi-setup/${flow}/${step}${query ? `?${query}` : ''}`
    },
    [searchParams],
  )

  const goTo = useCallback(
    (step: string, extra?: Record<string, string | null | undefined>) => {
      if (!currentFlow) return
      navigate(buildUrl(currentFlow.id, step, extra))
    },
    [currentFlow, buildUrl, navigate],
  )

  const goNext = useCallback(
    (extra?: Record<string, string | null | undefined>) => {
      const next = steps[currentIndex + 1]
      // Hết bước nghĩa là xong luồng — về lại màn chọn luồng thay vì mắc kẹt ở bước cuối.
      if (next) goTo(next.id, extra)
      else navigate('/kpi-setup')
    },
    [steps, currentIndex, goTo, navigate],
  )

  const goBack = useCallback(() => {
    const prev = steps[currentIndex - 1]
    if (prev) goTo(prev.id)
    else navigate('/kpi-setup')
  }, [steps, currentIndex, goTo, navigate])

  return {
    flows,
    currentFlow,
    steps,
    currentStep,
    currentIndex,
    isFirst: currentIndex <= 0,
    isLast: currentIndex === steps.length - 1,
    isLoading,
    cycleId,
    periodId,
    orgUnitId,
    isReachable,
    buildUrl,
    goTo,
    goNext,
    goBack,
    approvalEnabled: isEnabled('CRITERIA_APPROVAL'),
  }
}
