import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Gift, Radio, Sparkles, Wallet } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { cn, formatNumber } from '@/lib/utils'
import { useRewardActivityFeed } from '../hooks/useRewards'
import { RewardActivityType, type RewardActivity } from '../types'

/** Giây để một dòng tin đi hết chiều ngang. Nhân với số dòng ra thời lượng cả vòng. */
const SECONDS_PER_ITEM = 6

/**
 * Dưới ngưỡng này thì hai bản sao vẫn không phủ kín màn hình rộng, mối nối của vòng lặp
 * sẽ lộ ra thành một khoảng trống trôi qua. Ít tin thì thà đứng yên còn hơn chạy mà hở.
 */
const MIN_ITEMS_TO_SCROLL = 4

type Look = {
  icon: typeof Sparkles
  /** Màu của huy hiệu và của con số — phần người xem liếc là thấy ngay chuyện gì vừa xảy ra. */
  accent: string
  badge: string
}

const LOOKS: Record<RewardActivityType, Look> = {
  [RewardActivityType.POINTS_AWARDED]: {
    icon: Sparkles,
    accent: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  [RewardActivityType.BUDGET_GRANTED]: {
    icon: Wallet,
    accent: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  },
  [RewardActivityType.GIFT_REDEEMED]: {
    icon: Gift,
    accent: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
}

/** Người dùng đã tắt hiệu ứng chuyển động ở hệ điều hành. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: vi })
  } catch {
    return ''
  }
}

/**
 * Câu chữ của một dòng tin. Tên người luôn đứng ĐẦU câu — dải tin trôi qua rất nhanh,
 * người xem chỉ kịp bắt hai ba từ đầu, mà thứ họ tìm là "có phải tên mình không".
 */
function Message({ item }: { item: RewardActivity }) {
  const name = <span className="font-semibold text-[var(--color-foreground)]">{item.userName}</span>
  const accent = LOOKS[item.type].accent

  switch (item.type) {
    case RewardActivityType.POINTS_AWARDED:
      return (
        <>
          {name} vừa nhận{' '}
          <span className={cn('font-bold', accent)}>+{formatNumber(item.points, 0)} điểm</span>
          {item.actorName ? (
            <> từ {item.actorName}</>
          ) : (
            // Không có người trao nghĩa là chương trình tự động phát — nói rõ ra, để
            // trống thì người xem tưởng dữ liệu bị thiếu.
            <> từ chương trình thưởng tự động</>
          )}
          {item.note && <span className="text-[var(--color-muted-foreground)]"> · {item.note}</span>}
        </>
      )
    case RewardActivityType.BUDGET_GRANTED:
      return (
        <>
          {name} được cấp hạn mức{' '}
          <span className={cn('font-bold', accent)}>{formatNumber(item.points, 0)} điểm</span> để
          thưởng cho nhân viên
        </>
      )
    case RewardActivityType.GIFT_REDEEMED:
      return (
        <>
          {name} vừa đổi{' '}
          <span className={cn('font-bold', accent)}>{item.giftName}</span> với{' '}
          {formatNumber(item.points, 0)} điểm
        </>
      )
  }
}

function TickerItem({ item }: { item: RewardActivity }) {
  const look = LOOKS[item.type]
  const Icon = look.icon

  return (
    // Khoảng cách giữa các dòng tin nằm ở `mr-3` của chính từng dòng, KHÔNG dùng `gap`
    // của track. Với `gap`, hai bản sao trong track không rộng bằng nhau (bản đầu thiếu
    // một khoảng hở ở mối nối), nên translateX(-50%) lệch đi vài pixel mỗi vòng và dải
    // tin trôi dần khỏi vị trí.
    <li className="mr-3 flex shrink-0 items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] py-1.5 pl-1.5 pr-4 shadow-sm">
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', look.badge)}>
        <Icon size={15} />
      </span>
      <UserAvatar
        fullName={item.userName}
        avatarUrl={item.userAvatarUrl}
        className="h-7 w-7 rounded-full ring-2 ring-[var(--color-background)]"
        fallbackClassName="bg-[var(--color-muted)] text-[10px] font-bold text-[var(--color-muted-foreground)]"
      />
      <span className="whitespace-nowrap text-sm text-[var(--color-foreground)]">
        <Message item={item} />
      </span>
      <span className="whitespace-nowrap text-xs text-[var(--color-muted-foreground)]">
        {timeAgo(item.occurredAt)}
      </span>
    </li>
  )
}

/**
 * Dải tin điểm thưởng chạy ngang, kiểu bảng thông báo trong game: ai vừa được thưởng,
 * ai vừa được cấp hạn mức, ai vừa đổi quà — cả công ty cùng thấy mà không phải mở tab nào.
 *
 * <p>Tự ẩn khi chưa có tin nào (và khi API lỗi): một khung rỗng nằm trên đầu mọi trang
 * thưởng chỉ tổ chiếm chỗ. Cũng không có khung chờ tải, vì đây không phải nội dung chính
 * của trang — nó hiện ra khi có là đủ.
 */
export default function RewardActivityTicker({ className }: { className?: string }) {
  const { data } = useRewardActivityFeed()
  const reducedMotion = usePrefersReducedMotion()

  // Giữ tham chiếu ổn định giữa các lần render, nếu không `rendered` bên dưới sẽ dựng
  // lại mảng nhân đôi mỗi nhịp và dải tin bị vẽ lại từ đầu.
  const items = useMemo(() => data ?? [], [data])
  const scrolling = !reducedMotion && items.length >= MIN_ITEMS_TO_SCROLL

  // Chỉ nhân đôi khi thật sự chạy. Ở chế độ đứng yên, bản sao thứ hai là nội dung lặp
  // vô nghĩa mà trình đọc màn hình vẫn đọc lên.
  const rendered = useMemo(() => (scrolling ? [...items, ...items] : items), [items, scrolling])

  if (items.length === 0) return null

  return (
    <div
      className={cn(
        'reward-marquee-viewport relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-amber-500/5 via-violet-500/5 to-emerald-500/5 py-2.5',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 px-4">
        <Radio size={13} className="text-[var(--color-primary)]" />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Bảng tin điểm thưởng
        </span>
      </div>

      <div
        className={cn(
          'relative',
          // Không chạy thì phải cuộn được bằng tay, nếu không những tin phía sau sẽ
          // không có cách nào xem tới.
          scrolling ? 'overflow-hidden' : 'overflow-x-auto scrollbar-hide',
        )}
      >
        <ul
          className={cn(
            'flex w-max items-center',
            // Lề trái chỉ đặt khi ĐỨNG YÊN. Lúc chạy, mọi khoảng đệm trên track đều phá
            // vỡ tính đối xứng mà translateX(-50%) dựa vào.
            scrolling ? 'animate-reward-marquee' : 'pl-4',
          )}
          style={
            scrolling
              ? ({
                  '--reward-marquee-duration': `${items.length * SECONDS_PER_ITEM}s`,
                } as React.CSSProperties)
              : undefined
          }
        >
          {rendered.map((item, index) => (
            // Bản sao thứ hai dùng lại đúng id, nên khoá phải kèm vị trí. `type` cũng
            // phải có vì id chỉ duy nhất trong từng loại nguồn.
            <TickerItem key={`${item.type}-${item.id}-${index}`} item={item} />
          ))}
        </ul>

        {/* Làm mờ hai mép để dòng tin trôi ra/vào thay vì bị cắt cụt ở rìa khung. Chỉ phủ
            hàng tin — trùm cả nhãn "Bảng tin điểm thưởng" ở trên sẽ làm nhãn bạc màu.
            Chỉ khi đang chạy: trong khung cuộn tay, lớp phủ tuyệt đối trôi theo nội dung
            nên sẽ nằm giữa dải tin thay vì ở rìa. */}
        {scrolling && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--color-background)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--color-background)] to-transparent" />
          </>
        )}
      </div>
    </div>
  )
}
