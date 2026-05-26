import axiosClient from '@/lib/axios'
import type { PagedKpiDetailResponse, KpiDetailParams } from './personalObjectiveApi'

export interface PersonalKpiMetrics {
  averageProgress: number
  averagePerformance: number
  runningKpis: number
  completedKpis: number
  riskKpis: number
}

export interface KpiComboChartData {
  points: {
    label: string
    oldItems: number
    newItems: number
    completionTrend: number
    performanceTrend: number
  }[]
}

export interface StandaloneKpiDetailParams {
  from?: string
  to?: string
  onlyApproved?: boolean
  sortBy?: string
  sortDir?: string
  sharedType?: string
  page?: number
  size?: number
}

export const personalKpiApi = {
  getMetrics: async (params?: { from?: string; to?: string; onlyApproved?: boolean }) => {
    const res = await axiosClient.get<{ data: PersonalKpiMetrics }>('/stats/personal/kpis/metrics', { params })
    return res.data.data
  },
  getComboChart: async (params?: { from?: string; to?: string; onlyApproved?: boolean }) => {
    const res = await axiosClient.get<{ data: KpiComboChartData }>('/stats/personal/kpis/chart/combo', { params })
    return res.data.data
  },
  getDetailedKpis: async (params?: StandaloneKpiDetailParams) => {
    const res = await axiosClient.get<{ data: PagedKpiDetailResponse }>('/stats/personal/kpis/details', { params })
    return res.data.data
  },
}
