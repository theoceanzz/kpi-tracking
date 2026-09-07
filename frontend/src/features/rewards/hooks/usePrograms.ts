import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { programApi } from '../api/programApi'
import type { RewardProgramRequest, RewardTier } from '../types'

const errMsg = (error: any, fallback: string) => error?.response?.data?.message || fallback

const invalidateProgramData = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['rewardPrograms'] })
  qc.invalidateQueries({ queryKey: ['rewardRuns'] })
  // Phát thưởng đụng vào ví và sổ cái của rất nhiều người cùng lúc.
  qc.invalidateQueries({ queryKey: ['rewardWallet'] })
  qc.invalidateQueries({ queryKey: ['rewardTransactions'] })
}

export const useRewardPrograms = () => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['rewardPrograms'],
    queryFn: () => programApi.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: RewardProgramRequest) => programApi.create(data),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success('Đã tạo chương trình thưởng')
    },
    onError: (error: any) =>
      toast.error(errMsg(error, 'Tạo chương trình thất bại'), { duration: 7000 }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RewardProgramRequest }) =>
      programApi.update(id, data),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success('Đã cập nhật chương trình')
    },
    onError: (error: any) =>
      toast.error(errMsg(error, 'Cập nhật thất bại'), { duration: 7000 }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => programApi.delete(id),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success('Đã xoá chương trình')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Xoá thất bại'), { duration: 7000 }),
  })

  return {
    ...query,
    createProgram: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateProgram: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProgram: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}

/** Lịch sử các lần chạy của một chương trình. */
export const useProgramRuns = (programId?: string) =>
  useQuery({
    queryKey: ['rewardRuns', programId],
    queryFn: () => programApi.getRuns(programId!),
    enabled: !!programId,
  })

export const useProgramRunActions = () => {
  const qc = useQueryClient()

  const previewMutation = useMutation({
    mutationFn: ({
      programId,
      targetId,
      tiers,
    }: {
      programId: string
      targetId: string
      tiers?: RewardTier[]
    }) => programApi.preview(programId, targetId, tiers),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewardRuns'] }),
    onError: (error: any) =>
      toast.error(errMsg(error, 'Tính bảng xếp hạng thất bại'), { duration: 8000 }),
  })

  const issueMutation = useMutation({
    mutationFn: (runId: string) => programApi.issue(runId),
    onSuccess: (run) => {
      invalidateProgramData(qc)
      toast.success(
        `Đã phát ${run.totalPoints.toLocaleString('vi-VN')} điểm cho ${run.recipientCount} nhân viên`,
      )
    },
    // Lỗi hay gặp nhất là "bảng xếp hạng đã thay đổi" — thông điệp dài nên để lâu.
    onError: (error: any) => toast.error(errMsg(error, 'Phát thưởng thất bại'), { duration: 9000 }),
  })

  const revertMutation = useMutation({
    mutationFn: (runId: string) => programApi.revert(runId),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success('Đã thu hồi toàn bộ điểm của lần phát này')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Thu hồi thất bại'), { duration: 8000 }),
  })

  return {
    preview: previewMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    issue: issueMutation.mutateAsync,
    isIssuing: issueMutation.isPending,
    revert: revertMutation.mutateAsync,
    isReverting: revertMutation.isPending,
  }
}
