import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { bscApi } from '../api/bscApi'
import type { CascadePolicyRequest, CascadeRequest, BscOverrideRequest } from '../types'
import { useBscInvalidator } from './useBsc'
import { useTranslation } from 'react-i18next'

/**
 * Hook cho BSC phân cấp (docs/bsc-cascade-design.md): cây, độ phủ, phân rã, vòng đời trình–duyệt,
 * kết quả BSC đơn vị, chính sách điểm BSC và diễn giải điểm cá nhân.
 *
 * <p>Tách khỏi `useBsc.ts` (danh mục hạng mục + CRUD bộ tiêu chí) cho khớp cách backend đã tách
 * BscController / BscCascadeController.
 */

const errText = (error: unknown, fallback: string) => {
  const e = error as { response?: { data?: { message?: string } } }
  return getApiErrorMessage(e, fallback)
}

export function useScorecardTree(organizationId?: string, kpiPeriodId?: string) {
  return useQuery({
    queryKey: ['bsc-scorecard-tree', organizationId, kpiPeriodId ?? null],
    queryFn: () => bscApi.getScorecardTree(organizationId!, kpiPeriodId),
    enabled: !!organizationId,
  })
}

export function useScorecardCoverage(scorecardId?: string) {
  return useQuery({
    queryKey: ['bsc-coverage', scorecardId],
    queryFn: () => bscApi.getCoverage(scorecardId!),
    enabled: !!scorecardId,
  })
}

export function useUnitResult(scorecardId?: string, kpiPeriodId?: string) {
  return useQuery({
    queryKey: ['bsc-unit-result', scorecardId, kpiPeriodId],
    queryFn: () => bscApi.getUnitResult(scorecardId!, kpiPeriodId!),
    enabled: !!scorecardId && !!kpiPeriodId,
  })
}

export function useCascadePolicies(organizationId?: string) {
  return useQuery({
    queryKey: ['bsc-cascade-policies', organizationId],
    queryFn: () => bscApi.getCascadePolicies(organizationId!),
    enabled: !!organizationId,
  })
}

export function useWaterfall(evaluationId?: string) {
  return useQuery({
    queryKey: ['bsc-waterfall', evaluationId],
    queryFn: () => bscApi.getWaterfall(evaluationId!),
    enabled: !!evaluationId,
  })
}

export function useLinkedWeight(userId?: string, kpiPeriodId?: string, organizationId?: string) {
  return useQuery({
    queryKey: ['bsc-linked-weight', userId, kpiPeriodId, organizationId],
    queryFn: () => bscApi.getLinkedWeight(userId!, kpiPeriodId!, organizationId!),
    enabled: !!userId && !!kpiPeriodId && !!organizationId,
  })
}

// ================================================================
// Phân rã & vòng đời
// ================================================================

export function useCascadeMutations() {
  const { t } = useTranslation('bsc')
  const invalidate = useBscInvalidator()

  const cascade = useMutation({
    mutationFn: ({ scorecardId, data }: { scorecardId: string; data: CascadeRequest }) =>
      bscApi.cascade(scorecardId, data),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.kpiCascadedToUnits'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToCascadeKpi'))),
  })

  const submitScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.submitScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.scorecardSubmittedWaitingForParentApproval'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToSubmitScorecard'))),
  })

  const approveScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.approveScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.scorecardApprovedAndApplied'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToApproveScorecard'))),
  })

  const rejectScorecard = useMutation({
    mutationFn: ({ scorecardId, reason }: { scorecardId: string; reason: string }) =>
      bscApi.rejectScorecard(scorecardId, reason),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.scorecardReturnedToTheUnitFor'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToReturnScorecard'))),
  })

  const activateScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.activateScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.theScorecardHasBeenApplied'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToApplyScorecard'))),
  })

  const lockScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.lockScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.scorecardLocked'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToLockScorecard'))),
  })

  const reopenScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.reopenScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.scorecardUnlocked'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToUnlockScorecard'))),
  })

  const attachParent = useMutation({
    mutationFn: ({ scorecardId, parentScorecardId, linkItems }: {
      scorecardId: string
      parentScorecardId: string | null
      linkItems?: boolean
    }) => bscApi.attachScorecardParent(scorecardId, parentScorecardId, linkItems ?? true),
    onSuccess: (res, vars) => {
      invalidate()
      // Server nói rõ nối được mấy chỉ tiêu — dùng đúng câu đó thay vì một câu chung chung.
      toast.success(res.message || (vars.parentScorecardId
        ? t('useBscCascade.attachedToTheParentScorecard')
        : t('useBscCascade.detachedTheScorecardFromTheTree')))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToAttachToParent'))),
  })

  return {
    cascade,
    attachParent,
    submitScorecard,
    approveScorecard,
    rejectScorecard,
    activateScorecard,
    lockScorecard,
    reopenScorecard,
  }
}

// ================================================================
// Kết quả BSC đơn vị
// ================================================================

export function useUnitResultMutations() {
  const { t } = useTranslation('bsc')
  const invalidate = useBscInvalidator()

  const recompute = useMutation({
    mutationFn: ({ scorecardId, kpiPeriodId }: { scorecardId: string; kpiPeriodId: string }) =>
      bscApi.recomputeUnitResult(scorecardId, kpiPeriodId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.recalculatedTheUnitsBscResults'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToRecalculateResults'))),
  })

  const finalize = useMutation({
    mutationFn: ({ scorecardId, kpiPeriodId }: { scorecardId: string; kpiPeriodId: string }) =>
      bscApi.finalizeUnitResult(scorecardId, kpiPeriodId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.finalizedTheUnitsBscResults'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToFinalizeResults'))),
  })

  const reopen = useMutation({
    mutationFn: ({ scorecardId, kpiPeriodId }: { scorecardId: string; kpiPeriodId: string }) =>
      bscApi.reopenUnitResult(scorecardId, kpiPeriodId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.resultsUnlockedForRecalculation'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToUnlockResults'))),
  })

  const setManualActual = useMutation({
    mutationFn: ({ scorecardId, itemId, kpiPeriodId, actualValue }:
      { scorecardId: string; itemId: string; kpiPeriodId: string; actualValue: number | null }) =>
      bscApi.setManualActual(scorecardId, itemId, kpiPeriodId, actualValue),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.figuresUpdated'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToUpdateFigures'))),
  })

  return { recompute, finalize, reopen, setManualActual }
}

// ================================================================
// Chính sách điểm BSC & ghi đè điểm
// ================================================================

export function useCascadePolicyMutations() {
  const { t } = useTranslation('bsc')
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bsc-cascade-policies'] })

  const createPolicy = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: CascadePolicyRequest }) =>
      bscApi.createCascadePolicy(organizationId, data),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.bscScorePolicyCreated'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToCreatePolicy'))),
  })

  const updatePolicy = useMutation({
    mutationFn: ({ policyId, data }: { policyId: string; data: CascadePolicyRequest }) =>
      bscApi.updateCascadePolicy(policyId, data),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.bscScorePolicyUpdated'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToUpdatePolicy'))),
  })

  const deletePolicy = useMutation({
    mutationFn: (policyId: string) => bscApi.deleteCascadePolicy(policyId),
    onSuccess: () => {
      invalidate()
      toast.success(t('useBscCascade.policyDeletedThatCycleFallsBack'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToDeletePolicy'))),
  })

  return { createPolicy, updatePolicy, deletePolicy }
}

export function useOverrideMutation() {
  const { t } = useTranslation('bsc')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ evaluationId, data }: { evaluationId: string; data: BscOverrideRequest }) =>
      bscApi.overrideScore(evaluationId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['bsc-waterfall', vars.evaluationId] })
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success(t('useBscCascade.overrideScoreUpdated'))
    },
    onError: e => toast.error(errText(e, t('useBscCascade.failedToOverrideScore'))),
  })
}
