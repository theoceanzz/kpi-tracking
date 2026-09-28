import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useApproveKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.approve(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); qc.invalidateQueries({ queryKey: ['kpi-approval-inbox'] }); toast.success(res.message || t('useApproveKpi.kpiApproved')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useApproveKpi.failedToApproveKpi'))),
  })
}
