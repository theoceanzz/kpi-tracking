import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { TabDef } from '@/hooks/useTabParam'
import { useTourTabScope } from '@/hooks/useTourScope'

export interface WorkspaceTabsValue {
  tabs: TabDef<string>[]
  activeTab: string
  setActiveTab: (key: string) => void
  /** `WorkspaceHeader` gọi khi mount để báo hàng tab đã được vẽ ra. */
  claim: () => () => void
  /** Ô trống trong header để tab con gửi nút hành động lên — xem `WorkspaceHeaderActions`. */
  actionSlot: HTMLElement | null
  setActionSlot: (el: HTMLElement | null) => void
}

const WorkspaceTabsContext = createContext<WorkspaceTabsValue | null>(null)

/**
 * Truyền tab cấp 2 từ trang cha (nơi gọi `useTabParam`) xuống trang con (nơi có mô tả,
 * số liệu và nút hành động của màn hình).
 *
 * Đi bằng context chứ không phải prop vì hai mảnh này nằm ngược chiều nhau: danh sách
 * tab thuộc về cha, còn phần thân card thì chỉ trang con mới biết. Nếu nâng nội dung
 * lên cha thì mỗi trang con phải phơi stats/actions ra ngoài, còn nếu đẩy tab xuống
 * con thì mỗi trang con lại phải khai lại cả danh sách anh em của mình.
 *
 * HỢP ĐỒNG: mỗi trang con nằm dưới provider phải render đúng một `<WorkspaceHeader/>`.
 * Quên thì hàng tab biến mất và người dùng kẹt lại ở tab đang mở, nên có cảnh báo ở
 * chế độ dev bên dưới.
 */
export function WorkspaceTabsProvider({
  tabs,
  activeTab,
  setActiveTab,
  children,
}: Omit<WorkspaceTabsValue, 'claim' | 'actionSlot' | 'setActionSlot'> & { children: ReactNode }) {
  const claimCount = useRef(0)
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)

  // Hàng tab này là tầng thứ ba của điều hướng, nên hệ hướng dẫn cần biết tab nào đang
  // mở. Báo từ đây chứ không đọc URL: mỗi màn dùng một tên tham số khác nhau
  // (`?tab=`, `?scoring=`) và tab mặc định thì chưa kịp có mặt trong URL.
  useTourTabScope(activeTab)

  // Ổn định qua các lần render để effect đăng ký bên `WorkspaceHeader` không chạy lại.
  const claim = useCallback(() => {
    claimCount.current += 1
    return () => {
      claimCount.current -= 1
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Đợi hết lượt commit của cây con rồi mới đếm.
    const timer = setTimeout(() => {
      if (claimCount.current === 0) {
        console.warn(
          `[WorkspaceTabs] Tab "${activeTab}" không render <WorkspaceHeader/> nên hàng tab cấp 2 không hiện ra. ` +
            'Thêm <WorkspaceHeader/> vào đầu trang con.'
        )
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [activeTab])

  return (
    <WorkspaceTabsContext.Provider
      value={{ tabs, activeTab, setActiveTab, claim, actionSlot, setActionSlot }}
    >
      {children}
    </WorkspaceTabsContext.Provider>
  )
}

/** `null` khi trang không có tab cấp 2 — `WorkspaceHeader` khi đó chỉ hiện tiêu đề. */
export function useWorkspaceTabs() {
  return useContext(WorkspaceTabsContext)
}

/**
 * Nút hành động chính của một tab, hiện lên trong card header thay vì trôi xuống dưới.
 *
 * Cần đến cổng (portal) vì tab con là ANH EM của `WorkspaceHeader`, không phải con của
 * nó: mỗi tab tự giữ state của hộp thoại mà nút mở ra, nên nâng nút lên trang cha sẽ
 * kéo theo cả đống state đi cùng. Bọc nút bằng component này thì tab giữ nguyên state,
 * chỉ chỗ hiển thị là đổi.
 *
 * Ngoài phạm vi provider (trang không có tab cấp 2) thì nút hiện tại chỗ như thường,
 * nên dùng nhầm cũng không mất nút.
 */
export function WorkspaceHeaderActions({ children }: { children: ReactNode }) {
  const ctx = useWorkspaceTabs()
  if (!ctx) return <>{children}</>
  return ctx.actionSlot ? createPortal(children, ctx.actionSlot) : null
}
