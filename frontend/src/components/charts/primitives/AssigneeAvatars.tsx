import { useState } from 'react'

export interface AssigneeBrief {
  userId: string
  fullName: string
  avatarUrl?: string | null
}

/** Tối đa bao nhiêu avatar trước khi gộp phần còn lại thành `+N`. */
const MAX_AVATARS = 4

/**
 * Avatar một người. Ảnh là URL ngoài (Cloudinary) nên có thể hỏng bất cứ lúc nào — kiểm
 * `avatarUrl != null` là chưa đủ, phải bắt cả `onError` rồi rơi về vòng tròn chữ cái đầu, nếu
 * không sẽ để lại một ô ảnh vỡ giữa tooltip.
 */
export function AssigneeAvatar({ name, url }: { name: string; url?: string | null }) {
  const [broken, setBroken] = useState(false)
  const base = 'w-[22px] h-[22px] rounded-full border-2 border-white dark:border-slate-900 shrink-0'
  if (!url || broken) {
    return (
      <span
        title={name}
        className={`${base} bg-slate-200 dark:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-200 flex items-center justify-center`}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    )
  }
  return <img src={url} alt="" title={name} onError={() => setBroken(true)} className={`${base} object-cover`} />
}

/**
 * Dãy avatar chồng nhau cho tooltip biểu đồ.
 *
 * <p>Từ hai người trở lên chỉ còn avatar: liệt kê tên sẽ làm tooltip cao quá, che mất chính biểu
 * đồ ở dưới. Trỏ chuột vào từng avatar vẫn xem được tên.
 */
export function AssigneeAvatars({ people, label = 'Đảm nhiệm:' }: {
  people: AssigneeBrief[]
  label?: string
}) {
  if (people.length === 0) return null
  return (
    <div className="flex items-center gap-2 pt-2.5 mt-2.5 border-t border-[var(--color-border)]">
      <span className="text-xs text-[var(--color-muted-foreground)] font-medium shrink-0">{label}</span>
      <span className="flex items-center">
        {people.slice(0, MAX_AVATARS).map((p, i) => (
          <span key={p.userId} className={i === 0 ? '' : '-ml-1.5'}>
            <AssigneeAvatar name={p.fullName} url={p.avatarUrl} />
          </span>
        ))}
        {people.length > MAX_AVATARS && (
          <span className="ml-1.5 text-xs font-bold text-[var(--color-muted-foreground)] tabular-nums">
            +{people.length - MAX_AVATARS}
          </span>
        )}
      </span>
      {people.length === 1 && (
        <span className="text-xs font-bold text-[var(--color-foreground)] truncate">
          {people[0]!.fullName}
        </span>
      )}
    </div>
  )
}

export default AssigneeAvatars
