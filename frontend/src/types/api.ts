// Matches BE: ApiResponse<T>
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
}

// Matches BE: CursorPageResponse<T> — keyset pagination cho bảng ghi liên tục (thông báo...).
// Không có totalElements/totalPages: gửi lại nextCursor để lấy trang kế, null = hết.
export interface CursorPageResponse<T> {
  content: T[]
  size: number
  nextCursor: string | null
  hasMore: boolean
}

// Matches BE: PageResponse<T>
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface PageParams {
  page?: number
  size?: number
}
