import { formatDistanceToNow } from 'date-fns'
import { dateFnsLocale } from '@/i18n/format'
import type { DiscussionReactionType } from './types'

export const REACTIONS: { type: DiscussionReactionType; emoji: string }[] = [
  { type: 'LIKE', emoji: '👍' },
  { type: 'AGREE', emoji: '🤝' },
  { type: 'LOVE', emoji: '❤️' },
  { type: 'CHECK', emoji: '✅' },
  { type: 'QUESTION', emoji: '❓' },
]

/** "5 phút trước" theo ngôn ngữ đang chọn. */
export function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: dateFnsLocale() })
}
