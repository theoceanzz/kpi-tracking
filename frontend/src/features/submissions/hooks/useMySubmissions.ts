import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'

export function useMySubmissions(page = 0, size = 20) {
  return useQuery({
    queryKey: ['submissions', 'my', page, size],
    queryFn: () => submissionApi.getMy(page, size),
  })
}
