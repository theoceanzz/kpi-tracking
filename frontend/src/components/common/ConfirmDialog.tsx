import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
}

/**
 * Hộp xác nhận cho hành động không hoàn tác được — dùng khung `Dialog` chuẩn (size sm).
 * Nút xác nhận dùng màu phá huỷ để tách khỏi nút hành động chính thường ngày; đang xử lý
 * thì khoá Esc/bấm nền để không mất trạng thái.
 */
export default function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Xác nhận', loading }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      dismissible={!loading}
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-[var(--color-error-bg)]">
            <AlertTriangle className="text-[var(--color-error)]" size={15} aria-hidden="true" />
          </span>
          {title}
        </span>
      }
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>}
          primary={<Button variant="destructive" onClick={onConfirm} disabled={loading}>{loading ? 'Đang xử lý…' : confirmLabel}</Button>}
        />
      }
    >
      <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>
    </Dialog>
  )
}
