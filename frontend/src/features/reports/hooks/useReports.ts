import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'

export function useReports(params: { page?: number; size?: number; orgUnitId?: string } = {}) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportApi.getAll(params),
  })
}

export function useReport(id: string, enabled = true) {
  return useQuery({
    queryKey: ['reports', id],
    queryFn: () => reportApi.getById(id),
    enabled: !!id && enabled,
  })
}
