import { useCallback, useState } from 'react'

export type TrendMode = 'trend' | 'share'

const STORAGE_PREFIX = 'analytics-trend-mode:'

/**
 * Ghi nhớ người dùng muốn đọc biểu đồ xu hướng theo *mức độ* hay theo *cơ cấu*.
 *
 * <p>Hai chế độ trả lời hai câu khác nhau và đều cần: `trend` cho biết con số đi lên hay đi xuống,
 * còn `share` (100% stacked) cho biết tỉ trọng giữa các thành phần dịch chuyển ra sao. Một kỳ ít
 * việc mà toàn tồn đọng vẫn là vấn đề, nhưng ở biểu đồ tuyệt đối nó trông nhỏ xíu — chỉ chế độ cơ
 * cấu mới làm nó nổi lên.
 *
 * <p>Lựa chọn lưu theo từng biểu đồ trong localStorage, cùng quy ước với {@link useChartTableView}.
 * Bọc try/catch vì trình duyệt chặn site data sẽ ném ngay ở bước đọc.
 */
export function useTrendMode(
  chartId: string,
  initial: TrendMode = 'trend',
  /** Do bố cục lưới điều khiển (cài đặt của ô THẮNG); bỏ trống thì tự nhớ bằng localStorage. */
  controlled?: { value?: TrendMode; onChange?: (m: TrendMode) => void },
) {
  const key = STORAGE_PREFIX + chartId
  const onChange = controlled?.onChange

  const [mode, setModeState] = useState<TrendMode>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === 'trend' || saved === 'share' ? saved : initial
    } catch {
      return initial
    }
  })

  const setMode = useCallback((next: TrendMode) => {
    setModeState(next)
    // Vẫn ghi localStorage kể cả khi đang bị điều khiển: cùng biểu đồ ở trang chủ không có bố cục
    // riêng, nó chỉ có mỗi đường này để nhớ.
    try {
      localStorage.setItem(key, next)
    } catch {
      /* không lưu được thì thôi — chỉ mất tiện lợi, không ảnh hưởng hiển thị */
    }
    onChange?.(next)
  }, [key, onChange])

  const effective = controlled?.value ?? mode
  return { mode: effective, setMode, isShare: effective === 'share' }
}
