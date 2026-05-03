import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { SubmissionStatus } from '@/types/submission'

export function useMySubmissions(params: { 
  page?: number; 
  size?: number; 
  status?: SubmissionStatus; 
  sortBy?: string;
  sortDir?: string;
  submittedById?: string;
} = {}) {
  return useQuery({
    queryKey: ['submissions', 'my', params],
    queryFn: () => submissionApi.getMy(params),
  })
}
