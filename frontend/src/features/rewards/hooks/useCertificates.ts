import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { certificateApi } from '../api/certificateApi'
import type { CertificateTemplateRequest } from '../types'

const errMsg = (error: any, fallback: string) => error?.response?.data?.message || fallback

/**
 * Danh mục mẫu cho màn hình IN.
 *
 * <p>Chỉ mẫu đang bật. Danh sách rỗng là bình thường — tổ chức chưa soạn mẫu nào vẫn in
 * được bằng bộ thiết kế dựng sẵn ở `presets.ts`, nên đừng coi đây là lỗi thiếu dữ liệu.
 */
export const useCertificateCatalog = (enabled = true) =>
  useQuery({
    queryKey: ['certificateCatalog'],
    queryFn: () => certificateApi.getCatalog(),
    enabled,
    // Mẫu chứng nhận gần như không đổi trong một phiên làm việc; giữ lâu để mở modal in
    // không phải chờ mạng mỗi lần.
    staleTime: 5 * 60 * 1000,
  })

/** Danh mục cho màn hình QUẢN TRỊ: có cả mẫu đang tắt, kèm các thao tác sửa. */
export const useCertificateTemplates = () => {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['certificateTemplates'],
    queryFn: () => certificateApi.getCatalogForManage(),
  })

  // Sửa mẫu ở màn quản trị phải thấy ngay ở màn in — hai nơi đọc hai khoá khác nhau.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['certificateTemplates'] })
    qc.invalidateQueries({ queryKey: ['certificateCatalog'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: CertificateTemplateRequest) => certificateApi.create(data),
    onSuccess: () => {
      invalidate()
      toast.success('Đã lưu mẫu chứng nhận')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Lưu mẫu thất bại')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CertificateTemplateRequest }) =>
      certificateApi.update(id, data),
    onSuccess: () => {
      invalidate()
      toast.success('Đã cập nhật mẫu chứng nhận')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Cập nhật mẫu thất bại')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => certificateApi.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success('Đã xoá mẫu chứng nhận')
    },
    onError: (error: any) => toast.error(errMsg(error, 'Xoá mẫu thất bại')),
  })

  return {
    ...query,
    createTemplate: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTemplate: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTemplate: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}

/** Các lần chính mình được thưởng — nguồn của mục "Chứng nhận của tôi". */
export const useMyAwards = (page = 0, size = 20) =>
  useQuery({
    queryKey: ['myAwards', page, size],
    queryFn: () => certificateApi.getMyAwards(page, size),
  })
