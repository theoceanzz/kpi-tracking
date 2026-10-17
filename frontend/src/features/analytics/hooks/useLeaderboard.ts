import { useQuery } from '@tanstack/react-query'
import { leaderboardApi, type LeaderboardFilter } from '../api/leaderboardApi'

/**
 * Hook cho ba ô mở đầu trang Thống kê.
 *
 * <p>Phạm vi dữ liệu do server quyết (ORG / UNIT / SELF), nên khoá truy vấn không mang vai trò —
 * đăng xuất đã xoá sạch cache.
 */
function key(name: string, f: LeaderboardFilter) {
  return ['leaderboard', name, f.orgUnitId, f.periodId, f.periodIdTo, f.cycleId, f.limit,
    f.sortBy, f.sortDir] as const
}

export function usePeopleLeaderboard(f: LeaderboardFilter, enabled = true) {
  return useQuery({
    queryKey: key('people', f),
    queryFn: () => leaderboardApi.getPeople(f),
    enabled,
    placeholderData: previous => previous,
  })
}

export function useUnitLeaderboard(f: LeaderboardFilter, enabled = true) {
  return useQuery({
    queryKey: key('units', f),
    queryFn: () => leaderboardApi.getUnits(f),
    enabled,
    placeholderData: previous => previous,
  })
}

export function useUnitPeriodHeatmap(f: LeaderboardFilter, enabled = true) {
  return useQuery({
    queryKey: key('heatmap', f),
    queryFn: () => leaderboardApi.getUnitPeriodHeatmap(f),
    enabled,
    placeholderData: previous => previous,
  })
}
