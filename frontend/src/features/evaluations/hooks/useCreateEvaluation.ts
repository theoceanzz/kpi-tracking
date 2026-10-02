import { useMutation, useQueryClient } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'
import { toast } from 'sonner'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import type { CreateEvaluationRequest } from '@/types/evaluation'
import { useTranslation } from 'react-i18next'

export function useCreateEvaluation() {
  const { t } = useTranslation('evaluations')
  const qc = useQueryClient()
  return useMutation({
    // `askProvisional`: nơi gọi tự hỏi lại "chốt theo số tạm tính?" khi thẻ nguồn của dòng "Kết quả
    // cấp trên" chưa chốt — khi đó không toast lỗi để khỏi báo hai lần.
    mutationFn: (vars: CreateEvaluationRequest & { askProvisional?: boolean }) => evaluationApi.create({
      userId: vars.userId,
      kpiPeriodId: vars.kpiPeriodId,
      score: vars.score,
      comment: vars.comment,
      allowProvisionalBsc: vars.allowProvisionalBsc,
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['evaluations'] })
      toast.success(t('useCreateEvaluation.evaluationCreatedSuccessfully'))
      // Khung bell curve ở chế độ "chỉ cảnh báo": đánh giá vẫn được lưu, nhưng người chấm cần
      // biết đơn vị đang lệch hạn mức — im lặng thì chế độ này chẳng khác gì tắt khung.
      if (data?.bellCurveWarning) toast.warning(data.bellCurveWarning, { duration: 8000 })
    },
    onError: (error, vars) => {
      if (vars.askProvisional && getApiErrorCode(error) === 'EVALUATION_WAITING_BSC_SOURCE') return
      toast.error(getApiErrorMessage(error, t('useCreateEvaluation.failedToCreateEvaluation')))
    },
  })
}
