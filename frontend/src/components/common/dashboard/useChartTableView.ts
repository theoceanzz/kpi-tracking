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
 *
 * <p><b>Hai nguồn, một thứ tự ưu tiên.</b> Widget nằm trên lưới lưu lựa chọn này vào bố cục
 * (`WidgetSettings.table`) nên nó theo tài khoản sang máy khác; truyền vào qua `controlled` và giá
 * trị đó THẮNG. Nhưng cùng component còn được vẽ ở những chỗ không có bố cục để lưu (thẻ trên
 * trang chủ, tab không dùng lưới), nên localStorage vẫn phải sống làm đường lui — bỏ nó đi là hai
 * chỗ kia mất luôn khả năng nhớ lựa chọn.
 */
export function useChartTableView(
  widgetId: string,
  initial: ChartTableView = 'chart',
  controlled?: { value?: ChartTableView; onChange?: (v: ChartTableView) => void },
) {
  const key = STORAGE_PREFIX + widgetId
  const onChange = controlled?.onChange

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
    // Vẫn ghi localStorage kể cả khi đang bị điều khiển: cùng biểu đồ đó ở trang chủ không có
    // bố cục riêng, nó chỉ có mỗi đường này để nhớ.
    try {
      localStorage.setItem(key, next)
    } catch {
      /* không lưu được thì thôi — chỉ mất tiện lợi, không ảnh hưởng hiển thị */
    }
    onChange?.(next)
  }, [key, onChange])

  const effective = controlled?.value ?? view
  return { view: effective, setView, isChart: effective === 'chart' }
}
