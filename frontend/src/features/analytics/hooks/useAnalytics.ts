import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/features/dashboard/api/statsApi'

export function useMyAnalytics(from?: string, to?: string, periodId?: string, periodIdTo?: string) {
  return useQuery({
    queryKey: ['analytics', 'my', from, to, periodId, periodIdTo],
    queryFn: () => statsApi.getMyAnalytics(from, to, periodId, periodIdTo),
  })
}

export function useDrillDown(orgUnitId?: string, from?: string, to?: string, periodId?: string, periodIdTo?: string) {
  return useQuery({
    queryKey: ['analytics', 'drill-down', orgUnitId, from, to, periodId, periodIdTo],
    queryFn: () => statsApi.getDrillDown(orgUnitId, from, to, periodId, periodIdTo),
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

export function useSummaryComparison(orgUnitId?: string, from?: string, to?: string, onlyApproved?: boolean, periodId?: string, periodIdTo?: string) {
  return useQuery({
    queryKey: ['analytics', 'summary', 'comparison', orgUnitId, from, to, onlyApproved, periodId, periodIdTo],
    queryFn: () => statsApi.getSummaryComparison(orgUnitId, from, to, onlyApproved, periodId, periodIdTo),
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

export function useSummaryRankings(orgUnitId?: string, rankingUnitId?: string, from?: string, to?: string, onlyApproved?: boolean, periodId?: string, page?: number, size?: number, sortBy?: string, sortDir?: string, periodIdTo?: string) {
  return useQuery({
    queryKey: ['analytics', 'summary', 'rankings', orgUnitId, rankingUnitId, from, to, onlyApproved, periodId, page, size, sortBy, sortDir, periodIdTo],
    queryFn: () => statsApi.getSummaryRankings(orgUnitId, rankingUnitId, from, to, onlyApproved, periodId, page, size, sortBy, sortDir, periodIdTo),
    placeholderData: (previousData) => previousData,
  })
}
