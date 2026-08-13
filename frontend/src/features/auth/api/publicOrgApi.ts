import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse } from '@/types/api'

/** Công ty hiển thị ở màn chọn công ty. Endpoint công khai nên chỉ có 4 trường. */
export interface PublicOrganization {
  id: string
  /** Backend đã chọn sẵn: tên trên Lark nếu có, ngược lại tên trong KeyGo. */
  name: string
  code: string
  avatarUrl: string | null
}

export const publicOrgApi = {
  search: (keyword: string, page: number, size = 10) =>
    axiosInstance
      .get<ApiResponse<PageResponse<PublicOrganization>>>('/public/organizations', {
        params: { keyword: keyword || undefined, page, size },
      })
      .then((r) => r.data.data),
}
