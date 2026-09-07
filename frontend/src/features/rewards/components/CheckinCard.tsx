import { CalendarCheck, Check, Flame, Gift, Loader2 } from 'lucide-react'
import { useCheckin, useMyCheckinStatus } from '../hooks/useCheckin'
import type { CheckinDay, CheckinStatus } from '../types'

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Ngày trần 'yyyy-MM-dd' — tách tay thay vì new Date() để không bị lệch múi giờ. */
const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAY[new Date(y!, m! - 1, d!).getDay()]
}
const dayOfMonth = (iso: string) => Number(iso.split('-')[2])

/**
 * Một ô trong dải lịch. Ba trạng thái phải phân biệt được ngay: đã điểm danh, ngày nghỉ,
 * và bỏ lỡ. Gộp hai cái sau lại thì nhân viên tưởng mình đã làm đứt chuỗi vào cuối tuần.
 */
function DayDot({ day, isToday }: { day: CheckinDay; isToday: boolean }) {
  const base =
    'flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition-colors'
  const cls = day.checkedIn
    ? 'border-transparent bg-emerald-500 text-white'
    : day.restDay
      ? 'border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)]/50'
      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">
        {weekdayOf(day.date)}
      </span>
      <div
        className={`${base} ${cls} ${isToday ? 'ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-card)]' : ''}`}
        title={
          day.checkedIn
            ? `Đã điểm danh, +${day.points} điểm`
            : day.restDay
              ? 'Ngày nghỉ — không tính vào chuỗi'
              : 'Không điểm danh'
        }
      >
        {day.checkedIn ? <Check size={15} strokeWidth={3} /> : dayOfMonth(day.date)}
      </div>
    </div>
  )
}

/** Dải mốc thưởng của chu kỳ hiện tại: mốc nào đã qua, mốc nào sắp tới. */
function StreakBonusStrip({ status }: { status: CheckinStatus }) {
  if (status.streakBonuses.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status.streakBonuses.map((b) => {
        // Mốc coi như đã đạt khi chuỗi trong chu kỳ đã đi qua nó VÀ hôm nay đã điểm danh —
        // chưa bấm thì streakDay mới chỉ là con số sắp đạt, tô sáng sẽ là hứa trước.
        const reached = status.checkedInToday && status.streakDay >= b.day
        return (
          <span
            key={b.day}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              reached
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
            }`}
          >
            <Gift size={12} />
            Ngày {b.day}: +{b.points}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Thẻ điểm danh hàng ngày. Tự ẩn khi tổ chức chưa bật tính năng — không hiện khối rỗng
 * hay dòng "đang tắt" cho nhân viên, vì đó là chuyện họ không làm gì được.
 */
export default function CheckinCard() {
  const { data: status, isLoading } = useMyCheckinStatus()
  const { mutate: checkin, isPending } = useCheckin()

  if (isLoading) {
    return <div className="h-36 animate-pulse rounded-3xl bg-[var(--color-muted)]" />
  }
  if (!status?.enabled) return null

  // Vị trí trong chu kỳ chỉ đúng với ngày ĐÃ bấm. Chưa bấm thì streakDay là vị trí của
  // lần sắp tới, hiện ra cạnh con số chuỗi đã đạt sẽ thành hai số vênh nhau.
  const cycleLabel =
    status.checkedInToday && status.streakCycleDays
      ? `chu kỳ ${status.streakDay}/${status.streakCycleDays}`
      : null

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
            <CalendarCheck size={14} />
            Điểm danh hàng ngày
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-2xl font-black tracking-tight">
              <Flame
                size={22}
                className={status.streakLength > 0 ? 'text-orange-500' : 'text-[var(--color-muted-foreground)]'}
              />
              {status.streakLength} ngày
            </span>
            {cycleLabel && (
              <span className="text-sm text-[var(--color-muted-foreground)]">{cycleLabel}</span>
            )}
          </div>

          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {status.checkedInToday
              ? `Hôm nay bạn đã nhận ${status.todayPoints} điểm. Tháng này: ${status.pointsThisMonth} điểm.`
              : status.canCheckin
                ? `Điểm danh hôm nay để lên chuỗi ${status.nextStreakLength} ngày.`
                : (status.blockedReason ??
                  `Điểm danh mỗi ngày làm việc để nhận ${status.pointsPerDay} điểm và giữ chuỗi.`)}
          </p>
        </div>

        {/* Nút nêu thẳng con số sắp nhận. "Điểm danh" trơ trọi thì nhân viên phải bấm
            mới biết được bao nhiêu, mà mốc thưởng chuỗi lại làm con số đó thay đổi. */}
        <button
          onClick={() => checkin()}
          disabled={!status.canCheckin || isPending}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : status.checkedInToday ? (
            <Check size={16} strokeWidth={3} />
          ) : (
            <CalendarCheck size={16} />
          )}
          {status.checkedInToday
            ? 'Đã điểm danh'
            : status.canCheckin
              ? `Điểm danh +${status.nextPoints}`
              : 'Điểm danh'}
        </button>
      </div>

      {/* Chỉ báo trước phần thưởng mốc khi nó thực sự sắp rơi vào lần bấm này. */}
      {status.canCheckin && (status.nextBonusPoints ?? 0) > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <Gift size={14} />
          Điểm danh hôm nay chạm mốc ngày {status.streakDay} — thưởng thêm {status.nextBonusPoints} điểm!
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {status.recentDays.map((d) => (
          <DayDot key={d.date} day={d} isToday={d.date === status.today} />
        ))}
      </div>

      {status.streakBonuses.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <StreakBonusStrip status={status} />
        </div>
      )}
    </div>
  )
}
