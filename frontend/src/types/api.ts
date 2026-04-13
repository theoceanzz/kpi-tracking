// Matches BE: ApiResponse<T>
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
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
