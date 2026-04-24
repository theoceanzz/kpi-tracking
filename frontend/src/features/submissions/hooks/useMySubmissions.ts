import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'

export function useMySubmissions(params: { 
  page?: number; 
  size?: number; 
  status?: SubmissionStatus; 
  sortBy?: string;
  sortDir?: string;
} = {}) {
  return useQuery({
    queryKey: ['submissions', 'my', params],
    queryFn: () => submissionApi.getMy(params),
  })
}
