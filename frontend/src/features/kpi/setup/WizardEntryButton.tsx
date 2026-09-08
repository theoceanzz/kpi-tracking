import { Link } from 'react-router-dom'
import { Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Lối vào trình thiết lập từ các trang quản lý.
 *
 * Đặt cạnh nút "Tạo mới" chứ không thay nó: trang quản lý vẫn là nơi sửa/xoá/lọc/import, và tạo
 * lẻ một bản ghi bằng modal ở đây vẫn nhanh hơn đi qua bốn bước. Nút này dành cho lần thiết lập
 * đầu, khi người dùng cần được dẫn từ kỳ tới lúc gửi duyệt.
 */
export default function WizardEntryButton({ className }: { className?: string }) {
  return (
    <Link
      to="/kpi-setup"
      className={cn(
        'group flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[20px] border border-indigo-200 bg-white px-6 text-[11px] font-black uppercase tracking-widest text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95',
        'dark:border-indigo-900/60 dark:bg-slate-900 dark:text-indigo-400 dark:hover:bg-indigo-900/20',
        className,
      )}
    >
      <Workflow size={16} />
      Thiết lập nhanh
    </Link>
  )
}
