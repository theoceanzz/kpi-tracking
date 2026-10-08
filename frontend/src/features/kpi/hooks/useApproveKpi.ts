import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'
import { invalidateApprovalQueries } from './useKpiApprovalChain'

export function useApproveKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.approve(id),
    onSuccess: (res) => { invalidateApprovalQueries(qc); toast.success(res.message || t('useApproveKpi.kpiApproved')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useApproveKpi.failedToApproveKpi'))),
  })
}
