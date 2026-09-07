import { useCallback, useState } from 'react'

export type ChartTableView = 'chart' | 'table'

const STORAGE_PREFIX = 'analytics-view:'

/**
 * Ghi nhớ người dùng muốn xem widget này dạng biểu đồ hay dạng bảng.
 *
 * <p>Biểu đồ trả lời "tình hình thế nào" trong một cái liếc; bảng trả lời "con số chính xác là bao
 * nhiêu". Cả hai đều cần, nên thay vì bỏ bảng đi thì để biểu đồ làm mặc định và giữ bảng sau một
 * cú bấm — bảng vẫn nguyên sort/lọc/phân trang phía server đã có.
 *
 * <p>Lựa chọn lưu theo từng widget trong localStorage: người hay đối chiếu số sẽ không phải bấm
 * lại mỗi lần mở trang. Bọc try/catch vì trình duyệt chặn site data sẽ ném ngay ở bước đọc.
 */
export function useChartTableView(widgetId: string, initial: ChartTableView = 'chart') {
  const key = STORAGE_PREFIX + widgetId

  const [view, setViewState] = useState<ChartTableView>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === 'chart' || saved === 'table' ? saved : initial
    } catch {
      return initial
    }
  })

  const setView = useCallback((next: ChartTableView) => {
    setViewState(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      /* không lưu được thì thôi — chỉ mất tiện lợi, không ảnh hưởng hiển thị */
    }
  }, [key])

  return { view, setView, isChart: view === 'chart' }
}
