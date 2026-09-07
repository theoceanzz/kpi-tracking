import { useQuery } from '@tanstack/react-query'
import { advancedAnalyticsApi, type AdvancedFilter } from '../api/advancedAnalyticsApi'

/**
 * Hooks cho các biểu đồ chuyên sâu.
 *
 * <p>Phạm vi dữ liệu KHÔNG do frontend quyết định: mỗi endpoint tự phân giải cấp
 * (ORG / UNIT / SELF) từ quyền của người gọi, nên cùng một lời gọi trả về lượng dữ liệu khác nhau
 * tuỳ người đăng nhập. Vì vậy queryKey không cần mang theo vai trò — đăng xuất đã xoá sạch cache
 * qua `authStore.logout()`.
 *
 * <p>Mọi hook đều nhận cờ `enabled` để widget nằm trong mục thu gọn hoặc tab chưa mở không bắn
 * request thừa.
 */
function key(name: string, f: AdvancedFilter) {
  return ['advanced', name, f.orgUnitId, f.periodId, f.periodIdTo, f.from, f.to] as const
}

export function useBehaviorCompletion(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('behavior-completion', f),
    queryFn: () => advancedAnalyticsApi.getBehaviorCompletion(f),
    enabled,
  })
}

export function useBscVsSystemScatter(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('bsc-vs-system', f),
    queryFn: () => advancedAnalyticsApi.getBscVsSystem(f),
    enabled,
  })
}

export function usePerspectiveBubble(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('perspective-bubble', f),
    queryFn: () => advancedAnalyticsApi.getPerspectiveBubble(f),
    enabled,
  })
}

export function useScoreHistogram(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('score-histogram', f),
    queryFn: () => advancedAnalyticsApi.getScoreHistogram(f),
    enabled,
  })
}

export function useUnitBoxplot(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('unit-boxplot', f),
    queryFn: () => advancedAnalyticsApi.getUnitBoxplot(f),
    enabled,
  })
}

export function useSubmissionComposition(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('submission-composition', f),
    queryFn: () => advancedAnalyticsApi.getSubmissionComposition(f),
    enabled,
  })
}

export function useSubmissionShare(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('submission-share', f),
    queryFn: () => advancedAnalyticsApi.getSubmissionShare(f),
    enabled,
  })
}

export function useBscWaterfall(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('bsc-waterfall', f),
    queryFn: () => advancedAnalyticsApi.getBscWaterfall(f),
    enabled,
  })
}

export function useWeightHistory(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('weight-history', f),
    queryFn: () => advancedAnalyticsApi.getWeightHistory(f),
    enabled,
  })
}

export function useKpiCascade(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('kpi-cascade', f),
    queryFn: () => advancedAnalyticsApi.getKpiCascade(f),
    enabled,
  })
}

export function useKpiLifecycle(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('kpi-lifecycle', f),
    queryFn: () => advancedAnalyticsApi.getKpiLifecycle(f),
    enabled,
  })
}

export function useOkrFlow(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('okr-flow', f),
    queryFn: () => advancedAnalyticsApi.getOkrFlow(f),
    enabled,
  })
}

export function useScoreDeviation(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('deviation', f),
    queryFn: () => advancedAnalyticsApi.getDeviation(f),
    enabled,
  })
}

export function useSelfVsManager(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('self-vs-manager', f),
    queryFn: () => advancedAnalyticsApi.getSelfVsManager(f),
    enabled,
  })
}

export function useRankDelta(f: AdvancedFilter, enabled = true) {
  return useQuery({
    queryKey: key('rank-delta', f),
    queryFn: () => advancedAnalyticsApi.getRankDelta(f),
    enabled,
  })
}
