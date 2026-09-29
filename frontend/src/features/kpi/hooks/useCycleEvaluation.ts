import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiCycleEvaluationApi } from '../api/kpiCycleEvaluationApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { LockCyclePayload } from '../types/cycleLock'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

/** Tổng hợp đánh giá phòng ban theo kỳ (kèm danh sách thành viên). */
export const useUnitCycleSummary = (cycleId?: string, orgUnitId?: string) => {
  const { t } = useTranslation('kpi')
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
      toast.success(t('useCycleEvaluation.cycleDataFinalizedNowScoreThe'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToFinalizeCycleData'))),
  })

  const invalidateCycleLock = () => {
    qc.invalidateQueries({ queryKey: ['kpiCycles'] })
    qc.invalidateQueries({ queryKey: ['kpiPeriods'] })
    qc.invalidateQueries({ queryKey: ['kpiCycleLockPreview'] })
    qc.invalidateQueries({ queryKey: ['kpiCycleEvents'] })
    qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
  }

  const finalizeMutation = useMutation({
    mutationFn: ({ comment, cycleLock }: { comment: string; cycleLock?: LockCyclePayload }) =>
      kpiCycleEvaluationApi.finalizeUnit(cycleId!, orgUnitId!, comment, cycleLock),
    onSuccess: (data) => {
      invalidate()
      if (data.rootUnit) invalidateCycleLock()
      toast.success(data.rootUnit
        ? t('useCycleEvaluation.resultsLockedAndCycleLockedKpis', { cycleName: data.cycleName })
        : t('useCycleEvaluation.theDepartmentsCycleEvaluationResultsAre'))
    },
    // 409 (dữ liệu đợt vừa đổi) do hộp thoại tự xử lý: tải lại danh sách đợt.
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) return
      toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToLockResults')))
    },
  })

  const reopenMutation = useMutation({
    mutationFn: (cascade: boolean = false) => kpiCycleEvaluationApi.reopenUnit(cycleId!, orgUnitId!, cascade),
    onSuccess: (data, cascade) => {
      invalidate()
      // Mở khoá kết quả ở đơn vị gốc cũng mở lại kỳ (khoá kỳ gộp vào khoá kết quả gốc).
      const reopenedCycle = data.rootUnit && data.status === 'CALIBRATING'
      if (reopenedCycle) invalidateCycleLock()
      toast.success(
        data.status === 'DRAFT'
          ? t('useCycleEvaluation.theCycleIsBackToDraft')
          : (cascade ? t('useCycleEvaluation.unlockedTheWholeUnitTreeBack') : t('useCycleEvaluation.unlockedBackToTheCalibrationStep'))
            + (reopenedCycle ? t('useCycleEvaluation.theCycleHasBeenReopened') : ''),
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToUnlock'))),
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
      if (!vars.silent) toast.success(t('useCycleEvaluation.finalizedCycleScoreSaved'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToSaveTheFinalizedCycle'))),
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
      if (failed.length) toast.warning(t('useCycleEvaluation.appliedSuggestionsCouldNotSave', { done, join: failed.join(', ') }), { duration: 8000 })
      else toast.success(t('useCycleEvaluation.appliedCalibrationSuggestions', { done }))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToApplySuggestions'))),
  })

  const saveUnitScoreMutation = useMutation({
    mutationFn: ({ score, reason }: { score: number | null; reason: string }) =>
      kpiCycleEvaluationApi.saveUnitScore(cycleId!, orgUnitId!, { score, reason }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cycleUnitSummary', cycleId, orgUnitId] })
      toast.success(vars.score == null ? t('useCycleEvaluation.manualScoreRemovedBackToThe') : t('useCycleEvaluation.unitScoreSaved'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToSaveTheUnitScore'))),
  })

  const sendEvaluationMutation = useMutation({
    mutationFn: (userIds: string[]) => kpiCycleEvaluationApi.sendEvaluation(cycleId!, orgUnitId!, userIds),
    onSuccess: (result) => {
      if (result.failed.length === 0) {
        toast.success(t('useCycleEvaluation.sentEvaluationResultsToEmployees', { count: result.sent }))
      } else {
        // Gửi hàng loạt là bán phần: báo rõ ai hỏng thay vì chỉ nói "thành công".
        toast.warning(
          t('useCycleEvaluation.sentEmailsCouldNotSendTo', { sent: result.sent, join: result.failed.join(', ') }),
          { duration: 8000 },
        )
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCycleEvaluation.failedToSendEmail'))),
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
