import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workflowApi } from '../api/workflowApi'
import type { UpdateWorkflowConfigRequest, WorkflowStage, WorkflowStageCode } from '../types'

export const WORKFLOW_CONFIG_KEY = ['kpi-workflow', 'config']

/** Lấy thông báo lỗi do backend gửi kèm, vì nó nói rõ bước nào/luật nào chặn hơn câu chung chung. */
function apiMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message ?? fallback
}

/**
 * Luồng KPI đang hiệu lực của tổ chức.
 *
 * `staleTime` 30 phút khớp với `useSidebarSettings`: cả hai đều là cấu hình cấp tổ chức, đổi rất
 * thưa, và đều nằm trên đường vẽ menu nên không nên gọi lại mỗi lần điều hướng.
 */
export function useKpiWorkflow() {
  const query = useQuery({
    queryKey: WORKFLOW_CONFIG_KEY,
    queryFn: workflowApi.getConfig,
    staleTime: 1000 * 60 * 30,
  })

  const stages = useMemo<WorkflowStage[]>(() => query.data?.stages ?? [], [query.data])

  const enabledStages = useMemo(
    () => stages.filter((s) => s.enabled).sort((a, b) => a.order - b.order),
    [stages],
  )

  const helpers = useMemo(() => {
    const byCode = new Map(stages.map((s) => [s.code, s]))

    /**
     * Chưa tải xong thì coi như BẬT. Mặc định ngược lại sẽ khiến sidebar chớp mất các mục KPI
     * trong khoảnh khắc đầu tiên mỗi lần tải trang.
     */
    const isEnabled = (code: WorkflowStageCode) => byCode.get(code)?.enabled ?? true

    /**
     * Suy bước từ URL. Khớp dài nhất thắng, nên /kpi-criteria/pending không rơi vào /kpi-criteria.
     *
     * Hoà thì route KHÔNG kèm query thắng: Tự đánh giá và Kết quả đánh giá cùng ở /evaluations,
     * nhưng Tự đánh giá là hành động mở bằng ?action=self-eval chứ không phải trang. Thiếu luật
     * này thì tắt bước tự đánh giá sẽ ẩn mất cả mục menu của trang kết quả đánh giá.
     */
    const stageForPath = (path: string): WorkflowStage | undefined => {
      const clean = path.split('?')[0] ?? path
      let best: WorkflowStage | undefined
      let bestScore = 0
      for (const stage of stages) {
        for (const route of [stage.route, ...stage.extraRoutes]) {
          const base = route.split('?')[0] ?? route
          if (clean !== base && !clean.startsWith(`${base}/`)) continue
          const score = base.length * 2 + (route.includes('?') ? 0 : 1)
          if (score > bestScore) {
            best = stage
            bestScore = score
          }
        }
      }
      return best
    }

    const nextStage = (code: WorkflowStageCode): WorkflowStage | undefined => {
      const index = enabledStages.findIndex((s) => s.code === code)
      return index >= 0 ? enabledStages[index + 1] : undefined
    }

    return { isEnabled, stageForPath, nextStage, byCode }
  }, [stages, enabledStages])

  return {
    config: query.data,
    stages,
    enabledStages,
    isLoading: query.isLoading,
    canManage: query.data?.canManage ?? false,
    showRail: query.data?.ui?.showRail ?? true,
    ...helpers,
  }
}

export function useUpdateKpiWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateWorkflowConfigRequest) => workflowApi.updateConfig(data),
    onSuccess: (data) => {
      queryClient.setQueryData(WORKFLOW_CONFIG_KEY, data)
      toast.success('Đã cập nhật luồng KPI')
    },
    onError: (error: unknown) => {
      toast.error(apiMessage(error, 'Không lưu được cấu hình luồng KPI'))
    },
  })
}

export function useResetKpiWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: workflowApi.resetConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(WORKFLOW_CONFIG_KEY, data)
      toast.success('Đã khôi phục luồng KPI mặc định')
    },
    onError: (error: unknown) => {
      toast.error(apiMessage(error, 'Không khôi phục được cấu hình mặc định'))
    },
  })
}
