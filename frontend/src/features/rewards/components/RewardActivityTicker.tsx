import { useMemo, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Gift, Radio, Sparkles, Wallet, X } from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { cn, formatNumber } from '@/lib/utils'
import { useRewardActivityFeed } from '../hooks/useRewards'
import { RewardActivityType, type RewardActivity } from '../types'
import { Button } from '@/components/ui/button'

/** Giây để một thẻ tin đi hết chiều ngang. Nhân với số thẻ ra thời lượng cả vòng. */
const SECONDS_PER_ITEM = 6

/**
 * Số thẻ tối thiểu trong MỘT nửa track.
 *
 * <p>Vòng lặp chạy bằng {@code translateX(-50%)} nên track phải gồm hai nửa giống hệt nhau, và
 * mỗi nửa phải rộng hơn khung — nửa hẹp hơn khung thì mỗi vòng lộ ra một khoảng trống trôi qua.
 * Công ty mới có một hai hoạt động thì danh sách gốc quá ngắn, nên lặp nó lên cho đủ số thẻ này.
 *
 * <p>Con số CỐ ĐỊNH, cố ý không đo bề rộng thật rồi tính số bản cần lặp: cách đo phải giữ một
 * state, mà mỗi lần state đổi thì thời lượng animation đổi theo và hoạt ảnh khởi động lại từ
 * đầu — chỉ cần phép đo dao động giữa hai giá trị là dải tin đứng im tại chỗ trông như hỏng.
 * 12 thẻ phủ dư một màn hình rộng ở mọi cỡ thẻ thực tế, và đây chỉ là vài chục nút DOM tĩnh.
 */
const MIN_ITEMS_PER_HALF = 12

/**
 * Mốc thời gian của tin MỚI NHẤT lúc người dùng bấm x.
 *
 * <p>Lưu mốc chứ không lưu cờ true/false: cờ thì tắt một lần là dải tin im mãi mãi, kể cả khi
 * công ty có tin mới — mà cái hay của bảng tin là tin mới tự trôi tới. Có tin mới hơn mốc đã
 * tắt thì hiện lại; không có gì mới thì im, đúng ý "ấn x đi thì mới mất".
 */
const STORAGE_KEY = 'rewardTickerDismissedAt'

const readDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư, cookie bị khoá). Coi như chưa tắt
    // còn hơn để cả dải tin chết vì một API lưu trữ không thiết yếu.
    return null
  }
}

const isNewerThanDismissed = (occurredAt: string, dismissedAt: string | null) => {
  if (!dismissedAt) return true
  const a = Date.parse(occurredAt)
  const b = Date.parse(dismissedAt)
  // Mốc hỏng (người dùng sửa tay localStorage, đổi định dạng ngày) thì coi như chưa tắt.
  if (Number.isNaN(a) || Number.isNaN(b)) return true
  return a > b
}

type Look = {
  icon: typeof Sparkles
  /** Màu của huy hiệu và của con số — phần người xem liếc là thấy ngay chuyện gì vừa xảy ra. */
  accent: string
  badge: string
}

const LOOKS: Record<RewardActivityType, Look> = {
  [RewardActivityType.POINTS_AWARDED]: {
    icon: Sparkles,
    accent: 'text-[var(--color-warning)]',
    badge: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
  [RewardActivityType.BUDGET_GRANTED]: {
    icon: Wallet,
    accent: 'text-[var(--color-primary)]',
    badge: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  },
  [RewardActivityType.GIFT_REDEEMED]: {
    icon: Gift,
    accent: 'text-[var(--color-success)]',
    badge: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  },
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
          <span className={cn('font-semibold', accent)}>+{formatNumber(item.points, 0)} điểm</span>
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
          <span className={cn('font-semibold', accent)}>{formatNumber(item.points, 0)} điểm</span> để
          thưởng cho nhân viên
        </>
      )
    case RewardActivityType.GIFT_REDEEMED:
      return (
        <>
          {name} vừa đổi{' '}
          <span className={cn('font-semibold', accent)}>{item.giftName}</span> với{' '}
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
    // của track. Với `gap`, hai nửa của track không rộng bằng nhau (nửa đầu thiếu một
    // khoảng hở ở mối nối), nên translateX(-50%) lệch đi vài pixel mỗi vòng và dải tin
    // trôi dần khỏi vị trí.
    <li className="mr-3 flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] py-1 pl-1 pr-3.5 shadow-sm">
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', look.badge)}>
        <Icon size={13} />
      </span>
      <UserAvatar
        fullName={item.userName}
        avatarUrl={item.userAvatarUrl}
        className="h-6 w-6 rounded-full ring-2 ring-[var(--color-background)]"
        fallbackClassName="bg-[var(--color-muted)] text-caption"
      />
      <span className="whitespace-nowrap text-[13px] text-[var(--color-foreground)]">
        <Message item={item} />
      </span>
      <span className="whitespace-nowrap text-caption">
        {timeAgo(item.occurredAt)}
      </span>
    </li>
  )
}

/**
 * Dải tin điểm thưởng chạy ngang dưới thanh tiêu đề ở MỌI trang: ai vừa được thưởng, ai vừa
 * được cấp hạn mức, ai vừa đổi quà — cả công ty cùng thấy mà không phải mở tab nào.
 *
 * <p>Tự ẩn hoàn toàn khi chưa có tin nào (và khi API lỗi): một dải rỗng chạy suốt trên đầu mọi
 * trang chỉ tổ chiếm chỗ. Cũng không có khung chờ tải — đây không phải nội dung chính, nó hiện
 * ra khi có là đủ.
 *
 * <p>Chạy LIÊN TỤC, không có ngưỡng tối thiểu số tin: danh sách gốc được lặp cho đủ
 * {@link MIN_ITEMS_PER_HALF} thẻ mỗi nửa nên dù chỉ có một hai tin thì mối nối vẫn kín.
 *
 * <p><b>Cố ý KHÔNG nhường {@code prefers-reduced-motion}.</b> Bảng tin là thứ chạy để loan báo —
 * đứng yên thì nó chỉ còn là một dòng chữ chiếm chỗ trên đầu mọi trang, và bản thân việc "trôi
 * qua" là lý do tính năng tồn tại. Rất nhiều máy Windows tắt hiệu ứng chuyển động vì lý do hiệu
 * năng chứ không phải vì người dùng nhạy cảm với chuyển động, nên nhường thiết lập đó sẽ tắt tính
 * năng cho một nhóm lớn không hề cần được tắt. Lối thoát cho người thật sự khó chịu: trỏ chuột
 * vào là dừng ngay (xem {@code .reward-marquee-viewport:hover} ở index.css), và nút x tắt hẳn.
 */
export default function RewardActivityTicker() {
  const { hasPermission } = useHasPermission()
  const { data } = useRewardActivityFeed(30, hasPermission('REWARD:VIEW_MY'))
  const [dismissedAt, setDismissedAt] = useState(readDismissed)

  const items = useMemo(() => data ?? [], [data])

  /**
   * Nội dung của MỘT nửa track: danh sách gốc lặp lại cho đủ {@link MIN_ITEMS_PER_HALF} thẻ.
   *
   * <p>Chỉ là một phép tính thuần từ `items` — không state, không đo đạc, không effect. Nhờ vậy
   * số thẻ và thời lượng animation đứng yên suốt vòng đời component, và hoạt ảnh không bao giờ
   * bị khởi động lại giữa chừng.
   */
  const half = useMemo(() => {
    if (items.length === 0) return []
    const times = Math.ceil(MIN_ITEMS_PER_HALF / items.length)
    return Array.from({ length: times }, () => items).flat()
  }, [items])

  // Tin mới nhất đứng đầu danh sách — vừa là thứ quyết định có hiện dải tin nữa hay
  // không, vừa là mốc lưu lại khi bấm x. Lấy ra biến rồi kiểm tra để không phải chỉ mục
  // vào mảng ở ba chỗ khác nhau.
  const newest = items[0]
  if (!newest) return null
  if (!isNewerThanDismissed(newest.occurredAt, dismissedAt)) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, newest.occurredAt)
    } catch {
      // Không lưu được thì dải tin hiện lại ở lần tải trang sau. Chấp nhận được; ném lỗi
      // ở đây sẽ làm hỏng cả lượt bấm x.
    }
    setDismissedAt(newest.occurredAt)
  }

  return (
    <div className="reward-marquee-viewport flex items-center gap-2 border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] py-1.5 pl-4 pr-2 md:pl-6">
      {/* Nhãn ẩn ở màn hình hẹp: giữ lại thì dải tin chỉ còn một mẩu không đọc nổi. */}
      <span className="hidden flex-shrink-0 items-center gap-1.5 pr-1 sm:flex">
        <Radio size={13} className="text-[var(--color-warning)]" />
        <span className="text-eyebrow text-[var(--color-warning)]">
          Bảng tin thưởng
        </span>
      </span>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="animate-reward-marquee flex w-max items-center"
          style={
            {
              // Thời lượng theo số thẻ của MỘT nửa — đó đúng bằng quãng đường một vòng
              // chạy (-50%), nên tốc độ trôi không đổi dù bảng tin dài ngắn khác nhau.
              '--reward-marquee-duration': `${half.length * SECONDS_PER_ITEM}s`,
            } as React.CSSProperties
          }
        >
          <ul className="flex items-center">
            {half.map((item, index) => (
              // Bản lặp dùng lại đúng id, nên khoá phải kèm vị trí. `type` cũng phải có
              // vì id chỉ duy nhất trong từng loại nguồn.
              <TickerItem key={`${item.type}-${item.id}-${index}`} item={item} />
            ))}
          </ul>

          {/* Nửa thứ hai chỉ để vá mối nối của vòng lặp — trình đọc màn hình bỏ qua, nếu
              không nó sẽ đọc lại toàn bộ bảng tin lần thứ hai. */}
          <ul aria-hidden className="flex items-center">
            {half.map((item, index) => (
              <TickerItem key={`dup-${item.type}-${item.id}-${index}`} item={item} />
            ))}
          </ul>
        </div>

        {/* Làm mờ mép trái để dòng tin trôi vào thay vì bị cắt cụt ở rìa. Mép phải không
            cần vì nút x đã che sẵn chỗ đó. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--color-warning-bg)] to-transparent" />
      </div>

      <Button variant="ghost" size="icon-sm" aria-label="Ẩn bảng tin" onClick={dismiss} title="Ẩn bảng tin">
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
