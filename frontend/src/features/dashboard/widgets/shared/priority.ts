import { Activity, Eye, Flame, type LucideIcon } from 'lucide-react'

/**
 * Ba mức ưu tiên dùng chung cho hai widget "việc cần xử lý": việc của chính mình
 * (`MyTodoWidget`) và nhân sự cần can thiệp (`TeamFocusWidget`).
 *
 * <p>Gom vào một chỗ để hai widget nói cùng một ngôn ngữ: cùng nhãn, cùng màu, cùng thứ tự.
 * Trước đây mỗi khối tự đặt tên mức độ riêng nên "cần gấp" ở chỗ này lại là "khẩn" ở chỗ kia.
 *
 * <p>Phần giao diện dùng chung nằm ở `PriorityParts.tsx` — tách ra để file này chỉ còn hằng số
 * và hàm thuần (yêu cầu của quy tắc fast-refresh: một file không vừa xuất component vừa xuất
 * hằng số).
 */
export type Priority = 'URGENT' | 'REVIEW' | 'MONITOR'

export const PRIORITY_ORDER: Record<Priority, number> = { URGENT: 0, REVIEW: 1, MONITOR: 2 }

export const PRIORITY_META: Record<Priority, {
  label: string
  hint: string
  icon: LucideIcon
  /** Chấm tròn trên thẻ bộ lọc. */
  dot: string
  /** Nhãn mức độ trên từng dòng. */
  chip: string
  /** Vạch màu bên trái dòng + thanh tiến độ. */
  bar: string
}> = {
  URGENT: {
    label: 'Cần gấp', hint: 'Xử lý ngay trong hôm nay', icon: Flame,
    dot: 'bg-red-500',
    chip: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
    bar: 'bg-red-500',
  },
  REVIEW: {
    label: 'Cần xem xét', hint: 'Nên xử lý trong tuần', icon: Eye,
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    bar: 'bg-amber-500',
  },
  MONITOR: {
    label: 'Theo dõi', hint: 'Chưa nghiêm trọng, cần quan sát', icon: Activity,
    dot: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
    bar: 'bg-sky-500',
  },
}

export type PriorityFilter = 'ALL' | Priority

export const countByPriority = (items: { priority: Priority }[]): Record<Priority, number> =>
  items.reduce(
    (acc, i) => { acc[i.priority] += 1; return acc },
    { URGENT: 0, REVIEW: 0, MONITOR: 0 } as Record<Priority, number>,
  )
