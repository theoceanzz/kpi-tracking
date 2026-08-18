import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { urboxApi } from '../api/urboxApi'
import type { ImportUrboxGiftRequest } from '../types'

const errMsg = (error: any, fallback: string) => error?.response?.data?.message || fallback

/**
 * Kết nối UrBox có bật không. Hỏi một lần rồi giữ lâu: đây là cấu hình của bản triển
 * khai, không phải dữ liệu thay đổi trong phiên làm việc.
 */
export const useUrboxStatus = () =>
  useQuery({
    queryKey: ['urboxStatus'],
    queryFn: () => urboxApi.getStatus(),
    staleTime: 30 * 60 * 1000,
    // Chưa cấu hình UrBox là trạng thái bình thường, không phải sự cố — thử lại chỉ làm
    // chậm màn hình quản lý quà.
    retry: false,
  })

export const useUrboxCategories = (enabled = true) =>
  useQuery({
    queryKey: ['urboxCategories'],
    queryFn: () => urboxApi.getCategories(2),
    enabled,
    staleTime: 60 * 60 * 1000,
  })

export const useUrboxCatalog = (
  params: { catId?: string; brandId?: string; title?: string; page?: number; size?: number },
  enabled = true,
) =>
  useQuery({
    queryKey: ['urboxCatalog', params],
    queryFn: () => urboxApi.browse(params),
    enabled,
    // Kho quà UrBox gần như không đổi trong ngày; giữ lại để chuyển trang qua lại không
    // bắn thêm request ra ngoài.
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
  })

export const useUrboxImport = () => {
  const qc = useQueryClient()

  const importMutation = useMutation({
    mutationFn: (data: ImportUrboxGiftRequest) => urboxApi.importGift(data),
    onSuccess: (gift) => {
      qc.invalidateQueries({ queryKey: ['giftsManage'] })
      qc.invalidateQueries({ queryKey: ['giftShop'] })
      // Kho quà phải làm mới theo: món vừa nhập cần chuyển sang trạng thái "đã nhập",
      // nếu không quản trị viên sẽ bấm nhập lần nữa và nhận lỗi trùng.
      qc.invalidateQueries({ queryKey: ['urboxCatalog'] })
      toast.success(`Đã thêm "${gift.name}" vào danh mục quà`, {
        description: `Nhân viên đổi món này với ${gift.pointCost.toLocaleString('vi-VN')} điểm.`,
      })
    },
    onError: (error: any) => toast.error(errMsg(error, 'Nhập quà thất bại'), { duration: 6000 }),
  })

  return {
    importGift: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
  }
}
