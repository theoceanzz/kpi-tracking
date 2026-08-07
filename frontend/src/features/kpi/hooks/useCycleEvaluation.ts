import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { kpiCycleEvaluationApi } from '../api/kpiCycleEvaluationApi'
import { toast } from 'sonner'

/**
 * Ưu tiên message của server: luật chốt/mở khoá theo cấp bậc trả về lý do cụ thể
 * ("do X (Trưởng phòng) chốt…"), hữu ích hơn nhiều so với câu báo lỗi chung.
 */
const serverMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message || fallback

/** Tổng hợp đánh giá phòng ban theo kỳ (kèm danh sách thành viên). */
export const useUnitCycleSummary = (cycleId?: string, orgUnitId?: string) => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['cycleUnitSummary', cycleId, orgUnitId],
    queryFn: () => kpiCycleEvaluationApi.getUnitSummary(cycleId!, orgUnitId!),
    enabled: !!cycleId && !!orgUnitId,
  })

  // Chốt/mở khoá làm đổi cả chuỗi duyệt (khoá kế thừa xuống đơn vị con),
  // nên phải làm mới toàn bộ chain chứ không chỉ đơn vị đang xem.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
    qc.invalidateQueries({ queryKey: ['cycleApprovalChain'] })
  }

  const finalizeMutation = useMutation({
    mutationFn: (comment: string) => kpiCycleEvaluationApi.finalizeUnit(cycleId!, orgUnitId!, comment),
    onSuccess: () => {
      invalidate()
      toast.success('Đã chốt đánh giá phòng ban theo kỳ')
    },
    onError: (error) => toast.error(serverMessage(error, 'Chốt đánh giá thất bại')),
  })

  const reopenMutation = useMutation({
    mutationFn: () => kpiCycleEvaluationApi.reopenUnit(cycleId!, orgUnitId!),
    onSuccess: () => {
      invalidate()
      toast.success('Đã mở khoá, có thể chỉnh lại điểm')
    },
    onError: (error) => toast.error(serverMessage(error, 'Mở khoá thất bại')),
  })

  const saveUserScoreMutation = useMutation({
    mutationFn: ({ userId, finalScore, qualScore, comment }:
      { userId: string; finalScore: number | null; qualScore: number | null; comment: string }) =>
      kpiCycleEvaluationApi.saveUserScore(cycleId!, userId, { finalScore, qualScore, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      toast.success('Đã lưu điểm chốt kỳ')
    },
    onError: (error) => toast.error(serverMessage(error, 'Lưu điểm chốt kỳ thất bại')),
  })

  const sendEvaluationMutation = useMutation({
    mutationFn: (userIds: string[]) => kpiCycleEvaluationApi.sendEvaluation(cycleId!, orgUnitId!, userIds),
    onSuccess: (result) => {
      if (result.failed.length === 0) {
        toast.success(`Đã gửi kết quả đánh giá cho ${result.sent} nhân viên`)
      } else {
        // Gửi hàng loạt là bán phần: báo rõ ai hỏng thay vì chỉ nói "thành công".
        toast.warning(
          `Đã gửi ${result.sent} email. Không gửi được cho: ${result.failed.join(', ')}`,
          { duration: 8000 },
        )
      }
    },
    onError: (error) => toast.error(serverMessage(error, 'Gửi email thất bại')),
  })

  return {
    ...query,
    finalize: finalizeMutation.mutateAsync,
    sendEvaluation: sendEvaluationMutation.mutateAsync,
    isSending: sendEvaluationMutation.isPending,
    isFinalizing: finalizeMutation.isPending,
    reopen: reopenMutation.mutateAsync,
    isReopening: reopenMutation.isPending,
    saveUserScore: saveUserScoreMutation.mutateAsync,
    isSavingUserScore: saveUserScoreMutation.isPending,
  }
}

/**
 * Chuỗi duyệt của kỳ: đơn vị đang xem → các đơn vị cha lên tới gốc.
 * Server tính sẵn canFinalize/canReopen/blockedReason cho người dùng hiện tại.
 */
export const useCycleApprovalChain = (cycleId?: string, orgUnitId?: string) =>
  useQuery({
    queryKey: ['cycleApprovalChain', cycleId, orgUnitId],
    queryFn: () => kpiCycleEvaluationApi.getApprovalChain(cycleId!, orgUnitId!),
    enabled: !!cycleId && !!orgUnitId,
  })
