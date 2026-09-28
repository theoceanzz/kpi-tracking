import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { RejectKpiRequest } from '@/types/kpi'
import { useTranslation } from 'react-i18next'

export function useRejectKpi() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectKpiRequest }) => kpiApi.reject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success(t('useRejectKpi.kpiRejected')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useRejectKpi.failedToRejectKpi'))),
  })
}
