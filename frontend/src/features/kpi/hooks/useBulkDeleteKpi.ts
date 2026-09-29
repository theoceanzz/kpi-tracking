import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useBulkDeleteKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => kpiApi.bulkDelete(ids),
    onSuccess: (deleted) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(t('useBulkDeleteKpi.deletedKpis', { count: deleted ?? 0 }));
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useBulkDeleteKpi.failedToDeleteKpi'))),
  })
}
