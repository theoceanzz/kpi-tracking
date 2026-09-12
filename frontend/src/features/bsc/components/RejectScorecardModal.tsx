import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface RejectScorecardModalProps {
  open: boolean
  onClose: () => void
  /** Tên thẻ đang trả lại — để người duyệt chắc chắn mình đang trả đúng thẻ. */
  scorecardName: string
  pending: boolean
  onSubmit: (reason: string) => void
}

/**
 * Nhập lý do trả lại một bộ tiêu chí đang chờ duyệt.
 *
 * <p>Trước đây dùng `window.prompt`: hộp thoại của trình duyệt không theo theme (luôn sáng, lệch hẳn
 * ở dark mode), không đặt được nhãn dài, và chỉ cho một dòng — trong khi lý do trả lại là thứ đơn vị
 * đọc để biết phải sửa gì nên thường vài câu.
 */
export default function RejectScorecardModal({
  open, onClose, scorecardName, pending, onSubmit,
}: RejectScorecardModalProps) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      dismissible={!pending}
      title="Trả lại để sửa"
      description={<span className="block truncate" title={scorecardName}>{scorecardName}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={pending}>Huỷ</Button>}
          primary={
            <Button variant="destructive" onClick={() => trimmed && onSubmit(trimmed)} disabled={!trimmed || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Trả lại
            </Button>
          }
        />
      }
    >
      <div className="space-y-1.5">
        <label htmlFor="reject-scorecard-reason" className="text-label block">
          Lý do trả lại <span className="text-[var(--color-error)]">*</span>
        </label>
        <textarea
          id="reject-scorecard-reason"
          autoFocus
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="Đơn vị cần biết phải sửa gì: hạng mục nào thiếu, chỉ tiêu nào chưa hợp lý..."
          className="w-full resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
        <p className="text-caption">
          Thẻ quay về trạng thái <b className="font-medium text-[var(--color-foreground)]">Nháp</b> để đơn vị sửa rồi trình lại.
        </p>
      </div>
    </Dialog>
  )
}
