import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Chỗ đứng của cụm "Tuỳ chỉnh / Lưu / Ẩn-Hiện / Thêm / Đặt lại" trên thanh tiêu đề của app.
 *
 * <p>Trang chủ trước đây có một thẻ header riêng ("Hệ thống Quản trị Hiệu suất", lời chào…)
 * và cụm nút nằm trong đó. Thẻ header đã bỏ, nên cụm nút chuyển lên thanh tiêu đề chung.
 * Thanh tiêu đề nằm trong `AppLayout`, còn trang chủ nằm dưới `<Outlet />` — hai bên không
 * gọi trực tiếp nhau được, nên dùng cổng DOM: layout đặt {@link DashboardToolbarSlot},
 * trang chủ bắn nội dung vào đó qua {@link DashboardToolbarPortal}.
 *
 * <p>Trang nào không phải trang chủ thì không bắn gì và ô này rộng 0 — không chiếm chỗ.
 */
export const DASHBOARD_TOOLBAR_SLOT_ID = 'dashboard-toolbar-slot'

export function DashboardToolbarSlot() {
  return (
    <div
      id={DASHBOARD_TOOLBAR_SLOT_ID}
      // min-w-0 + cuộn ngang: ở chế độ chỉnh sửa cụm nút dài hơn hẳn, trên màn hẹp nó phải
      // cuộn được thay vì đẩy chuông/đăng xuất ra khỏi màn hình.
      className="flex items-center min-w-0 overflow-x-auto custom-scrollbar"
    />
  )
}

export function DashboardToolbarPortal({ children }: { children: React.ReactNode }) {
  // Node của layout chỉ tồn tại sau khi commit, nên phải tra ở effect chứ không phải khi render:
  // lần render đầu của trang chủ chạy TRƯỚC khi header của AppLayout kịp vào DOM.
  // Đây đúng là ca "đọc trạng thái của một hệ thống bên ngoài" mà quy tắc dưới đây trừ ra,
  // và nó chỉ chạy một lần khi mount.
  const [node, setNode] = useState<HTMLElement | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNode(document.getElementById(DASHBOARD_TOOLBAR_SLOT_ID)) }, [])
  if (!node) return null
  return createPortal(children, node)
}
