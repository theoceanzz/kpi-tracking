import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { UpdateKpiRequest } from '@/types/kpi'
import { useTranslation } from 'react-i18next'

export function useUpdateKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKpiRequest }) => kpiApi.update(id, data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(t('useUpdateKpi.kpiUpdatedSuccessfully')) 
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useUpdateKpi.failedToUpdateKpi'))),
  })
}
