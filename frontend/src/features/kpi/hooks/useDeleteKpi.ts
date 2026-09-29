import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

export function useDeleteKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kpiApi.delete(id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(t('useDeleteKpi.kpiDeleted')) 
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDeleteKpi.failedToDeleteKpi'))),
  })
}
