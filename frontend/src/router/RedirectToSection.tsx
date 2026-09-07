import { Navigate, useLocation } from 'react-router-dom'

/**
 * Chuyển một route cũ về mục tương ứng trong trang thiết lập gộp, GIỮ NGUYÊN các query
 * param đang có.
 *
 * `<Navigate to="...">` với chuỗi cố định sẽ nuốt mất query, làm chết những link mang
 * tham số như `/bsc/dashboard?scorecard=…`.
 */
export default function RedirectToSection({
  to,
  params,
}: {
  /** Đường dẫn đích, ví dụ `/settings/tools`. */
  to: string
  /** Param cần đặt thêm, ví dụ `{ section: 'kpi-cycles', tab: 'periods' }`. */
  params: Record<string, string>
}) {
  const { search } = useLocation()
  const merged = new URLSearchParams(search)
  Object.entries(params).forEach(([k, v]) => merged.set(k, v))
  return <Navigate to={`${to}?${merged.toString()}`} replace />
}
