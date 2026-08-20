import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'

/**
 * Chốt an toàn cho việc "mọi khối đều là widget": người dùng có quyền ẩn cả khối cảnh báo,
 * nên chip này nằm NGOÀI lưới và không gỡ được. Nó chỉ xuất hiện khi thực sự có việc khẩn,
 * để không trở thành nhiễu thị giác thường trực.
 *
 * `count` luôn đến từ `useScopedAlerts` — một nguồn duy nhất cho cả ba vai trò, đã giới hạn
 * đúng phạm vi dữ liệu của người đang đăng nhập.
 */
export function UrgentWorkChip({ count, to }: { count: number; to: string }) {
  if (count <= 0) return null

  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-black text-xs hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors"
    >
      <Flame size={15} aria-hidden="true" />
      {/* Câu đầy đủ để trình đọc màn hình không chỉ đọc mỗi con số */}
      <span>{count} việc khẩn cần xử lý</span>
    </Link>
  )
}
