import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { delegationApi, type DelegationRequest } from '../api/delegation.api'

/**
 * Uỷ quyền chéo đơn vị. Mọi thao tác đều làm đổi PHẠM VI QUYỀN của người khác, nên sau khi
 * lưu phải dọn sạch cache của những màn hình đọc theo quyền (đơn vị, đánh giá, chốt kỳ) —
 * không thì người vừa được trao quyền vẫn thấy danh sách cũ cho tới lần tải lại trang.
 */
const invalidateScopeDerived = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['delegations'] })
  qc.invalidateQueries({ queryKey: ['orgUnitTree'] })
  qc.invalidateQueries({ queryKey: ['cycleUnitSummary'] })
  qc.invalidateQueries({ queryKey: ['cycleApprovalChain'] })
  qc.invalidateQueries({ queryKey: ['evaluations'] })
}

export function useDelegations(organizationId?: string) {
  return useQuery({
    queryKey: ['delegations', organizationId],
    queryFn: () => delegationApi.list(organizationId!),
    enabled: !!organizationId,
  })
}

export function useCreateDelegation(organizationId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request: DelegationRequest) => delegationApi.create(organizationId!, request),
    onSuccess: (created) => {
      invalidateScopeDerived(qc)
      toast.success(created.length > 1
        ? `Đã uỷ quyền quản lý ${created.length} đơn vị`
        : 'Đã uỷ quyền quản lý đơn vị')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Không thể uỷ quyền quản lý đơn vị')),
  })
}

export function useRevokeDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => delegationApi.revoke(id),
    onSuccess: () => {
      invalidateScopeDerived(qc)
      toast.success('Đã thu hồi uỷ quyền')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Không thể thu hồi uỷ quyền')),
  })
}
