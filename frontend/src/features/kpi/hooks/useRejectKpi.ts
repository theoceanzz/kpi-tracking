import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { RejectKpiRequest } from '@/types/kpi'
import { useTranslation } from 'react-i18next'
import { invalidateApprovalQueries } from './useKpiApprovalChain'

export function useRejectKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectKpiRequest }) => kpiApi.reject(id, data),
    onSuccess: () => { invalidateApprovalQueries(qc); toast.success(t('useRejectKpi.kpiRejected')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useRejectKpi.failedToRejectKpi'))),
  })
}
