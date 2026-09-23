import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiCycleEvaluationApi } from '../api/kpiCycleEvaluationApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

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
    qc.invalidateQueries({ queryKey: ['cycleCalibration', cycleId, orgUnitId] })
    qc.invalidateQueries({ queryKey: ['cycleApprovalChain'] })
  }

  const calibrateMutation = useMutation({
    mutationFn: () => kpiCycleEvaluationApi.startCalibration(cycleId!, orgUnitId!),
    onSuccess: () => {
      invalidate()
      toast.success('Đã chốt dữ liệu kỳ — giờ chấm điểm phòng và hiệu chỉnh theo khung')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Chốt dữ liệu kỳ thất bại')),
  })

  const finalizeMutation = useMutation({
    mutationFn: (comment: string) => kpiCycleEvaluationApi.finalizeUnit(cycleId!, orgUnitId!, comment),
    onSuccess: () => {
      invalidate()
      toast.success('Đã khoá kết quả đánh giá kỳ của phòng ban')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Khoá kết quả thất bại')),
  })

  const reopenMutation = useMutation({
    mutationFn: (cascade: boolean = false) => kpiCycleEvaluationApi.reopenUnit(cycleId!, orgUnitId!, cascade),
    onSuccess: (data, cascade) => {
      invalidate()
      toast.success(
        data.status === 'DRAFT'
          ? 'Đã mở lại kỳ về nháp — đánh giá đợt và hạnh kiểm sửa được trở lại'
          : cascade ? 'Đã mở khoá cả cây đơn vị, quay lại bước hiệu chỉnh' : 'Đã mở khoá, quay lại bước hiệu chỉnh',
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Mở khoá thất bại')),
  })

  const saveUserScoreMutation = useMutation({
    // `silent`: tắt toast thành công — panel hiệu chỉnh tự báo theo tên người, khỏi hai toast một lượt.
    mutationFn: ({ userId, finalScore, qualScore, comment, matrixRating }:
      { userId: string; finalScore: number | null; qualScore: number | null; comment: string
        matrixRating?: number | null; silent?: boolean }) =>
      kpiCycleEvaluationApi.saveUserScore(cycleId!, userId, {
        finalScore, qualScore, comment,
        ...(matrixRating !== undefined ? { matrixRating } : {}),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      qc.invalidateQueries({ queryKey: ['cycleCalibration', cycleId, orgUnitId] })
      if (!vars.silent) toast.success('Đã lưu điểm chốt kỳ')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Lưu điểm chốt kỳ thất bại')),
  })

  /**
   * Áp dụng NHIỀU điểm kỳ một lượt (đề xuất hiệu chỉnh): gọi tuần tự rồi mới tải lại một lần —
   * mỗi lượt lưu mà tải lại bảng + đề xuất thì 10 người là 20 request thừa và màn nhấp nháy.
   * Một người hỏng không dừng cả lượt; báo lại số hỏng ở cuối.
   */
  const applyManyMutation = useMutation({
    mutationFn: async (items: { userId: string; finalScore: number | null; qualScore: number | null; comment: string; matrixRating?: number | null; label: string }[]) => {
      const failed: string[] = []
      for (const it of items) {
        try {
          await kpiCycleEvaluationApi.saveUserScore(cycleId!, it.userId, {
            finalScore: it.finalScore, qualScore: it.qualScore, comment: it.comment,
            ...(it.matrixRating !== undefined ? { matrixRating: it.matrixRating } : {}),
          })
        } catch {
          failed.push(it.label)
        }
      }
      return { done: items.length - failed.length, failed }
    },
    onSuccess: ({ done, failed }) => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      qc.invalidateQueries({ queryKey: ['cycleCalibration', cycleId, orgUnitId] })
      if (failed.length) toast.warning(`Đã áp dụng ${done} đề xuất. Không lưu được: ${failed.join(', ')}`, { duration: 8000 })
      else toast.success(`Đã áp dụng ${done} đề xuất hiệu chỉnh`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Áp dụng đề xuất thất bại')),
  })

  const saveUnitScoreMutation = useMutation({
    mutationFn: ({ score, reason }: { score: number | null; reason: string }) =>
      kpiCycleEvaluationApi.saveUnitScore(cycleId!, orgUnitId!, { score, reason }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      toast.success(vars.score == null ? 'Đã bỏ chấm tay, quay lại TB thành viên' : 'Đã lưu điểm đơn vị')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Lưu điểm đơn vị thất bại')),
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
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gửi email thất bại')),
  })

  return {
    ...query,
    startCalibration: calibrateMutation.mutateAsync,
    isCalibrating: calibrateMutation.isPending,
    finalize: finalizeMutation.mutateAsync,
    sendEvaluation: sendEvaluationMutation.mutateAsync,
    isSending: sendEvaluationMutation.isPending,
    isFinalizing: finalizeMutation.isPending,
    reopen: reopenMutation.mutateAsync,
    isReopening: reopenMutation.isPending,
    saveUserScore: saveUserScoreMutation.mutateAsync,
    isSavingUserScore: saveUserScoreMutation.isPending,
    applyMany: applyManyMutation.mutateAsync,
    isApplyingMany: applyManyMutation.isPending,
    saveUnitScore: saveUnitScoreMutation.mutateAsync,
    isSavingUnitScore: saveUnitScoreMutation.isPending,
  }
}

/**
 * Chuỗi duyệt của kỳ: đơn vị đang xem → các đơn vị cha lên tới gốc.
 * Server tính sẵn canFinalize/canReopen/blockedReason cho người dùng hiện tại.
 */
/** Phân bố vs khung bell curve + đề xuất nắn điểm — chỉ hỏi khi đơn vị đã chốt dữ liệu kỳ. */
export const useCycleCalibration = (cycleId?: string, orgUnitId?: string, enabled = true) =>
  useQuery({
    queryKey: ['cycleCalibration', cycleId, orgUnitId],
    queryFn: () => kpiCycleEvaluationApi.getCalibration(cycleId!, orgUnitId!),
    enabled: !!cycleId && !!orgUnitId && enabled,
  })

export const useCycleApprovalChain = (cycleId?: string, orgUnitId?: string) =>
  useQuery({
    queryKey: ['cycleApprovalChain', cycleId, orgUnitId],
    queryFn: () => kpiCycleEvaluationApi.getApprovalChain(cycleId!, orgUnitId!),
    enabled: !!cycleId && !!orgUnitId,
  })
