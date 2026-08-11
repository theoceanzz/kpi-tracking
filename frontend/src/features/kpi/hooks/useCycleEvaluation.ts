import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiCycleEvaluationApi } from '../api/kpiCycleEvaluationApi'
import { toast } from 'sonner'

/** Tổng hợp đánh giá phòng ban theo kỳ (kèm danh sách thành viên). */
export const useUnitCycleSummary = (cycleId?: string, orgUnitId?: string) => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['cycleUnitSummary', cycleId, orgUnitId],
    queryFn: () => kpiCycleEvaluationApi.getUnitSummary(cycleId!, orgUnitId!),
    enabled: !!cycleId && !!orgUnitId,
  })

  const finalizeMutation = useMutation({
    mutationFn: (comment: string) => kpiCycleEvaluationApi.finalizeUnit(cycleId!, orgUnitId!, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      toast.success('Đã chốt đánh giá phòng ban theo kỳ')
    },
    onError: () => toast.error('Chốt đánh giá thất bại'),
  })

  const reopenMutation = useMutation({
    mutationFn: () => kpiCycleEvaluationApi.reopenUnit(cycleId!, orgUnitId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      toast.success('Đã mở khoá, có thể chỉnh lại điểm')
    },
    onError: () => toast.error('Mở khoá thất bại'),
  })

  const saveUserScoreMutation = useMutation({
    mutationFn: ({ userId, finalScore, qualScore, comment }:
      { userId: string; finalScore: number | null; qualScore: number | null; comment: string }) =>
      kpiCycleEvaluationApi.saveUserScore(cycleId!, userId, { finalScore, qualScore, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      toast.success('Đã lưu điểm chốt kỳ')
    },
    onError: () => toast.error('Lưu điểm chốt kỳ thất bại'),
  })

  return {
    ...query,
    finalize: finalizeMutation.mutateAsync,
    isFinalizing: finalizeMutation.isPending,
    reopen: reopenMutation.mutateAsync,
    isReopening: reopenMutation.isPending,
    saveUserScore: saveUserScoreMutation.mutateAsync,
    isSavingUserScore: saveUserScoreMutation.isPending,
  }
}
