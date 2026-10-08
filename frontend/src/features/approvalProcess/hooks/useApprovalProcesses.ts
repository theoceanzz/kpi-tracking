import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/apiError'
import { approvalProcessApi } from '../api/approvalProcessApi'
import type { ApprovalProcessListParams, ApprovalProcessRequest } from '../types'

export const approvalProcessKeys = {
  all: ['approval-processes'] as const,
  list: (params: ApprovalProcessListParams) => ['approval-processes', 'list', params] as const,
  detail: (id: string) => ['approval-processes', 'detail', id] as const,
  catalog: ['approval-processes', 'catalog'] as const,
}

export function useApprovalProcessList(params: ApprovalProcessListParams) {
  return useQuery({
    queryKey: approvalProcessKeys.list(params),
    queryFn: () => approvalProcessApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useApprovalProcess(id: string | undefined) {
  return useQuery({
    queryKey: approvalProcessKeys.detail(id ?? ''),
    queryFn: () => approvalProcessApi.get(id!),
    enabled: !!id,
    // Trang sửa giữ bản nháp riêng; tải lại ngầm giữa chừng sẽ đè lên những gì người dùng đang vẽ.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Từ vựng của màn sửa (đối tượng, trường điều kiện…) — hầu như không đổi. */
export function useApprovalProcessCatalog() {
  return useQuery({
    queryKey: approvalProcessKeys.catalog,
    queryFn: () => approvalProcessApi.catalog(),
    staleTime: 10 * 60_000,
  })
}

export function useSaveApprovalProcess() {
  const { t } = useTranslation('approvalProcess')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: ApprovalProcessRequest }) =>
      id ? approvalProcessApi.update(id, data) : approvalProcessApi.create(data),
    onSuccess: (saved, { id }) => {
      qc.invalidateQueries({ queryKey: approvalProcessKeys.all })
      qc.setQueryData(approvalProcessKeys.detail(saved.id), saved)
      toast.success(id ? t('hooks.processUpdated') : t('hooks.processCreated'))
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('hooks.couldNotSaveProcess'))),
  })
}

export function useSetApprovalProcessActive() {
  const { t } = useTranslation('approvalProcess')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => approvalProcessApi.setActive(id, active),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: approvalProcessKeys.all })
      toast.success(saved.active ? t('hooks.processTurnedOn') : t('hooks.processTurnedOff'))
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('hooks.couldNotChangeStatus'))),
  })
}

export function useDeleteApprovalProcesses() {
  const { t } = useTranslation('approvalProcess')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => approvalProcessApi.remove(ids),
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: approvalProcessKeys.all })
      toast.success(t('hooks.processesDeleted', { count }))
    },
    onError: (e) => toast.error(getApiErrorMessage(e, t('hooks.couldNotDeleteProcesses'))),
  })
}
