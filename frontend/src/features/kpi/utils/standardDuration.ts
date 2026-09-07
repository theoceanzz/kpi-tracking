import { addDays, addMonths, addYears, subDays } from 'date-fns'
import type { KpiFrequency } from '@/types/kpi'

/** Loại kỳ: Tháng / Quý / 6 Tháng / Năm — mẫu gợi ý, thời gian vẫn chỉnh tự do. */
export const CYCLE_TYPES: KpiFrequency[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY']

/**
 * Ngày kết thúc chuẩn của một KỲ.
 *
 * Kỳ chỉ nhận chu kỳ từ tháng trở lên (xem {@link CYCLE_TYPES}), nên mọi giá trị khác rơi về
 * mặc định một tháng.
 */
export function cycleStandardEnd(start: Date, type: KpiFrequency): Date {
  let end: Date
  switch (type) {
    case 'QUARTERLY': end = subDays(addMonths(start, 3), 1); break
    case 'SEMI_ANNUALLY': end = subDays(addMonths(start, 6), 1); break
    case 'YEARLY': end = subDays(addYears(start, 1), 1); break
    case 'MONTHLY':
    default: end = subDays(addMonths(start, 1), 1)
  }
  end.setHours(23, 59, 59, 999)
  return end
}

/**
 * Ngày kết thúc chuẩn của một ĐỢT.
 *
 * Khác {@link cycleStandardEnd} ở chỗ đợt nhận thêm chu kỳ NGÀY và TUẦN. Hai hàm cố ý tách riêng
 * thay vì gộp một: gộp lại thì một thay đổi cho đợt sẽ âm thầm đổi luôn luật của kỳ.
 */
export function periodStandardEnd(start: Date, type: KpiFrequency): Date {
  let end: Date
  switch (type) {
    case 'DAILY':
      end = new Date(start)
      break
    case 'WEEKLY':
      end = addDays(start, 6)
      break
    case 'MONTHLY':
      end = subDays(addMonths(start, 1), 1)
      break
    case 'QUARTERLY':
      end = subDays(addMonths(start, 3), 1)
      break
    case 'SEMI_ANNUALLY':
      end = subDays(addMonths(start, 6), 1)
      break
    case 'YEARLY':
      end = subDays(addYears(start, 1), 1)
      break
    default:
      end = new Date(start)
  }
  end.setHours(23, 59, 59, 999)
  return end
}
