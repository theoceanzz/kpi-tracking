import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { bscApi } from '../api/bscApi'
import type { CascadePolicyRequest, CascadeRequest, BscOverrideRequest } from '../types'
import { useBscInvalidator } from './useBsc'

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
  const invalidate = useBscInvalidator()

  const cascade = useMutation({
    mutationFn: ({ scorecardId, data }: { scorecardId: string; data: CascadeRequest }) =>
      bscApi.cascade(scorecardId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Đã phân rã chỉ tiêu xuống các đơn vị')
    },
    onError: e => toast.error(errText(e, 'Phân rã chỉ tiêu thất bại')),
  })

  const submitScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.submitScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã trình bộ tiêu chí, chờ cấp trên duyệt')
    },
    onError: e => toast.error(errText(e, 'Trình bộ tiêu chí thất bại')),
  })

  const approveScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.approveScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã duyệt và áp dụng bộ tiêu chí')
    },
    onError: e => toast.error(errText(e, 'Duyệt bộ tiêu chí thất bại')),
  })

  const rejectScorecard = useMutation({
    mutationFn: ({ scorecardId, reason }: { scorecardId: string; reason: string }) =>
      bscApi.rejectScorecard(scorecardId, reason),
    onSuccess: () => {
      invalidate()
      toast.success('Đã trả lại bộ tiêu chí cho đơn vị sửa')
    },
    onError: e => toast.error(errText(e, 'Trả lại bộ tiêu chí thất bại')),
  })

  const activateScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.activateScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success('Bộ tiêu chí đã được áp dụng')
    },
    onError: e => toast.error(errText(e, 'Áp dụng bộ tiêu chí thất bại')),
  })

  const lockScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.lockScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã khoá bộ tiêu chí')
    },
    onError: e => toast.error(errText(e, 'Khoá bộ tiêu chí thất bại')),
  })

  const reopenScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.reopenScorecard(scorecardId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã mở khoá bộ tiêu chí')
    },
    onError: e => toast.error(errText(e, 'Mở khoá bộ tiêu chí thất bại')),
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
        ? 'Đã gắn vào bộ tiêu chí cấp trên'
        : 'Đã gỡ bộ tiêu chí khỏi cây'))
    },
    onError: e => toast.error(errText(e, 'Gắn vào cấp trên thất bại')),
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
  const invalidate = useBscInvalidator()

  const recompute = useMutation({
    mutationFn: ({ scorecardId, kpiPeriodId }: { scorecardId: string; kpiPeriodId: string }) =>
      bscApi.recomputeUnitResult(scorecardId, kpiPeriodId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã tính lại kết quả BSC của đơn vị')
    },
    onError: e => toast.error(errText(e, 'Tính lại kết quả thất bại')),
  })

  const finalize = useMutation({
    mutationFn: ({ scorecardId, kpiPeriodId }: { scorecardId: string; kpiPeriodId: string }) =>
      bscApi.finalizeUnitResult(scorecardId, kpiPeriodId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã chốt kết quả BSC của đơn vị')
    },
    onError: e => toast.error(errText(e, 'Chốt kết quả thất bại')),
  })

  const reopen = useMutation({
    mutationFn: ({ scorecardId, kpiPeriodId }: { scorecardId: string; kpiPeriodId: string }) =>
      bscApi.reopenUnitResult(scorecardId, kpiPeriodId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã mở khoá kết quả để tính lại')
    },
    onError: e => toast.error(errText(e, 'Mở khoá kết quả thất bại')),
  })

  const setManualActual = useMutation({
    mutationFn: ({ scorecardId, itemId, kpiPeriodId, actualValue }:
      { scorecardId: string; itemId: string; kpiPeriodId: string; actualValue: number | null }) =>
      bscApi.setManualActual(scorecardId, itemId, kpiPeriodId, actualValue),
    onSuccess: () => {
      invalidate()
      toast.success('Đã cập nhật số liệu')
    },
    onError: e => toast.error(errText(e, 'Cập nhật số liệu thất bại')),
  })

  return { recompute, finalize, reopen, setManualActual }
}

// ================================================================
// Chính sách điểm BSC & ghi đè điểm
// ================================================================

export function useCascadePolicyMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bsc-cascade-policies'] })

  const createPolicy = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: CascadePolicyRequest }) =>
      bscApi.createCascadePolicy(organizationId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Đã tạo chính sách điểm BSC')
    },
    onError: e => toast.error(errText(e, 'Tạo chính sách thất bại')),
  })

  const updatePolicy = useMutation({
    mutationFn: ({ policyId, data }: { policyId: string; data: CascadePolicyRequest }) =>
      bscApi.updateCascadePolicy(policyId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Đã cập nhật chính sách điểm BSC')
    },
    onError: e => toast.error(errText(e, 'Cập nhật chính sách thất bại')),
  })

  const deletePolicy = useMutation({
    mutationFn: (policyId: string) => bscApi.deleteCascadePolicy(policyId),
    onSuccess: () => {
      invalidate()
      toast.success('Đã xoá chính sách — kỳ đó quay về dùng chính sách mặc định')
    },
    onError: e => toast.error(errText(e, 'Xoá chính sách thất bại')),
  })

  return { createPolicy, updatePolicy, deletePolicy }
}

export function useOverrideMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ evaluationId, data }: { evaluationId: string; data: BscOverrideRequest }) =>
      bscApi.overrideScore(evaluationId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['bsc-waterfall', vars.evaluationId] })
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success('Đã cập nhật điểm ghi đè')
    },
    onError: e => toast.error(errText(e, 'Ghi đè điểm thất bại')),
  })
}
