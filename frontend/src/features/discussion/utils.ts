import { format, isSameDay } from 'date-fns'
import { formatDateTime } from '@/i18n/format'
import type { DiscussionReactionType } from './types'

export const REACTIONS: { type: DiscussionReactionType; emoji: string }[] = [
  { type: 'LIKE', emoji: '👍' },
  { type: 'AGREE', emoji: '🤝' },
  { type: 'LOVE', emoji: '❤️' },
  { type: 'CHECK', emoji: '✅' },
  { type: 'QUESTION', emoji: '❓' },
]

/** Giờ đăng bình luận: trong ngày chỉ hiện giờ ("10:04"), ngày khác hiện cả ngày theo ngôn ngữ đang chọn. */
export function commentTime(iso: string) {
  const d = new Date(iso)
  return isSameDay(d, new Date()) ? format(d, 'HH:mm') : formatDateTime(d)
}
