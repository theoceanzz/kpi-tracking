import { ListChecks } from 'lucide-react'

/**
 * Lấp phần trống dưới bảng chi tiết trong ô widget cao cố định.
 * Luôn `flex-1 min-h-0` để giãn kín phần dư của vùng cuộn; khi dữ liệu tràn thì co về 0
 * (không thêm thanh cuộn thừa). Truyền `message` (chỉ khi ít dòng) để hiện minh hoạ nhẹ.
 */
export function SparseTableFiller({ message }: { message?: string | null }) {
  if (!message) return <div className="flex-1 min-h-0" aria-hidden />
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 py-8 text-slate-300 dark:text-slate-600 select-none pointer-events-none">
      <ListChecks className="w-9 h-9 opacity-40" strokeWidth={1.5} />
      <p className="text-xs font-semibold">{message}</p>
    </div>
  )
}
