import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, CalendarCheck, Flame, X } from 'lucide-react'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useMyCheckinStatus } from '../hooks/useCheckin'
import { Button } from '@/components/ui/button'

/**
 * Ngày đã tắt nhắc, theo giờ Việt Nam (khớp với `today` backend trả về). Lưu NGÀY chứ
 * không lưu cờ true/false: cờ thì tắt một lần là im mãi mãi, còn ở đây sang ngày mới
 * giá trị cũ tự hết khớp và nhắc lại — đúng ý "chỉ tắt khi bấm x", cho hôm nay thôi.
 */
const STORAGE_KEY = 'checkinReminderDismissedOn'

const readDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư, cookie bị khoá). Coi như chưa tắt
    // còn hơn để cả banner chết vì một API lưu trữ không thiết yếu.
    return null
  }
}

/**
 * Banner nhắc điểm danh, nằm ngay dưới thanh tiêu đề ở MỌI trang.
 *
 * <p>Tự ẩn hoàn toàn khi tổ chức chưa bật điểm thưởng/điểm danh, khi đã điểm danh, và
 * vào ngày nghỉ — tất cả gói trong cờ `canCheckin` do backend tính, nên luật chuỗi và
 * luật cuối tuần không bị chép lại ở đây.
 */
export default function CheckinReminderBanner() {
  const { hasPermission } = useHasPermission()
  const location = useLocation()
  const [dismissedOn, setDismissedOn] = useState(readDismissed)

  const { data: status } = useMyCheckinStatus(hasPermission('REWARD:VIEW_MY'))

  // canCheckin đã gộp: tính năng đang bật, chưa điểm danh, và hôm nay không phải ngày nghỉ.
  if (!status?.canCheckin) return null
  if (dismissedOn === status.today) return null
  // Đang đứng ở đúng trang có nút điểm danh thì banner chỉ là tiếng ồn.
  if (location.pathname === '/me' && location.search.includes('section=my-rewards')) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, status.today)
    } catch {
      // Không lưu được thì banner sẽ hiện lại ở lần tải trang sau. Chấp nhận được;
      // ném lỗi ở đây sẽ làm hỏng cả lượt bấm x.
    }
    setDismissedOn(status.today)
  }

  const streak = status.streakLength ?? 0

  return (
    <div className="border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]">
      <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
          <CalendarCheck size={17} />
        </span>

        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Bạn chưa điểm danh hôm nay</span>
          <span className="text-[var(--color-muted-foreground)]">
            {' — '}
            {/* Nói con số cụ thể chứ không nói "nhận điểm": mốc thưởng chuỗi làm số này
                đổi từng ngày, và một ngày +110 đáng để người ta dừng lại bấm. */}
            điểm danh ngay để nhận <strong className="text-[var(--color-foreground)]">
              +{status.nextPoints} điểm
            </strong>
            {streak > 0 && (
              <>
                {' '}và giữ chuỗi{' '}
                <strong className="inline-flex items-center gap-0.5 text-[var(--color-foreground)]">
                  <Flame size={13} className="text-[var(--color-warning)]" />
                  {streak} ngày
                </strong>
              </>
            )}
            .
          </span>
        </p>

        <Link
          to="/me?section=my-rewards"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-control bg-[var(--color-warning-solid)] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {/* Nhãn rút gọn ở mobile — chữ đầy đủ sẽ đẩy nút x ra khỏi màn hình hẹp. */}
          <span className="hidden sm:inline">Điểm danh ngay</span>
          <span className="sm:hidden">Điểm danh</span>
          <ArrowRight size={14} />
        </Link>

        <Button variant="ghost" size="icon-sm" aria-label="Ẩn nhắc nhở hôm nay" onClick={dismiss} title="Ẩn nhắc nhở hôm nay">
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
