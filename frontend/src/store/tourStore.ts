import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Khoá của một bài hướng dẫn, theo đúng ba tầng điều hướng của app:
 *
 *   `<navId>`                      — dòng sidebar (màn hình lưới thẻ của trang gộp)
 *   `<navId>/<sectionId>`          — một mục bên trong trang, chọn bằng `?section=`
 *   `<navId>/<sectionId>#<tabKey>` — một tab bên trong mục đó
 *
 * Trước đây đây là một union viết tay gồm 22 khoá phẳng, sinh ra từ hồi mỗi màn hình
 * còn là một dòng sidebar riêng. Cấu trúc phẳng đó không diễn đạt nổi quan hệ cha–con
 * nên không có chỗ đặt khoá cho những mục nằm sâu (ví dụ tab "Điểm danh" trong mục
 * "Quản lý thưởng"), và cũng không cho biết xem xong tầng trên thì tầng nào tới lượt.
 * Chuỗi ký tự có quy ước thì cả hai việc đó đều suy ra được.
 */
export type TourKey = string

export type TourLevel = 'page' | 'section' | 'tab'

/** Ghép khoá từ ba mảnh. Thiếu mảnh nào thì dừng ở tầng đó. */
export function tourKeyOf(navId: string, sectionId?: string | null, tabKey?: string | null): TourKey {
  if (!sectionId) return navId
  if (!tabKey) return `${navId}/${sectionId}`
  return `${navId}/${sectionId}#${tabKey}`
}

export function tourLevelOf(key: TourKey): TourLevel {
  if (key.includes('#')) return 'tab'
  if (key.includes('/')) return 'section'
  return 'page'
}

export function splitTourKey(key: TourKey): { navId: string; sectionId?: string; tabKey?: string } {
  const hashAt = key.indexOf('#')
  const beforeHash = hashAt === -1 ? key : key.slice(0, hashAt)
  const tabKey = hashAt === -1 ? undefined : key.slice(hashAt + 1)
  const slashAt = beforeHash.indexOf('/')
  const navId = slashAt === -1 ? beforeHash : beforeHash.slice(0, slashAt)
  const sectionId = slashAt === -1 ? undefined : beforeHash.slice(slashAt + 1)
  return { navId, sectionId, tabKey }
}

/**
 * Vị trí người dùng đang đứng, do chính các khung màn hình báo lên.
 *
 * Cố ý KHÔNG suy từ URL: `?section=` thì đọc được, nhưng tab cấp 3 mỗi màn dùng một tên
 * tham số khác nhau (`?tab=`, `?scoring=`), tab đang mở còn có thể là tab mặc định chưa
 * kịp ghi vào URL, hoặc một tab bị ẩn theo quyền. Khung nào vẽ ra tab thì khung đó biết
 * chắc tab nào đang mở — để nó báo lên là hết đường sai.
 */
export interface TourScope {
  navId: string | null
  sectionId: string | null
  tabKey: string | null
}

const EMPTY_SCOPE: TourScope = { navId: null, sectionId: null, tabKey: null }

interface TourState {
  /** userId → (khoá hướng dẫn → đã xem chưa) */
  seenToursByUser: Record<string, Record<string, boolean>>
  /** Khoá đang chạy, `null` khi không có bài nào chạy. */
  activeTour: TourKey | null
  /** Vị trí hiện tại, không lưu xuống đĩa. */
  scope: TourScope

  /** Khung trang báo lên đang ở dòng sidebar nào, mục nào. */
  setNavScope: (navId: string | null, sectionId: string | null) => void
  /** Khung tab báo lên tab nào đang mở trong mục hiện tại. */
  setTabScope: (tabKey: string | null) => void

  markSeen: (key: TourKey, userId: string) => void
  startTour: (key: TourKey) => void
  stopTour: () => void
  hasSeen: (key: TourKey, userId: string) => boolean
  resetTour: (key: TourKey, userId: string) => void
  resetAll: () => void
}

/**
 * Khoá cũ (bản 1, khi mỗi màn hình còn là một dòng sidebar) → khoá mới theo ba tầng.
 * Không có bảng này thì mọi người dùng cũ bị coi như chưa xem gì và bị chạy lại toàn bộ
 * hướng dẫn ngay lần đăng nhập kế tiếp.
 */
const LEGACY_KEY_MAP: Record<string, TourKey> = {
  'dashboard-director': 'dashboard/director',
  'dashboard-head': 'dashboard/head',
  'dashboard-staff': 'dashboard/staff',
  'company': 'setup-company',
  'roles': 'setup-company/roles',
  'org-structure': 'setup-company/org-structure',
  'users': 'setup-company/users',
  'tool-config': 'setup-tools',
  'performance': 'performance',
  'my-space': 'my-space',
  'kpi-criteria': 'performance/kpi-criteria',
  'kpi-periods': 'setup-tools/kpi-cycles#periods',
  'kpi-pending': 'performance/kpi-criteria-pending',
  'kpi-adjustments': 'performance/kpi-adjustments-pending',
  'submissions-org': 'performance/submissions-org-unit',
  'my-kpi': 'my-space/my-kpi',
  'my-submissions': 'my-space/my-submissions',
  'my-adjustments': 'my-space/my-adjustments',
  'evaluations': 'my-space/evaluations',
  'analytics': 'analytics',
  'okr-management': 'setup-tools/okr',
}

function migrateSeenMap(seen: Record<string, Record<string, boolean>>) {
  const out: Record<string, Record<string, boolean>> = {}
  for (const [userId, keys] of Object.entries(seen ?? {})) {
    const migrated: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(keys ?? {})) {
      migrated[LEGACY_KEY_MAP[key] ?? key] = value
    }
    out[userId] = migrated
  }
  return out
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      seenToursByUser: {},
      activeTour: null,
      scope: EMPTY_SCOPE,

      setNavScope: (navId, sectionId) =>
        set((state) => {
          if (state.scope.navId === navId && state.scope.sectionId === sectionId) return state
          // KHÔNG xoá `tabKey` ở đây, dù đổi mục thì tab cũ hết nghĩa. Lý do là thứ tự
          // effect của React: component con (hàng tab) chạy effect TRƯỚC component cha
          // (khung trang), nên xoá ở đây sẽ xoá đúng cái tab mà con vừa báo lên. Việc
          // dọn thuộc về `useTourTabScope`: hàng tab cũ unmount thì tự gỡ khoá của mình.
          return { scope: { ...state.scope, navId, sectionId } }
        }),

      setTabScope: (tabKey) =>
        set((state) => (state.scope.tabKey === tabKey ? state : { scope: { ...state.scope, tabKey } })),

      markSeen: (key, userId) =>
        set((state) => {
          const userSeen = state.seenToursByUser[userId] || {}
          return {
            seenToursByUser: {
              ...state.seenToursByUser,
              [userId]: { ...userSeen, [key]: true },
            },
            activeTour: state.activeTour === key ? null : state.activeTour,
          }
        }),

      startTour: (key) => set({ activeTour: key }),

      stopTour: () => set({ activeTour: null }),

      hasSeen: (key, userId) => {
        if (!userId) return true // Chưa đăng nhập thì không chạy hướng dẫn.
        return !!get().seenToursByUser[userId]?.[key]
      },

      resetTour: (key, userId) =>
        set((state) => {
          const userSeen = { ...(state.seenToursByUser[userId] || {}) }
          delete userSeen[key]
          return { seenToursByUser: { ...state.seenToursByUser, [userId]: userSeen } }
        }),

      resetAll: () => set({ seenToursByUser: {}, activeTour: null }),
    }),
    {
      name: 'tour-storage',
      version: 2,
      partialize: (state) => ({ seenToursByUser: state.seenToursByUser }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { seenToursByUser?: Record<string, Record<string, boolean>> }
        if (version >= 2) return state as never
        return { seenToursByUser: migrateSeenMap(state.seenToursByUser ?? {}) } as never
      },
    }
  )
)
