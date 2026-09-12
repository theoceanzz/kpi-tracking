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
        'text-eyebrow group flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-6 text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary-soft)]',
        '',
        className,
      )}
    >
      <Workflow size={16} />
      Thiết lập nhanh
    </Link>
  )
}
