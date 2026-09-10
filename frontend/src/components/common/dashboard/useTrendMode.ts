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
export function useTrendMode(chartId: string, initial: TrendMode = 'trend') {
  const key = STORAGE_PREFIX + chartId

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
    try {
      localStorage.setItem(key, next)
    } catch {
      /* không lưu được thì thôi — chỉ mất tiện lợi, không ảnh hưởng hiển thị */
    }
  }, [key])

  return { mode, setMode, isShare: mode === 'share' }
}
