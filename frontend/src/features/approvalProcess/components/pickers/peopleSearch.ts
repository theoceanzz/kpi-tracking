import { createContext, useContext } from 'react'
import { userApi } from '@/features/users/api/userApi'

/** Một người trong kết quả tìm của bộ chọn người. */
export interface PersonHit {
  id: string
  name: string
  avatarUrl?: string | null
  /** Dòng phụ: email. */
  detail?: string | null
}

export interface PeopleSearch {
  /** Phân biệt cache giữa các nguồn. */
  key: string
  search: (keyword: string) => Promise<PersonHit[]>
}

/** Mặc định: danh sách người dùng (cần USER:VIEW) — màn quản trị quy trình duyệt. */
const usersSearch: PeopleSearch = {
  key: 'users',
  search: (keyword) =>
    userApi.getAll({ page: 0, size: 10, keyword: keyword || undefined })
      .then((p) => p.content.map((u) => ({ id: u.id, name: u.fullName, avatarUrl: u.avatarUrl, detail: u.email }))),
}

/**
 * Nguồn tìm người cho {@link UserPickerPopover} / {@link ApproverPicker}. Trình sửa đơn từ đổi sang nguồn chỉ cần
 * đăng nhập (người quản lý đơn có thể không có quyền xem danh sách người dùng).
 */
export const PeopleSearchContext = createContext<PeopleSearch>(usersSearch)

export const usePeopleSearch = () => useContext(PeopleSearchContext)
