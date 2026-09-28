import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { delegationApi, type DelegationRequest } from '../api/delegation.api'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('organization')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request: DelegationRequest) => delegationApi.create(organizationId!, request),
    onSuccess: (created) => {
      invalidateScopeDerived(qc)
      toast.success(created.length > 1
        ? t('useDelegations.delegatedManagementOfUnits', { count: created.length })
        : t('useDelegations.delegatedUnitManagement'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDelegations.couldNotDelegateUnitManagement'))),
  })
}

export function useRevokeDelegation() {
  const { t } = useTranslation('organization')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => delegationApi.revoke(id),
    onSuccess: () => {
      invalidateScopeDerived(qc)
      toast.success(t('useDelegations.delegationRevoked'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDelegations.couldNotRevokeTheDelegation'))),
  })
}
