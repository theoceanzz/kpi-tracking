import type { ReactNode } from 'react'
import { Eye, Info, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AiCriteriaSet } from '../api/aiReviewApi'

/**
 * Đơn vị đang áp tài liệu của cấp trên: nói rõ vì sao không tự thay được + xem tài liệu đó + chỗ đặt nút gửi đề
 * nghị (`children`). Dùng ở form tải lên, màn duyệt bản nháp và hộp nhân bản / áp lại.
 */
export default function UnitLockNotice({ current, onView, children }: {
  current: AiCriteriaSet
  onView: () => void
  children?: ReactNode
}) {
  return (
    <div role="alert" className="space-y-2 rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-sm">
      <p className="flex gap-2 text-[var(--color-foreground)]">
        <Lock size={15} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
        <span>{current.lockReason ?? `Đơn vị đang áp «${current.title}» do cấp trên áp dụng.`}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye aria-hidden="true" /> Xem tài liệu đang áp
        </Button>
        {children}
      </div>
    </div>
  )
}

/** Đơn vị đang áp tài liệu mình quản: xác nhận bản mới sẽ thay tài liệu đó. */
export function UnitReplaceNote({ current, unitLabel }: { current: AiCriteriaSet; unitLabel: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-[var(--color-muted-foreground)]">
      <Info size={13} className="mt-px shrink-0" aria-hidden="true" />
      <span>{unitLabel} đang áp «{current.title}». Xác nhận tài liệu mới sẽ thay tài liệu đó.</span>
    </p>
  )
}
