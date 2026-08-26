import { useEffect } from 'react'
import { useTourStore } from '@/store/tourStore'

/**
 * Báo lên cho hệ hướng dẫn biết màn hình này thuộc dòng sidebar nào và đang mở mục nào.
 *
 * Gọi từ khung trang (`SettingsSectionLayout`) hoặc từ những trang không có mục con
 * (dashboard theo vai trò, K.AI). Trang tự khai thay vì để layout đoán từ URL: dashboard
 * chọn bảng theo quyền và theo `?view=`, chỉ chính nó mới biết đang vẽ bảng nào.
 */
export function useTourScope(navId: string | null, sectionId: string | null = null) {
  const setNavScope = useTourStore((s) => s.setNavScope)

  useEffect(() => {
    setNavScope(navId, sectionId)
    return () => {
      // Chỉ dọn nếu scope vẫn còn là của mình: khi chuyển thẳng từ trang này sang trang
      // khác, effect của trang mới có thể chạy trước cleanup của trang cũ.
      const current = useTourStore.getState().scope
      if (current.navId === navId && current.sectionId === sectionId) {
        useTourStore.getState().setNavScope(null, null)
      }
    }
  }, [navId, sectionId, setNavScope])
}

/**
 * Báo lên tab cấp 3 nào đang mở trong mục hiện tại.
 *
 * Tách khỏi `useTourScope` vì hai mảnh này do hai component khác nhau nắm: khung trang
 * biết mục, còn hàng tab bên trong card mới biết tab.
 */
export function useTourTabScope(tabKey: string | null | undefined) {
  const setTabScope = useTourStore((s) => s.setTabScope)
  const key = tabKey ?? null

  useEffect(() => {
    setTabScope(key)
    return () => {
      const current = useTourStore.getState().scope
      if (current.tabKey === key) useTourStore.getState().setTabScope(null)
    }
  }, [key, setTabScope])
}
