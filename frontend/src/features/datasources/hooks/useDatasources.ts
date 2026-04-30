import { useQuery, useQueries } from '@tanstack/react-query'
import { datasourceApi } from '../api/datasourceApi'

export function useDatasources(params: { page?: number; size?: number; orgUnitId?: string } = {}) {
  return useQuery({
    queryKey: ['datasources', params],
    queryFn: () => datasourceApi.getAll(params),
  })
}

export function useDatasource(id: string, enabled = true) {
  return useQuery({
    queryKey: ['datasources', id],
    queryFn: () => datasourceApi.getById(id),
    enabled: !!id && enabled,
  })
}

export function useDatasourceRows(datasourceId: string, params: { page?: number; size?: number } = {}) {
  return useQuery({
    queryKey: ['datasource-rows', datasourceId, params],
    queryFn: () => datasourceApi.getRows(datasourceId, params),
    enabled: !!datasourceId,
  })
}

export function useDatasourceData(datasourceId: string, enabled = true) {
  return useQuery({
    queryKey: ['datasource-data', datasourceId],
    queryFn: () => datasourceApi.queryData(datasourceId),
    enabled: !!datasourceId && enabled,
  })
}

export function useDatasourceDataQueries(datasourceIds: string[]) {
  return useQueries({
    queries: datasourceIds.map(id => ({
      queryKey: ['datasource-data', id],
      queryFn: () => datasourceApi.queryData(id),
      enabled: !!id,
    }))
  })
}
