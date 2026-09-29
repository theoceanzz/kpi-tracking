import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useBulkSubmitKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => kpiApi.bulkSubmit(ids),
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(t('useBulkSubmitKpi.submittedKpisForApproval', { count: Array.isArray(data) ? data.length : 0 }));
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useBulkSubmitKpi.failedToSubmitForApproval'))),
  })
}
