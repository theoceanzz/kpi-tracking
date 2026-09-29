import { intlLocale } from '@/i18n/format'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { programApi } from '../api/programApi'
import type { RewardProgramRequest, RewardTier } from '../types'
import { useTranslation } from 'react-i18next'

const errMsg = (error: any, fallback: string) => getApiErrorMessage(error, fallback)

const invalidateProgramData = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['rewardPrograms'] })
  qc.invalidateQueries({ queryKey: ['rewardRuns'] })
  // Phát thưởng đụng vào ví và sổ cái của rất nhiều người cùng lúc.
  qc.invalidateQueries({ queryKey: ['rewardWallet'] })
  qc.invalidateQueries({ queryKey: ['rewardTransactions'] })
}

export const useRewardPrograms = () => {
  const { t } = useTranslation('rewards')
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['rewardPrograms'],
    queryFn: () => programApi.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: RewardProgramRequest) => programApi.create(data),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success(t('usePrograms.rewardProgramCreated'))
    },
    onError: (error: any) =>
      toast.error(errMsg(error, t('usePrograms.failedToCreateProgram')), { duration: 7000 }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RewardProgramRequest }) =>
      programApi.update(id, data),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success(t('usePrograms.programUpdated'))
    },
    onError: (error: any) =>
      toast.error(errMsg(error, t('usePrograms.updateFailed')), { duration: 7000 }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => programApi.delete(id),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success(t('usePrograms.programDeleted'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('usePrograms.deleteFailed')), { duration: 7000 }),
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
  const { t } = useTranslation('rewards')
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
      toast.error(errMsg(error, t('usePrograms.failedToComputeTheRanking')), { duration: 8000 }),
  })

  const issueMutation = useMutation({
    mutationFn: (runId: string) => programApi.issue(runId),
    onSuccess: (run) => {
      invalidateProgramData(qc)
      toast.success(
        t('usePrograms.awardedPointsToEmployees', { value: run.totalPoints.toLocaleString(intlLocale()), count: run.recipientCount }),
      )
    },
    // Lỗi hay gặp nhất là "bảng xếp hạng đã thay đổi" — thông điệp dài nên để lâu.
    onError: (error: any) => toast.error(errMsg(error, t('usePrograms.awardFailed')), { duration: 9000 }),
  })

  const revertMutation = useMutation({
    mutationFn: (runId: string) => programApi.revert(runId),
    onSuccess: () => {
      invalidateProgramData(qc)
      toast.success(t('usePrograms.revokedAllPointsOfThisRun'))
    },
    onError: (error: any) => toast.error(errMsg(error, t('usePrograms.revokeFailed')), { duration: 8000 }),
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
