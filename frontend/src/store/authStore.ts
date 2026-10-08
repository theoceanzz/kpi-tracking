import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserInfo } from '@/types/auth'
import { clearUserScopedState, orgIdOf } from '@/lib/session'

/**
 * Store này KHÔNG giữ token. Access/refresh token nằm trong cookie HttpOnly do backend cấp,
 * JavaScript không đọc được — đó là điểm mấu chốt để XSS không lấy được phiên đăng nhập.
 *
 * Phần lưu ở localStorage chỉ còn hồ sơ người dùng và cờ đã đăng nhập, đủ để render ngay
 * khi tải trang. Tính hợp lệ thật sự do cookie quyết định; useAuth.refreshUser() đối chiếu
 * lại với /auth/me và tự đăng xuất nếu server trả 401.
 *
 * orgId KHÔNG lưu riêng ở đâu cả: mọi nơi lấy `user.memberships[0].organizationId` từ store này
 * lúc render/gửi request, nên đổi `user` là đổi orgId.
 */
interface AuthState {
  user: UserInfo | null
  isAuthenticated: boolean
  /** Đăng nhập thành công: luôn là phiên mới — dọn sạch cache của phiên trước rồi mới đặt user. */
  setAuth: (user: UserInfo) => void
  /** Cập nhật hồ sơ (từ /auth/me, sau khi sửa hồ sơ…). Đổi người / đổi tổ chức thì dọn cache. */
  setUser: (user: UserInfo) => void
  logout: () => void
}

export const AUTH_STORAGE_KEY = 'auth-storage'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => {
        // Đăng nhập lại đúng người cũ thì giữ nháp form của họ; người khác thì xoá.
        clearUserScopedState({ keepDrafts: get().user?.id === user.id })
        set({ user, isAuthenticated: true })
      },

      setUser: (user) => {
        const prev = get().user
        if (prev && (prev.id !== user.id || orgIdOf(prev) !== orgIdOf(user))) clearUserScopedState()
        set({ user })
      },

      logout: () => {
        clearUserScopedState()
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      // v0 lưu cả accessToken lẫn refreshToken. Nâng version buộc mọi bản lưu cũ bị bỏ đi
      // ở lần tải trang đầu tiên sau khi triển khai, xoá token còn sót trong localStorage.
      // Người dùng đang đăng nhập phải đăng nhập lại một lần — đúng như mong đợi vì cookie
      // phiên chưa tồn tại.
      version: 1,
      migrate: () => ({ user: null, isAuthenticated: false }),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)

/** Điểm đăng xuất phía client duy nhất (đăng xuất, refresh token hỏng, phát hiện phiên lệch). */
export function resetSession() {
  useAuthStore.getState().logout()
}

/**
 * Cookie phiên dùng chung cho mọi tab, còn store trong bộ nhớ thì không: tab khác đăng xuất /
 * đăng nhập tài khoản khác thì tab này vẫn giữ user cũ và gọi API theo orgId cũ bằng cookie mới
 * → 403. Nghe sự kiện `storage` của chính key này và đồng bộ theo.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== AUTH_STORAGE_KEY) return
    const before = useAuthStore.getState().user
    let next: UserInfo | null = null
    try {
      next = e.newValue ? (JSON.parse(e.newValue)?.state?.user ?? null) : null
    } catch { /* bản lưu hỏng — coi như đã đăng xuất */ }
    if (before?.id === next?.id && orgIdOf(before) === orgIdOf(next)) return
    // Tải lại trang: mọi component, socket và query đang chạy của người cũ bị bỏ cùng lúc,
    // trang mới đọc hồ sơ mới từ localStorage (hoặc về /login nếu đã đăng xuất). Không xoá nháp
    // ở đây: localStorage dùng chung, tab kia đã tự dọn đúng lúc.
    window.location.reload()
  })
}
