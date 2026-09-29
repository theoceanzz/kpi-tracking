import { useMutation, useQueryClient } from '@tanstack/react-query'
import { datasourceApi } from '../api/datasourceApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CreateDatasourceRequest, UpdateDatasourceRequest, UpsertColumnRequest, UpsertRowRequest } from '@/types/datasource'
import { useTranslation } from 'react-i18next'

export function useCreateDatasource() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDatasourceRequest) => datasourceApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success(t('useDatasourceMutations.dataSourceCreatedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToCreateDataSource'))),
  })
}

export function useUpdateDatasource() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDatasourceRequest }) => datasourceApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success(t('useDatasourceMutations.updatedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToUpdateDataSource'))),
  })
}

export function useDeleteDatasource() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => datasourceApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success(t('useDatasourceMutations.dataSourceDeletedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToDeleteDataSource'))),
  })
}

export function useAddColumn() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ datasourceId, data }: { datasourceId: string; data: UpsertColumnRequest }) =>
      datasourceApi.addColumn(datasourceId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); qc.invalidateQueries({ queryKey: ['datasource-rows'] }); toast.success(t('useDatasourceMutations.columnAddedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToAddColumn'))),
  })
}

export function useUpdateColumn() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ columnId, data }: { columnId: string; data: UpsertColumnRequest }) =>
      datasourceApi.updateColumn(columnId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success(t('useDatasourceMutations.columnUpdatedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToUpdateColumn'))),
  })
}

export function useDeleteColumn() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (columnId: string) => datasourceApi.deleteColumn(columnId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); qc.invalidateQueries({ queryKey: ['datasource-rows'] }); toast.success(t('useDatasourceMutations.columnDeletedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToDeleteColumn'))),
  })
}

export function useAddRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ datasourceId, data }: { datasourceId: string; data?: UpsertRowRequest }) =>
      datasourceApi.addRow(datasourceId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasource-rows'] }); qc.invalidateQueries({ queryKey: ['datasources'] }) },
  })
}

export function useUpdateRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rowId, data }: { rowId: string; data: UpsertRowRequest }) =>
      datasourceApi.updateRow(rowId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasource-rows'] }) },
  })
}

export function useDeleteRow() {
  const { t } = useTranslation('datasources')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rowId: string) => datasourceApi.deleteRow(rowId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasource-rows'] }); qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success(t('useDatasourceMutations.rowDeletedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useDatasourceMutations.failedToDeleteRow'))),
  })
}
