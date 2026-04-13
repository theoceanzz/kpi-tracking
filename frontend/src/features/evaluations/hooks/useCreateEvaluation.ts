import { useMutation, useQueryClient } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'
import { toast } from 'sonner'
import type { CreateEvaluationRequest } from '@/types/evaluation'

export function useCreateEvaluation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEvaluationRequest) => evaluationApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evaluations'] }); toast.success('Tạo đánh giá thành công') },
    onError: () => toast.error('Tạo đánh giá thất bại'),
  })
}
