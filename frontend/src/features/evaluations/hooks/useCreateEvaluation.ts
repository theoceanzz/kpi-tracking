import { useMutation, useQueryClient } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CreateEvaluationRequest } from '@/types/evaluation'
import { useTranslation } from 'react-i18next'

export function useCreateEvaluation() {
  const { t } = useTranslation('evaluations')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEvaluationRequest) => evaluationApi.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success(t('useCreateEvaluation.evaluationCreatedSuccessfully'))
      // Khung bell curve ở chế độ "chỉ cảnh báo": đánh giá vẫn được lưu, nhưng người chấm cần
      // biết đơn vị đang lệch hạn mức — im lặng thì chế độ này chẳng khác gì tắt khung.
      if (data?.bellCurveWarning) toast.warning(data.bellCurveWarning, { duration: 8000 })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCreateEvaluation.failedToCreateEvaluation'))),
  })
}
