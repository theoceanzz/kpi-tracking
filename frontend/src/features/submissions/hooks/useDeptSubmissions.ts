import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import type { SubmissionStatus } from '@/types/submission'

export function useDeptSubmissions(params: { page?: number; size?: number; status?: SubmissionStatus; kpiCriteriaId?: string } = {}) {
  return useQuery({
    queryKey: ['submissions', 'dept', params],
    queryFn: () => submissionApi.getAll(params),
  })
}
