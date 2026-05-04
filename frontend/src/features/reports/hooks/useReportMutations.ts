import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import { toast } from 'sonner'
import type { CreateReportRequest, UpdateReportRequest, AddReportDatasourceRequest, UpsertWidgetRequest } from '@/types/datasource'

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReportRequest) => reportApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Tạo báo cáo thành công') },
    onError: () => toast.error('Tạo báo cáo thất bại'),
  })
}

export function useUpdateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReportRequest }) => reportApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Cập nhật thành công') },
    onError: () => toast.error('Cập nhật thất bại'),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Xóa báo cáo thành công') },
    onError: () => toast.error('Xóa thất bại'),
  })
}

export function useAddReportDatasource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: string; data: AddReportDatasourceRequest }) =>
      reportApi.addDatasource(reportId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Kết nối datasource thành công') },
    onError: () => toast.error('Kết nối thất bại'),
  })
}

export function useRemoveReportDatasource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reportDatasourceId: string) => reportApi.removeDatasource(reportDatasourceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Ngắt kết nối thành công') },
    onError: () => toast.error('Ngắt kết nối thất bại'),
  })
}

export function useAddWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: string; data: UpsertWidgetRequest }) =>
      reportApi.addWidget(reportId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Thêm biểu đồ thành công') },
    onError: () => toast.error('Thêm biểu đồ thất bại'),
  })
}

export function useUpdateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ widgetId, data }: { widgetId: string; data: UpsertWidgetRequest }) =>
      reportApi.updateWidget(widgetId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Cập nhật biểu đồ thành công') },
    onError: () => toast.error('Cập nhật biểu đồ thất bại'),
  })
}

export function useDeleteWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (widgetId: string) => reportApi.deleteWidget(widgetId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Xóa biểu đồ thành công') },
    onError: () => toast.error('Xóa biểu đồ thất bại'),
  })
}
