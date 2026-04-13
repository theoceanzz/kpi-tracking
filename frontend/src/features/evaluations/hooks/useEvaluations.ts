import { useQuery } from '@tanstack/react-query'
import { evaluationApi } from '../api/evaluationApi'

export function useEvaluations(params: { page?: number; size?: number; userId?: string; kpiCriteriaId?: string } = {}) {
  return useQuery({ queryKey: ['evaluations', params], queryFn: () => evaluationApi.getAll(params) })
}
