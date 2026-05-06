import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { SubmissionStatus } from '@/types/submission'

export function useSubmissions(params: { 
  page?: number; 
  size?: number; 
  status?: SubmissionStatus; 
  kpiCriteriaId?: string;
  submittedById?: string;
  orgUnitId?: string;
  kpiPeriodId?: string;
  organizationId?: string;
  sortBy?: string;
  sortDir?: string;
} = {}) {
  return useQuery({
    queryKey: ['submissions', 'all', params],
    queryFn: () => submissionApi.getAll(params),
  })
}
