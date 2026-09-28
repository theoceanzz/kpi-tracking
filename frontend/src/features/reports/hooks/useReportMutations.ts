import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CreateReportRequest, UpdateReportRequest, AddReportDatasourceRequest, UpsertWidgetRequest } from '@/types/datasource'
import { useTranslation } from 'react-i18next'

export function useCreateReport() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReportRequest) => reportApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.reportCreatedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.failedToCreateReport'))),
  })
}

export function useUpdateReport() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReportRequest }) => reportApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.updatedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.failedToUpdateReport'))),
  })
}

export function useDeleteReport() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.reportDeletedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.failedToDeleteReport'))),
  })
}

export function useAddReportDatasource() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: string; data: AddReportDatasourceRequest }) =>
      reportApi.addDatasource(reportId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.dataSourceConnectedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.connectionFailed'))),
  })
}

export function useRemoveReportDatasource() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reportDatasourceId: string) => reportApi.removeDatasource(reportDatasourceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.disconnectedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.disconnectFailed'))),
  })
}

export function useAddWidget() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: string; data: UpsertWidgetRequest }) =>
      reportApi.addWidget(reportId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.chartAddedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.failedToAddChart'))),
  })
}

export function useUpdateWidget() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ widgetId, data }: { widgetId: string; data: UpsertWidgetRequest }) =>
      reportApi.updateWidget(widgetId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.chartUpdatedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.failedToUpdateChart'))),
  })
}

export function useDeleteWidget() {
  const { t } = useTranslation('reports')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (widgetId: string) => reportApi.deleteWidget(widgetId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success(t('useReportMutations.chartDeletedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReportMutations.failedToDeleteChart'))),
  })
}
