import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import type { SubmissionStatus } from '@/types/submission'

export function useOrgUnitSubmissions(params: { 
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
    queryKey: ['submissions', 'org-unit', params],
    queryFn: () => submissionApi.getAll(params),
  })
}
