import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'

export function useMyAnalytics(from?: string, to?: string) {
  return useQuery({
    queryKey: ['analytics', 'my', from, to],
    queryFn: () => statsApi.getMyAnalytics(from, to),
  })
}

export function useDrillDown(orgUnitId?: string) {
  return useQuery({
    queryKey: ['analytics', 'drill-down', orgUnitId],
    queryFn: () => statsApi.getDrillDown(orgUnitId),
  })
}

export function useDetailTable(params: { orgUnitId?: string; search?: string; page?: number; size?: number }) {
  return useQuery({
    queryKey: ['analytics', 'detail-table', params],
    queryFn: () => statsApi.getDetailTable(params),
  })
}

export function useSummaryStats(orgUnitId?: string, rankingUnitId?: string, direction?: string) {
  return useQuery({
    queryKey: ['analytics', 'summary', orgUnitId, rankingUnitId, direction],
    queryFn: () => statsApi.getSummary(orgUnitId, rankingUnitId, direction),
    placeholderData: (previousData) => previousData,
  })
}

export function useSummaryTrend(orgUnitId?: string, period: string = '5_MONTHS') {
  return useQuery({
    queryKey: ['analytics', 'summary', 'trend', orgUnitId, period],
    queryFn: () => statsApi.getSummaryTrend(orgUnitId, period),
    placeholderData: (previousData) => previousData,
  })
}

export function useSummaryComparison(orgUnitId?: string, from?: string, to?: string, onlyApproved?: boolean) {
  return useQuery({
    queryKey: ['analytics', 'summary', 'comparison', orgUnitId, from, to, onlyApproved],
    queryFn: () => statsApi.getSummaryComparison(orgUnitId, from, to, onlyApproved),
    placeholderData: (previousData) => previousData,
  })
}

export function useSummaryRisks(orgUnitId?: string, period: string = 'MONTH') {
  return useQuery({
    queryKey: ['analytics', 'summary', 'risks', orgUnitId, period],
    queryFn: () => statsApi.getSummaryRisks(orgUnitId, period),
    placeholderData: (previousData) => previousData,
  })
}

export function useSummaryRankings(orgUnitId?: string, rankingUnitId?: string, from?: string, to?: string, onlyApproved?: boolean) {
  return useQuery({
    queryKey: ['analytics', 'summary', 'rankings', orgUnitId, rankingUnitId, from, to, onlyApproved],
    queryFn: () => statsApi.getSummaryRankings(orgUnitId, rankingUnitId, from, to, onlyApproved),
    placeholderData: (previousData) => previousData,
  })
}
