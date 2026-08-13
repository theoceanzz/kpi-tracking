import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiQuotaApi, type AiQuotaAllocationParams } from '../api/ai-quota.api'

const KEYS = {
  me: ['ai-quota', 'me'] as const,
  overview: ['ai-quota', 'overview'] as const,
  allocations: ['ai-quota', 'allocations'] as const,
}

/** Hạn mức của chính người đang đăng nhập. */
export function useMyAiQuota(enabled = true) {
  return useQuery({
    queryKey: KEYS.me,
    queryFn: aiQuotaApi.getMyQuota,
    enabled,
    staleTime: 60_000,
  })
}

export function useAiQuotaOverview() {
  return useQuery({ queryKey: KEYS.overview, queryFn: aiQuotaApi.getOverview })
}

/** queryKey mang cả bộ lọc để React Query cache riêng từng tổ hợp. */
export function useAiQuotaAllocations(params: AiQuotaAllocationParams, enabled = true) {
  return useQuery({
    queryKey: [...KEYS.allocations, params],
    queryFn: () => aiQuotaApi.getAllocations(params),
    enabled,
    placeholderData: (prev) => prev, // giữ dữ liệu cũ khi đổi trang, tránh nháy trắng
  })
}

export function useSetAiQuotaLimit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, monthlyLimit }: { userId: string; monthlyLimit: number }) =>
      aiQuotaApi.setUserLimit(userId, monthlyLimit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-quota'] })
      toast.success('Đã cập nhật hạn mức')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không cập nhật được hạn mức')
    },
  })
}

export function useSetAiDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => aiQuotaApi.setDelegation(enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-quota'] })
      toast.success('Đã cập nhật')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không cập nhật được')
    },
  })
}
