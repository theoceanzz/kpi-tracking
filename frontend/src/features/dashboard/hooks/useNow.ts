import { useState } from 'react'

/**
 * Mốc thời gian "bây giờ" cố định trong suốt vòng đời của component.
 *
 * Gọi thẳng `Date.now()` trong thân render (kể cả trong `useMemo`) là hàm không thuần: mỗi lần
 * React render lại sẽ ra kết quả khác, nên "còn 3 ngày" có thể tự đổi thành "còn 2 ngày" giữa
 * hai lần render không liên quan. Lấy một lần qua khởi tạo lười của useState để mọi phép tính
 * hạn/quá hạn trên cùng một màn hình đều dựa trên cùng một mốc.
 */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}
