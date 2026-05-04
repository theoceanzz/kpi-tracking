import { useMutation, useQueryClient } from '@tanstack/react-query'
import { datasourceApi } from '../api/datasourceApi'
import { toast } from 'sonner'
import type { CreateDatasourceRequest, UpdateDatasourceRequest, UpsertColumnRequest, UpsertRowRequest } from '@/types/datasource'

export function useCreateDatasource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDatasourceRequest) => datasourceApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success('Tạo datasource thành công') },
    onError: () => toast.error('Tạo datasource thất bại'),
  })
}

export function useUpdateDatasource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDatasourceRequest }) => datasourceApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success('Cập nhật thành công') },
    onError: () => toast.error('Cập nhật thất bại'),
  })
}

export function useDeleteDatasource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => datasourceApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success('Xóa datasource thành công') },
    onError: () => toast.error('Xóa thất bại'),
  })
}

export function useAddColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ datasourceId, data }: { datasourceId: string; data: UpsertColumnRequest }) =>
      datasourceApi.addColumn(datasourceId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); qc.invalidateQueries({ queryKey: ['datasource-rows'] }); toast.success('Thêm cột thành công') },
    onError: () => toast.error('Thêm cột thất bại'),
  })
}

export function useUpdateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ columnId, data }: { columnId: string; data: UpsertColumnRequest }) =>
      datasourceApi.updateColumn(columnId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success('Cập nhật cột thành công') },
    onError: () => toast.error('Cập nhật cột thất bại'),
  })
}

export function useDeleteColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (columnId: string) => datasourceApi.deleteColumn(columnId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasources'] }); qc.invalidateQueries({ queryKey: ['datasource-rows'] }); toast.success('Xóa cột thành công') },
    onError: () => toast.error('Xóa cột thất bại'),
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rowId: string) => datasourceApi.deleteRow(rowId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasource-rows'] }); qc.invalidateQueries({ queryKey: ['datasources'] }); toast.success('Xóa hàng thành công') },
    onError: () => toast.error('Xóa hàng thất bại'),
  })
}
