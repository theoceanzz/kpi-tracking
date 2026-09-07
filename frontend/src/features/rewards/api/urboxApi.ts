import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type {
  GiftItem,
  ImportUrboxGiftRequest,
  UrboxCatalogPage,
  UrboxStatus,
  UrboxTaxonomy,
} from '../types'

/**
 * Kho quà eVoucher UrBox — CHỈ dùng ở màn hình quản trị.
 *
 * <p>Cửa hàng của nhân viên không gọi những endpoint này: nó đọc quà đã nhập từ
 * `/reward-gifts`. Mỗi request ở đây là một cuộc gọi thẳng sang UrBox, và họ khuyến nghị
 * đọc kho quà khoảng 1 lần/ngày.
 */
export const urboxApi = {
  getStatus: () =>
    axiosInstance.get<ApiResponse<UrboxStatus>>('/urbox/status').then((r) => r.data.data),

  browse: (params: {
    catId?: string
    brandId?: string
    title?: string
    page?: number
    size?: number
  }) =>
    axiosInstance
      .get<ApiResponse<UrboxCatalogPage>>('/urbox/gifts', { params })
      .then((r) => r.data.data),

  /** parentId = 2 là danh mục quà eVoucher, 136 là quà vật lý. */
  getCategories: (parentId?: number) =>
    axiosInstance
      .get<ApiResponse<UrboxTaxonomy[]>>('/urbox/categories', { params: { parentId } })
      .then((r) => r.data.data),

  getBrands: (catId?: string) =>
    axiosInstance
      .get<ApiResponse<UrboxTaxonomy[]>>('/urbox/brands', { params: { catId } })
      .then((r) => r.data.data),

  importGift: (data: ImportUrboxGiftRequest) =>
    axiosInstance
      .post<ApiResponse<GiftItem>>('/urbox/gifts/import', data)
      .then((r) => r.data.data),
}
