import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
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
        if (step.onlyWhenHasAny && !step.onlyWhenHasAny.some(p => hasPermission(p))) return false
        return true
      }),
    [isEnabled, hasPermission],
  )

  /** Các luồng người này thật sự đi được — luồng không còn bước nào thì cũng bỏ luôn. */
  const flows = useMemo(
    () =>
      SETUP_FLOWS.filter(f => f.requiresAny.some(p => hasPermission(p)))
        // Luồng đã được gộp vào luồng khác thì không hiện thẻ riêng nữa.
        .filter(f => !f.hiddenWhenHasAny?.some(p => hasPermission(p)))
        .map(f => {
          // Luồng nuốt thêm bước thì nhãn cũ không còn mô tả đúng việc nó làm.
          const merged = !!f.mergedWhenHasAny?.some(p => hasPermission(p))
          return {
            ...f,
            merged,
            label: merged && f.mergedLabel ? f.mergedLabel : f.label,
            description: merged && f.mergedDescription ? f.mergedDescription : f.description,
            steps: resolveSteps(f),
          }
        })
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
   * Tổng trọng số của cặp (đơn vị, đợt) đang mang theo trên URL — chính con số mà backend đem so
   * với 100% khi chặn gửi duyệt, nên chốt chặn ở đây không bao giờ nói khác server.
   *
   * Truy vấn này đã được bước Chỉ tiêu gọi với cùng khoá, React Query gộp làm một.
   */
  const { data: serverWeight } = useKpiTotalWeight(orgUnitId ?? undefined, periodId ?? undefined)

  /**
   * Lý do KHÔNG vào được một bước, hoặc `undefined` nếu vào được.
   *
   * Trả về câu chữ chứ không phải boolean: trước đây bước chưa mở được chỉ đơn giản là một nút bị
   * vô hiệu hoá — người dùng bấm mãi không hiểu vì sao không đi tiếp được. Có câu lý do thì mọi
   * nơi chặn đều nói được ra thành lời.
   *
   * Nhận `pending` để kiểm trên giá trị SẮP ghi vào URL: `goNext({periodId})` ở bước chọn đợt chạy
   * trước khi URL kịp đổi, đọc giá trị cũ sẽ từ chối chính cú điều hướng vừa hợp lệ.
   */
  const blockReason = useCallback(
    (id: string, pending?: { periodId?: string | null; orgUnitId?: string | null }): string | undefined => {
      const step = steps.find(s => s.id === id)
      if (!step?.needs?.length) return undefined

      const effectivePeriodId = pending && 'periodId' in pending ? pending.periodId : periodId
      const effectiveUnitId = pending && 'orgUnitId' in pending ? pending.orgUnitId : orgUnitId

      if (step.needs.includes('period') && !effectivePeriodId) {
        return 'Hãy chọn hoặc tạo một đợt KPI ở bước trước đã.'
      }

      if (step.needs.includes('weight100')) {
        if (!effectiveUnitId) {
          return 'Chưa có chỉ tiêu nào. Quay lại bước Chỉ tiêu để thêm cho tới khi đủ 100% trọng số.'
        }
        // Con số đã tải là của ĐƠN VỊ TRÊN URL. Người gọi đang chuyển sang một đơn vị khác thì nó
        // không nói gì về đơn vị đó — nhường lại cho phép kiểm tại chỗ của bước Chỉ tiêu, nơi có
        // trọng số đúng của cặp đang nhìn. Chặn bằng số của đơn vị khác là từ chối nhầm.
        const weightMatchesUnit = effectiveUnitId === orgUnitId

        // Đang tải thì KHÔNG chặn: chặn theo dữ liệu chưa về là từ chối nhầm người làm đúng.
        if (weightMatchesUnit && serverWeight != null && Math.abs(serverWeight - 100) > 0.001) {
          return serverWeight > 100
            ? `Tổng trọng số đang là ${serverWeight.toFixed(1)}%, vượt 100%. Hãy giảm bớt ở bước Chỉ tiêu.`
            : `Tổng trọng số mới đạt ${serverWeight.toFixed(1)}%, còn thiếu ${(100 - serverWeight).toFixed(1)}%. Hãy thêm chỉ tiêu cho đủ 100%.`
        }
      }

      return undefined
    },
    [steps, periodId, orgUnitId, serverWeight],
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

  /**
   * Đi tới một bước. Trả về `false` và báo lỗi ra màn hình nếu bước đó chưa mở được.
   *
   * Chốt chặn đặt Ở ĐÂY chứ không phải ở từng nút: mọi lối đi tới một bước — nút "Tiếp tục", vòng
   * tròn đánh số trên thanh bước, hay gõ thẳng URL — đều chảy qua đây, nên không có đường vòng nào
   * lọt qua mà quên kiểm.
   */
  const goTo = useCallback(
    (step: string, extra?: Record<string, string | null | undefined>) => {
      if (!currentFlow) return false

      const pending: { periodId?: string | null; orgUnitId?: string | null } = {}
      if (extra && WORKFLOW_PARAMS.period in extra) pending.periodId = extra[WORKFLOW_PARAMS.period]
      if (extra && 'orgUnitId' in extra) pending.orgUnitId = extra.orgUnitId

      const reason = blockReason(step, pending)
      if (reason) {
        toast.error(reason)
        return false
      }

      navigate(buildUrl(currentFlow.id, step, extra))
      return true
    },
    [currentFlow, buildUrl, navigate, blockReason],
  )

  const goNext = useCallback(
    (extra?: Record<string, string | null | undefined>) => {
      const next = steps[currentIndex + 1]
      // Hết bước nghĩa là xong luồng — về lại màn chọn luồng thay vì mắc kẹt ở bước cuối.
      if (next) return goTo(next.id, extra)
      navigate('/kpi-setup')
      return true
    },
    [steps, currentIndex, goTo, navigate],
  )

  // Lùi lại KHÔNG kiểm điều kiện: bước trước chính là nơi người dùng phải quay về để làm cho đủ
  // điều kiện. Chặn cả đường lùi là nhốt họ lại.
  const goBack = useCallback(() => {
    if (!currentFlow) return
    const prev = steps[currentIndex - 1]
    if (prev) navigate(buildUrl(currentFlow.id, prev.id))
    else navigate('/kpi-setup')
  }, [steps, currentIndex, currentFlow, buildUrl, navigate])

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
    blockReason,
    buildUrl,
    goTo,
    goNext,
    goBack,
    approvalEnabled: isEnabled('CRITERIA_APPROVAL'),
  }
}
