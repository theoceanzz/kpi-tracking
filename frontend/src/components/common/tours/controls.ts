import { createContext } from 'react'

/**
 * Điều khiển bài đang chạy, do `TourHost` cấp. Tooltip KHÔNG dùng `primaryProps`/`backProps` của
 * Joyride: chuyển bước ở app phải chạy `prepare` và chờ neo trước, nên nút nào cũng đi qua host.
 * Context đi xuyên được portal của Joyride vì React giữ cây context qua `createPortal`.
 */
export interface TourControls {
  index: number
  total: number
  busy: boolean
  next: () => void
  prev: () => void
  close: () => void
  /** Tên bài kế tiếp nếu bài đang chạy có `next` — bước cuối hiện "Tiếp: <tên>". */
  nextTourTitle?: string
}

export const TourControlsContext = createContext<TourControls | null>(null)

/**
 * Dưới mốc này hộp hướng dẫn thôi bám theo neo mà ghim thành dải ở mép trên/dưới màn hình. Màn
 * điện thoại không đủ chỗ đặt hộp 360px cạnh neo, và header của vài trang tự tràn ngang ở khổ này
 * nên floating-ui không ghìm nổi hộp vào khung nhìn — đo được hộp lòi ra mép phải 60px.
 */
export const TOUR_NARROW_QUERY = '(max-width: 639px)'
