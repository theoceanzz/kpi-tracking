import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_COLOR, FORM_COLORS, FORM_ICONS } from '../model/icons'

/** Ô tròn màu kèm icon trắng của một đơn (như danh sách đơn của Lark). */
export default function FormIcon({ icon, color, size = 'md', className }: {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = FORM_ICONS[icon] ?? FileText
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const glyph = size === 'sm' ? 16 : size === 'lg' ? 26 : 20
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-white', box, className)}
      style={{ backgroundColor: FORM_COLORS[color] ?? FORM_COLORS[DEFAULT_COLOR] }}
    >
      <Icon size={glyph} strokeWidth={2.2} />
    </span>
  )
}
